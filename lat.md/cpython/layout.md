# Block placement and connection routing

The factory separates placement from routing. The implemented [[scene#Isometric factory scene#Compact placement]] compares Graphviz arrangements; libavoid, circuit routing, and geometric clearance validation remain planned.

This develops [[factory-world#Program-built factory world#Stable layout and controlled detail]]. The immediate scope excludes JIT machinery and native execution. Existing JIT research remains a future reference rather than a requirement for the first layout.

## Placement at two scales

Keep the infrastructure map authored and stable, while generating the program neighborhood from its code objects and control-flow graphs. Automatic layout should solve the variable portion of the scene.

Place parser/compiler, evaluator, frames, and object storage in explicit zones around the program plot. Measure component footprints, label space, and routing clearance before layout. Use a local coordinate system for each code-object enclosure; pack completed enclosures into the plot with space for connection corridors.

Use Graphviz dot to lay out basic blocks within each enclosure, with a consistent direction, ranks, and branch ordering. Supply fixed node dimensions, stable IDs, and stable input ordering. Treat loop-back edges separately in ranking and reserve perimeter lanes for their eventual routes. These are layout constraints, not a change to the program's edges. Exception edges and selected reference relationships can appear in additional inspection layers rather than forcing every possible relationship into the primary CFG layout.

Graphviz's [dot engine](https://graphviz.org/docs/layouts/dot/) provides directed layered layout, ranking controls, and crossing/length heuristics. It is a candidate placement engine, not a guarantee of optimal coordinates or stability after graph edits. Use local layouts to limit unrelated movement, and freeze positions for playback.

Read computed positions and dimensions from [Graphviz JSON output](https://graphviz.org/docs/outputs/json/), normalize its coordinate units, then perform grid compaction and collision checks. Do not merely round coordinates independently: that can close routing corridors or overlap enlarged footprints. Lay out on the ground plane before projecting it into 3D.

## Routing candidates

Evaluate obstacle avoidance and port handling separately from node placement. The preferred initial candidate is Graphviz for placement plus libavoid for orthogonal connectors.

| Candidate | Intended experiment | Constraint |
| --- | --- | --- |
| Graphviz alone | Establish a cheap baseline with orthogonal paths | Its documented orthogonal routing does not handle ports or dot edge labels |
| Graphviz plus libavoid | Route around measured footprints using named connection points | Must validate spacing, grid alignment, crossings, and browser integration |
| Graphviz plus Freerouting | Compare PCB-style clearance and multilayer routing on a difficult fixture | Requires a circuit-format adapter and a separate execution/deployment strategy |

Graphviz's [splines documentation](https://graphviz.org/docs/attrs/splines/) explicitly records the orthogonal-router port/label limitation. Its routes are useful for comparison but should not be assumed to attach correctly to our semantic ports.

[libavoid](https://www.adaptagrams.org/documentation/libavoid.html) is a native C++ connector router for interactive diagrams. It supports object-avoiding orthogonal paths. Its [routing controls](https://www.adaptagrams.org/documentation/router_8h.html) include shape clearance, segment and crossing penalties, port-direction penalties, and separation of nearby paths. These controls make it a closer fit than a general force-directed graph library, but penalties are not hard zero-crossing guarantees.

[Freerouting's routing options](https://www.freerouting.org/freerouting/manual/routing-options) support clearance rules, permitted layers, via choices, and route-length reduction. It is a useful experimental comparator for routing quality. Adapt block terminals to pins, independent connections to nets, obstacles to keepouts, and elevated routes to extra layers; export through a supported circuit format. Do not adopt physical-board assumptions such as electrically joining distinct control paths just because they meet the same component.

Graphviz can run in the browser through the native engine's [HPCC WebAssembly distribution](https://github.com/hpcc-systems/hpcc-js-wasm). Use JavaScript for orchestration, not a replacement layout algorithm. A pinned libavoid WASM build or suitable binding needs a feasibility check; browser deployment of the PCB comparator is not assumed. No native dot executable was found on PATH during this research.

## Ports and connection semantics

Each component declares its footprint, clearance envelope, and named ports before routing. Connections attach to exact terminals and retain their meaning throughout playback.

Ports specify position, allowed exit direction, and connection kind. A conditional block exposes distinct branch outputs with stable labels. Give loop-back routes dedicated entry lanes where needed. Route outward through a short unobstructed terminal stub before turning, avoiding ambiguous runs along a building edge.

Different connections may share a source without becoming one visual wire. Explicit junctions represent intentional branching; an incidental crossing is never a junction. Separate lanes for control flow and selected object references prevent a load operation from looking like a control transfer. Source spans and prose labels belong in readable panels or reserved areas, not over unconstrained wire segments.

## Clearance before shortest distance

Require legal endpoints and obstacle clearance first, then optimize crossings, bends, and route length. The shortest isolated path is not always the best route for the complete map.

Use a priority order: valid ports and no component penetration; no unmarked crossings or unrelated shared segments; sufficient wire spacing; few bridges; few bends; short total Manhattan length; minimal changes from a previous layout. Treat the exact relative costs as experimental parameters, and report route quality rather than claiming a global optimum.

A nonplanar graph cannot always be drawn crossing-free on one plane, and fixed ports impose additional constraints. On failure, widen a corridor or move blocks before escalating to an explicit bridge or underpass. A 3D bridge needs clearance from buildings and other routes and must remain understandable in the default camera. Two routes on separate heights can still overlap in screen projection, so inspect the projected view as well.

libavoid produces planar routes; bridge assignment and height changes would be our additional pass. Do not imply that this router automatically solves multilayer routing. If a route remains invalid, show a diagnostic in the prototype and retry layout with more space rather than silently drawing through an obstacle.

## Layout artifact and lifecycle

Persist a renderer-independent map description containing positioned components, ports, routed polylines, and any explicit crossings. Playback changes state and highlights, not the map's topology on every instruction.

The proposed artifact includes graph/version identity, component bounds, enclosure bounds, named terminal positions, edge semantics, ground-plane waypoints, bridge annotations, and layout diagnostics. The renderer turns these coordinates into buildings and paths; execution events refer to stable component and edge IDs.

Compute the complete static layout before the staged compilation reveal, then reveal its pieces in semantic order. This preserves the appearance of construction without repeatedly shuffling existing buildings. Runtime allocations use bounded display slots or expandable inspectors; they do not continuously relayout the CFG. New source triggers a new layout, with deterministic inputs and preservation of unchanged neighborhoods where practical.

## First routing experiment

Compare routing quality in a plain top-down view before adding 3D geometry. Use identical footprints, ports, and input graphs so placement changes do not disguise routing weaknesses.

Fixtures should include a straight chain, a branch/rejoin diamond, nested loops, multiple function enclosures, a high-degree shared target, explicit exception edges, and a deliberately nonplanar graph. Include two nearby source revisions to measure unwanted movement. Synthetic stress fixtures test geometry; source-derived CFGs test whether the result explains real code.

First compare Graphviz-only with Graphviz plus libavoid. Then try the PCB router on the hardest fixed-placement fixture. Record node overlaps, edge-obstacle collisions, endpoint/direction violations, unrelated segment overlaps, crossings, minimum clearance, bends, bridges, total length, bounds, runtime, and movement after an edit.

The acceptance gate is valid, readable geometry with stable playback, not the shortest wiring at any cost. Keep adapters behind one layout-artifact contract so the best routing approach can be selected from evidence. JIT layouts and 3D art are outside this first experiment.
