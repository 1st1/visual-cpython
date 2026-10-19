// RW shading kit — iso-glow builds the shapes, this layer shades them like the RWDS sheet:
// filled olive gradients (top light, front mid, side dark), soft lime rim on top edges,
// lime gradient for lit parts, translucent lime glass, contact shadow + lime pool, floating dots.
const RW = (() => {
  // faces mix the accent into --rw-base: the page background in dark mode, a deep neutral in light mode,
  // so Lumen objects stay solid and readable on a light page (flat lit parts, no glow)
  const BASE = 'var(--rw-base, var(--bg))';
  const mix = (p, b = BASE) => `color-mix(in srgb, var(--accent) ${p}%, ${b})`;
  // optional gradient theme: --accent2 is the end colour (falls back to --accent)
  const B = 'var(--accent2, var(--accent))', mix2 = (p, b = BASE) => `color-mix(in srgb, ${B} ${p}%, ${b})`;
  // body tint: the gradient stop that stays rich when darkened (the picker avoids orange/gold, which turn brown)
  const mixT = (p, b = BASE) => `color-mix(in srgb, var(--rw-tint, var(--accent)) ${p}%, ${b})`;
  const st = (o, c, a = 1) => `<stop offset="${o}" style="stop-color:${c};stop-opacity:${a}"/>`;
  const lg = (id, x2, y2, s) => `<linearGradient id="rw-${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${s}</linearGradient>`;
  const rg = (id, s, cx = .5, cy = .5, r = .5) => `<radialGradient id="rw-${id}" cx="${cx}" cy="${cy}" r="${r}">${s}</radialGradient>`;
  const defs = `<defs>
    ${lg('top', 1, 1, st(0, mixT(42)) + st(1, mix2(18)))}
    ${lg('corner', 0, 1, st(0, 'var(--accent-hi)', .9) + st(.45, 'var(--accent)', .3) + st(1, B, 0))}
    ${lg('front', 0, 1, st(0, mixT(20)) + st(1, mixT(8)))}
    ${lg('side', 0, 1, st(0, mixT(10)) + st(1, mixT(2)))}
    ${lg('cyl', 1, 0, st(0, mixT(8)) + st(.38, mixT(30)) + st(.72, mix2(14)) + st(1, mixT(5)))}
    ${lg('litcyl', 1, 0, st(0, mix(55)) + st(.4, 'var(--accent-hi)') + st(.75, B) + st(1, mix2(45)))}
    ${lg('lit', 0, 1, st(0, 'var(--accent-hi)') + st(.5, 'var(--accent)') + st(1, mix2(70)))}
    ${lg('glass', 0, 1, st(0, 'var(--accent)', .7) + st(1, B, .22))}
    ${lg('column', 0, 1, st(0, B, 0) + st(.35, B, .16) + st(1, 'var(--accent)', .34))}
    ${lg('tube', 1, 0, st(0, 'var(--accent-hi)', .4) + st(.14, 'var(--accent)', .14) + st(.5, 'var(--accent)', .06) + st(.86, B, .14) + st(1, 'var(--accent-hi)', .35))}
    ${lg('lface', 0, 1, st(0, B, 0) + st(.32, B, .2) + st(1, 'var(--accent)', .3))}
    ${lg('ledge', 0, 1, st(0, 'var(--accent-hi)', 0) + st(.5, 'var(--accent-hi)', .25) + st(1, 'var(--accent-hi)', .85))}
    ${lg('cone', 0, 1, st(0, B, 0) + st(.3, B, 0) + st(.6, B, .1) + st(.85, 'var(--accent)', .24) + st(1, 'var(--accent)', .36))}
    ${lg('beam', 0, 1, st(0, B, 0) + st(1, 'var(--accent)', .55))}
    ${lg('cardf', 1, 1, st(0, mixT(52)) + st(1, mix2(28)))}
    ${lg('litwall', 0, 1, st(0, mix2(70)) + st(1, 'var(--accent-hi)'))}
    ${lg('paper', 0, 1, st(0, mixT(26)) + st(1, mix2(12)))}
    <linearGradient id="rw-theme" x1="0" y1=".5" x2="1" y2=".5"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:${B}"/></linearGradient>
    <linearGradient id="rw-themehi" x1="0" y1=".5" x2="1" y2=".5"><stop offset="0" style="stop-color:var(--accent-hi)"/><stop offset="1" style="stop-color:color-mix(in srgb, ${B} 60%, #ffffff)"/></linearGradient>
    ${rg('well', st(0, 'var(--accent-hi)') + st(.55, 'var(--accent)') + st(1, mix2(60)))}
    ${rg('orb', st(0, 'var(--accent-hi)') + st(.55, 'var(--accent)') + st(1, mix2(55)), .36, .3, .8)}
    ${rg('pool', st(0, 'var(--accent)', .16) + st(1, B, 0))}
    ${rg('shadow', st(0, '#000', .7) + st(1, '#000', 0))}
  </defs>`;
  // light-theme rule: prefix EVERY selector in the list, not just the first
  const L = rule => { const [sels, body] = rule.split('{'); const list = sels.split(',').map(s => s.trim());
    return `@media (prefers-color-scheme: light) { ${list.map(s => `:root:not([data-theme="dark"]) ${s}`).join(', ')} {${body} } ${list.map(s => `:root[data-theme="light"] ${s}`).join(', ')} {${body}`; };
  const css = `
    @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { --rw-base:#1b1e18; } }
    :root[data-theme="light"] { --rw-base:#1b1e18; }
    #stage .rw-top { fill:url(#rw-top); }
    #stage .rw-front { fill:url(#rw-front); }
    #stage .rw-side { fill:url(#rw-side); }
    #stage .rw-cyl { fill:url(#rw-cyl); }
    #stage .rw-litcyl { fill:url(#rw-litcyl); }
    #stage .rw-lit { fill:url(#rw-lit); }
    #stage .rw-orb { fill:url(#rw-orb); }
    #stage .rw-glass { fill:url(#rw-glass); stroke:var(--accent-hi); stroke-opacity:.75; stroke-width:1; vector-effect:non-scaling-stroke; }
    #stage .rw-paper { fill:url(#rw-paper); }
    #stage .rw-flat { fill:url(#rw-theme); }
    #stage .rw-hi { fill:url(#rw-themehi); }
    #stage .rw-edge { fill:${mixT(42)}; }
    #stage .rw-pit { fill:${mixT(5)}; }
    #stage .rw-ink { fill:${mixT(14)}; }
    #stage .rw-txt { fill:${mix(48)}; font-family:var(--mono); }
    #stage .rw-lip { fill:none; stroke:${mix(72)}; stroke-opacity:.85; stroke-width:1.2; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
    #stage .rw-rim { fill:none; stroke:${mix(30)}; stroke-width:1; vector-effect:non-scaling-stroke; }
    #stage .rw-etch { fill:none; stroke:${mix(24)}; stroke-width:1; stroke-linecap:round; vector-effect:non-scaling-stroke; }
    #stage .rw-line { fill:none; stroke:var(--accent-hi); stroke-width:1.4; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
    #stage .rw-glow { fill:url(#rw-theme); opacity:.45; }
    #stage .rw-dot { fill:url(#rw-themehi); }
    #stage .rw-halo { fill:url(#rw-theme); opacity:.16; }
    #stage .rw-cardf { fill:url(#rw-cardf); stroke:var(--accent); stroke-width:1.2; vector-effect:non-scaling-stroke; }
    #stage .rw-litwall { fill:url(#rw-litwall); }
    #stage .rw-wall { fill:${mixT(6)}; }
    #stage .rw-cast { fill:#000; opacity:.38; }
    #stage .rw-shadow { fill:url(#rw-shadow); }
    #stage .rw-corner { fill:url(#rw-corner); }
    #stage .rw-ring { fill:none; stroke:var(--accent); stroke-opacity:.2; stroke-width:1; vector-effect:non-scaling-stroke; }
    #stage .rw-ring2 { fill:none; stroke:var(--accent); stroke-opacity:.14; stroke-width:1; stroke-dasharray:3 9; vector-effect:non-scaling-stroke; animation:rw-turn 40s linear infinite; }
    @keyframes rw-turn { to { stroke-dashoffset:-480; } }
    @media (prefers-reduced-motion:reduce) { #stage .rw-ring2 { animation:none; } }
    #stage .rw-pool { fill:url(#rw-pool); }
    #stage .rw-beam { fill:url(#rw-beam); }
    #stage .rw-column { fill:url(#rw-column); }
    #stage .rw-cone { fill:url(#rw-cone); }
    #stage .rw-tube { fill:url(#rw-tube); }
    #stage .rw-lface { fill:url(#rw-lface); }
    #stage .rw-ledge { fill:url(#rw-ledge); }
    #stage .rw-cedge { fill:none; stroke:var(--accent-hi); stroke-opacity:.55; stroke-width:1.2; vector-effect:non-scaling-stroke; }
    #stage .rw-ray { stroke:var(--accent-hi); stroke-opacity:.3; stroke-width:1; vector-effect:non-scaling-stroke; }
    ${L('#stage [filter] { filter:none !important; }')}
    ${L('#stage .rw-glow, #stage .rw-halo, #stage .rw-pool, #stage .rw-beam, #stage .rw-column, #stage .rw-cone, #stage .rw-tube, #stage .rw-lface, #stage .rw-ledge, #stage .rw-cedge, #stage .rw-ray { display:none; }')}
    ${L('#stage .rw-shadow { opacity:.25; }')}
  `;
  const kit = K => {
    const { P } = K, f = v => v.toFixed(2), H = Math.PI / 2, q = H / 2;
    const d3 = (pts, close = true) => 'M' + pts.map(p => P(...p).map(f).join(' ')).join('L') + (close ? 'Z' : '');
    const arc = (cx, cy, r, a0, a1, n = 10) => { if (r <= 0) return [[cx, cy]]; const o = [];
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };
    const wall = (pts, z0, z1) => d3([...pts.map(([a, b]) => [a, b, z0]), ...pts.slice().reverse().map(([a, b]) => [a, b, z1])]);
    // shaded rounded box: separate side / front / top fills + rim light on the near top edge
    function box(x, y, z, w, d, h, r = 0, c = '', topc = 'rw-top') {
      r = Math.min(r, w / 2, d / 2); const z1 = z + h, k = c ? ' ' + c : '';
      const ring = [...arc(x+w-r, y+r, r, -H, 0), ...arc(x+w-r, y+d-r, r, 0, H), ...arc(x+r, y+d-r, r, H, 2*H), ...arc(x+r, y+r, r, 2*H, 3*H)];
      const side = [...arc(x+w-r, y+r, r, -q, 0), ...arc(x+w-r, y+d-r, r, 0, q)];
      const front = [...arc(x+w-r, y+d-r, r, q, H), ...arc(x+r, y+d-r, r, H, 3*q)];
      const lip = [...arc(x+w-r, y+r, r, -q, 0), ...arc(x+w-r, y+d-r, r, 0, H), ...arc(x+r, y+d-r, r, H, 3*q)];
      // light catching the front vertical corner: a thin strip fading downward
      const cx0 = x + w - r + r * Math.cos(q), cy0 = y + d - r + r * Math.sin(q), [tx, ty] = P(cx0, cy0, z1), [, by] = P(cx0, cy0, z);
      const hw = h > 8 ? .8 : 0, corner = hw ? `<path class="rw-corner" d="M${f(tx - hw)} ${f(ty)}H${f(tx + hw)}V${f(by)}H${f(tx - hw)}Z"/>` : '';
      return `<path class="rw-side${k}" d="${wall(side, z, z1)}"/><path class="rw-front${k}" d="${wall(front, z, z1)}"/>` + corner +
        `<path class="${topc}${k}" d="${d3(ring.map(([a, b]) => [a, b, z1]))}"/><path class="rw-lip" d="${d3(lip.map(([a, b]) => [a, b, z1]), false)}"/>`;
    }
    // upright cylinder (axis z)
    function cyl(cx, cy, z, r, h, c = 'rw-cyl', topc = 'rw-top') {
      const vis = arc(cx, cy, r, -q, 3*q, 24), ring = arc(cx, cy, r, 0, 4*H, 40);
      return `<path class="${c}" d="${wall(vis, z, z+h)}"/><path class="${topc}" d="${d3(ring.map(([a, b]) => [a, b, z+h]))}"/>` +
        `<path class="rw-lip" d="${d3(vis.map(([a, b]) => [a, b, z+h]), false)}"/>`;
    }
    // stacked copies of a face-local shape along a 3D step: solid thickness for coins, cards, discs
    function ext(tf, n, inner, face, edgeCls = 'rw-edge') {
      let s = ''; for (let i = 0; i < n; i++) s += `<g transform="${tf(i)}" class="${edgeCls}">${inner}</g>`;
      return s + `<g transform="${tf(n)}">${face}</g>`;
    }
    const ground = (cx, cy, rx, ry, pool = true) => `<g transform="${K.TOP(0, 0, 0)}">
      ${pool ? `<ellipse class="rw-pool" cx="${cx}" cy="${cy}" rx="${rx * 1.25}" ry="${ry * 1.25}"/>` : ''}
      <ellipse class="rw-shadow" cx="${cx + 6}" cy="${cy + 6}" rx="${rx}" ry="${ry}"/>
      <circle class="rw-ring" cx="${cx}" cy="${cy}" r="${(rx + ry) / 2 * 1.04}"/>
      <circle class="rw-ring2" cx="${cx}" cy="${cy}" r="${(rx + ry) / 2 * 1.24}"/></g>`;
    const dot = (x, y, z, r = 2.5, id = '') => { const p = P(x, y, z);
      const a = Math.round(Math.random() * 90);
      return `<g ${id ? `id="${id}" ` : ''}><rect class="rw-dot" transform="translate(${f(p[0])} ${f(p[1])}) rotate(${a})" x="${-r * .8}" y="${-r * .8}" width="${r * 1.6}" height="${r * 1.6}" rx=".3"/></g>`; };
    // sunken pocket: shape(cls, transform) returns ONE element. Opening drawn as wall colour, floor shifted
    // by the depth transform and clipped to the opening, so the far inner walls show through.
    let rid = 0;
    function recess(shape, tf0, tf1, wallCls = 'rw-wall', floorCls = 'rw-pit', extra = '') {
      const id = 'rwc' + (rid++) + Math.random().toString(36).slice(2, 6);
      return `<clipPath id="${id}">${shape('', tf0)}</clipPath>${shape(wallCls, tf0)}<g clip-path="url(#${id})">${shape(floorCls, tf1)}${extra}</g>`;
    }
    // expanding light cone (approved look): convex hull of the projected base + top circles, path "d"
    const hull = pts => { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cr = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]); const lo = [], up = [];
      for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); }
      for (const p of pts.slice().reverse()) { while (up.length > 1 && cr(up[up.length-2], up[up.length-1], p) <= 0) up.pop(); up.push(p); }
      return 'M' + lo.slice(0, -1).concat(up.slice(0, -1)).map(p => p.map(f).join(' ')).join('L') + 'Z'; };
    const cone = (cx, cy, z, r0, r1, h) => hull([...arc(cx, cy, r0, 0, 4*H, 48).map(([a, b]) => P(a, b, z)),
                                                ...arc(cx, cy, r1, 0, 4*H, 48).map(([a, b]) => P(a, b, z + h))]);
    // rising square motes appended to `el`; returns tick(t, level 0..1, speed)
    function motes(el, { cx, cy, r, z0, h, n = 12, size = 1 }) {
      n = Math.round(n * 1.4); size *= 1.15;
      const ps = [];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 4 * H, rr = Math.sqrt(Math.random()) * r, s = (.7 + Math.random() * 1.1) * size;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.innerHTML = `<rect class="rw-dot" x="${-s}" y="${-s}" width="${2*s}" height="${2*s*(.6 + Math.random()*.4)}" rx=".2"/>`;
        el.appendChild(g);
        ps.push({ g, x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a), off: Math.random(), spd: 3200 + Math.random() * 2600, rot: Math.random() * 360, spin: (Math.random() - .5) * 200 });
      }
      return (t, level = 1, speed = 1) => ps.forEach(p => {
        const u = ((t * speed / p.spd) + p.off) % 1, [px, py] = P(p.x, p.y, z0 + u * h);
        p.g.setAttribute('transform', `translate(${f(px)} ${f(py)}) rotate(${(p.rot + u * p.spin).toFixed(1)})`);
        p.g.style.opacity = (level * Math.min(1, u * 6) * (1 - u)).toFixed(2);
      });
    }
    // clip polygon for the vertical plane y = yc above height z (things sinking into a slot)
    const above = (id, yc, z) => `<clipPath id="${id}"><polygon points="${[P(-400, yc, z), P(600, yc, z), P(600, yc, 600), P(-400, yc, 600)].map(p => p.map(f).join(',')).join(' ')}"/></clipPath>`;
    // circles / cylinders / cones along any 3D axis
    const sub = (a, b) => a.map((v, i) => v - b[i]), dotp = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
    const unit = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
    function ring3(c, axis, r, n = 40) {
      const a = unit(axis), u = unit(cross(a, Math.abs(a[2]) < .9 ? [0, 0, 1] : [1, 0, 0])), v = cross(a, u);
      return Array.from({ length: n }, (_, i) => { const t = i / n * 4 * H, cs = Math.cos(t), sn = Math.sin(t);
        return [c[0] + r * (u[0]*cs + v[0]*sn), c[1] + r * (u[1]*cs + v[1]*sn), c[2] + r * (u[2]*cs + v[2]*sn)]; });
    }
    const poly = pts => 'M' + pts.map(p => P(...p).map(f).join(' ')).join('L') + 'Z';
    function cylAx(c0, c1, r, side = 'rw-cyl', cap = 'rw-top') {
      const ax = sub(c1, c0), r0 = ring3(c0, ax, r), r1 = ring3(c1, ax, r);
      const capR = dotp(ax, [1, 1, 1]) > 0 ? r1 : r0;
      return `<path class="${side}" d="${hull([...r0, ...r1].map(p => P(...p)))}"/><path class="${cap}" d="${poly(capR)}"/>`;
    }
    const coneAx = (c0, c1, r0, r1) => hull([...ring3(c0, sub(c1, c0), r0), ...ring3(c1, sub(c1, c0), r1)].map(p => P(...p)));
    return { d3, arc, wall, box, cyl, ext, ground, dot, recess, cone, motes, above, ring3, poly, cylAx, coneAx, hull };
  };
  // idle auto-play: run step() every `period` ms unless the viewer touched the figure recently.
  // returns mark() — call it from key handlers; pointer input on the stage is tracked automatically.
  const auto = (api, stage, period, step) => {
    let last = 0; const mark = () => { last = performance.now(); };
    stage.addEventListener('pointerdown', mark, true);
    api.every(period, () => { if (performance.now() - last > period + 2500) step(); });
    return mark;
  };
  // install the shared Lumen classes once, so any figure works on its own
  if (typeof document !== 'undefined' && !document.getElementById('rw-css')) {
    const el = document.createElement('style'); el.id = 'rw-css'; el.textContent = css; document.head.appendChild(el);
  }
  return { mix, mix2, mixT, defs, css, kit, auto };
})();
