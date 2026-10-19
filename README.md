# CPython Factory

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
are needed for deployment. Python loads only when a capture starts; Graphviz
loads in a separate worker when the recording is ready for layout.

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
npm run test:factory
npm run test:parsing
npm run test:memory
lat check
```

Set `FACTORY_URL=http://127.0.0.1:8001` to target a preview on another port.
Screenshots are written to ignored `artifacts/`. Native tests use
`.build/native/python.exe -m unittest discover -s tests -v` (or `python` where
that is the executable name); `npm run test:graph` also uses the native build.

## What the trace means

Operand stacks are observed **before** each opcode. The parser replay records
real token requests, PEG checkpoints, and AST constructors. Opcode tracing
perturbs specialization, so this is not an uninstrumented performance trace.
Coroutine suspensions and resumptions retain activation identity. The selected
asyncio API supports cooperative tasks and timers, without socket or thread I/O.
Other imports, private attributes, classes, generators, and dynamic code are
restricted. The UI lists current capture limits.

Use **Run & capture**, then play, step, rewind, or seek the recording. Source,
tokens, AST nodes, and opcode tiles share one map. Compilation correspondence
links appear only in their relevant construction stage. Execution uses
synchronized highlights and an opcode transition trail. **Skip reveal** shows
the completed map; reduced motion suppresses construction and signal animation.

Drag to orbit, scroll or right-drag to pan, and pinch to zoom. **Focus opcode**,
**Stack**, and the minimap navigate larger programs. The inspector provides
locals, the full sampled stack, and output. Graphviz routing remains a baseline:
crossings are not junctions, and obstacle clearance is not certified.
