# CPython visualization plan

This directory contains source-grounded research and proposed presentation flows for regular CPython and its experimental JIT. The user explicitly requested planning in Lat; the presentation and data capture are not implemented.

Current implementation scope is the adaptive interpreter only. JIT research is retained for a later phase; it must not block the first program layout, execution capture, or visualization.

- [[compilation]] describes the shared source-to-code-object pipeline.
- [[execution]] describes adaptive interpretation, JIT tracing, native execution, and exits.
- [[presentation]] proposes the narrative, visual entities, examples, playback model, and validation work.
- [[postgres-reference]] studies the supplied PostgreSQL visualization and translates its spatial and interaction patterns into CPython layout proposals.
- [[factory-world]] defines the program-built factory map, construction sequence, execution activity, and stable spatial layout.
- [[layout]] evaluates Graphviz placement and diagram/circuit routing for the interpreter-only map.
- [[v1-plan]] defines the interpreter-only first release, implementation milestones, feasibility gates, and acceptance criteria.

## Source baseline

Research uses the clean local CPython checkout at commit `036d309cf542986a39eeba5ca805b2ec7619731d`, identifying itself as `3.16.0a1+dev`. Claims are scoped to this snapshot, not to all Python releases.

The version comes from [patchlevel.h](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Include/patchlevel.h#L23). Source citations are pinned to that commit so this graph remains useful without the ignored local checkout. The installed Lat CLI does not expose the external-source registration command described in the project instructions, so citations use ordinary pinned source links.

The root [.gitignore](../../.gitignore) excludes the local `/cpython/` checkout and macOS metadata. The checkout is research input, not vendored presentation code. No CPython source was changed or built during this research; exact bytecode listings, traces, thresholds, and performance remain to be captured.

## Comparison boundary

The proposed modes are the adaptive bytecode interpreter with JIT disabled and the same CPython revision with native JIT enabled. They share the front end, Python semantics, and initial interpreter execution.

Use a conventional GIL-enabled build for the first comparison. In this revision, [_PyOptimizer_Optimize](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Python/optimizer.c#L129) has a free-threaded conditional that does not take the normal optimization path. Free threading is a separate topic, not a switch to combine casually with the JIT demonstration.

The [configure options](https://github.com/python/cpython/blob/036d309cf542986a39eeba5ca805b2ec7619731d/Doc/using/configure.rst#L447) distinguish no JIT, enabled native JIT, native JIT disabled by default, and a micro-op interpreter for debugging. The latter is valuable for inspecting traces but must not be labeled native machine-code execution. The tail-call interpreter is also a dispatch implementation, not the JIT.

For matched recordings, prefer the same JIT-capable executable in separate processes with `PYTHON_JIT=0` and `PYTHON_JIT=1`, after checking build support. Record build flags, architecture, input, and revision with every capture. A no-JIT build is another valid baseline but introduces additional build differences.
