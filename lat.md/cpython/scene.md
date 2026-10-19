# Isometric factory scene

The first 3D factory renders every decoded opcode as a separate tile on a ground plane. It shares graph identities, layout, and replay state with the schematic; it does not implement another Python evaluator.

[web/factory.mjs](../../web/factory.mjs) provides the Three.js renderer. It follows the restrained surfaces, edge outlines, orthographic camera, and event-driven activity described in [[lat.md/glow/3d#Interactive 3D authoring]]. This is the first scene slice of [[factory-world]], not the completed storyboard.

## Shared geometry

Layout schema 1 carries centered ground-plane coordinates for blocks, code-object enclosures, and sampled connection paths. Both renderers originate from the same Graphviz input and preserve stable semantic IDs during replay.

[web/layout.mjs](../../web/layout.mjs) converts Graphviz points and inch-sized nodes into a common unit, reverses the vertical axis, samples cubic path segments, removes redundant collinear points, and includes arrow endpoints. [web/layout-worker.mjs](../../web/layout-worker.mjs) returns this artifact alongside the SVG and engine version.

The scene maps layout x/y to Three.js x/z, with Three.js y representing height. Code objects become low platforms, basic blocks become grouping trays, and every decoded instruction gets its own outlined tile. Solid control routes have narrow raised lines and arrowheads; observed Python calls remain dashed violet lines. Heights are visual categories, not execution cost or memory size.

Graphviz's baseline routes still lack semantic ports, verified obstacle clearance, and bridges. Projection can occlude connectors, and crossings are not junctions. The scene does not certify these routes as valid factory belts. The routing experiments in [[layout]] remain outstanding.

## Compact placement

The layout worker compares the original top-down arrangement with compact top-down and left-to-right alternatives. It fits the current window aspect ratio, then freezes geometry for playback.

[web/placement.mjs](../../web/placement.mjs) owns candidate scoring and the shared factory footprint. The score estimates the viewport area needed at the current window width-to-height ratio, includes source, token, and AST lanes plus runtime infrastructure, and uses projected area and route length as secondary costs. It matches the landscape camera orientation. This is a readability heuristic, not a globally optimal routing claim. The selected options and all candidate scores, ground areas, and route lengths are retained in the layout artifact. Both schematic and 3D use the winning Graphviz output. The browser passes its window aspect to the layout worker; non-browser callers default to 1.8. Layout chooses the best-fitting candidate without stretching tiles to force an exact ratio.

Tokenizer and PEG landmarks sit above their artifact lanes; the compiler sits beside the opcode area. Evaluator and frames share a compact side strip with a reserved stack rack. Ground size follows the program bounds with a smaller minimum plot; the previous long row of five machines no longer determines the map depth. [web/graph.mjs](../../web/graph.mjs) supplies the compact block dimensions and wraps long operation labels to keep text inside them.

## Operand-stack rack

A vertical rack displays observed operand entries from bottom to top. It shows the active frame identity, total depth, value previews, object IDs, and an explicit top marker; the Stack camera preset provides a close view.

[web/stack.mjs](../../web/stack.mjs) projects the current event into at most eight visible slots, retaining the highest entries and their original bottom-based indices. An overflow count reports lower entries omitted from the rack. Internal NULL sentinels, tagged integers, and Python objects remain distinct; these are operand references and previews, not heap objects moving physically.

[web/factory.mjs](../../web/factory.mjs) reuses eight slot meshes and paints their front faces from that projection. It updates slots immediately when stepping or rewinding. A missing sample clears the rack and says not sampled; a sampled zero-length stack says empty. Call, return, and exception events never retain another event's operands as if they were current. Frame changes use the new event's snapshot directly.

The top slot is highlighted and labeled in screen space as well as on its tile. The full bounded capture remains available in the inspector. Texture labels only repaint when their content changes. The rack footprint and camera fit include its maximum visible height, so changing stack depth never causes layout to shift.

## Runtime activity and construction

The map has a parser, compiler, evaluator, frames display, and operand-stack rack beside the generated program. Only runtime indicators respond to recorded execution; parser/compiler buildings are explanatory landmarks in execution mode.

The [[parsing]] timeline on the shared map drives parser indicators from real capture checkpoints.

Before a capture, source-line tiles appear beside the landmarks and empty opcode plot. Once the complete layout arrives, the staged reveal replays observed token and AST-construction checkpoints, then reveals individual opcode tiles in source-line order. This skippable reveal stages already compiled artifacts; it is not a recording of parser/compiler timing or intermediate AST construction. Starting another run clears the prior opcode program immediately and retains the submitted source tiles.

[web/factory.mjs](../../web/factory.mjs) colors the active opcode tile, its containing tray, and the incoming recorded connection, distinguishes exception/unwind events, and updates evaluator, frame-count, and the operand-stack rack from the same event used by the inspector. Function activations reuse their code-object buildings. Detailed locals, operand values, output, and terminating frame chains remain in the inspector.

A brief pulse follows an observed incoming edge when event selection changes. It encodes that event's transition, not continuous execution while paused. Selecting another event ends construction immediately; rewind restores recorded state without regenerating geometry. Reduced-motion preference disables the reveal and moving pulse while preserving static highlights.

## Source quadrant and fullscreen workspace

The 3D world fills the viewport. Source, token, PEG/AST, and opcode lanes share one map, with collapsible editor and inspector overlays, persistent camera controls, and a bottom replay transport.

[web/app.mjs](../../web/app.mjs) previews editor changes before a recording exists. During and after capture, the world retains the submitted source; subsequent edits take effect on the next run. Each physical source line, including blank and comment lines, gets a tile. Columns contain at most 24 lines. Long tile text is ellipsized; the editor and source inspector retain the complete text.

[web/factory.mjs](../../web/factory.mjs) highlights the recorded source line together with the exact opcode, connecting source → tokens → AST → opcodes with dashed fan-out and convergence links. These links represent source-location relationships, not control flow or observed compiler data transfers. Missing source locations and non-opcode events have no execution-line highlight. Rewind restores both highlights; source and opcode geometry remain fixed. The Source quadrant camera preset provides an overhead reading view.

[web/placement.mjs](../../web/placement.mjs) shares source-quadrant dimensions between scene construction and candidate scoring. Source-line, token, and AST-node counts are part of the derived graph. Window resizing debounces a fresh layout selection and camera fit; replay position, output, and selected block survive, and the compilation reveal does not restart. Resizing does not rerun Python. The initial opcode reveal illustrates completed compilation, not live parsing; reduced motion or advancing replay immediately reveals all instructions.

## Camera and selection

An orthographic camera supports isometric and top presets, orbit, pan, zoom, fit, and focus. Trackpad scrolling pans; pinch gestures zoom.

Capture, including its intermediate source-only scene and failure results, preserves camera orientation, pan, and effective orthographic zoom. Source edits also preserve navigation after the initial fit; explicit camera presets and viewport relayout can refit the map. Chrome checks compare the camera pose across recapture.

Building selection and the accessible block menu share the existing instruction inspector and recorded-visit navigation.

[web/app.mjs](../../web/app.mjs) switches between 3D and schematic without recapturing Python or recomputing layout. Ordinary wheel events pan in both screen axes, with line/page delta normalization and Shift-wheel horizontal panning. Ctrl-wheel pinch events zoom the camera directly and cancel browser defaults. Safari gesturestart/change/end events use relative gesture scale, also cancelling page magnification; duplicate Ctrl-wheel input during those gestures is ignored. Middle-drag pans, and touchscreen two-finger pan/pinch remains available. Toolbar zoom buttons remain explicit controls. The root document cannot scroll, and overlay scroll containers contain overscroll to prevent gestures from moving the page frame. Browser tests exercise ordinary wheel input and synthetic Safari gesture events, checking cancellation, camera zoom, and unchanged overlay bounds.

Pointer raycasts select buildings; the block menu offers keyboard access. Screen-aligned labels identify machines, enclosures, and the active block, hiding collisions rather than overlapping text. Focus opcode centers the current instruction (or the first instruction of a selected tray) in an overhead reading view.

[web/factory.mjs](../../web/factory.mjs) caps pixel ratio, resizes the renderer with its container, disposes old geometries/materials/textures on replacement, and pauses scene updates when hidden. If WebGL initialization fails, the workbench selects the schematic; runtime capture remains available. A lost graphics context displays a message directing the user to the schematic or reload.

## Minimap navigation

A bottom minimap shows the four pipeline regions, the camera target, and the projected viewport footprint. Clicking or dragging recenters the camera without changing zoom or replay state.

[web/minimap.mjs](../../web/minimap.mjs) translates camera and orbit target together on the ground plane. Left/right buttons and arrow keys on the focused minimap pan along the pipeline. The footprint updates during orbit, zoom, focus, and resize. [tools/test_factory.mjs](../../tools/test_factory.mjs) checks pointer navigation and button/keyboard panning.

## Opcode tiles and inspection

Every decoded instruction has a persistent 3D box, including instructions never reached in the recording. Basic-block trays preserve control-flow grouping, while the exact executing opcode is highlighted independently.

[web/opcodes.mjs](../../web/opcodes.mjs) defines a serpentine instruction grid and formats decoded arguments. [web/graph.mjs](../../web/graph.mjs) sizes each Graphviz node to contain that grid before routing. [web/factory.mjs](../../web/factory.mjs) renders one tile per instruction and arrows between successive tiles. Inter-tray connectors remain basic-block control flow; internal arrows show instruction order. Fused bytecodes retain their decoded identity rather than inventing component instructions.

Each tile shows its offset, opcode name, and bounded decoded argument. Textures preserve the physical aspect ratio and use anisotropic filtering; text is wrapped or ellipsized instead of stretched to fit. The screen-aligned Opcodes panel retains full captured instruction text, follows execution, or pins a selected tray. It can be hidden with the Opcodes button.

Clicking a visited tile or panel row seeks the next recorded occurrence of that code/offset, wrapping to the first if needed. Unexecuted panel rows are disabled; their tiles remain inspectable without fabricating execution. Follow execution clears the pinned selection. Only opcode events have an active instruction; call, return, unwind, and terminal positions do not falsely highlight a currently executing opcode.

[[runtime/capture.py#Observer#code]] includes bounded disassembly argument text, preserving variable names and arithmetic operators. Code constants use a stable code-name description rather than a process memory address. This is an additive capture-schema-2 field; [web/opcodes.mjs](../../web/opcodes.mjs) falls back to numeric arguments for older captures.

## Shortest-path example

The example selector includes a complete breadth-first search over a small unweighted graph. It exercises a queue, visited-path dictionary, nested loops, branches, subscripts, and a function return within the existing capture limits.

[web/programs/shortest_path.py](../../web/programs/shortest_path.py) is the canonical source served to the editor and used by tests. Its default graph returns the path from node 0 to node 5. It requires no imports, attribute access, or increased execution budget. The example is loaded on selection; loading failures are reported and stale requests do not replace a newer selection.

## Validation and packaging

Geometry tests verify stable IDs, finite route coordinates, matching node/enclosure counts, and route endpoints at target bounds. Headless Chrome exercises actual WebGL rendering and the fallback path.

[tools/test_graph.mjs](../../tools/test_graph.mjs) validates normalized geometry across the existing semantic fixtures, deterministic candidate selection, and a score no worse than the original candidate. [tools/test_factory.mjs](../../tools/test_factory.mjs) verifies idle infrastructure, capture-driven buildings, rewind, block-menu selection, ray picking, camera controls, view switching, clearing after syntax errors, observed addition operands/results, stack rewind, NULL versus None, bounded stack overflow, reduced motion, mobile overflow, and capture with WebGL disabled. Opcode checks cover one tile per decoded instruction, decoded operands, exact highlights, seeking, and the shortest-path output. Fullscreen checks cover viewport coverage, editor toggling, source preview with blank/comment lines, ordered pipeline lanes, tandem source/token/AST/opcode highlights, complete reveal, and clearing highlights at the terminal position. The shortest-path layout regression checks different selections for portrait and wide windows. Browser coverage verifies resize-driven layout uses the actual window ratio while retaining replay position and output. It saves screenshots for visual review.

[tools/package_web.py](../../tools/package_web.py) stages the pinned Three.js module, core, OrbitControls, and license from npm beside the other local browser assets. No CDN dependency is required. The existing schematic browser tests remain separate from the new scene checks.

## Space presentation

The scene uses a slow forward-flight starfield, cool blue active accents, and translucent glass overlays. Text and opcode roofs retain contrasting surfaces for readability.

[web/starfield.mjs](../../web/starfield.mjs) projects 680 deterministic stars through depth, producing slow radial parallax with soft near-star halos and fade-in at depth wrap. Faint overlapping violet and blue nebula gradients add diffuse depth behind the stars without obscuring the map. Its clock is independent of playback and camera navigation; hidden scenes pause and reduced motion freezes the field. It reuses the renderer animation loop and caps pixel ratio at two. [web/stars.svg](../../web/stars.svg) remains a static fallback. [web/factory.mjs](../../web/factory.mjs) uses a transparent WebGL canvas and translucent deck so the starfield remains visible around and beneath the map. [web/style.css](../../web/style.css) gives overlays restrained borders, blur, and subtle gradients; star motion is decorative and does not imply runtime activity. Chrome checks verify motion advances normally and freezes under reduced motion.

## Python syntax highlighting

The editor, source inspector, and 3D source tiles share a lightweight Python presentation lexer. Keywords, builtins, strings, numbers, comments, and operators receive consistent colors distinct from execution highlighting.

[web/python-syntax.mjs](../../web/python-syntax.mjs) preserves source text and handles multiline strings across source tiles. It is a display lexer rather than a Python parser; string interpolation is colored as a string. The editor uses a scroll-synchronized highlighted layer behind its native textarea, preserving ordinary editing and accessible text input. DOM highlighting uses textContent rather than HTML interpolation.
