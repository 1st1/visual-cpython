# Capture runtime

The implementation combines a revision-pinned CPython observation module, bounded Python capture driver, and browser workbench with a generated program map and first 3D factory scene.

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

Runtime integrity, compilation, capture correctness, and production-browser behavior are separate checks. Browser tests accept FACTORY_URL so the same suites can target Vite development or the built preview.

Run the native interpreter with `-m unittest discover -s tests -v` (`.build/native/python.exe` on this macOS build, or `.build/native/python` where applicable). npm run test:wasm checks the committed runtime; npm run test:graph additionally requires the local native interpreter. With Vite development or preview running, npm run test:browser, npm run test:factory, npm run test:parsing, and npm run test:memory exercise capture, rendering, parser replay, and resource bounds. Run lat check for documentation validation. Screenshots remain ignored under artifacts/.

## Observed instruction stacks

The native probe reads synchronized operand-stack entries during opcode tracing. It distinguishes ordinary object references, null call sentinels, and tagged integers without reconstructing values from bytecode effects.

[[runtime/probe.c#snapshot]] checks the frame and debug synchronization state and returns bottom-to-top entries. Its internal API is pinned to the source revision in [runtime/revision.txt](../../runtime/revision.txt). The generated evaluator synchronizes the stack before invoking instruction instrumentation; this is the basis for reading it from the callback, not permission to inspect an arbitrary running frame.

[[runtime/capture.py#Observer#trace]] sets opcode tracing on each target-frame event, retaining line callbacks to enable instruction instrumentation in this revision. The recording omits line events themselves. With the browser’s progress flag, line callbacks emit a flushed private stderr message at most 30 times per second. The worker forwards these separately from program output; the current capture generation highlights the corresponding source tile immediately. Fast programs may finish before a browser repaint, and this live display samples activity rather than replaying every line. Each opcode snapshot describes state before that instruction executes. Call, return, exception, and unwind events carry locals and output but do not claim an opcode stack snapshot.

This is explicitly an instrumented observation mode. Opcode tracing pauses/adapts specialization behavior, so these captures cannot demonstrate undisturbed adaptive specialization or performance. A different hook strategy remains necessary for that later claim. The milestone is real observed state, not a complete implementation of the planned capture backend.

## Identity and bounded capture

Capture records distinct activations, reusable code identities, source positions, and bounded value previews. Limits prevent unlimited trace growth, while execution cancellation is managed outside the interpreter.

[[runtime/capture.py#Observer#value]] preserves alias identity using a bounded strong-reference registry. Exact builtin containers receive shallow, cycle-aware previews; arbitrary repr methods are not invoked. Retention changes object lifetime and is limited to a single recording. This is not a faithful reference-count/GC trace.

[[runtime/capture.py#capture]] accepts a small syntax/builtin surface and checks source bytes and Python lexical tokens before execution. It enforces event, object-identity, activation, and output limits. Async functions, await, public attributes, and asyncio imports are accepted. Other imports, private attributes, classes, generators, and exception-handling syntax remain rejected. The source-size cap is independent of runtime cost.

[[runtime/capture.py#import_module]] exposes selected real asyncio APIs: run, sleep, gather, create_task, wait_for, current_task, get_running_loop, Task, Future, and CancelledError. On Emscripten, run uses a selector-loop subclass without the socketpair wakeup mechanism; the single worker supports cooperative tasks and timers, not socket or thread I/O. Native runs use the standard loop. Library frames remain opaque; user coroutine opcodes are observed normally.

[[runtime/capture.py#Observer#trace]] records coroutine yield and re-entry as suspend and resume, retaining the same frame identity across awaits. Replay updates the resumed frame's current caller, rather than treating suspension as completion or resumption as a new activation. Native, WASM, and Chrome tests exercise async sleep and output, with native/WASM assertions for stable suspension/resumption identity.

Recordings distinguish completed, error, and limited outcomes. Exceptions followed by frame termination are labeled unwind rather than a successful return of None. Syntax errors produce no execution events. [[tools/capture.py#run]] launches a fresh native subprocess and applies a parent-enforced timeout; it is a local development tool, not an untrusted-code sandbox.

## Browser workbench

The diagnostic UI exposes editing, capture, source/instruction selection, locals, stack, output, and forward/backward playback. It consumes complete recordings and drives the generated map described in [[graph]].

[web/worker.mjs](../../web/worker.mjs) loads the generated Emscripten runtime, standard-library archive, and capture driver. Each run gets a new worker and interpreter. The worker writes source into its virtual filesystem, executes capture, and sends a serializable recording to the UI. The hosting server serves static files only.

[[tools/package_web.py#package]] publishes a content-hashed runtime manifest after staging the committed runtime, WASM binary, standard library, and capture driver. The worker fetches this manifest without caching and uses its build identifier on all four asset URLs, including Emscripten’s WASM lookup. Rebuilt parser probes therefore cannot silently reuse the previous build’s cached binary.

With browser WebAssembly JSPI support, CPython completes asynchronously: the worker waits for the runtime exit callback before parsing captured output. Synchronous runtimes use the immediate exit code. The pinned build enables dynamic linking because CPython's JSPI initialization requires Emscripten's symbol resolver.

[web/app.mjs](../../web/app.mjs) applies separate runtime-loading and execution deadlines and terminates discarded workers. Play, step, rewind, and seek select recorded snapshots rather than re-executing Python. Output at each event reflects captured output at that time; the terminal position shows final output/status. A wall-clock timeout discards the unfinished capture.

The Emscripten link configuration sets a maximum linear-memory size; JavaScript, fetched assets, and browser overhead are additional. [web/index.html](../../web/index.html) presents a Compile action for recording execution, with status and errors in the source panel. The explanatory tracing and scope text is omitted from the interface; runtime limits remain enforced. [web/style.css](../../web/style.css) provides a responsive diagnostic layout; the first factory renderer is described in [[scene]].

## Validation

Native semantic tests check observed values and identity, not merely event presence. The WASM smoke runner exercises the same packaged runtime used by the browser.

[[tests/test_capture.py]] verifies integer operands/results, separate calls sharing code, aliased cyclic containers, repeated loop positions, errors/unwinds, limits and fresh runs, rejected inputs, and the distinction between None and an internal null sentinel. [tools/test_wasm.mjs](../../tools/test_wasm.mjs) checks arithmetic stack values, repeated calls, exceptions, and infinite-loop event termination against expected results.

Build success, semantic test execution, and browser UI verification must be reported separately. The current scripts provide those checks without declaring that later graph extraction, routing, or native-JIT work is complete.

[tools/test_browser.mjs](../../tools/test_browser.mjs) uses Playwright with installed headless Chrome against the static workbench. It verifies actual operand values, backward replay, output, calls, aliases, errors, event limits, hard worker timeout and recovery, cancellation, and mobile overflow. Screenshots are saved in ignored artifacts for visual inspection.
