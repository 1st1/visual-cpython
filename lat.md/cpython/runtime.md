# Capture runtime

The implementation combines a revision-pinned CPython observation module, bounded Python capture driver, and browser workbench with a generated program map. The 3D scene remains unimplemented.

Build recipes and commands are in [README.md](../../README.md). [[tools/build_native.py#build]] exports the pinned revision from the ignored reference checkout and adds [[runtime/probe.c]] as a static module in a disposable build. [[tools/build_wasm.py#build]] prepares a separate Emscripten build; [[tools/package_web.py#package]] stages generated browser assets.

## Observed instruction stacks

The native probe reads synchronized operand-stack entries during opcode tracing. It distinguishes ordinary object references, null call sentinels, and tagged integers without reconstructing values from bytecode effects.

[[runtime/probe.c#snapshot]] checks the frame and debug synchronization state and returns bottom-to-top entries. Its internal API is pinned to the source revision in [runtime/revision.txt](../../runtime/revision.txt). The generated evaluator synchronizes the stack before invoking instruction instrumentation; this is the basis for reading it from the callback, not permission to inspect an arbitrary running frame.

[[runtime/capture.py#Observer#trace]] sets opcode tracing on each target-frame event, retaining line callbacks to enable instruction instrumentation in this revision. The recording omits line events themselves. Each opcode snapshot describes state before that instruction executes. Call, return, exception, and unwind events carry locals and output but do not claim an opcode stack snapshot.

This is explicitly an instrumented observation mode. Opcode tracing pauses/adapts specialization behavior, so these captures cannot demonstrate undisturbed adaptive specialization or performance. A different hook strategy remains necessary for that later claim. The milestone is real observed state, not a complete implementation of the planned capture backend.

## Identity and bounded capture

Capture records distinct activations, reusable code identities, source positions, and bounded value previews. Limits prevent unlimited trace growth, while execution cancellation is managed outside the interpreter.

[[runtime/capture.py#Observer#value]] preserves alias identity using a bounded strong-reference registry. Exact builtin containers receive shallow, cycle-aware previews; arbitrary repr methods are not invoked. Retention changes object lifetime and is limited to a single recording. This is not a faithful reference-count/GC trace.

[[runtime/capture.py#capture]] accepts a small syntax/builtin surface and checks source bytes and Python lexical tokens before execution. It enforces event, object-identity, activation, and output limits. Imports, attributes, classes, generators, exception-handling syntax, and other unsupported constructs are rejected. The source-size cap is independent of runtime cost.

Recordings distinguish completed, error, and limited outcomes. Exceptions followed by frame termination are labeled unwind rather than a successful return of None. Syntax errors produce no execution events. [[tools/capture.py#run]] launches a fresh native subprocess and applies a parent-enforced timeout; it is a local development tool, not an untrusted-code sandbox.

## Browser workbench

The diagnostic UI exposes editing, capture, source/instruction selection, locals, stack, output, and forward/backward playback. It consumes complete recordings and drives the generated map described in [[graph]].

[web/worker.mjs](../../web/worker.mjs) loads the generated Emscripten runtime, standard-library archive, and capture driver. Each run gets a new worker and interpreter. The worker writes source into its virtual filesystem, executes capture, and sends a serializable recording to the UI. The hosting server serves static files only.

With browser WebAssembly JSPI support, CPython completes asynchronously: the worker waits for the runtime exit callback before parsing captured output. Synchronous runtimes use the immediate exit code. The pinned build enables dynamic linking because CPython's JSPI initialization requires Emscripten's symbol resolver.

[web/app.mjs](../../web/app.mjs) applies separate runtime-loading and execution deadlines and terminates discarded workers. Play, step, rewind, and seek select recorded snapshots rather than re-executing Python. Output at each event reflects captured output at that time; the terminal position shows final output/status. A wall-clock timeout discards the unfinished capture.

The Emscripten link configuration sets a maximum linear-memory size; JavaScript, fetched assets, and browser overhead are additional. [web/index.html](../../web/index.html) exposes the current capture limits and the instrumentation caveat. [web/style.css](../../web/style.css) provides a responsive diagnostic layout; it is not the final factory art.

## Validation

Native semantic tests check observed values and identity, not merely event presence. The WASM smoke runner exercises the same packaged runtime used by the browser.

[[tests/test_capture.py]] verifies integer operands/results, separate calls sharing code, aliased cyclic containers, repeated loop positions, errors/unwinds, limits and fresh runs, rejected inputs, and the distinction between None and an internal null sentinel. [tools/test_wasm.mjs](../../tools/test_wasm.mjs) checks arithmetic stack values, repeated calls, exceptions, and infinite-loop event termination against expected results.

Build success, semantic test execution, and browser UI verification must be reported separately. The current scripts provide those checks without declaring that later graph extraction, routing, or native-JIT work is complete.

[tools/test_browser.mjs](../../tools/test_browser.mjs) uses Playwright with installed headless Chrome against the static workbench. It verifies actual operand values, backward replay, output, calls, aliases, errors, event limits, hard worker timeout and recovery, cancellation, and mobile overflow. Screenshots are saved in ignored artifacts for visual inspection.
