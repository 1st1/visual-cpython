# Capture runtime

The implementation combines a revision-pinned CPython observation module, live opcode stepping, bounded inspection history, and a browser workbench with a generated program map and 3D scene.

Build recipes and commands are in [README.md](../../README.md). [[tools/build_native.py#build]] exports the pinned revision from the ignored reference checkout and adds [[runtime/probe.c]] as a static module in a disposable build. [[tools/build_wasm.py#build]] prepares a separate Emscripten build; [[tools/package_web.py#package]] stages generated browser assets.

## Build pipeline

Vite bundles the browser application around a checked-in CPython WASM runtime. Frontend development and Vercel builds need Node and npm only; CPython compilation is an explicit local maintenance step.

The browser artifacts live in [web/public/runtime](../../web/public/runtime): the generated loader, WASM binary, standard-library ZIP, capture driver, CPython license, and revision/hash manifest. [[tools/package_web.py#package]] refreshes this directory from local build outputs. These artifacts are committed alongside their build recipes; `.build/`, the reference checkout, dependencies, and `dist/` remain ignored.

[vite.config.mjs](../../vite.config.mjs) uses `web/` as its root and emits `dist/`. Vite bundles npm imports for Three.js, OrbitControls, and Graphviz, emits separate module workers, fingerprints frontend assets and example programs, and copies public runtime files unchanged. [tools/check_runtime.mjs](../../tools/check_runtime.mjs) verifies the runtime hash, pinned revision, and capture-driver freshness before development or production builds.

```sh
npm ci
npm run dev
# Production build and local preview:
npm run build
npm run preview
```

Both servers default to 127.0.0.1:8000 with a strict port; run only one there, or pass -- --port 8001. [vercel.json](../../vercel.json) selects Vite, npm run build, and dist. Runtime URLs revalidate rather than retaining stale files; hashed frontend assets use Vercel's normal asset caching. Deployment serves static files and needs no Python compiler, Emscripten SDK, CPython checkout, or server-side Python execution.

### Local runtime rebuild

Rebuild CPython only when its pinned revision, C observation module, parser instrumentation, or compiler configuration changes. The local reference checkout remains unchanged.

Prerequisites are Git, a C compiler, make, host Python 3.14+, Node 24, and a local `cpython/` Git checkout containing [runtime/revision.txt](../../runtime/revision.txt). [[tools/build_native.py#build]] exports the revision into `.build/native`, applies [[tools/instrument_parser.py#instrument]], and installs [[runtime/probe.c]] as a static module. It builds a debug interpreter with JIT and ensurepip disabled.

[[tools/build_wasm.py#build]] currently expects Emscripten SDK 6.0.10. It exports and instruments `.build/wasm-source`, then cross-compiles into `.build/wasm` using the native interpreter. The browser build disables JIT, pymalloc, and test modules, enables WASM dynamic linking, and caps linear memory at 256 MiB.

```sh
python3 tools/build_native.py
python3 cpython/Platforms/emscripten install-emscripten --emsdk-cache .build/emsdk
python3 tools/build_wasm.py
python3 tools/package_web.py
npm run check:runtime
npm run test:wasm
```

Commit the refreshed [web/public/runtime](../../web/public/runtime) files after validation. Changes only to [[runtime/capture.py]] need repackaging, not a C rebuild. Frontend edits use Vite development reloads and a production rebuild for deployment; npm dependency changes need npm ci and a frontend rebuild. Configure options apply only when a Makefile is absent; changing them requires fresh affected build directories. Revision mismatches require moving old build directories aside before rebuilding.

### Build validation

Runtime integrity, compilation, capture correctness, and production-browser behavior are separate checks. Browser tests accept XRAY_URL so the same suites can target Vite development or the built preview.

Run the native interpreter with `-m unittest discover -s tests -v` (`.build/native/python.exe` on this macOS build, or `.build/native/python` where applicable). npm run test:wasm checks the committed runtime; npm run test:graph additionally requires the local native interpreter. With Vite development or preview running, npm run test:browser, npm run test:xray, npm run test:parsing, and npm run test:memory exercise capture, rendering, parser replay, and resource bounds. Run lat check for documentation validation. Screenshots remain ignored under artifacts/.

## Observed instruction stacks

The native probe reads synchronized operand-stack entries during opcode tracing. It distinguishes ordinary object references, null call sentinels, and tagged integers without reconstructing values from bytecode effects.

[[runtime/probe.c#snapshot]] checks the frame and debug synchronization state and returns bottom-to-top entries. Its internal API is pinned to the source revision in [runtime/revision.txt](../../runtime/revision.txt). The generated evaluator synchronizes the stack before invoking instruction instrumentation; this is the basis for reading it from the callback, not permission to inspect an arbitrary running frame.

[[runtime/capture.py#Observer#trace]] sets opcode tracing on each target-frame event, retaining line callbacks to enable instruction instrumentation in this revision. The recording omits line events themselves. Browser execution emits each observed event immediately and suspends at opcode boundaries until the UI grants a permit. Each opcode snapshot describes state before that instruction executes. Call, return, exception, and unwind events carry locals and output but do not claim an opcode stack snapshot.

This is explicitly an instrumented observation mode. Opcode tracing pauses/adapts specialization behavior, so these captures cannot demonstrate undisturbed adaptive specialization or performance. A different hook strategy remains necessary for that later claim. The milestone is real observed state, not a complete implementation of the planned capture backend.

## Identity and bounded capture

Capture records distinct activations, reusable code identities, source positions, and bounded value previews. Limits prevent unlimited trace growth, while execution cancellation is managed outside the interpreter.

[[runtime/capture.py#Observer#value]] preserves alias identity using a bounded strong-reference registry. Exact builtin containers receive shallow, cycle-aware previews; arbitrary repr methods are not invoked. Retention changes object lifetime and is limited to a single recording. This is not a faithful reference-count/GC trace.

[[runtime/capture.py#capture]] accepts a small syntax/builtin surface and checks a 16 KiB source cap and 256 Python lexical tokens before execution. The token cap excludes whitespace, comments, and indentation. Sharing uses the same tokenizer in validation-only mode without parsing or executing the program. The native capture utility enforces event, object-identity, activation, and output limits. Browser live mode has no total event limit: completed frames are released, object identities use a bounded registry with monotonic IDs, and output retains its latest 4,096 characters. Evicted objects may receive new IDs if observed again; IDs are never reassigned to unrelated objects. Active/suspended activations remain capped at 256. Async functions, await, public attributes, and public standard-library imports are accepted. Third-party imports, relative imports, private attributes, classes, generators, and exception-handling syntax remain rejected. Module availability depends on the bundled WASM build; unsupported OS facilities can still fail at runtime. The source-size cap is independent of runtime cost.

[[runtime/capture.py#import_module]] delegates public standard-library imports to CPython, including time, math, json, and collections. It retains a browser-compatible facade for selected real asyncio APIs: run, sleep, gather, create_task, wait_for, current_task, get_running_loop, Task, Future, and CancelledError. On Emscripten, run uses a selector-loop subclass without the socketpair wakeup mechanism; the single worker supports cooperative tasks and timers, not socket or thread I/O. Native runs use the standard loop. Library frames remain opaque; user coroutine opcodes are observed normally.

[[runtime/capture.py#Observer#trace]] records coroutine yield and re-entry as suspend and resume, retaining the same frame identity across awaits. Replay updates the resumed frame's current caller, rather than treating suspension as completion or resumption as a new activation. Native, WASM, and Chrome tests exercise async sleep and output, with native/WASM assertions for stable suspension/resumption identity.

Recordings distinguish completed, error, and limited outcomes. Both stdout and stderr are captured in event snapshots and final results. Runtime diagnostics are appended to final stderr and displayed with stdout in the Inspector’s program output, rather than the floating UI error label. Compilation diagnostics instead open the source editor and mark the offending source location, including rejected AST constructs and imports. Editing clears stale diagnostics. Exceptions followed by frame termination are labeled unwind rather than a successful return of None. Syntax errors produce no execution events. [[tools/capture.py#run]] launches a fresh native subprocess and applies a parent-enforced timeout; it is a local development tool, not an untrusted-code sandbox.

## Browser workbench

The workbench compiles without executing, then advances the real interpreter at opcode boundaries. Source, instructions, locals, stack, and output follow live execution or retained history in [[graph]].

[web/worker.mjs](../../web/worker.mjs) loads the generated Emscripten runtime, standard-library archive, and capture driver. Each Compile or Run operation gets a new worker and interpreter. The worker writes source into its virtual filesystem. Compile returns artifacts; Run streams serializable events while the interpreter is still executing. The hosting server serves static files only.

[[tools/package_web.py#package]] publishes a content-hashed runtime manifest after staging the committed runtime, WASM binary, standard library, and capture driver. The worker fetches this manifest without caching and uses its build identifier on all four asset URLs, including Emscripten’s WASM lookup. Rebuilt parser probes therefore cannot silently reuse the previous build’s cached binary.

Live Run uses JSPI when available and a shared-memory worker gate otherwise. [web/worker.mjs](../../web/worker.mjs) registers an Emscripten filesystem device. [[runtime/capture.py#Observer#trace]] emits the pre-instruction snapshot, then reads one permit byte. With JSPI, an asynchronous read suspends the WASM stack until the UI resolves it. Without JSPI, the read blocks only the worker using Atomics.wait; the main thread writes a shared permit and notifies it. An atomic compare/exchange consumes each permit, including a permit delivered before the worker begins waiting. Both paths advance the same interpreter and never pre-capture a run.

The fallback requires SharedArrayBuffer and cross-origin isolation. [vite.config.mjs](../../vite.config.mjs) and [vercel.json](../../vercel.json) send COOP same-origin, COEP require-corp, and CORP same-origin for development, preview, and deployment. CORP also lets WebKit reuse worker resources without a policy rejection. The worker reports a capability error if neither execution transport is available. Compile and native capture retain synchronous compatibility. Reset terminates the worker even while it is waiting on shared memory.


[web/app.mjs](../../web/app.mjs) starts a fresh interpreter for each Run. Run grants one permit every 100 ms after the next snapshot arrives; Pause cancels future permits, and Step grants one permit at the live frontier. There is at most one permit in flight. Opaque builtin calls can finish before the next opcode pause, and asyncio timers use real wall time, including pauses. Recompiling or changing the program terminates the worker even during an opaque call. Loading and compilation retain deadlines; live execution has no five-second or total-event deadline.

[web/app.mjs](../../web/app.mjs) retains the latest 2,000 events and their projected states, discarding older entries. Back, the slider, and source/opcode visits inspect that window without undoing Python state. Run from history returns to the live frontier. After completion, history can be replayed; Run at the end starts a fresh interpreter. Edited source must be compiled again. Changing examples, recompiling, or closing changed source terminates execution and clears the preceding session. No trace persists between runs.

[web/index.html](../../web/index.html) keeps Compile in the top-left toolbar and execution controls at top right. Run/Pause remains available during execution. The first control is Reset with a stop icon: it discards the interpreter, history, and output while preserving compiled artifacts and scene geometry, without a message. Reset is always visible, becomes enabled only after Pause, and disables after reset or resume. Recompiling or changing the program also discards the worker. Starting Run does not flash a loading label or capture progress track. The slider shows retained history rather than predicted completion. Errors remain visible; ordinary completion status stays hidden. The Emscripten linear-memory cap remains 256 MiB, excluding browser overhead and user-visible history.

## Validation

Native semantic tests check observed values and identity, not merely event presence. The WASM smoke runner exercises the same packaged runtime used by the browser.

[[tests/test_capture.py]] verifies integer operands/results, separate calls sharing code, aliased cyclic containers, repeated loop positions, errors/unwinds, limits and fresh runs, rejected inputs, and the distinction between None and an internal null sentinel. [tools/test_wasm.mjs](../../tools/test_wasm.mjs) checks arithmetic stack values, repeated calls, exceptions, and infinite-loop event termination against expected results.

Build success, semantic test execution, and browser UI verification must be reported separately. The current scripts provide those checks without declaring that later graph extraction, routing, or native-JIT work is complete.

[tools/test_browser.mjs](../../tools/test_browser.mjs) uses Playwright with installed headless Chrome against the static workbench. It verifies actual operand values, backward replay, output, calls, aliases, errors, cancellation, and mobile overflow. Screenshots are saved in ignored artifacts for visual inspection.

## Compile and run separation checks

Compilation must produce inspectable artifacts without executing user statements; live execution starts only from Run.

[[tests/test_capture.py#CaptureTests#test_compile_only_does_not_execute]] checks empty events/output, nested code artifacts, infinite-loop safety, syntax errors, and ordinary execution. [tools/test_compile_flow.mjs](../../tools/test_compile_flow.mjs) verifies compile-only behavior, stale-source guards, syntax errors, and resets during live execution.

## Live execution checks

Live controls must suspend the evaluator, advance real opcodes, survive history rollover, and release discarded sessions.

[tools/test_live_execution.mjs](../../tools/test_live_execution.mjs) runs beyond the former event budget, checks bounded history, pause stability, real opcode steps, backward inspection, resume, cancellation, fresh runs, asyncio, exceptions, and silent run reset that preserves compilation. It accelerates only the UI permit delay; the actual WASM suspension protocol remains unchanged.

[tools/test_live_runtime.mjs](../../tools/test_live_runtime.mjs) streams more than 85,000 events across 4,500 calls using the packaged WASM runtime. It checks identity eviction, completed-frame release, rolling output, monotonic sequences, and an empty runtime event array. Node requires its experimental WASM JSPI flag.

## Safari live stepping checks

Safari must execute live opcodes without JSPI, retaining responsive controls and bounded history.

The browser check also injects a first-layout startup failure without an error message and a delayed obsolete callback, verifying automatic recovery on the initial Compile click. Runtime-error checks keep prior stdout and the Python diagnostic in Inspector output, leave the floating message empty, and remove the diagnostic when rewinding.

[tools/test_safari.mjs](../../tools/test_safari.mjs) uses WebKit with JSPI disabled in both the page and interpreter worker to verify isolation headers, a loop beyond the history limit, pause stability, single stepping, backward inspection, reset of a blocked worker, fresh runs, and asyncio completion.

## Shared program limits

Source validation and compilation enforce the same size and token limits, including incomplete code.

[[tests/test_capture.py#CaptureTests#test_shared_program_limits]] accepts exactly 256 tokens, rejects larger programs and oversized source, preserves the token count before an incomplete-token error, and validates an infinite loop without executing it.

## Shared program links

Custom programs can be shared through a bounded gzip/base64url fragment, loaded as source without automatic compilation or execution.

[web/share-codec.mjs](../../web/share-codec.mjs) compresses UTF-8 source into a URL-safe base64 fragment and limits encoded input and decompressed output before CPython token validation. [web/app.mjs](../../web/app.mjs) shows Share only for Custom, opens a keyboard-dismissable modal with a selectable URL and clipboard button, and loads valid fragments into the source-only scene. Invalid links retain the current example and display a readable error. [web/sharing.mjs](../../web/sharing.mjs) runs token validation in workers that terminate on completion or popup cancellation; stale loads cannot replace later edits or example selections. [web/runtime-worker.mjs](../../web/runtime-worker.mjs) uses unique worker-entry URLs for each interpreter to avoid WebKit’s cached module-worker access-control failures while keeping large runtime assets cached. [tools/test_sharing.mjs](../../tools/test_sharing.mjs) verifies Unicode round trips, source-only loading, visibility, token rejection, malformed payloads, and bounded decompression in Chrome and WebKit.

## Editor diagnostics and standard-library checks

The CodeMirror editor indents with Tab and shows located compilation failures; standard-library imports execute inside the worker.

[tools/test_editor.mjs](../../tools/test_editor.mjs) checks Tab/Shift-Tab, automatic editor opening for syntax and unsupported-import failures, clearing diagnostics on edit, time.sleep, math/json/collections imports, and separate stdout/stderr capture. [[tests/test_capture.py#CaptureTests#test_standard_library_and_diagnostics]] checks native equivalents and structured diagnostic locations.
