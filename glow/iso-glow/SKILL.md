---
name: iso-glow
description: Build interactive isometric line-art figures with glow lighting in a single HTML file — a dark hairline drawing where whatever is live glows in one accent colour (pressed keys, lit screens and windows, beams, wires with travelling light pulses), plus an accent-colour picker. One figure, or a gallery of several figures with sidebar navigation. Also builds the same look in real 3D (three.js: orbit, true isometric view, revolve), including cleaning up a user's own .glb model into iso-glow hairlines. Also has a Lumen style: solid, lit, filled objects with geometric light cones, for product showcases and web/landing-page illustration. Use for isometric objects, devices, buildings and cityscapes, "Fig N" plates, glowing interactive isometric illustrations, Lumen / solid isometric product illustrations, and 3D versions of them, including exploded and sectioned real objects.
---

# Iso glow

Interactive isometric figures with glow lighting. Builds on **iso-figure** by Tolga Cohce (MIT, github.com/MrBongoC/ai-iso-skill): the projection kernel, the "Fig N" plate and the rule that every figure must do something real all come from there. This skill adds the lighting, colour palettes, a multi-figure gallery shell, and lessons from building twenty figures (desk objects and city buildings).

## The look in one sentence

A monochrome hairline drawing on a dark panel; **one accent colour, only on what is live** — and live things glow. Lit display content, the key you just pressed, a floor whose lights are on, a wire carrying signal, a sweeping beam. That contrast is the whole effect.

## Fast path (follow this; it is quick and can't hang)

You never need to open `assets/gallery.html` or the example files. Everything required is on this page.

1. **Write the figure to `fig.js`** in the working folder, starting from the starter below. Default to **one figure** unless the user asks for several (then put several `FIGS.push` calls in the file). Aim for roughly 150–300 lines.
2. **Assemble the page with this one command** (it copies the template, sets the name and palette, and inserts `fig.js`). Replace `<skill folder>` with the base directory shown when this skill loaded (usually `~/.claude/skills/iso-glow`), `NAME` with the piece's name and `PALETTE` with `ember` (default) or `city`:

```bash
python3 - "<skill folder>/assets/gallery.html" NAME.html fig.js "NAME" PALETTE <<'PY'
import sys
src, out, fig, name, pal = sys.argv[1:6]
s = open(src).read()
for a, b in [('<title>Iso Figures</title>', f'<title>{name}</title>'), ('Iso figures</span>', f'{name}</span>'),
             ("palette: 'ember'", f"palette: '{pal}'"), ('/* paste figure scripts here (see examples/) */', open(fig).read())]:
    assert a in s, a
    s = s.replace(a, b, 1)
open(out, 'w').write(s)
print('wrote', out)
PY
```

   No Python? Copy the template (`cp`) and make the same four text replacements with your edit tool, without reading the rest of the file.
3. **Finish without browser automation.** Do **not** install or launch Playwright, Puppeteer, headless Chrome or any other browser tool: they need downloads or can hang indefinitely. Instead re-read `fig.js` once for obvious mistakes (`node --check fig.js` if Node is available), open the page in the user's normal browser and return immediately (`open NAME.html` on macOS, `xdg-open` on Linux, `start` on Windows), and tell the user what to click or press. If they report a problem, fix that. Some preview panes show local `file://` pages as static snapshots without running scripts, which makes a working page look blank.

### Starter figure (complete and working: a lamp whose window lights up)

```js
FIGS.push({
  id: 'lamp', name: 'Lamp', hint: 'Click the lamp · space toggles', aria: 'Isometric lamp. Click it or press space to switch it on.',
  mount(stage, api) {
    const K = api.iso.frame([[0,0,0],[200,0,0],[0,160,0],[200,160,0],[70,50,98]]);   // extreme corners incl. tallest point
    const { TOP, FRONT, box } = K;
    let svg = box(0,0,0, 200,160,8, 12);                                                 // ground plate
    svg += `<g transform="${TOP(0,0,8)}"><rect class="detail" x="8" y="8" width="184" height="144" rx="8"/></g>`;
    svg += `<g class="press" id="lamp-body">${box(70,50,8, 60,60,90, 6)}</g>`;          // pressable body
    svg += `<g transform="${FRONT(70,110,98)}"><rect id="lamp-glass" class="face led" filter="url(#soft)" x="10" y="12" width="40" height="40" rx="4"/></g>`;
    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;
    const st = { on: false };
    const glass = stage.querySelector('#lamp-glass'), body = stage.querySelector('#lamp-body');
    function render() { glass.classList.toggle('hot', st.on); api.power(st.on); api.readout(st.on ? 'on' : 'off'); }
    const toggle = () => { st.on = !st.on; render(); };
    body.addEventListener('click', toggle);
    render();
    return { key: e => (e.key === ' ' || e.key === 'Enter') ? (toggle(), true) : false, demo: () => api.after(200, toggle) };
  },
});
```

Grow this: more `box()` parts for the object, detail drawn on face planes (`FRONT`/`SIDE`/`TOP` groups), one state object, one `render()`, keyboard and click calling the same functions, and a `demo()` that leaves it lit. Only what is live gets the accent (`.hot`, `.lit`, `.latched`).

## Start from the template

`assets/gallery.html` is a complete, self-contained page: tokens for dark and light themes, glow filters, the shared CSS vocabulary below, the kernel, navigation, the palette picker, and an empty slot for figures. Copy it (never read it), set `<title>` and the brand text, choose a palette in `window.GALLERY`, and paste the figure code over the placeholder `/* paste figure scripts here (see examples/) */`. The placeholder is already inside a `<script>` tag, so paste plain JavaScript (one `FIGS.push({...})` per figure), not another `<script>` tag. With one figure the sidebar simply lists one item; delete the nav if you want a bare plate.

`assets/examples/desk-computer.js` (typing, power toggle, coiled cable with a light pulse) and `assets/examples/office-tower.js` (window grids, floor toggles, cascading lights) are complete figures. You don't need to read them; the starter figure above shows the structure.

## Figure contract

```js
FIGS.push({
  id: 'lamp', name: 'Desk lamp', hint: 'Click the switch · ↑↓ dim', aria: 'Isometric desk lamp. …',
  css: `[data-fig="lamp"] …`,            // optional, always scoped to the figure
  mount(stage, api) {                      // stage: a fresh <svg> per mount
    const K = api.iso.frame([/* extreme 3D corners, incl. the tallest point */]);
    const { P, D, TOP, FRONT, SIDE, rect, box, boxc, path } = K;
    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;
    // listeners on stage; one state object; one render()
    return { key(e) { /* true if handled */ }, keyup(e) {}, unmount() {}, demo() {} };
  },
});
```

`api`: `iso.frame(points)` (kernel + 4:3 viewBox), `iso.slits(a0,a1,step,b0,b1,vertical=true,cls='detail')` (parallel hairlines at a0, a0+step … a1, each spanning b0→b1, in face-local units; vertical lines by default), `iso.esc`, `readout(str)`, `audio()` → `{ctx,out,analyser}` (call inside a user gesture), `after(ms,fn)` / `every(ms,fn)` / `loop(fn)` (all auto-cleared on unmount; `loop` calls `fn(timestampMs)` every animation frame and returns a stop function, so animate from the timestamp rather than counting frames), `flash(el)` (press + glow, then fade), `replay(el,'go')` (restart a one-shot animation such as a pulse), `power(bool)` (warm haze behind the figure while it is on). The figure's `name` becomes the "Fig N · Name" label, the sidebar entry and the browser-tab title; the template's brand text (`Iso figures`) is the only other name to change. Prefix every id with the figure id. `demo()` is a short scripted sequence using the same functions as real input; it runs with `?demo`, or on every arrival when `GALLERY.autoDemo` is true, so a figure can open already lit.

## Kernel (from iso-figure)

```js
const C = Math.cos(Math.PI/6), S = Math.sin(Math.PI/6);
const P = (x,y,z) => [(x-y)*C + OX, (x+y)*S - z + OY];
const D = (x,y,z) => [(x-y)*C, (x+y)*S - z];
const plane = (O,U,V) => { const o=P(...O), u=D(...U), v=D(...V); return `matrix(${u[0]} ${u[1]} ${v[0]} ${v[1]} ${o[0]} ${o[1]})`; };
const TOP   = (x,y,z) => plane([x,y,z],[1,0,0],[0,1,0]);
const FRONT = (x,y,z) => plane([x,y,z],[1,0,0],[0,0,-1]);   // y = max face, lower-left
const SIDE  = (x,y,z) => plane([x,y,z],[0,-1,0],[0,0,-1]);  // x = max face, lower-right
```

+x runs down-right, +y down-left, +z up. Draw ordinary rects, text and paths inside `<g transform="${FRONT(x, y+d, z+h)}">` (face top-left corner, local v grows downward) and they land on the plane. A box is its three visible faces. `box(x,y,z,w,d,h,r)` always draws a full, opaque top over its whole footprint, so don't use it for thin trim, ledges or bands that sit against a wall (the top would cover what is above or behind); draw those as flat strips on the wall's FRONT/SIDE plane instead. `rect(transform, w, h, r = 0, cls = 'face')` draws one rectangle on a plane, e.g. `rect(FRONT(x, y+d, z+h), w, 4, 0, 'face')` for a strip. Paint order is the only depth sort: back to front (smaller x+y first, lower z first). Faces need opaque fills. `vector-effect: non-scaling-stroke` on every stroke.

## Glow kit (classes in the template)

| Class | Use |
|---|---|
| `.face`, `.face.top`, `.face.recess`, `.detail`, `.label` | structure, decks, insets, hairline texture, printed text |
| `.press` + `.down` / `.lit` / `.latched` | pressable part; sinks 3px; transient orange glow (`api.flash`); persistent on-state |
| `.glass` + `.hot` | display glass, lit: warm fill + accent stroke |
| `.halo` + `.hot` with `filter="url(#bloom)"` | soft light spilling behind a lit glass, beam or bulb |
| `.scr`, `.scr-accent` | lit display content |
| `.led` + `.hot` | indicator on |
| `.wire` + `.hot`, `.wire-under` | wire, carrying signal; background-coloured stroke under it for crossings |
| `.pulse` + `.go` on a `path` with `pathLength="1000"` | a dash of light travelling along a wire (`api.replay`) |
| filters `#glow`, `#soft`, `#bloom` | strong glow, subtle glow, blur only |

Colour only through tokens: `--body --deck --line --detail --recess --ink --ink-hi --glass --glass-on --accent --accent-hi --accent-dim --panel`. Never a literal hue in a figure, or the palette picker and light theme break.

## Palettes

Set `window.GALLERY.palette` to `'ember'` (Ember, Cyan, Lime, Violet, Rose, Ice) or `'city'` (Sodium street-lamp amber, Tungsten, Neon, Signal, Dusk, Moon), or pass your own `[[name, darkAccent, darkHi, lightAccent, lightHi], …]`. Pick a set that matches the subject: city lights for buildings, warm ember for desk objects. The light theme uses **the same accent as the dark theme**; only near-white colours (Ice, Moon) get a dark light-theme variant, because white would vanish on a pale panel. The choice is remembered per viewer.

**Light theme has no glow.** It keeps the accent fills, strokes and lit text exactly as in the dark theme but drops every ambient, radiating light: the template turns `#glow`/`#soft` into pass-through and `#bloom` into nothing, and hides `.halo` in the light theme. Don't add light pools, beams or haze that only work as glow; in the light theme a lit thing is a flat, bright accent.

## Procedure

1. **Name the output** of each figure before drawing: typed text, a number, a sound, lights that switch, a vehicle that moves. A figure you can only watch is decoration.
2. **Decompose** into 3–8 boxes; write `(x,y,z,w,d,h)` down first. Give the long, detailed face to FRONT or SIDE.
3. **Draw back to front**, detail on faces, texture by repetition (slits, window grids, ribs). Start from a ground plate (rounded box, inset line, screws).
4. **Light it**: decide what glows in each state. At least one large lit element per figure (a display, a lit floor band, a beam, a sign) should read as solid accent with bloom.
5. **Wire state**: one state object, one `render()`, keyboard and pointer calling the same functions. Readout bottom-right, terse and lowercase: `on · 9 chars · key t`.
6. **Frame** with `api.iso.frame` including the tallest point. **Finish** as in Fast path step 3: open it in the user's browser and hand over; no browser automation.

## Lessons (from building twenty figures)

- **Make the lit state unmistakable.** A faint glow was the most common failure. Push opacity and bloom until it reads at thumbnail size.
- **Point the detail at the viewer.** Only the top, FRONT and SIDE faces show. A server rack with its front on the narrow face looked like a blank box.
- **Moving things**: animate with `api.loop`, timed from `performance.now()`; move along an axis by translating with `D(dx,dy,dz)`. Objects that pass in front of and behind others need their draw order recomputed per frame.
- **Filters on straight lines**: the template's filters use `filterUnits="userSpaceOnUse"` because a perfectly horizontal or vertical path has a zero-height box and vanishes under a default filter region.
- **Escape before writing text into SVG**; clip scrolling screen text to its glass with a `<clipPath>`.
- **Rounded boxes**: `box(..., r)` draws a rounded top plus one continuous side wall, so corners line up. Don't round the FRONT and SIDE faces separately; three separately rounded faces leave notched, misaligned corners.
- **Round things** (domes, lamp shades, beams) can be drawn as hulls of projected circles or as stacked boxes; keep the hairline style.
- **After a nav click, focus the stage** (the template does this) so Space and Enter go to the figure instead of re-clicking the button.
- Audio only after a user gesture; wrap it in try/catch.

## 3D mode

Use it when the user asks for 3D, something to orbit, a true isometric view of a real model, or gives you a `.glb`/`.gltf`. Same look as the SVG figures: dark hairline drawing, one accent colour on what is live, every figure does something real. The page is built on three.js; you never write a renderer, lines, lights or UI.

`assets/gallery-3d.html` is the complete shell: renderer, three line tiers (silhouette shell, major folds, dim detail, always 1 CSS px), crease extraction, light points and soft pools, dark/light themes, accent picker (Ember, Cyan, Lime, Violet, Rose, Ice), **Revolve** toggle, **Iso view** (true orthographic isometric), per-figure button panel, readout, sound helpers and twelve working figures that double as references (typewriter, drum machine, cassette deck, kitchen timer, vending machine, computer, lamp, logic board, server rack, system stack, turntable, instant camera). Copy it, never read it. When you paste figures into its `FIGS3D` slot only yours get tabs (one figure: no tab bar).

### Fast path

1. Write the figure module to `fig3d.js`, starting from the starter below (aim for 100–250 lines).
2. Assemble:

```bash
python3 - "<skill folder>/assets/gallery-3d.html" NAME.html fig3d.js "NAME" <<'PY'
import sys
src, out, fig, name = sys.argv[1:5]
s = open(src).read()
for a, b in [('<title>Iso 3D</title>', f'<title>{name}</title>'), ('<i></i>Iso 3D</div>', f'<i></i>{name}</div>'),
             ('/* paste 3D figure modules here */', open(fig).read())]:
    assert a in s, a
    s = s.replace(a, b, 1)
open(out, 'w').write(s)
print('wrote', out)
PY
```

3. Check `fig3d.js` (`node --check` won't parse it on its own because it uses the page's helpers, so re-read it once), open the page in the user's browser (it needs internet once for three.js) and hand over, as in the 2D fast path. No browser automation.

### Starter 3D figure (complete: a button that counts on a lit screen)

```js
FIGS3D.push({ id: 'clicker', name: 'Clicker', mod: (() => {
  const g0 = new THREE.Group(); g0.visible = false; scene.add(g0);
  const first = twMeshes.length;                                    // parts built from here get crease lines
  plateWith(g0, 240, 200, [[18, 18], [222, 18], [18, 182], [222, 182]]);
  rbox(50, 40, 7, 140, 110, 60, 10, bodyMat, g0);                   // body: x, y, z, w (x), d (y), h (z), plan radius
  const btn = new THREE.Group(); btn.userData = { hit: 'btn' }; g0.add(btn);   // flash(btn) sinks it and lights it
  const mat = capMat(); twCaps.push(mat); rbox(90, 60, 67, 60, 50, 8, 8, mat, btn);
  label('PUSH', 30, 8, 7, onTop(120, 85, 75), btn);
  frontInset(g0, 64, 150, 58, 112, 30, 4);                          // recess on the front face (y = 150)
  const scr = faceCanvas('front', 68, 150, 54, 104, 22, 10, g0);    // a screen drawn on a canvas
  const led = dotFront(160, 150, 18, 2, g0), ledGlow = glowPoints([W(160, 151, 18)], 0.2); g0.add(ledGlow);
  slitsUV(frontUV(50, 150, 67), 14, 40, 3, 50, 56, g0);             // hairline texture on the front
  hazeAndShadow(g0, 120, 100, 2.6, 2.1);
  creases(first);
  const st = { n: 0 };
  function readout() { if (active === 'clicker') document.getElementById('read').textContent = `${st.n} clicks`; }
  function render() {
    const { x, P } = scr, { C, A_ } = screenBg(scr, st.n > 0, 3);
    x.fillStyle = st.n ? A_ : C.ink; x.font = `${14 * P}px ${MONO3}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(st.n).padStart(4, '0'), 52 * P, 11.5 * P); scr.tex.needsUpdate = true;
    led.material = st.n % 2 ? ledOnMat : ledOffMat; ledGlow.material.uniforms.intensity.value = st.n % 2 ? 0.8 : 0;
    readout();
  }
  const push = () => { st.n++; flash(btn, 120); SFX.button(); render(); return true; };
  themeHooks.push(render); render();
  return { group: g0, readout, demo: push, stop: () => {},
    key: e => e.key === ' ' && !e.repeat ? push() : false,
    click: hit => { let o = hit?.object; while (o && !o.userData.hit) o = o.parent; if (o) push(); },
    tick: now => tickFlashes(now),
    panel: [['Push', 'space', push]],
    view: { target: W(120, 100, 40), dist: 6.4 },
    info: '<h2>Clicker</h2><p>Press the button (or space): it sinks, flashes and counts on the front screen; the LED toggles on every odd count.</p>',
    hint: 'click the button · space' };
})() });
```

### Module contract and helpers

Coordinates are the SVG figures' units: +x right-down, +y left-down (the FRONT face is at the larger y), +z up; `W(x, y, z)` turns them into a three.js point (100 units = 1). `mod` returns `{ group, key(e) → bool, click(hit, event), tick(now, dt), stop(), readout(), demo(), panel: [[label, key, fn]], view: { target, dist }, info, hint }`; `readout` writes `#read` only when `active` is your id. Ids must not clash with the built-ins (`tw dr cs tm vm pc lp lg rk sk tt pl`).

- Solids: `rbox(x,y,z,w,d,h,r,mat,parent)` (rounded in plan, sharp rims), `plateWith(g,w,d,screws,slot)` ground plate, `inset(x,y,z,w,d,r,parent)` / `frontInset(parent,x,y,ztop,w,h,r)` / `sideInset(parent,x,yRight,ztop,w,h,r)` recesses. Cylinders and other shapes: plain three.js meshes with `bodyMat`, then `addOutline(m); twMeshes.push(m)`.
- Lines: call `creases(first)` once after building (`first` = `twMeshes.length` at the start); `seg([[a,b],…], parent, mat)`, `polyLine(points, mat, parent)`, `slitsUV(frontUV(x0,y,ztop) | sideUV(…) | topUV(…), u0, u1, step, v0, v1, parent)`. Materials: `lineMat` (detail), `majorMat` (folds), `accentLineMat` (a wire carrying signal: swap `line.material`).
- Live parts: `capMat()` pushed to `twCaps`; `flash(group, ms)` sinks and lights it (`group.userData.pressAxis = 'z'` for front buttons that push in); a latched part keeps `mat.userData.base = 0.55`; call `tickFlashes(now)` in `tick`. `dotFront(x,y,z,r,parent)` + `ledOnMat`/`ledOffMat` for LEDs.
- Light: `glowPoints([W(…)], size)` (set `.material.uniforms.intensity.value`), `hazeAndShadow(g,cx,cy,w,d)` returns a haze material to fade in while on, real `THREE.SpotLight`/`PointLight` for lamps and flashes. Glow sprites and haze are hidden automatically in the light theme, and lit `capMat` parts turn flat accent there.
- Print and screens: `label(text,w,h,size,onTop(cx,cy,z) | onFront(cx,y,cz),parent,{align})`, `faceCanvas('top'|'front',x,y,z,w,h,P,parent,transparent)` + `screenBg(cv,on)` (returns `{C, A_}`: theme colours and the accent), `sideCanvas(…)`; redraw from `themeHooks.push(fn)` so theme and accent changes repaint.
- Sound: `SFX.button() / switch() / key() / coin() / thunk() / detent() / bit(on)`, `tone(f, dur, peak, {type, to, at})`, `tap(freq, gain, q)`.
- Movement along a wire: `bezier(…)`, `cumLen(pts)`, `alongPts(pts, cum, t)`, `moveGlow(sprite, p, intensity)`.

### Bring your own model (.glb)

Embed the file as base64 (browsers block `fetch()` from `file://`): add `<script type="application/octet-stream" id="glb">BASE64</script>` before `</body>`, and use this module. It scales the model and gives every mesh the dark body, the silhouette shell and crease hairlines:

```js
FIGS3D.push({ id: 'model', name: 'My model', mod: (() => {
  const g0 = new THREE.Group(); g0.visible = false; scene.add(g0);
  const SIZE = 3;                                                    // longest side in scene units
  const bin = Uint8Array.from(atob(document.getElementById('glb').textContent.trim()), c => c.charCodeAt(0));
  new GLTFLoader().parse(bin.buffer, '', gltf => {
    const root = gltf.scene; root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), k = SIZE / Math.max(size.x, size.y, size.z);
    const c = box.getCenter(new THREE.Vector3()), first = twMeshes.length;
    root.traverse(o => { if (!o.isMesh) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-c.x, -box.min.y, -c.z).scale(k, k, k);
      geo.deleteAttribute('uv'); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, bodyMat); addOutline(m); twMeshes.push(m); g0.add(m); });
    creases(first);
  });
  hazeAndShadow(g0, 0, 0, SIZE * 1.1, SIZE * 0.9);
  const readout = () => { if (active === 'model') document.getElementById('read').textContent = 'drag to orbit · scroll to zoom'; };
  return { group: g0, readout, demo: () => {}, stop: () => {}, key: () => false, click: () => {}, tick: now => tickFlashes(now),
    panel: [], view: { target: new THREE.Vector3(0, SIZE * 0.25, 0), dist: SIZE * 2.4 },
    info: '<h2>My model</h2><p>Drag to orbit, scroll to zoom.</p>', hint: 'drag to orbit' };
})() });
```

Then make it live: name the parts that should move or light (rotors, doors, lamps), give them pivots and a state, as in the built-in figures. Clean the model first when it needs it (Blender headless works well): split it into named parts, check handedness against the real object and mirror if needed, remove duplicate coincident faces (they flicker), delete glass and transparent panels (they glitch; leave open frames), and set rotation pivots from the geometry. Credit CC-BY models on the page (author, licence, "restyled").

### Anatomy builds

Only when the user wants a real object taken apart (exploded views, section cut, part labels, true dimensions): read `references/anatomy-builds.md` before building. Skip it otherwise.

### 3D rules (learned the hard way)

- Lines stay 1 CSS px at every zoom; detail lines dimmer than folds, folds dimmer than the silhouette. Never a line-weight control.
- No fake light: no cone beams, glowing glass plates, rotor-disc glows or glow on fans and exhausts. Light comes from a real source (a bulb, an LED, a screen) and lights real surfaces.
- Build from the SVG figure's own box numbers when a 2D version exists; keep every interaction (keys, clicks, sound, readout, demo).
- Light theme: the same accent as dark, lit parts flat accent, no ambient glow (the shell does this; don't add your own pools there).
- Hold-to-act controls act on pointerdown; front buttons push in (`pressAxis: 'z'`); screens need their own canvas, redrawn on theme change.

## Lumen style (solid, lit)

A second look for the same figures: **filled, shaded objects with geometric light** (solid accent parts, light cones, beams, floor rings, rising square particles) instead of hairlines. Made for product showcases and web illustration: landing-page heroes, feature sections, onboarding. Use it when the user asks for Lumen, "solid" or "filled" isometric illustrations, product or landing-page illustrations, or shows glossy isometric icon references; otherwise use the hairline look above.

Read `references/lumen.md` first. It holds the build command (the kit `assets/lumen/kit.js` goes before the figures and `assets/lumen/picker.js` after), the style rules, the kit API and three example figures in `assets/lumen/examples/`. The figure contract, kernel and gallery template are unchanged.

## Footer credit

The template ends with a light footer, **Made with ISO-GLOW ↗**, linking to https://iso-glow.vercel.app. Keep it by default, including on single-figure pages you build without the template (a small, muted link under the figure). Remove it whenever the user asks or says they don't want it. Never turn it into an author credit such as "Made by …"; the finished work belongs to the user.

## Don'ts

- No real company logos, product silhouettes or trademarks on objects or screens; invent signage and glyphs.
- No hand-written skewed polygons for faces; use `plane()`.
- No external scripts; the page must run when opened from disk. (Exception: 3D mode loads three.js from cdn.jsdelivr.net through the template's import map.)
- No hue anywhere except through the accent tokens.
- Give the svg `role="img"` and an `aria-label` that says what it is and how to operate it (the template sets this from `aria`).
