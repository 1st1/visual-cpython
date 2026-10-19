# Glow visualization guidance

The local [Iso Glow skill](../../glow/iso-glow/SKILL.md) supplies reusable visualization guidance and templates. This extraction emphasizes interactive 3D while retaining links to the original recipes and optional styles.

The source package remains in [glow/iso-glow](../../glow/iso-glow). These sections describe its capabilities and authoring conventions, not an implemented CPython simulator. The user's requested medium is real 3D, covered by [[lat.md/glow/3d#Interactive 3D authoring]]; the SVG and Lumen modes are documented in [[lat.md/glow/alternatives#Alternative rendering styles]].

## Visual language

Default Glow styling is a monochrome hairline drawing on a dark panel, with one accent color reserved for active parts and signals. A live state must be recognizable at thumbnail size.

Use subdued structure and detail, and make at least one substantial live element clearly visible: a display, indicator, or active connection. Keep colors in the supplied theme and accent system so the palette picker works. Dark and light themes retain the same accent, except near-white accents need darker variants on pale backgrounds. Light mode removes ambient glow, bloom, and haze while retaining flat accent fills, lines, and text.

Give detailed surfaces a clear orientation toward the viewer. Start with a small decomposition of roughly three to eight main parts; place secondary detail on their surfaces. Avoid literal hues scattered through figure code. The filled, gradient-driven Lumen style has separate rules and is not the default.

## Meaningful interaction

Every figure needs an observable result of user input. Define that result before drawing, and connect visual activity to state rather than decorative motion alone.

Use one state object and one rendering function. Keyboard and pointer actions should call the same state transitions; a demo should exercise those transitions too. Keep the readout terse and informative. Animate using elapsed time rather than frame counts. Focus the stage after navigation so Space and Enter operate the figure. Audio must begin after a user gesture and tolerate failure.

For information-flow visualization, the useful transferable convention is that an active connection carries a visible pulse and the receiving component changes state. This is a visual convention, not evidence about CPython's actual stages or timing; those semantics still need separate grounding.

## Source assets and assembly

The package contains complete HTML shells and example figures. Reuse the shell infrastructure and insert custom figure modules at its designated placeholder.

| Asset | Purpose |
| --- | --- |
| [glow/iso-glow/assets/gallery-3d.html](../../glow/iso-glow/assets/gallery-3d.html) | Three.js renderer, cameras, interaction shell, themes, line rendering, and twelve built-in examples |
| [glow/iso-glow/assets/gallery.html](../../glow/iso-glow/assets/gallery.html) | Self-contained SVG gallery, projection kernel, palette picker, glow filters, and figure lifecycle |
| [[glow/iso-glow/assets/examples/desk-computer.js]] | Typing, power state, and a cable signal pulse |
| [[glow/iso-glow/assets/examples/office-tower.js]] | Window grids, floor toggles, and cascading lights |
| [[glow/iso-glow/assets/examples/lens-camera-3d.js]] | Exploded and sectioned physical-object reference |

The original [skill](../../glow/iso-glow/SKILL.md) includes starter figures and exact assembly commands. Those commands copy a shell, replace its title and brand text, and insert plain JavaScript into an existing script slot. Assert that each replacement target exists. Default to a single figure unless multiple figures are requested; custom 3D entries determine the visible tabs, with no tab bar for a single entry.

## Delivery and attribution

The upstream workflow favors a directly opened HTML artifact and lightweight validation. Its source instructions remain distinct from project-wide requirements.

The skill recommends rereading figure code, checking JavaScript syntax where applicable, opening the result in a normal browser, and explaining the controls. It discourages installing or launching browser automation for its fast path. That is an upstream delivery preference, not a technical limitation of the templates. Local preview panes can show static snapshots without running scripts.

SVG output is self-contained; the 3D template imports Three.js from a CDN and therefore needs network access unless dependencies are supplied locally. Do not describe that template as fully offline. The upstream statement that standalone 3D syntax checks fail merely because helpers are supplied by the page is inaccurate: syntax checking does not resolve helper names. Parsing must still use the appropriate script/module mode, and it does not validate runtime behavior.

Keep the muted “Made with ISO-GLOW” link to https://iso-glow.vercel.app by default; the user may request its removal. Do not turn it into an author credit. The [MIT license](../../glow/iso-glow/LICENSE) requires preserving its copyright and permission notice in copies or substantial portions; this is separate from the optional visible footer. The source credits April Zhu for Iso Glow and Tolga Cohce for Iso Figure.

The upstream object-design convention avoids company logos and trademarks on models and uses invented signage. Descriptive technical labels remain necessary for an educational explanation.
