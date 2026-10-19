# Lumen style (solid, lit)

Lumen is iso-glow's second look: **solid, lit objects** instead of hairline drawings. Faces are filled with accent-tinted gradients, lit parts are solid accent, and light is drawn as geometry (cones, beams, sheets of light) rather than blur. It is made for **product showcases and web illustration**: landing-page heroes, feature sections, onboarding and empty states, fintech / crypto / SaaS explainers.

The kernel, figure contract, gallery template and palettes are the same as hairline iso-glow. Only the shading layer changes. Use Lumen when the user asks for Lumen, "solid", "filled", "3D-looking icons", product or landing-page illustrations, or references glossy isometric icon sheets; otherwise default to hairline.

## Fast path

1. Write figures to `fig.js`, one `FIGS.push` each, using the kit (`RW`, see below). Start from `assets/lumen/examples/` (card terminal, vault safe, ETH blocks): copy the closest one and change it.
2. Assemble: the kit goes **before** the figures and the picker **after** them.

```bash
python3 - "<skill folder>/assets" NAME.html fig.js "NAME" <<'PY'
import sys
assets, out, fig, name = sys.argv[1:5]
s = open(assets + '/gallery.html').read()
code = '\n'.join(open(p).read() for p in [assets + '/lumen/kit.js', fig, assets + '/lumen/picker.js'])
pal = "palette: [['Lumen','#a3e635','#d6f79f','#a3e635','#d6f79f']], autoDemo: true, storageKey: 'iso-glow-lumen'"   # one base entry; the picker drives colour
for a, b in [('<title>Iso Figures</title>', f'<title>{name}</title>'), ('Iso figures</span>', f'{name}</span>'),
             ("palette: 'ember', autoDemo: false, storageKey: 'iso-glow-accent'", pal), ('/* paste figure scripts here (see examples/) */', code)]:
    assert a in s, a
    s = s.replace(a, b, 1)
open(out, 'w').write(s)
print('wrote', out)
PY
```

3. Check and finish exactly as in hairline mode (`node --check`, open the page, no headless browsers). The kit installs its shared classes itself; a figure's own `css` holds only its extras.

Lumen is **gradient-only**: there are no single-colour presets. The picker shows the gradient presets as swatches right in the header, plus a Custom chip that opens the editor (a gradient bar with two draggable stops, stop colour / hex / position %, an angle dial, reverse, rotate). It sets `--accent` / `--accent2` and the angle + stop offsets of the shared `#rw-theme` / `#rw-themehi` gradients. Flat lit parts use `fill:url(#rw-theme)` (or `#rw-themehi` for the brightest), never `var(--accent)`. Presets: Aurora, Sunset, Ocean, Nebula, Solar, Mint, Ultraviolet, Rose gold — neighbouring hues, both ends bright. Object bodies are tinted by `--rw-tint` (use `RW.mixT(p)` for body colours): the picker sets it to the stop that stays rich when darkened, because orange/gold/yellow turn muddy brown on dark faces. **Lumen is dark-only**: the picker locks `data-theme="dark"` (ignoring the system setting and any theme toggle), because the lit look depends on a dark stage.

## The look, as rules

- **Faces**: never grey hairline outlines. `RW.kit(K).box()` shades the top lightest, the front mid, the side darkest, with a soft accent rim on the near top edge and a thin lit strip down the front corner.
- **Surface offsets**: real objects have tiers: plinth, recessed groove band, body, raised frame round a sunken deck, screens set into faces. Use `recess()` for every pocket (slot, screen, opening); its inner walls show on the correct sides automatically.
- **Glow is geometry, not blur**: lit strips are solid full-brightness accent; wells have lit inner walls and a bright floor; halos are low-opacity crisp shapes. Never a bloom blob.
- **Light rising from an opening**: ONE expanding cone, `cone(cx, cy, z, r0, r1, h)` (round base on the opening, top about 1.5–1.75 × wider), fully transparent in its top third, no edge lines, no rays, no second cone. Rejected alternatives: a capped cylinder (reads as a glass jar), a square prism, back faces only.
- **Directional light** (a lamp, an open door): `coneAx(from, to, r0, r1)` filled with a `userSpaceOnUse` linear gradient running from the source to the target, fading out.
- **One hero light visible at rest** in every figure (cone, beam, sheet of light, lit seam), so it reads at first glance before anything happens.
- **Particles**: small squares at random angles, slowly spinning, rising (`motes()`); floating accent squares around the object (`dot()`). Never circles or rings.
- **Floor**: `ground()` gives a contact shadow, a faint accent pool and two circular floor rings (the outer one dashed and slowly turning).
- **Solid things have thickness**: cards, coins, discs and doors are stacked layers (`ext()`), with a soft radial shadow under hovering parts. A hard-edged rect under a soft filter shows as a black bar.
- **Glyphs on dark faces glow**; the face around them stays dark (e.g. a coin: dark olive face, lime glyph).
- **Frame tight**: frame points only where the object and its moving parts actually go; one high outlier shrinks the whole figure.
- **Every figure animates on its own**: `RW.auto(api, stage, period, step)` runs the main action when idle and pauses after any click or key (call the returned `mark()` in `key`).

## Kit API

`RW.defs` gradients (prepend to the svg) · `RW.mix(p)` / `RW.mix2(p)` accent / gradient-end tint at p % · `RW.auto(api, stage, ms, fn)` → `mark()`.

`const G = RW.kit(K)` (K from `api.iso.frame`):

| helper | draws |
|---|---|
| `box(x,y,z,w,d,h,r,cls,topCls)` | shaded rounded box: side, front, corner light, top, rim |
| `cyl(cx,cy,z,r,h,sideCls,topCls)` | upright cylinder |
| `cylAx(p0,p1,r,sideCls,capCls)` | cylinder along any axis (gavel heads, lamp arms, pens) |
| `cone(cx,cy,z,r0,r1,h)` / `coneAx(p0,p1,r0,r1)` | light cone path `d` (vertical / any axis) |
| `recess(shape,tfOpen,tfFloor,wallCls,floorCls,extra)` | sunken pocket; `shape(cls, transform)` returns ONE element |
| `ext(tf, n, inner, face, edgeCls)` | thickness: n layers of `inner`, then `face` |
| `ground(cx,cy,rx,ry)` | shadow, pool, floor rings |
| `motes(group, {cx,cy,r,z0,h,n})` → `tick(t, level, speed)` | rising square particles |
| `dot(x,y,z,size,id)` | floating accent square |
| `above(id, y, z)` | clipPath for things sinking into a slot in plane y |
| `ring3`, `poly`, `hull`, `arc`, `wall`, `d3` | geometry helpers |

Classes: faces `rw-top rw-front rw-side rw-cyl rw-edge rw-pit rw-wall rw-paper rw-cardf`; lit `rw-lit rw-litcyl rw-orb rw-litwall rw-flat rw-hi rw-line`; light `rw-cone rw-lface rw-beam rw-column rw-halo rw-pool`; detail `rw-etch rw-rim rw-lip rw-txt rw-ink`; particles `rw-dot`.

## Lessons

- Figure CSS that overrides a kit class needs `#stage[data-fig="id"] .x.rw-top`; `[data-fig] .x` loses to the kit's `#stage .rw-top`.
- The light-mode helper must prefix every selector in a list; prefixing only the first hid every glow in dark mode too.
- A sweep along a path: draw a short fading tail from the moving object's own positions; a dash on a `pathLength` path drifts away from it, because equal parameter steps aren't equal lengths.
- Rotating doors and tilted parts: re-order layers when a face turns away (`dot(normal, [1,1,1]) < 0`).
- Objects seen end-on vanish: tilt pens and similar parts across the view axis, not along it.
- When a cube or chunk returns home, merge it back into the solid shape so the silhouette stays clean.
- Preview servers can't read `~/Desktop` on macOS; serve a copy from a scratch folder to screenshot it.
