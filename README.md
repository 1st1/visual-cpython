# CPython X-Ray

An interactive 3D visualization of real CPython tokenization, PEG/AST construction,
bytecode, and execution. Programs run in a disposable browser worker using an
instrumented CPython WASM build. No backend executes submitted Python.

## Develop

Install Node 24 and npm. The built CPython runtime is checked in under
`web/public/runtime/`; no Python compiler or Emscripten installation is needed
for frontend work.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:8000. Vite handles modules, workers, and frontend reloads.

## Build and deploy

```sh
npm run build
npm run preview
```

The build verifies the committed runtime and emits `dist/`. Development and
preview default to the same strict port; stop one before starting the other,
or use `npm run preview -- --port 8001`.

Import this repository into Vercel. `vercel.json` selects Vite, `npm run build`,
and `dist` as the output directory. No local CPython checkout or build outputs
are needed for deployment. Python loads for Compile and Run; Graphviz loads in a separate worker when
compiled artifacts are ready for layout.

## Rebuild the observation runtime locally

Only needed after changing CPython, `runtime/probe.c`, or parser instrumentation.
Prerequisites: Git, a C compiler, make, host Python 3.14+, Node 24, and a CPython
checkout at `./cpython` containing the revision in `runtime/revision.txt`.
The scripts leave that checkout unchanged and build under ignored `.build/`.

```sh
python3 tools/build_native.py
python3 cpython/Platforms/emscripten install-emscripten --emsdk-cache .build/emsdk
python3 tools/build_wasm.py
python3 tools/package_web.py
npm run check:runtime
npm run test:wasm
```

Commit the refreshed `web/public/runtime/` artifacts after validation. Changes
to `runtime/capture.py` alone require repackaging, not recompiling C. The manifest
records the CPython revision and content hash; frontend builds reject stale
capture scripts or mismatched artifacts.

Full build details and rebuild boundaries are in
[Lat's runtime documentation](lat.md/cpython/runtime.md#build-pipeline).

## Validate

```sh
npm run test:wasm
# With Vite dev or preview running and Google Chrome installed:
npm run test:browser
npm run test:xray
npm run test:parsing
npm run test:memory
lat check
```

Set `XRAY_URL=http://127.0.0.1:8001` to target a preview on another port.
Screenshots are written to ignored `artifacts/`. Native tests use
`.build/native/python.exe -m unittest discover -s tests -v` (or `python` where
that is the executable name); `npm run test:graph` also uses the native build.

## What the trace means

Operand stacks are observed **before** each opcode. The parser replay records
real token requests, PEG checkpoints, and AST constructors. Opcode tracing
perturbs specialization, so this is not an uninstrumented performance trace.
Coroutine suspensions and resumptions retain activation identity. The selected
asyncio API supports cooperative tasks and timers, without socket or thread I/O.
Public standard-library imports such as time, math, json, and collections are
available when supported by the bundled WASM runtime. Third-party imports,
private attributes, classes, generators, and dynamic code remain restricted. Live history retains the latest 2,000 events without imposing a total
execution-event limit.

Use **Compile** to build source, token, AST, and opcode views without executing
Python. **Run/Pause** and **Step** control live execution. Back and the slider
inspect retained history; resuming returns to the live interpreter. **Reset**
after Pause clears the run while preserving compilation. Source edits require
recompilation. **Stop animation** skips construction reveal.

Drag to orbit, use the mouse/trackpad navigation setting for scroll behavior,
and pinch to zoom the scene. The minimap offers 3D/2D, zoom, and fit controls.
The Inspector provides source, instructions, locals, operand stack, and output.
Mobile portrait places execution controls at the bottom; landscape aligns both
toolbars at the top. Mouse/trackpad choices are hidden on mobile devices.

Live stepping uses WebAssembly JSPI where available, or a shared-memory worker gate on Safari and other browsers without JSPI. Serve with the configured Vite preview or Vercel headers: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, and `Cross-Origin-Resource-Policy: same-origin`. A plain static server without these headers cannot provide the Safari fallback.

For the Safari-engine regression test, install WebKit with `npx playwright install webkit`, then run `npm run test:safari` against the running app. `XRAY_URL` can point it at a production preview.

Custom programs support up to 256 Python tokens and 16 KiB of source. Edit uses
CodeMirror with Tab indentation and inline compilation errors. Share opens a
copyable gzip/base64url link; opening it previews the source without running it.
