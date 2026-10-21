# PostgreSQL visual reference

The user supplied a screenshot of an ISO-GLOW PostgreSQL internals visualization. This study records visible design choices and their proposed application to CPython; its implementation and animation behavior have not been inspected.

The reference is the conversation image supplied on October 19, 2026, titled “POSTGRESQL INTERNALS,” with an executor inspector open. It shows one rendered state, not evidence of timing, simulation fidelity, or the behavior of each control. The recommendations below extend [[presentation#Presentation approach]].

## A persistent system map

The screenshot presents a complete system on one physical-looking base, with functional neighborhoods and connectors. The spatial layout gives the viewer a stable place to look for each kind of activity.

Clients sit on the left, with the postmaster and backend blocks nearby. A large shared-memory board dominates the center: buffer slots, WAL buffers, transaction status, locks, and the process array are visible within it. Background processes occupy a row behind it. Data storage and a standby sit to the right; WAL segments and related processes run across the foreground. Parser, rewriter, planner, and executor form a numbered foreground row.

This combines two explanatory structures: the topology of a system and a sequence of processing stages. The proposed lesson for CPython is to keep an architectural overview available while highlighting a particular operation's route through it. A guided sequence can change focus without replacing the entire scene at every step.

The physical metaphor does not establish that every box is an independent process. In particular, numbered pipeline stages need explicit grouping. For CPython, label compiler stages as operations and frames/code objects as data structures; avoid implying that a parser, evaluator, and JIT are separate servers exchanging messages.

## State appears on the components

The objects carry compact labels and state displays instead of relying entirely on a distant legend. Repeated small cells make capacity, occupancy, and individual entries visually inspectable.

Visible examples include shared-buffer slots, transaction-status dots, heap-page cells, WAL segments, backend status, and standby replay information. The single purple accent marks selected or active-looking details against subdued geometry; the screenshot alone does not reveal the precise meaning of every colored item.

For CPython, use local slots and operand-stack entries within a frame, an instruction strip and cache cells within a code object, and guarded micro-op groups within a trace. Keep values and short state labels attached to their owner. Reserve the inspector for expanded explanations, exact instructions, and source evidence.

The objects should express their representation: a stack should visibly have a top, a graph should branch, and a trace should be a sequence. Repeating server-shaped boxes for every concept would lose these distinctions. Fixed grids should not imply fixed-size Python heaps or universal implementation limits; label displayed capacity as a cropped sample when appropriate.

## Actions lead the exploration

The right panel offers named workloads and system events with keyboard shortcuts. The visible choices give viewers questions to ask of the model rather than only camera controls.

The screenshot offers SELECT, UPDATE, INSERT, a sequential-scan report, rollback, checkpoint, vacuum, a background-writer round, and crash/recovery. Demo, revolve, isometric view, palette, and theme controls support presentation and inspection. The bottom hint invites hovering over parts; the executor explanation is visible in the lower-left panel.

For CPython, propose a compact scenario panel: “Run once,” “Repeat integer loop,” “Change operand type,” “Take another branch,” and later “Change a dependency.” The interpreter/JIT selector changes the execution mode for those scenarios. Keep “Compile” available as a guided chapter, and give each scenario an explicit starting state and reset/replay action.

Warmup, specialization, trace compilation, and fallback should emerge as consequences of the selected workload. Do not make the viewer manually press a button for every internal subsystem in order to get a valid run. Expose pause and step controls for explaining those consequences once they occur.

## Three levels of explanation

The screenshot combines an overview, labels and state on individual objects, and a larger component inspector. A bottom status strip summarizes the current run independently of the inspected component.

The visible inspector explains the executor in prose and includes a short waiting state. The status strip shows idle state, buffer occupancy, dirty count, hits, misses, and a log position. This separates “what this component does” from “what the system is doing now.”

Use the same distinction for CPython. The inspector should identify the selected component, explain its role, show its current state, and link to the relevant source. A compact run strip can show execution mode, phase, source location, call depth, and executor/exit information when relevant. Keep detailed statistics in the inspector rather than filling the footer with implementation counters.

Hover should preview a description; click or keyboard focus should pin it. Essential explanations must remain accessible without hover. Selection and execution activity need distinguishable outlines or markers, even when both use the same accent hue.

## Proposed CPython arrangement

Use the screenshot's stable neighborhoods and local state displays, with CPython-specific shapes and ownership boundaries. This is a layout proposal, not a claim about implemented geometry or physical memory placement.

| Neighborhood | Proposed contents | Relationship to the rest |
| --- | --- | --- |
| Source and compilation edge | Source, tokens, AST, scopes, CFG, assembly | Produces code objects; expands for the compilation chapter |
| Code-object shelf | Instructions, constants, metadata, inline caches, executor entries | Referenced by frames; reused across calls |
| Central execution area | Current frame, other activations, locals, operand stack, instruction cursor | Main focus during stepping |
| Object and environment area | Values, types, globals, selected object identities | Connected to frame slots by reference links |
| JIT extension | Recorder, raw trace, optimizer, optimized trace, installed executor | Revealed in JIT mode; entry and return connect to the same execution area |
| Build-time inset | Stencil preparation and stencil library | Feeds native emission; stays separate from the running program |

In interpreter mode, keep the JIT extension collapsed or clearly marked disabled. Enabling its view should preserve the position of the execution area and shared artifacts. Prefer this single-map mode switch as the default; side-by-side comparison remains an optional advanced view.

The compilation view can expand the front-end artifacts while reducing runtime detail. During execution, compact the finished front end into a recognizable neighborhood. This preserves context without keeping every AST node, opcode, object, and micro-op equally prominent at once.

## Readability and motion criteria

The reference achieves a restrained, cohesive look, but its screenshot also shows the legibility cost of dense detail and small text on oblique surfaces. Our explanation must remain readable at the intended presentation size.

Keep short labels on objects and detailed code in a screen-aligned panel. Offer a readable overview and focused views of a frame or trace. Avoid projected-label overlaps and prevent the inspector from covering the current action. Use subdued inactive connectors and emphasize only the route being explained, with arrowheads or travelling markers that establish direction.

Suggested motion has a specific meaning: a token enters a parser, an artifact is transformed, a slot gains a reference, the execution cursor advances, or a guard redirects control. These are proposals for CPython, not observed animations from the reference. Use spatially distinct routes for control and data, and keep the return from native execution to bytecode visible.

Before 3D implementation, storyboard one cold run, one warmed interpreter run, and one JIT run ending in a verified exit. Check that a viewer can identify the active operation, changed state, and reason for the next transition without rotating the camera. Validate these stories against [[presentation#Presentation approach#Evidence and validation plan]].
