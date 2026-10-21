# First-version implementation plan

V1 is an interpreter-only browser application where a small editable Python program constructs a xray map and its real execution activates that map. This page is the release plan; [[runtime#Capture runtime]] records the implemented capture slice.

The visual contract comes from [[xray-world#Program-built X-Ray world]], the layout candidates from [[layout#Block placement and connection routing]], and the semantic model from [[compilation#Shared compilation flow]] and [[execution#Interpreter and JIT execution#Adaptive execution]].

## User-visible completion target

A user edits a short program, runs it, watches connected program blocks appear, and inspects execution through source highlighting, frames, locals, operand-stack changes, and output.

Provide an editor with examples, compile/run, play/pause, forward/back step, reset, speed, and skip-construction controls. The scene includes fixed compiler/runtime machinery, generated code-object enclosures with basic blocks, routed control-flow connections, and a focused activation/objects area. Selection links source, instructions, map blocks, and an inspector. Include orthographic/isometric view, pan/zoom, and optional orbit; camera motion is never necessary to understand the default example.

The initial supported program surface is self-contained synchronous code: primitive values, assignment, arithmetic/comparisons, if/else, for/while, ordinary functions/calls/returns, basic lists/dictionaries, and a small allowlist of builtins such as print, range, and len. Include syntax errors and runtime exceptions with a clear termination/unwind display. Verify the exact supported operations in a capability matrix before enabling them in the editor.

Explicitly defer JIT, arbitrary imports/packages, host filesystem/network access, eval/exec, threading, async/generators, user-defined classes, full heap/GC visualization, and performance comparisons. Diagnose unsupported constructs before running where practical. This is an initial visualization contract, not a claim that the WASM interpreter cannot execute other Python features.

Use a proposed 200-token limit counted by Python's tokenizer, excluding comments, encoding/end markers, and layout-only tokens. Also cap source bytes, execution time, trace events, output, object-preview depth, and runtime memory. Token count alone cannot bound loops, allocations, or literal size. Select concrete execution/memory defaults from the feasibility runs and document them before release.

## Architecture and durable artifacts

Separate execution, graph extraction, layout, playback, and rendering so each stage can be validated independently. Both native development captures and browser captures should feed the same replay model.

| Layer | Responsibility | Durable output |
| --- | --- | --- |
| CPython build and capture | Compile source and collect safe interpreter state/events | Versioned program artifacts and execution trace |
| Graph extraction | Map code objects and instructions into basic blocks and edges | Semantic graph with stable IDs and source mappings |
| Placement and routing | Arrange measured components and connect named ports | Validated bounds, ports, paths, bridge annotations |
| Playback | Apply events to state; restore snapshots for rewind | Deterministic scene-state model |
| Renderer and UI | Render that state and accept user inspection/control | Interactive xray and explanatory panels |

Use TypeScript for the application and playback model, Three.js for the final scene, CPython compiled with Emscripten for execution, and native layout/routing algorithms exposed through WASM where feasible. Pin the exact dependency versions after the feasibility work. Use project-owned Three.js modules for visual primitives and controls.

Keep CPython execution in its own worker and layout in a separate worker. Only compact serializable artifacts/events cross into the UI; do not pass live Python objects. The UI's playback clock is independent of capture speed. For v1, finish or truncate a bounded recording before playback rather than attempting interactive suspension at every instruction.

Track build recipes, instrumentation patches, fixture programs, schemas, and small expected traces in this repository. Keep the local CPython checkout ignored and unmodified as a reference; build from an exact revision in a disposable worktree/copy with tracked patches applied. Record revision, build flags, instrumentation/schema versions, and capture limits in every trace. Avoid claiming that generated build artifacts or modifications hidden in the ignored checkout are reproducible source.

## Milestone 1 - Prove runtime capture and WASM

Establish that the pinned CPython can run in a browser worker and expose the execution state the xray needs. Detailed observation is the primary technical risk, so test it before building the full scene.

First reproduce a minimal integer-add/function-call capture natively, where debugging is easier. Compile the same instrumented revision to WASM and run it through a minimal worker harness. Verify stdout, errors, fresh-run isolation, and cancellation by discarding/recreating the worker. Enforce execution budgets independently of catchable Python exceptions; configure and test a WASM memory bound appropriate to the runtime's baseline footprint.

Capture stable code/frame/object identities, source/instruction positions, local changes, operand-stack state at safe boundaries, call/return, branches, and errors. Inspect generated evaluator semantics before choosing hook locations: fused instructions, dispatch, and stack-pointer synchronization must be handled correctly. Do not infer runtime stack values from static stack-effect counts alone.

Serialize bounded primitive/container previews without invoking arbitrary user repr methods or retaining unlimited strong references. Handle aliases, cycles, and object-ID lifetime deliberately. Treat builtin implementation internals as opaque operations in v1; display their arguments/results and observable effects rather than pretending to step every C operation.

Python-level tracing may validate early calls/lines/locals, but it is not sufficient evidence for the full stack display or undisturbed specialization. The deliverable requires either suitable internal hooks or a clearly documented narrower observed mode. Verify ordinary specialization under the final hooks before adding specialization claims to the UI.

Exit gate: the same small program produces consistent semantic results and coherent frame/stack transitions in native and browser captures; an infinite loop can be stopped without freezing the UI. If this fails, resolve or explicitly revise the capture scope before proceeding to polished 3D.

## Milestone 2 - Extract graphs and define replay

Turn compiler artifacts and captured events into a stable model that can power both a diagnostic inspector and the final xray. Rewind restores recorded state rather than re-executing Python.

Collect tokens, AST, symbol information, nested code objects, disassembly, constants/names, source positions, and exception metadata. Construct a runtime CFG from final bytecode boundaries and branch targets. Mark that CFG as derived from assembled bytecode; it is not the compiler's pre-assembly optimization graph. Defer exact compiler intermediate snapshots unless inexpensive hooks provide them faithfully.

Normalize bytecode offsets, extended arguments, cache entries, and fused instructions before identifying basic blocks. Keep source relationships many-to-many. Code-object IDs persist across repeated calls; frame IDs distinguish activations. Static call relationships are hints unless resolved by evidence; actual calls come from execution events.

Define artifact, graph, event, state, and snapshot schemas with versioning and provenance. Implement a pure playback reducer plus periodic snapshots. Validate replay against captured checkpoints and outputs. An interrupted/budget-limited trace has an explicit terminal status and remains inspectable; it must not look like successful completion.

Exit gate: a plain source/disassembly/state inspector can step and rewind through a branch, loop, nested call, and error with reproducible state. The graph agrees with observed control flow, including continuation targets.

## Milestone 3 - Prove placement and routing

Run the layout bake-off in a simple top-down view using fixed footprints and ports. Establish valid paths before converting them into belts, pipes, or elevated connections.

Implement Graphviz placement and a Graphviz-only routing baseline. Add a libavoid adapter and test browser WASM integration. Run the fixtures and metrics in [[layout#Block placement and connection routing#First routing experiment]], first with synthetic graphs and then with extracted program CFGs.

Try Freerouting on one difficult fixed-placement fixture as a bounded experiment. Keep its output behind the same route contract; do not turn a desktop/server circuit adapter into a required browser dependency unless it clearly justifies that deployment change. Compare valid geometry and readability as well as length.

Add clearance validation, loop perimeter lanes, collision-aware grid placement, and an explicit crossing policy. Prefer widening corridors or repositioning blocks; add checked bridges only where needed. Cache layout by graph, component dimensions, and algorithm version. Compute positions once before revealing the construction sequence.

Exit gate: fixture layouts have valid ports, no component penetration, no ambiguous shared segments, and no unmarked crossings. Same inputs produce stable results, and execution events never trigger a full relayout. Select the routing engine based on measured output, not the initial preference.

## Milestone 4 - Complete one schematic user journey

Integrate editable Python, capture, graph extraction, routing, and replay before investing in detailed art. This establishes the complete product path with inexpensive visual debugging.

Run the accumulator example from the editor, reveal its source-linked program structures, and animate a control cursor through actual recorded block transitions. Show selected locals, operand stack, references, stdout, and errors in readable panels. Add run status, limits, reset, and replay controls.

Use the other supported programs to validate dynamic graph generation, not just the default fixture. An edit produces a fresh run and layout; returning to an earlier playback position does not rerun side effects. Construction is a staged explanation over actual artifacts, not a claim to display compiler wall-clock timing.

Exit gate: a user can change a condition or loop count and see the resulting graph/state/output without a hardcoded animation script. Unsupported code and resource limits produce actionable messages rather than broken scenes.

## Milestone 5 - Render the xray in 3D

Replace the schematic drawing with the planned xray world while retaining the same geometry and playback state. Rendering must not introduce another model of Python execution.

Create a compact original kit: ground tiles, compiler/runtime machinery, code-object enclosures, basic-block structures, instruction strips, local slots, stacks, object displays, route segments, corners, and bridges. Use distinct forms for structures with distinct meanings. Keep detailed source/disassembly text screen-aligned and legible.

Stage the build reveal, animate cursor/reference transfers along existing paths, light active machinery, and update component displays. Interpolate visual transitions without changing event order or skipping observable state changes during stepping. Loops reuse geometry; repeated calls add bounded activation displays rather than function copies.

Implement camera presets, selected-component focus, semantic detail levels, and inspector pinning. Check route occlusion and label overlap in the default view. Pause/step and reduced-motion presentation must still communicate changes without relying on travelling pulses alone.

Exit gate: the default cold run, warmed interpreter run, changed branch, and failure scenario remain understandable at presentation size. Every highlight and moving item has an identifiable event or clearly labeled explanatory purpose.

## Milestone 6 - Validate and package v1

Finish v1 with reproducible builds, bounded execution, representative examples, and targeted correctness/visual checks. Deployment is a separate final action after the build is reviewable.

Use semantic fixtures for arithmetic, aliases, loops, branches, function nesting, return, syntax error, runtime error, and budget termination. Compare output/errors to the pinned native CPython and validate capture/replay invariants. Add geometry checks for route clearance, endpoints, crossings, and deterministic layout. These test observable contracts rather than mirroring implementation details.

Exercise the actual browser build, worker reset after a timeout, repeated edits/runs, main-thread responsiveness, and visual inspection at expected viewport sizes. Record initial load, capture latency, trace size, and layout cost on representative devices; tune limits and packaging from evidence. Test the hosting configuration required by the selected WASM/worker build.

Deliver a runnable app, setup/build instructions, tracked instrumentation and fixtures, exact version/provenance metadata, and an explicit supported-program list. Update Lat to distinguish implemented behavior from remaining plans and run lat check. No JIT UI or unfinished JIT controls belong in this release.

## Work order and scope decisions

Runtime feasibility comes first; graphs and playback follow. Routing can use synthetic fixtures while capture develops, and final 3D work begins only after an integrated schematic works.

The practical order is milestones 1 and 2, milestone 3, milestone 4, then milestones 5 and 6. Begin the routing comparison early if capture work encounters long build cycles, but keep its adapter independent. No schedule estimate is committed before the capture and routing feasibility gates.

Keep these decisions evidence-driven: whether the pinned development revision builds cleanly for the browser; which hook strategy safely exposes stacks without distorting specialization; whether libavoid's WASM integration and routing quality meet requirements; and what execution limits keep capture responsive. Any revision change, server dependency, or reduced observable scope should be made explicit rather than hidden inside an implementation shortcut.
