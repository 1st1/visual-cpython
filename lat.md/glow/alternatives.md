# Alternative rendering styles

The package also provides SVG isometric figures and a filled Lumen treatment. These are alternative rendering paths, not the real orbitable 3D mode described in [[lat.md/glow/3d#Interactive 3D authoring]].

## SVG figures

The [SVG shell](../../glow/iso-glow/assets/gallery.html) projects three-dimensional authoring coordinates onto a fixed isometric drawing and supplies gallery navigation, themes, filters, and lifecycle helpers.

Figures register through `FIGS.push` with `id`, `name`, `hint`, `aria`, optional scoped CSS, and `mount(stage, api)`. Mount returns keyboard, key-release, unmount, and demo hooks. Prefix element IDs with the figure ID. Set accessible image semantics and an explanation of how to operate the figure.

The projection maps x down-right, y down-left, and z upward. Use the supplied projection and face-plane transforms instead of manually skewing polygons. Frame the figure from its extreme corners, including the tallest point. Draw opaque faces back to front: lower x+y and lower z first. Moving objects that cross other objects may need their paint order updated each frame.

Use flat face strips for trim against walls: full boxes have opaque tops that can cover surrounding geometry. Rounded boxes use a continuous side wall; rounding each face separately leaves misaligned corners. Non-scaling strokes preserve line width.

## SVG state and glow

The SVG API manages readouts, power haze, flashes, pulses, timed callbacks, and animation loops. Its timers and loops are cleared on unmount.

The shared CSS vocabulary separates structure (`face`, `detail`, `label`), controls (`press` with pressed or latched states), live glass and LEDs (`hot`), active wires, and travelling pulses. Use the replay helper to restart a pulse. The animation loop supplies timestamps; derive motion from elapsed time.

Use the template's color tokens and glow filters rather than literal hues. Filters on horizontal or vertical lines need user-space bounds because their geometry can have a zero-size bounding dimension. Escape user text before inserting it into SVG, and clip scrolling display text to its glass. Audio starts only inside a user gesture.

## Lumen treatment

The [Lumen reference](../../glow/iso-glow/references/lumen.md) defines filled, shaded SVG objects with geometric light and two-stop gradients. Lumen is opt-in and dark-only.

Assembly inserts [[glow/iso-glow/assets/lumen/kit.js|the kit]] before figure scripts and [[glow/iso-glow/assets/lumen/picker.js|the picker]] afterward, using the SVG shell. Examples are [[glow/iso-glow/assets/lumen/examples/card-terminal.js]], [[glow/iso-glow/assets/lumen/examples/vault-safe.js]], and [[glow/iso-glow/assets/lumen/examples/eth-blocks.js]]. The reference includes the exact assembly command and helper API.

Faces have a bright top, mid front, dark side, and subtle accent rims. Recesses have visible inner walls, and solid objects have thickness. Lit faces use the shared gradients; the picker controls both stops, angle, and offsets, and derives a body tint that stays rich when darkened. There are no single-color presets, and the picker forces the dark theme.

Light is crisp geometry rather than blurred bloom: cones, beams, seams, and pools. Keep one hero light visible at rest. Rising particles are small rotating squares; an opening uses one expanding cone that fades out in its upper third. These conventions differ from the hairline 3D restrictions and should not be mixed accidentally.

Idle animation pauses after interaction. Frame only the region occupied by the object and its movement. Reorder layers when rotating faces turn away, use a moving object's actual positions for its fading trail, and merge returning pieces into the solid silhouette. Figure-specific CSS must account for the kit's selector specificity.
