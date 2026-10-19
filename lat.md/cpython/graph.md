# Program graph and schematic

The workbench derives a runtime control-flow graph from captured bytecode and renders it with Graphviz WASM. Replay selects blocks, observed call connections, and frame chains without changing positions.

This implements the first program-map slice of [[v1-plan#First-version implementation plan#Milestone 2 - Extract graphs and define replay]] and the Graphviz baseline from [[layout]]. The 3D factory, compiler-intermediate views, and clearance-aware routing remain planned.

## Bytecode graph

Capture schema 2 carries explicit instruction flow categories and execution targets. Graph schema 1 groups instructions into stable blocks within each code object, with branch, jump, continuation, and observed-call edges.

[[runtime/capture.py#Observer#code]] uses CPython disassembly without inline cache entries. Fused instructions retain their decoded identity; extended-argument instructions retain their offsets. IDs combine the recording's code identity and block-start offset, so repeated calls reuse geometry; IDs are not promised stable across source edits.

In the pinned evaluator, FOR_ITER exhaustion skips END_FOR. Capture preserves the encoded target separately and reports the actual successor as its execution target. This follows [INSTRUMENTED_FOR_ITER](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Python/bytecodes.c#L3884), rather than assuming every encoded jump lands on its disassembled target.

[web/graph.mjs](../../web/graph.mjs) splits at entry, targets, and instructions following branches, exits, and calls. Splitting after calls gives each call site its own outgoing connection. Unreachable bytecode remains visible and has no recorded visit. The result is an assembled-bytecode CFG, not CPython's optimization CFG. Exceptional unwind is shown in replay state, not fabricated as ordinary control flow.

## Replay projection

Every captured event has a deterministic map selection and frame chain. Runtime calls add dashed connections only when a captured Python activation proves the relationship; builtin internals remain opaque.

[web/graph.mjs](../../web/graph.mjs) tracks the previous opcode separately for each activation, so a callee cannot be mistaken for the caller's next basic block. It matches observed block transitions to static edges and records diagnostics for unmatched transitions. Return and unwind retain the terminating frame in that event's display; subsequent events select the surviving caller.

The bounded recording already contains state snapshots at every event. The map projection also stores one selection per event; seek and rewind index these arrays instead of running code or rebuilding layout. This is the current small-recording strategy, not the planned periodic-snapshot reducer. Static branch edges describe possibilities; dashed call edges describe calls observed anywhere in the completed recording, not predictions available before execution.

## Layout and interaction

A disposable layout worker runs the native Graphviz dot engine through pinned Viz.js. Code-object clusters, fixed-size blocks, and orthogonal connections form a top-down SVG diagnostic map.

[web/layout-worker.mjs](../../web/layout-worker.mjs) uses the pinned dependency in [package.json](../../package.json). [tools/package_web.py](../../tools/package_web.py) stages its self-contained WASM bundle beside CPython assets. Layout has a separate deadline and is discarded on a new capture. Only the SVG and engine version return to the main thread.

[web/app.mjs](../../web/app.mjs) keeps geometry fixed while replay updates node and edge classes. Users can zoom, scroll, select blocks with pointer or keyboard, inspect their instructions, and seek their next recorded opcode visit. Source, locals, and operand stack follow that event. Syntax failures clear the map. Layout failures leave the execution inspector usable.

This baseline does not yet expose renderer-independent route polylines, named ports, clearance guarantees, or crossing bridges. Graphviz may overlap or cross connectors; crossings are not junctions. The libavoid and PCB comparisons in [[layout#Block placement and connection routing#First routing experiment]] remain unimplemented.

## Validation

Graph fixtures verify that real captures map to coherent control flow and repeatable replay states. Browser tests verify the rendered map against actual WASM execution and UI interactions.

[tools/test_graph.mjs](../../tools/test_graph.mjs) covers diamonds, nested loops, continue/break, recursive and repeated calls, short-circuit expressions, exceptions, empty programs, syntax errors, and event limits. It checks complete instruction mapping, observed transitions, activation chains, deterministic results, and non-overlapping Graphviz node bounds. It does not assert wire clearance.

[tools/test_browser.mjs](../../tools/test_browser.mjs) checks active-block restoration after rewind, unchanged SVG bounds during stepping, block selection and visit seeking, multiple code enclosures, graph diagnostics, and desktop/mobile rendering. Native capture tests and the WASM smoke runner remain separate checks described in [[runtime#Capture runtime#Validation]].
