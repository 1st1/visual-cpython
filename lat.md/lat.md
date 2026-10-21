# CPython X-Ray

CPython X-Ray runs an instrumented CPython interpreter in the browser, visualizing compilation and live opcode execution with a navigable 3D scene and runtime Inspector.

- [[cpython]] records the pinned CPython source baseline and interpreter/JIT research boundary.
- [[compilation]] describes the shared source-to-code-object pipeline.
- [[execution]] describes adaptive interpretation, JIT tracing, native execution, and exits.
- [[presentation]] proposes the narrative, visual entities, examples, playback model, and validation work.
- [[postgres-reference]] studies the supplied PostgreSQL visualization and translates its spatial and interaction patterns into CPython layout proposals.
- [[xray-world]] defines the program-built execution map, construction sequence, execution activity, and stable spatial layout.
- [[layout]] evaluates Graphviz placement and diagram/circuit routing for the interpreter-only map.
- [[v1-plan]] defines the interpreter-only first release, implementation milestones, feasibility gates, and acceptance criteria.
- [[scene]] describes the shared 3D geometry, camera, runtime indicators, and scene validation.
- [[program-graph]] describes bytecode block extraction, replay projection, and the Graphviz schematic.
- [[parsing]] documents observed tokenizer/PEG capture and the parsing replay map.
- [[runtime]] describes the implemented capture probe, build recipes, bounded recording, and diagnostic workbench.
