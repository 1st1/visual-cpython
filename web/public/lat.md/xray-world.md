# Program-built X-Ray world

The proposed visual direction is a Factorio-inspired map: persistent CPython machinery surrounds a program-generated neighborhood. Compilation builds that neighborhood; execution activates its blocks and nearby runtime machinery.

This is the user's requested spatial metaphor; [[scene]] records the first implemented renderer. It is not a claim that CPython runs a network of autonomous machines. It develops the stable layout in [[postgres-reference#PostgreSQL visual reference]] and the execution semantics in [[execution#Interpreter and JIT execution]].

The first implementation is interpreter-only. JIT structures below describe a deferred extension; omit them from the initial map and controls. Placement and connection routing are developed in [[layout#Block placement and connection routing]].

## The starting map

Before code runs, the map contains recognizable infrastructure and an empty program plot. The viewer can distinguish machinery that exists independently of the program from structures created for this run.

Place the source terminal and tokenizer/parser near the plot's entrance, followed by scope analysis, code generation, and assembly. Put the evaluator, frame area, and object/environment storage near the program plot. Reserve a connected area for recording, optimization, and executors in JIT mode. These are visual roles; operations such as parsing are not separate operating-system processes.

Use a tiled ground plane, modular structures, routed connections, and local indicators as the visual vocabulary. Use restrained accents on active elements, with sufficient solid surfaces and contrast to make the map readable. Exact art, scale, and camera styling remain open; the conceptual influence does not require reproducing game assets or interface chrome.

## Compilation constructs the program neighborhood

New program structures appear as the corresponding artifacts become available. A staged reveal explains compilation without falsely suggesting that successful parsing has already created executable instructions.

First reveal syntax as a blueprint: function boundaries, statements, branches, and loops appear in a source-linked AST view. Scope analysis annotates names and their relationships. Code generation and CFG construction then establish executable basic blocks and control-flow edges. Assembly completes the code-object structure and its metadata. See [[compilation#Shared compilation flow]] for the actual dependencies.

Default runtime blocks represent basic blocks inside a code-object enclosure. Each can expand to show its instructions and caches. A function's enclosure is shared by its calls; activation state appears separately. The module has its own enclosure. An AST node is not assumed to map one-to-one to an instruction or a basic block.

Use a preview layout to reserve positions before revealing structures. Blueprint geometry is an explanatory preview, not an artifact claimed to exist inside CPython. Keep source-to-AST-to-instruction mappings inspectable as representations change. A compilation error leaves the failing artifact highlighted and prevents execution; it should not produce a completed working xray.

## Execution activates the neighborhood

The execution cursor follows the program's control-flow routes while nearby machinery exposes the operation's effects. Geometry remains stable as state changes.

| Program event | Proposed visible activity |
| --- | --- |
| Function definition executes | A function object appears and connects to its already compiled code and environment |
| Function call | An activation appears in the frame area, arguments populate slots, and the cursor enters the callee |
| Local load or store | The relevant slot and reference route pulse; the operand stack updates |
| Arithmetic | The active instruction and evaluator light up; operands are consumed and a result becomes available |
| Conditional branch | The tested condition is shown and the selected outgoing route activates |
| Loop iteration | The cursor takes the back edge; iteration state changes without adding another copy of the loop |
| Return | The result passes to the caller and the completed activation retires |
| Exception | A distinct control route leads to a handler or unwinds activations |

Infrastructure near a selected block can expand into a local detail view of its frame slots, stack, and operands. This is another view of shared state, not a new evaluator or a copied heap. Pin the active frame to the selected function's vicinity when helpful, retaining its parent-frame link.

Conveyor-like motion means transfer of an artifact, reference, or execution cursor. The visual must distinguish these meanings by lane shape and markers. Loading a variable moves or copies a reference into a slot; it does not physically transport the heap object. In a single-threaded example, idle machines must not animate as though several Python instructions are executing concurrently.

## Optimization visibly changes the routes

Adaptive specialization changes an operation site within the existing program. JIT compilation adds a connected execution route for an observed hot path while retaining the original bytecode route.

In regular mode, a warmed instruction site gains a specialized label and visible cache/guard information. A guard miss shows fallback at that site. This is a change to how the operation executes, not new Python source code.

In JIT mode, the recorder follows actual execution and accumulates a micro-op strip beside the program. The optimizer produces a second, optimized strip. Native emission builds an executor connected to its real bytecode entry and continuation points. A trace can cross source/basic-block boundaries; it must not be confined to a single source statement by the layout.

The resulting route may look like a shorter production line, but its length is a visual encoding, not measured speed. Entry guards act as visible gates. A side exit routes execution back to bytecode or another captured executor; invalidation disables the affected executor. Keep the original path visible so the viewer understands the relationship. The build-time stencil preparation stays in its own inset rather than operating on every run.

The rendering should accept either captured native events or browser-generated interpreter events. A WASM interpreter does not establish native-JIT support; the native executor chapter must retain explicit capture provenance and the backend distinction in [[cpython#CPython visualization plan#Comparison boundary]].

## Stable layout and controlled detail

Use a deterministic grid layout with reserved space and routed edges. Execution should change highlights and contents, not continuously rearrange the world.

Group by code object, lay out basic blocks with a consistent forward direction, and route loop-back edges along the enclosure perimeter. Use separate ports and line styles for control flow, references, and compilation dependencies. Aggregate inactive reference links and expose them on selection to prevent a dense web of wires.

Reserve space beside code objects for frame inspection and JIT traces. Additional calls reuse the code enclosure; recursion adds activation entries, not duplicated function factories. Collapse deeper stacks and large collections with explicit counts. Semantic zoom moves from function/code-object overview to basic blocks to instructions and individual slots.

For program edits, start a new compilation/run and preserve positions for reliably matched unchanged structures when possible. Within a run, IDs and positions remain stable. Do not imply that arbitrary live code edits patch an executing frame. Layout must tolerate a small source program producing many runtime objects or events; the source-size limit does not bound the map.

## First storyboard and acceptance criteria

The first design exercise follows the accumulator example through construction, one cold execution, and repeated adaptive-interpreter execution. It uses the same map throughout; JIT execution is deferred.

1. Show the dormant infrastructure, source terminal, and empty plot.
2. Parse the source into an inspectable blueprint, then reveal compiled blocks and their connections.
3. Execute the module definition and call; show the function object and its first activation separately.
4. Step one addition and loop-back edge, showing local slots and the operand stack.
5. Replay warm execution with specialization visible at the affected instruction sites.
6. Change an input and show a verified interpreter guard-miss or branch transition, with the correct resulting state.

At each pause, the viewer should be able to identify what is executing, which state changed, why a connection lit up, and where execution can go next. Source selection should locate the corresponding map structures, and selecting a block should show its source and actual instructions. Construction animation must be skippable, and stepping must wait for transitions to settle.

The first implementation should validate this layout and state model with a plain schematic and recorded fixture before adding full 3D art. This preserves [[presentation#Presentation approach#Evidence and validation plan]] while making the evolving xray map the intended final presentation.
