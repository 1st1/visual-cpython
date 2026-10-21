# Presentation approach

The proposed presentation follows one program through a shared compiler and two execution modes. This remains the narrative plan; [[runtime#Capture runtime]] describes the initial observation implementation, before xray rendering.

Build only the adaptive-interpreter mode initially. JIT examples and controls in this longer-term plan are deferred. The immediate spatial-design work is [[layout#Block placement and connection routing]].

The implementation sequence and release boundary are specified in [[v1-plan#First-version implementation plan]]. V1 targets bounded editable programs with real browser-side capture, with instrumentation fidelity evaluated explicitly before visualization claims.

The chosen spatial direction is [[xray-world#Program-built X-Ray world]]: persistent CPython infrastructure surrounds an initially empty program plot, compilation reveals connected program structures, and execution activates those structures and the machinery around them.

## One world with two execution modes

Keep source, compilation artifacts, code objects, and runtime state in stable locations. Switching modes reveals the additional JIT machinery while preserving the viewer's orientation.

Use a shared compilation chapter followed by “Adaptive interpreter” and “JIT enabled” execution chapters. An optional comparison layout can show independent runs side by side, aligned at semantic checkpoints such as function entry, loop iteration, and return. Do not align by equal numbers of bytecodes, micro-ops, or native instructions: these are not equivalent units of work.

The [[postgres-reference#PostgreSQL visual reference|PostgreSQL reference study]] motivates a persistent system map as the primary presentation: runtime state at the center, compilation at one edge, and a JIT extension connected to the same execution area. Workload buttons drive the story; chapters guide attention within this map. Detailed compiler artifacts expand when relevant and compact during execution.

The core explanation is that regular CPython learns about individual operation sites, whereas the JIT additionally records and optimizes an executed path across operations. The native path can rejoin the interpreter without changing Python semantics. See [[compilation#Shared compilation flow]] and [[execution#Interpreter and JIT execution]].

## Visual entities and flows

Use distinct shapes and labels for artifacts, active machinery, and runtime state. Reserve motion for a specific transformation, reference transfer, or control transfer.

| Entity | What the viewer can inspect | Meaningful interaction |
| --- | --- | --- |
| Source panel | Current source span and input | Select an expression or change a prepared input |
| Token stream and AST | Syntax structure and source mapping | Expand a subtree |
| Scope table | Binding classification | Select a name and see its storage category |
| CFG | Blocks and branch targets | Follow one branch and inspect its emitted instructions |
| Code object | Bytecode, caches, constants, metadata, executor entries | Toggle original and runtime representations |
| Frame stack | Calls, arguments, locals, return position | Step into or out of a call |
| Evaluation stack and object area | References, values, types, selected identities | Step an operation and follow its operands |
| Specialization site | Counter, cached assumptions, selected opcode | Compare cold, specialized, and guard-miss states |
| Trace recorder and optimizer | Observed path, guards, raw and optimized micro-ops | Match bytecode spans to micro-op groups |
| Stencil library and native executor | Patched code regions, entry, exits, dependencies | Expand copy-and-patch or take an exit |

A compiler arrow carries a representation; a runtime data arrow carries a reference or value; a control arrow carries the execution cursor. Distinguish these by shape, line pattern, and labels, not additional arbitrary accent colors. Active elements visibly respond to execution; exact 3D geometry and camera choreography come after the flows work in a plain view.

Object identity is logical, not a literal address. Locals and stack slots point to objects; objects do not fly bodily from one container to another on every load. Reference counting, allocation, and integer representation can be an advanced lens after the core narrative is verified. Keep native temporaries distinct from interpreter stack slots when their correspondence is not one-to-one.

## Candidate walkthroughs

Start with small programs that expose a clear mechanism, then confirm their actual behavior on the pinned build. These examples are candidates, not captured proof of a particular trace shape.

The first candidate is deliberately simple:

```python
def accumulate(n, step):
    total = 0
    for i in range(n):
        total = total + step
    return total

accumulate(8, 1)
```

Use the small input for source-to-bytecode and stack walkthroughs. Use a separately recorded warmup workload with larger inputs or repeated calls for specialization and JIT chapters; eight iterations are not claimed to trigger compilation. Captures should disclose the skipped warmup and its actual counts.

| Chapter | Proposed scenario | Question it answers |
| --- | --- | --- |
| Compile | The accumulator function and module call | How does text become an executable code object? |
| Execute | First call with integer operands | What do locals, operand stack, calls, and returns do? |
| Specialize | Repeated integer work with JIT disabled | What already gets faster in regular CPython? |
| Trace and compile | The same workload with native JIT enabled | What path is recorded, optimized, and installed? |
| Change assumptions | Warm with integers, then pass a float step | How does a different type remain correct? |
| Change control flow | A separate branch-bearing loop fixture | How does an unrecorded branch lead to a side exit? |
| Invalidate | A separately verified global or attribute dependency mutation | How does previously valid optimized code become unavailable? |

Keep type-change, branch-exit, and dependency-invalidation fixtures separate so each lesson has one cause. A float input may trigger different fallback behavior depending on the captured guards; do not label it a particular kind of exit before observing it. Add a helper-call example after the loop works to distinguish interpreter frame switching from JIT trace inlining.

## Playback model

Prefer deterministic replay of validated recordings with explanatory annotations. The browser should not claim to implement CPython or infer an actual native trace from a hand-written animation.

Plan three layers: capture/extraction of CPython artifacts, normalization into a versioned event stream, and renderer-independent playback. A 2D inspector should exercise that event stream before adding 3D. Backward stepping restores snapshots and replays events; it does not reverse a real Python process.

Each recording should include revision, build settings, platform/architecture, program and inputs, JIT mode, and extraction method. Each artifact or event should have a stable ID, semantic kind, source span when available, relevant code/frame/executor identity, instruction or micro-op position, state change, and provenance. Label provenance as captured, derived, or explanatory. Do not fabricate a source span for a synthetic instruction.

Capture raw and optimized representations separately. Proposed event families include artifact creation, frame push/pop, instruction execution, reference/stack update, specialization, recording start/stop, executor installation/entry, side exit, deopt, invalidation, and exception. The final schema depends on what instrumentation can reliably expose; not all listed events are currently available as public hooks.

Controls should include play/pause, step, back, reset, chapter selection, mode selection, speed, and an inspect panel. “Skip warmup” is an explicit timeline jump. Mode changes should restore the corresponding capture at a shared checkpoint or restart, rather than magically enabling JIT in the middle of a mismatched recording.

## Evidence and validation plan

Before drawing 3D, obtain a minimal set of artifacts and transitions from the pinned revision. Successful validation means correct semantics and provenance, not merely plausible animation.

Use AST, symbol-table, and disassembly facilities for externally inspectable compiler artifacts. CFG and preprocessing details may need internal test interfaces or dedicated extraction; do not imply ordinary `dis` exposes the compiler's full CFG. For runtime bytecode use the appropriate adaptive/cache-aware disassembly and clearly separate it from original code-object output.

CPython's [example_trace_dump.py](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Tools/jit/example_trace_dump.py) recommends a debug micro-op-interpreter build with stats to inspect trace structure. [_opcode.get_executor](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Modules/_opcode.c#L374) and [dis.py](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Lib/dis.py#L233) provide another inspection lead. These can validate trace concepts, but native execution and emitted machine code require a native-JIT build and its own evidence.

Avoid relying on `sys.settrace` to observe an otherwise unchanged JIT run: [stop_tracing_and_jit](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Python/ceval.c#L1090) checks tracing/profiling state before optimization, and [ENTER_EXECUTOR](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Python/bytecodes.c#L3550) can fall back for instrumentation. Assess capture perturbation explicitly. An opcode-step teaching trace and a native run may need separate captures linked at semantic checkpoints.

Validate equal outputs and exceptions across modes; consistent stack effects and frame lifetimes; real specialization and executor installation; correct continuation after exits; and at least one evidenced optimization. Preserve raw diagnostic output alongside normalized fixtures. Do not claim a speedup from animation speed or debug-build timings.

The next implementation milestone is a reproducible interpreter artifact bundle for one program plus a plain replay inspector and validated block routing. Then add a verified interpreter branch or guard-miss scenario, and only then use [[scene]] to render the same state transitions spatially. JIT, full memory management, concurrency, generators, imports, and performance benchmarking are deferred. On-demand capture for small editable programs remains a feasibility direction, not an implemented capability.
