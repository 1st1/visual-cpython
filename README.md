# CPython Factory

An interactive explanation of CPython being built from real execution data.
The first implemented slice is a capture workbench: edit a small Python program,
record actual instruction-boundary stacks, and inspect the recording forward or
backward. A Graphviz map groups bytecode into blocks and code-object enclosures,
with execution highlights and observed call connections. The first Three.js
factory renders that same map as an interactive isometric world.

## Build the observation runtime

Prerequisites: the local CPython reference checkout at `./cpython`, Git, a C
compiler and make, host Python 3.14+, and Node 24. Builds and SDK downloads stay
in ignored `.build/`; the reference checkout is not modified.

```sh
python3 tools/build_native.py
.build/native/python.exe -m unittest discover -s tests -v
python3 tools/capture.py examples/accumulate.py --output artifacts/accumulate.json
```

On platforms where the native executable is named `python`, use that name for
the test command. The build scripts and native launcher handle either name.

For the browser, install the SDK version specified by the pinned CPython and
build the same static probe into WASM:

```sh
python3 cpython/Platforms/emscripten install-emscripten --emsdk-cache .build/emsdk
python3 tools/build_wasm.py
npm ci
python3 tools/package_web.py
node tools/test_wasm.mjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory web
```

Open http://localhost:8000. Choose an example, run it, then step through the
recording. This harness runs CPython in a disposable browser worker. Its server
only serves static files; it does not execute submitted Python on the host.
The native CLI is a local development tool, not an untrusted-code sandbox.

With the static server running and Google Chrome installed, run browser checks
in headless Chrome:

```sh
npm run test:graph
npm run test:browser
npm run test:factory
```

The checks exercise real WASM execution, replay, errors, limits, cancellation,
and recovery after terminating a worker. Desktop and mobile screenshots are
written to `artifacts/`. Set `FACTORY_URL` to test a different server address.

## What the trace means

- Operand stacks are observed **before** the named instruction executes.
- Calls have distinct frame IDs; repeated calls share their code object's ID.
- Internal null stack slots are distinguished from the Python object `None`.
- Opcode tracing perturbs specialization. This is not an uninstrumented
  adaptive-interpreter or performance trace.
- Object identities are kept stable with bounded strong references, which
  changes object lifetimes. Snapshots use bounded previews and do not call
  arbitrary user `repr` methods.
- Syntax failures, runtime exceptions, limit termination, and worker timeouts
  are distinct outcomes. A timeout discards the in-progress recording.

The accepted syntax is deliberately limited; imports, attribute access,
generators, classes, and dynamic code are rejected. Capture limits and the
current implementation are described in [the runtime notes](lat.md/cpython/runtime.md).

Select a map block to inspect its instructions, then use **Next recorded visit**
to seek execution there. Zoom and scroll to inspect larger graphs. Layout stays
fixed during replay. This is the Graphviz routing baseline: connection crossings
are not junctions, and wire clearance/bridge routing is not implemented yet.

The default **3D factory** view supports drag to orbit, right-drag to pan, wheel
zoom, Iso/Top presets, and block focus. Use **Schematic** to compare views.
Select buildings or use the block menu, then seek their recorded visits.
**Skip reveal** finishes the staged construction immediately; reduced-motion
settings disable construction and signal movement. Parser/compiler buildings
are explanatory landmarks, not captured intermediate compilation steps.

The map compares compact Graphviz arrangements before choosing a layout. The
3D operand stack shows up to eight topmost slots, their values and object IDs,
and an overflow count. Click **Stack** for a close view. Missing opcode samples
are shown as **not sampled**, separately from an observed empty stack.

Each small 3D box now represents one decoded opcode. Basic blocks are trays,
and code objects are larger enclosures. Use **Focus opcode** for an overhead
reading view, or the **Opcodes** panel for full instruction text. Clicking a
visited opcode seeks its next recorded occurrence. Select **Shortest path ·
breadth-first search** for a complete queue-and-dictionary graph-search example.
