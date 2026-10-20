# Tokenizer and PEG replay

Parsing replay observes the pinned C tokenizer and generated PEG parser used by the capture runtime. Token acquisition, grammar-alternative checkpoints, and cursor rewinds are recorded separately from execution events.

## Capture boundaries

Observation starts immediately before parsing the submitted source into an AST and stops in a finally block. Runtime imports, source-limit token counting, and compilation from the resulting AST are outside this trace.

[[tools/instrument_parser.py#instrument]] patches only the disposable native and WASM source exports, starting from the pinned checkout revision on every build. It redirects generated parser debug checkpoints into bounded records, observes generated cursor restoration, hooks successful token-buffer acquisition, and instruments generated C AST constructors and C-to-Python AST conversion. It does not modify the user's CPython checkout or consume stderr as a trace protocol.

[[runtime/probe.c#parse_begin]] enables a fixed C buffer; [[runtime/probe.c#parse_end]] disables recording before constructing Python objects. At most 24,000 checkpoints are retained, with a dropped count for the omitted suffix. Text is bounded to 383 bytes and decoded with replacement if truncation splits UTF-8. Capture does not allocate Python objects in the hooks or abort parsing when this budget is reached. The runtime is a fresh, single-worker interpreter per run; the observer is process-global rather than a public thread-safe tracing API.

[[runtime/capture.py#capture]] includes an additive parsing artifact in capture schema 2. Records distinguish rule checkpoints, cursor rewinds, and tokens with kind, text, and source start coordinates. These are actual parser token requests, not a second Python tokenize pass presented as internal activity. Tokenization errors during the size precheck are deferred to the real parser, preserving syntax-failure traces.

The rule records describe attempted alternatives and success/failure checkpoints. They are not a complete function-entry/exit trace. Memo-table activity, every lookahead transition, and lexer character-state transitions are not captured. A failed alternative alone is normal PEG control flow, not necessarily a syntax error.

## Artifacts and map

Source, tokens, PEG/AST, and opcodes occupy four permanent lanes from left to right. Parsing and execution are independently seekable timelines on this shared map, without rerunning Python or replacing its geometry.

[web/parsing.mjs](../../web/parsing.mjs) projects recorded checkpoints into replay frames and bounds the visible alternative history to eight recent depth levels. The slider exposes every retained checkpoint. By default, play and step skip deep routine rule checkpoints while retaining token requests, cursor rewinds, and shallow alternatives; an Every checkpoint option restores detailed stepping. Rewind and AST result also control the timeline. Truncation is explicitly reported. Token tiles appear when acquired and the recorded cursor highlights its token and source line.

[web/factory.mjs](../../web/factory.mjs) arranges tokens in four-column rows and AST nodes in an ordered rooted tree. [web/ast-tree.mjs](../../web/ast-tree.mjs) packs sibling subtree contours by depth, preserving child order and centering parents over their children. It compares top-down and left-to-right orientations against a column-shaped footprint, retaining fixed tile dimensions. Orthogonal parent-child branches attach at the corresponding tile edges. Surface stage titles identify the pipeline; rule checkpoints remain in the parsing inspector. The shared footprint includes both artifact lanes in camera fit; opcode packing is scored independently. Inter-column chevrons appear only when both adjacent columns contain a visible tile, and hide again when replay or reset clears either column. [web/pipeline-chevrons.mjs](../../web/pipeline-chevrons.mjs) draws exactly three large golden-yellow chevrons per gap with thick antialiased strokes and faded strip ends. Their positions stay fixed while a brightness pulse advances toward the next column, illuminating each whole chevron. Reduced motion freezes the highlight; scene teardown disposes the strips. Individual artifact tiles keep fixed dimensions.

The AST is serialized with parent identities, node kinds, source lines, and bounded labels. Enum operators and expression contexts have no C node allocation and are omitted as independent tree nodes; operator kinds appear on their containing nodes. Syntax failures retain captured construction checkpoints without a final tree.

## Observed AST construction

C constructor checkpoints determine when nodes appear. Conversion-time identity matching identifies which constructions survive into the final AST; unmatched constructions remain separate from the retained tree.

[[runtime/probe.c#_FactoryAstCreated]] records the constructor kind, source byte span, and an internal arena address in the bounded trace. [[runtime/probe.c#_FactoryAstBind]] associates converted Python AST objects with those records while observation is active. [[runtime/probe.c#ast_id]] lets the capture serializer obtain event identities without emitting memory addresses. These temporary non-owning identity records are reset on each capture and never dereferenced after arena release.

[web/parsing.mjs](../../web/parsing.mjs) retains construction checkpoints during ordinary stepping. [web/factory.mjs](../../web/factory.mjs) reveals retained nodes at their recorded constructor event and shows a branch only once both endpoints exist. Constructions not retained in the final tree appear as labeled translucent ghost blocks near a matching retained node, or in the AST lane when no counterpart exists. All token flights use the same color. Up to twelve ghosts coexist and fade after 1.6 seconds; this visual lifetime does not claim a captured deallocation time. Seeking backward or leaving construction replay clears ghosts.

Token flights connect already-acquired tokens whose start positions lie within the constructor's recorded source span to the constructed node. Spanless helper nodes appear without invented token inputs. This is source-span correspondence at a real constructor checkpoint, not destructive token consumption or a claim that every covered token was directly consumed by that grammar action. The buffer remains intact for backtracking. The animation duration is illustrative; event order is observed. Reduced motion preserves highlights without moving particles, and backward seeking clears in-flight particles.

The initial reveal plays retained token/constructor checkpoints in order before revealing opcodes. Detailed parsing replay includes rule and rewind checkpoints too. A truncated trace explicitly reports omitted checkpoints; final nodes without a captured construction are only shown at the result position, never assigned a fabricated birth event.

## Execution correspondence

Each executing opcode highlights its recorded source line, tokens on that line, and AST nodes whose captured starting line matches.

Parsing shows source/token correspondence and token-to-AST construction activity. The subsequent opcode reveal shows only AST → opcode dashed links; earlier pipeline links are cleared. Execution retains synchronized artifact highlights but clears these links to keep evaluation readable. The links describe source locations, not recorded compiler dataflow.

[web/ast-tree.mjs](../../web/ast-tree.mjs) matches each instruction span to the smallest containing captured AST-constructor span. Token links use token starts inside those spans; missing spans remain unmatched. During compilation reveal, the current opcode link is brighter than other line-local opcode links.

[web/factory.mjs](../../web/factory.mjs) applies these highlights from the execution event and restores them when seeking or rewinding. Non-opcode and terminal positions clear correspondence highlights. Nodes without source locations do not receive inferred matches. The initial skippable reveal stages interleaved token acquisition and AST construction checkpoints, then opcode tiles; this is a presentation sequence rather than captured compilation timing.

## Verification

Native, WASM, and headless Chrome tests verify real token acquisition, grammar activity, cursor rewinds, successful AST results, syntax failures, fresh-run isolation, and switching between parsing and execution.

[[tests/test_capture.py#CaptureTests#test_real_parser_observation]] checks sequential token-buffer indices, indentation tokens, successful rule checkpoints, backward cursor movement, AST availability, and reset after failure. [[tests/test_capture.py#CaptureTests#test_parser_budget_keeps_compilation_working]] verifies truncation preserves parsing and subsequent captures. [tools/test_wasm.mjs](../../tools/test_wasm.mjs) asserts parser artifacts in the actual browser runtime. [tools/test_parsing.mjs](../../tools/test_parsing.mjs) exercises replay, rewind, AST visibility, execution restoration, and syntax-error rendering in headless Chrome.

[[tests/test_capture.py#CaptureTests#test_ast_constructor_identity_and_order]] verifies retained C-to-Python identities, constructor spans, child-before-parent ordering, and unmatched constructions. Graph tests verify tree depth and nonoverlapping node geometry; Chrome tests seek to a retained constructor and verify token-span correspondence and progressive node visibility.
