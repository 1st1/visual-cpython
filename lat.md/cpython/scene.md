# Isometric factory scene

The first 3D factory renders every decoded opcode as a separate tile on a ground plane. It shares graph identities, layout, and replay state with the schematic; it does not implement another Python evaluator.

[web/factory.mjs](../../web/factory.mjs) provides the Three.js renderer. It follows the restrained surfaces, edge outlines, orthographic camera, and event-driven activity described in [[lat.md/glow/3d#Interactive 3D authoring]]. This is the first scene slice of [[factory-world]], not the completed storyboard.

## Shared geometry

Layout schema 1 carries centered ground-plane coordinates for blocks, code-object enclosures, and sampled connection paths. Both renderers originate from the same Graphviz input and preserve stable semantic IDs during replay.

[web/layout.mjs](../../web/layout.mjs) converts Graphviz points and inch-sized nodes into a common unit, reverses the vertical axis, samples cubic path segments, removes redundant collinear points, and includes arrow endpoints. [web/layout-worker.mjs](../../web/layout-worker.mjs) returns this artifact alongside the SVG and engine version.

The scene maps layout x/y to Three.js x/z, with Three.js y representing height. Code objects become low platforms, basic blocks become grouping trays, and every decoded instruction gets its own outlined tile. Solid control routes use flat ribbons with bevel joins that preserve every routed bend. Shafts stop at a separate triangular arrowhead base; short final segments scale the head to fit. Routes sit above tray roofs; observed Python calls remain dashed violet lines. Heights are visual categories, not execution cost or memory size.

[web/connector.mjs](../../web/connector.mjs) builds the shared route geometry. [tools/test_connector.mjs](../../tools/test_connector.mjs) checks terminal placement, short segments, duplicate points, and tray clearance.

Graphviz's baseline routes still lack semantic ports, verified obstacle clearance, and bridges. Projection can occlude connectors, and crossings are not junctions. The scene does not certify these routes as valid factory belts. The routing experiments in [[layout]] remain outstanding.

## Compact placement

The layout worker fits the opcode neighborhood to the browser aspect ratio, comparing flow directions and instruction-grid shapes. Geometry stays frozen during playback.

[web/placement.mjs](../../web/placement.mjs) owns candidate scoring and the shared factory footprint. The score estimates the viewport area needed by opcode blocks, their enclosures, and routes at the current window width-to-height ratio, accounting for the default camera tilt. Earlier pipeline lanes do not influence opcode packing. Projected area and route length are secondary costs. Candidates combine top-down and left-to-right flow with four instruction-grid aspect targets, plus the original baseline. Tile dimensions stay fixed while the number of columns changes; the winning grid shape is shared by Graphviz and the 3D renderer. This is a readability heuristic, not a globally optimal routing claim. Graph tests check portrait versus wide opcode proportions, deterministic selection, tile containment, block non-overlap, and route endpoints. The selected options and all candidate scores, ground areas, and route lengths are retained in the layout artifact. Both schematic and 3D use the winning Graphviz output. The browser passes its window aspect to the layout worker; non-browser callers default to 1.8. Layout chooses the best-fitting candidate without stretching tiles to force an exact ratio.

Four titles drawn slightly above a grid-free header strip on the deck identify Stage 1: Source Code, Stage 2: Tokenize, Stage 3: Parse & Compile, and Stage 4: Run Code. Lane activity bounds include a 0.8-unit side margin around artifacts; opcode bounds include routed connections. All lanes share the same translucent deck and continuous base grid without opaque lane rectangles. Activity follows exact base-grid segments clipped to the padded lane bounds. Machine buildings are omitted; the flat operand column floats beyond the map’s right edge. The current map stays visible during capture and layout computation. Once layout is ready, the deck and all platforms switch to their final bounds in one scene rebuild. There is no platform growth or clipping reveal. The camera instantly compensates for changed projected map bounds, keeping the overall map at the same apparent framing instead of letting a larger map overflow the viewport. Token/AST/opcode construction replay continues within the final footprint. Failed compilation replaces the map with its source and available parsing artifacts. The layout-engine statistics badge is hidden; layout failures appear in the editor message area. Ground size follows the program bounds with a smaller minimum plot; the previous long row of five machines no longer determines the map depth. [web/graph.mjs](../../web/graph.mjs) supplies the compact block dimensions and wraps long operation labels to keep text inside them.

## Operand-stack rack

A flat column beside the map’s right edge displays operand tiles from top to bottom, parallel to the deck. It shows value previews, object IDs, and a top marker; the Stack camera preset provides a close view.

[web/stack.mjs](../../web/stack.mjs) projects the current event into at most eight visible slots, retaining the highest entries and their original bottom-based indices. An overflow count reports lower entries omitted from the rack. Internal NULL sentinels, tagged integers, and Python objects remain distinct; these are operand references and previews, not heap objects moving physically.

[web/factory.mjs](../../web/factory.mjs) reuses eight slot meshes and paints their upward-facing roofs from that projection, reversing display order so the top operand appears first. It updates slots immediately when stepping or rewinding. An empty or missing sample hides the entire column and its labels; the inspector retains the distinction between empty and not sampled. The column appears only for opcode replay events, including paused steps; capture, parsing, compilation, and terminal states hide it. Call, return, and exception events never retain another event's operands as if they were current. Frame changes use the new event's snapshot directly.

The first tile highlights and labels the top operand. There is no floating stack badge; frame identity and total depth remain available in the inspector. The full bounded capture remains available in the inspector. Texture labels only repaint when their content changes. The rack sits beyond the opcode-side deck boundary with a clear gap, centered along that edge. Placement scoring includes its width, and camera fit includes the full eight-tile column, so changing stack depth never causes layout to shift. The deck does not expand underneath it.

## Runtime activity and construction

The map uses four surface-titled pipeline lanes and a flat operand column. Machine buildings are omitted; recorded artifacts and lane highlights convey activity.

The [[parsing]] timeline reveals tokens and AST nodes from real capture checkpoints. Active animation brightens lane titles and sends cyan waves along the world-aligned grid lines, leaving the shared deck unpainted. Live capture line events briefly light the source lane. Tokenization and parse/compile light together during construction and parsing playback, avoiding per-event flicker. Execution playback lights the run lane. Idle, paused, stepped, and terminal states fade out lane glow. Grid intensity eases in and out over a fraction of a second; reduced motion changes it immediately. Reduced motion freezes the wave. [web/grid.mjs](../../web/grid.mjs) draws the base grid and animated brightness in one antialiased shader surface. Derivatives maintain continuous screen-space line coverage; cell interiors stay transparent. Header clipping preserves the separator’s full antialiased stroke and suppresses grid segments above it. Wave intensity and lane membership are sampled once per intersection-to-intersection edge at its midpoint, so highlights never end halfway along an edge. Wave troughs add no brightness above the idle grid. Internal lane boundaries taper over three grid units using whole-edge samples; outer deck borders remain fully eligible for highlighting. The grid remains depth-tested against content, but the underlying translucent deck does not write depth and draws first. This avoids thin-line rasterization gaps and deck/grid depth interference. Live source lighting follows sampled trace callbacks; replay lighting describes animation activity, not compiler timing. Real traced source lines highlight while the worker runs, before token/AST artifacts arrive.

Before a capture, source-line tiles appear beneath their lane title beside the empty downstream lanes. Once the complete layout arrives, the staged reveal replays observed token and AST-construction checkpoints, then reveals individual opcode tiles in source-line order. This skippable reveal stages already compiled artifacts; it is not a recording of parser/compiler timing or intermediate AST construction. Starting another run clears the prior opcode program immediately and retains the submitted source tiles.

[web/factory.mjs](../../web/factory.mjs) colors the active opcode tile hot orange, its containing tray, and the incoming recorded connection, distinguishes exception/unwind events, and updates the operand-stack column from the same event used by the inspector. Function activations reuse their code-object buildings. Detailed locals, operand values, output, and terminating frame chains remain in the inspector.

A brief pulse follows an observed incoming edge when event selection changes. It encodes that event's transition, not continuous execution while paused. Selecting another event ends construction immediately; rewind restores recorded state without regenerating geometry. Reduced-motion preference disables the reveal and moving pulse while preserving static highlights.

## Source quadrant and fullscreen workspace

The 3D world fills the viewport. Source, token, PEG/AST, and opcode lanes share one map, with collapsible editor and inspector overlays, persistent camera controls, and a bottom replay transport.

[web/app.mjs](../../web/app.mjs) previews editor changes before a recording exists. During and after capture, the world retains the submitted source; subsequent edits take effect on the next run. Each physical source line, including blank and comment lines, gets a tile. Columns contain at most 24 lines. Long tile text is ellipsized; the editor and source inspector retain the complete text.

[web/factory.mjs](../../web/factory.mjs) highlights the recorded source line together with the exact opcode. Parsing shows source/token links and AST construction activity. Opcode reveal shows only AST → opcode links; evaluation clears correspondence links while keeping artifact highlights. These links represent source-location relationships, not control flow or observed compiler data transfers. Missing source locations and non-opcode events have no execution-line highlight. Rewind restores both highlights; source and opcode geometry remain fixed. The Source quadrant camera preset provides an overhead reading view.

The inspector anchors program output at its bottom in a bounded scroll region. Locals and operand stack occupy separate scrollable columns above it; the remaining inspection content scrolls independently. Keyboard-focusable value and output regions contain scrolling so they do not pan the map.

[web/placement.mjs](../../web/placement.mjs) shares source-quadrant dimensions between scene construction and candidate scoring. Source-line, token, and AST-node counts are part of the derived graph. Window resizing debounces a fresh layout selection and camera fit; replay position, output, and selected block survive, and the compilation reveal does not restart. Resizing does not rerun Python. The initial opcode reveal illustrates completed compilation, not live parsing; reduced motion or advancing replay immediately reveals all instructions.

## Camera and selection

A 38° perspective camera supports angled and top presets, orbit, pan, zoom, fit, and focus. The default angled view faces the pipeline straight on, with level left-to-right lanes and a downward tilt. Trackpad scrolling pans; pinch gestures zoom.

The default angled preset uses 1.25× zoom over the fitted bounds and a small ground-plane pan to place the map lower in the viewport. The top preset remains centered at fit scale.

Capture, including final layout replacement and failure results, preserves viewing orientation, zoom relative to map fit, and pan normalized to map size. Camera distance scales by the ratio of new to old perspective-fit bounds and the target moves with the map center, without animation. Source edits also preserve navigation after the initial fit; explicit camera presets and viewport relayout can refit the map. Chrome checks compare orientation, normalized pan, and relative framing across recapture.

Building selection and the accessible block menu share the existing instruction inspector and recorded-visit navigation.

[web/app.mjs](../../web/app.mjs) switches between 3D and schematic without recapturing Python or recomputing layout. Ordinary wheel events pan in both screen axes, with line/page delta normalization and Shift-wheel horizontal panning. Ctrl-wheel pinch events zoom the camera directly and cancel browser defaults. Safari gesturestart/change/end events use relative gesture scale, also cancelling page magnification; duplicate Ctrl-wheel input during those gestures is ignored. Middle-drag pans, and touchscreen two-finger pan/pinch remains available. Toolbar zoom buttons remain explicit controls. The root document cannot scroll, and overlay scroll containers contain overscroll to prevent gestures from moving the page frame. Browser tests exercise ordinary wheel input and synthetic Safari gesture events, checking cancellation, camera zoom, and unchanged overlay bounds.

Pointer raycasts select buildings; the block menu offers keyboard access. Floating scene labels are omitted entirely. Machine names and instruction text remain on their physical surfaces; the minimap identifies pipeline regions, the inspector identifies code objects, and tile highlighting indicates execution. Focus opcode centers the current instruction (or the first instruction of a selected tray) in an overhead reading view.

[web/factory.mjs](../../web/factory.mjs) caps rendering at 2× pixel ratio and eight million pixels, resizes with its container, and pauses when hidden. [[scene#Isometric factory scene#Shared distance-field text]] replaces per-label canvas textures so the scene can use higher framebuffer resolution. Replacement disposes per-label geometry/materials while retaining shared glyph pages; teardown releases atlas pages, shadow targets, and background canvases. The capture handler stops parsing playback and clears its previous recording, frames, and tokens directly, retaining compatibility with cached parser modules that only expose stop. [tools/test_memory.mjs](../../tools/test_memory.mjs) runs three shortest-path captures at 2× display density, checking framebuffer/canvas budgets, zero per-label bitmap backing stores, bounded shared atlas storage, and stable GPU resource counts. These counters do not measure total browser-process or WASM peak memory. If WebGL initialization fails, the workbench selects the schematic; runtime capture remains available. A lost graphics context displays a message directing the user to the schematic or reload.

## Minimap navigation

A bottom minimap shows the four pipeline regions, the camera target, and the projected viewport footprint. Clicking or dragging recenters the camera without changing zoom or replay state.

[web/minimap.mjs](../../web/minimap.mjs) translates camera and orbit target together on the ground plane. Left/right buttons and arrow keys on the focused minimap pan along the pipeline. The footprint updates during orbit, zoom, focus, and resize. [tools/test_factory.mjs](../../tools/test_factory.mjs) checks pointer navigation and button/keyboard panning.

## Opcode tiles and inspection

Every decoded instruction has a persistent 3D box, including instructions never reached in the recording. Basic-block trays preserve control-flow grouping, while the exact executing opcode is highlighted independently.

[web/opcodes.mjs](../../web/opcodes.mjs) defines a serpentine instruction grid and formats decoded arguments. [web/graph.mjs](../../web/graph.mjs) sizes each Graphviz node to contain that grid before routing. [web/factory.mjs](../../web/factory.mjs) renders one tile per instruction and arrows between successive tiles. Trays appear with their first revealed instruction. Code-object enclosure platforms and outlines also stay hidden until their first opcode appears; parsing-only mode hides them again. Execution uses tile highlighting rather than a floating active-block badge. Internal arrows appear only after both adjacent tiles exist; inter-tray connectors wait for the source’s last instruction and the destination’s first. AST correspondence links also target revealed tiles only. Skip reveal and execution restore the complete graph without changing layout or camera. Inter-tray connectors remain basic-block control flow; internal arrows show instruction order. Fused bytecodes retain their decoded identity rather than inventing component instructions.

Each tile shows its offset, opcode name, and bounded decoded argument. Shared distance-field glyphs preserve character proportions; text is wrapped or ellipsized instead of stretched to fit. The screen-aligned Opcodes panel retains full captured instruction text, follows execution, or pins a selected tray. It can be hidden with the Opcodes button.

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

The scene uses perspective depth, directional shadows, a slow forward-flight starfield, cool blue accents, and translucent glass overlays. Text and opcode roofs retain contrasting surfaces for readability.

[web/factory.mjs](../../web/factory.mjs) uses beveled block geometry with restrained outlines, hemisphere fill, and a softer directional key above and behind the viewer that follows camera orbit. A 2,048-pixel percentage-closer-filtered shadow map uses a modest filter radius and reduced shadow intensity for gentle edges without variance-shadow bleeding; it is not a physically simulated area light. Shadow coverage follows the world bounds. Solid surfaces receive shadows, anchoring raised blocks to their platforms. Perspective fit accounts for corner depth, and source/opcode/stack focus plus minimap navigation use perspective camera distances.

[web/starfield.mjs](../../web/starfield.mjs) renders 36,000 deterministic stars: 32,400 cached distant points plus 3,600 nearer stars projected through depth, producing slow radial parallax with soft near-star halos and fade-in at depth wrap. [web/nebula.mjs](../../web/nebula.mjs) generates a cached warped fractal-noise texture with cloud filaments, dark dust lanes, and a muted rose core amid blue/teal gas and warm amber filaments. The far star layer drifts gently and scales with speed; caching keeps the dense field out of the per-star animation loop. Its clock is independent of playback and camera navigation; hidden scenes pause and reduced motion freezes the field. It reuses the renderer animation loop; background canvases cap pixel ratio at one and two million pixels. [web/stars.svg](../../web/stars.svg) remains a static fallback. [web/factory.mjs](../../web/factory.mjs) uses a transparent WebGL canvas and translucent deck so the starfield remains visible around and beneath the map. [web/style.css](../../web/style.css) gives overlays restrained borders, blur, and subtle gradients; Run & capture and execution playback use the same gentle cruising velocity, easing back to idle when inactive. Capture flight spans worker loading/execution, Graphviz layout, and the complete token/AST/opcode construction reveal. Worker completion hands off without deceleration; reveal completion or Skip reveal releases cruise. Both modes use the same acceleration and deceleration curves with no capture-only timed burst. Errors and cancellation release the capture contribution. Pause, stepping, seeking, reset, and playback completion stop the playback contribution. Motion changes only the background, preserving the map camera; reduced motion freezes it. Acceleration blends star colors toward icy blue and adds a faint blue central glow; slowing down restores the resting palette. This is an artistic forward Doppler cue, not spectral simulation. These effects indicate capture/playback activity, not measured execution speed. Chrome checks verify motion advances normally and freezes under reduced motion.

## Asyncio example

The example selector includes concurrent odd and even number tasks, demonstrating coroutine suspension and resumption with real one-second timer delays.

[web/programs/asyncio_numbers.py](../../web/programs/asyncio_numbers.py) runs two coroutines with asyncio.gather, printing odd numbers 1–9 and even numbers 2–10. Each sleeps between its prints, skipping the final unnecessary sleep so capture takes about four seconds within the five-second execution budget. WASM tests verify output and completion; Chrome checks load the example through the selector and capture it.

## Python syntax highlighting

The editor, source inspector, and 3D source tiles share a lightweight Python presentation lexer. Keywords, builtins, strings, numbers, comments, and operators receive consistent colors distinct from execution highlighting.

[web/python-syntax.mjs](../../web/python-syntax.mjs) preserves source text and handles multiline strings across source tiles. It is a display lexer rather than a Python parser; string interpolation is colored as a string. The editor uses a scroll-synchronized highlighted layer behind its native textarea, preserving ordinary editing and accessible text input. DOM highlighting uses textContent rather than HTML interpolation.

## Shared distance-field text

World-space labels share a bounded glyph atlas, keeping text sharp across zoom levels without a separate bitmap for each block.

[web/text-atlas.mjs](../../web/text-atlas.mjs) rasterizes each encountered character once into a temporary 64×64 canvas, computes a signed distance field, and packs it into single-channel 1,024×1,024 atlas pages. Up to four pages are retained per scene lifetime; unseen characters beyond that budget use a replacement glyph. Shared pages survive capture rebuilds and are disposed with the renderer.

Each label batches glyph quads by atlas page. A derivative-based shader reconstructs antialiased edges at the current pixel scale. Source syntax colors and execution highlighting are vertex colors, and tile backgrounds are ordinary colored planes. Labels remain real depth-tested geometry on block surfaces; no HTML label overlay is substituted. Memory savings fund the higher-resolution scene buffer, while the starfield retains its lower pixel budget.

Backing planes and glyphs use successively stronger constant and slope depth biases, with physical separation between layers. This prevents both crawling patches on tile faces during panning and missing letter fragments. Depth testing remains enabled for occlusion. [tools/test_text.mjs](../../tools/test_text.mjs) compares the complete tile surface above a solid block against an unoccluded reference at 45 combinations of pan, distance, and elevation.

## Opcode transition trail

A brief fiery orange trail connects the previous and current opcode tiles during forward replay, retracting toward the newly active instruction without covering either endpoint label.

[web/opcode-trail.mjs](../../web/opcode-trail.mjs) implements a world-space shader inspired by [cursor_blaze](https://github.com/0xhckr/ghostty-shaders/blob/main/cursor_blaze.glsl), using original GLSL with an amber-orange core, orange/red edges, subtle moving flame tongues, and a half-second retracting fade. The ribbon spans each tile’s footprint perpendicular to travel and interpolates between the two endpoint widths. One reused plane and material require no texture or framebuffer allocations. It shows observed execution-cursor movement, not an additional control-flow edge.

[web/factory.mjs](../../web/factory.mjs) triggers it only when the recorded event changes to a different opcode. Selection updates do not restart it. Reset, backward seeking, parsing, recapture, terminal events, and reduced motion clear or suppress the effect; teardown disposes its resources. [tools/test_opcode_trail.mjs](../../tools/test_opcode_trail.mjs) verifies orientation in every direction, expiry, reduced motion, and disposal. Headless Chrome scene checks verify the effect starts on a replay step and expires afterward.

## Grid continuity checks

The grid must remain continuous across close-up, distant, and oblique views, with identical geometry for idle and active states.

[tools/test_grid.mjs](../../tools/test_grid.mjs) samples visible grid edges and fractional-position header separators across 108 distance, elevation, pan, and activity combinations in headless Chrome, checking contrast against the deck and shader compilation errors.
