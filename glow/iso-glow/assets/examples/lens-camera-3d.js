// Reference example for iso-glow 3D "anatomy builds" (see SKILL.md). Read only the part you need, by its // ── heading:
// toon shading + textures, lathe parts with section halves, rounded/lofted body + edge/joint lines, explode by assembly,
// labels overlay (desktop columns, mobile pins + legend), section cut with clipping, ray trace, mobile toolbar CSS.
// ══ Exploded 50 mm f/1.8 lens (6 elements / 5 groups, 7-blade iris, gear-type stepping motor) ══
// Optics: JP S62-087922 Example 1 (EF 50mm f/1.8 design, kept for the STM version), traced exactly (meridional, Snell).
// Mechanics: plausible layout from teardown photos of the same optical design; see lens-exploded/README.md.
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
FIGS3D.push({ id: 'ln', name: 'Lens', mod: (() => {
  const g0 = new THREE.Group(); g0.visible = false; scene.add(g0);
  const first = twMeshes.length;
  const S = 3, Y0 = 600, ZC = 150, TAU = Math.PI * 2;          // 3 iso units per mm; optical axis along −y at height ZC
  const AY = a => Y0 - a * S;                                    // axial mm (0 = front vertex of L1 at ∞) → iso y
  const PT = (a, u, v, dx = 0) => W(S * u + dx, AY(a), ZC + S * v);
  const sm = t => (t = Math.min(1, Math.max(0, t)), t * t * (3 - 2 * t));

  // ── optics: R, thickness to next, n after, clear Ø (patent) ──
  const RX = [[34.30, 4.50, 1.62280, 30.99], [247.65, 2.40, 1, 30.99], [21.51, 4.35, 1.70154, 25.61], [40.31, 0.92, 1, 24.15],
    [78.44, 1.40, 1.67270, 25.61], [15.32, 6.75, 1, 19.97], [Infinity, 4.95, 1, 19.292], [-15.83, 1.10, 1.69895, 19.37],
    [135.97, 5.70, 1.79952, 23.76], [-21.24, 0.15, 1, 23.76], [162.15, 3.00, 1.72000, 23.60], [-49.97, 37.93, 1, 23.60]];
  const STOP_I = 6, SURF = []; { let a = 0; RX.forEach(([R, t, n, D]) => { SURF.push({ a, R, n, h: D / 2 }); a += t; }); }
  const A_IMG = SURF[11].a + 37.93, A_MOUNT = A_IMG - 44.0;   // sensor plane; EF flange focal distance 44.0 mm
  const sag = (R, h) => R === Infinity ? 0 : h * h / (R * (1 + Math.sqrt(Math.max(0, 1 - h * h / (R * R)))));
  function trace(a, h, da, dh, shift, stopR) {
    let n = 1; const pts = [[a, h]], L = Math.hypot(da, dh); da /= L; dh /= L; let stopH = 0;
    for (let i = 0; i < SURF.length; i++) {
      const s = SURF[i], va = s.a - shift; let t;
      if (s.R === Infinity) t = (va - a) / da;
      else { const ca = va + s.R, oa = a - ca, B = oa * da + h * dh, C = oa * oa + h * h - s.R * s.R, disc = B * B - C;
        if (disc < 0) return null; t = s.R > 0 ? -B - Math.sqrt(disc) : -B + Math.sqrt(disc); }
      a += t * da; h += t * dh; pts.push([a, h]);
      if (i === STOP_I) { stopH = h; if (Math.abs(h) > stopR + 1e-9) return null; continue; }
      if (Math.abs(h) > s.h + 0.05) return null;
      let na = -1, nh = 0; if (s.R !== Infinity) { na = (a - (va + s.R)) / s.R; nh = h / s.R; }
      const mu = n / s.n, ci = -(na * da + nh * dh), k = 1 - mu * mu * (1 - ci * ci); if (k < 0) return null;
      const ct = Math.sqrt(k); da = mu * da + (mu * ci - ct) * na; dh = mu * dh + (mu * ci - ct) * nh; n = s.n;
    }
    const t = (A_IMG - a) / da; pts.push([A_IMG, h + t * dh]);
    return { pts, stopH, hImg: h + t * dh };
  }
  const EFL = (() => { const r = trace(-20, 0.01, 1, 0, 0, 99), p = r.pts, [a1, h1] = p[p.length - 2], [a2, h2] = p[p.length - 1]; return 0.01 / -((h2 - h1) / (a2 - a1)); })();
  const RHO_K = trace(-20, EFL / 2 / 1.85, 1, 0, 0, 99).stopH / (EFL / 2 / 1.85);      // stop radius per entrance-pupil radius
  const STOPS = [1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22], Nreal = N => N === 1.8 ? 1.85 : N;
  const rhoOf = N => RHO_K * EFL / 2 / Nreal(N);
  function extFor(d) {           // unit focusing: how far the whole optical block moves forward to focus at d (mm from sensor)
    if (!isFinite(d)) return 0; let lo = 0, hi = 20;
    for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2, r = trace(A_IMG - d, 0, 1, 0.0004, m, 99); if (r.hImg > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  const DISTS = [Infinity, 5000, 3000, 2000, 1500, 1000, 800, 600, 500, 450, 400, 350];

  // ── materials ──
  const glassBody = new THREE.MeshStandardMaterial({ color: 0x30353b, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide, emissive: accent.clone(), emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const capU = () => ({ base: { value: new THREE.Color() }, ink: { value: new THREE.Color() }, acc: { value: accent }, lit: { value: 0 }, hatch: { value: 1 } });
  const capMatOf = hatch => { const u = capU(); u.hatch.value = hatch; return new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    vertexShader: `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 base, ink, acc; uniform float lit, hatch; varying vec3 vP;
      void main() {
        float k = (vP.y + vP.z) / 0.045, f = fract(k), fw = max(fwidth(k), 1e-4);
        float line = (1.0 - clamp(min(f, 1.0 - f) / fw - 0.35, 0.0, 1.0)) * (1.0 - smoothstep(0.12, 0.35, fw)) * hatch;
        gl_FragColor = vec4(mix(mix(base, ink, line), acc, lit), 1.0);
      }` }); };
  const cutMetal = capMatOf(1), cutGlass = capMatOf(0);
  const bladeMat2 = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.7, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const rayMat = new LineMaterial({ color: accent.clone(), linewidth: 1, resolution: devRes(), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -10, transparent: true });
  const rayDim = new LineMaterial({ color: accent.clone(), linewidth: 1, resolution: devRes(), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -10, transparent: true, opacity: 0.4 });
  const flexOn = new LineMaterial({ color: accent.clone(), linewidth: 1, resolution: devRes(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 });
  // section outline: the boundary of every cut face, drawn heavier than the hairlines (2 CSS px), in the outline colour
  const cutLine = new LineMaterial({ color: LINE_COL.clone(), linewidth: 2 * renderer.getPixelRatio(), resolution: devRes(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 });
  addEventListener('resize', () => { [rayMat, rayDim, flexOn, cutLine].forEach(m => m.resolution.copy(devRes())); cutLine.linewidth = 2 * renderer.getPixelRatio(); });
  themeHooks.push(t => { const L = t === 'light';
    glassBody.color.set(L ? 0xf3f4f5 : 0x30353b); bladeMat2.color.set(L ? 0xe9e9e8 : 0x1d1e21);
    cutMetal.uniforms.base.value.set(L ? 0xe2e3e3 : 0x202225); cutMetal.uniforms.ink.value.set(L ? 0xb2b5b8 : 0x34373a);
    cutGlass.uniforms.base.value.set(L ? 0xfbfbfa : 0x25292d); cutGlass.uniforms.ink.value.set(0);
    [rayMat, rayDim, flexOn].forEach(m => m.color.copy(accent)); cutLine.color.set(THEMES[t].line); render(); });

  // ── line contrast for this page: outlines clearly darker (light) / brighter (dark) than any shading band ──
  Object.assign(THEMES.light, { line: 0x3d4145, major: 0x6f7478, edge: 0xa6aaae, fadeMin: 0.9 });
  Object.assign(THEMES.dark, { line: 0x74797d, major: 0x55595d, edge: 0x3a3d41, fadeMin: 0.8 });   // zoomed out, lines keep most of their contrast
  // ── stepped shading and turned-ring texture for the metal and plastic parts (unlit, four tone bands by facing) ──
  const toons = [];
  const LIGHT_DIR = new THREE.Vector3(0.35, 1, 0.55).normalize();
  function toon({ pitch = 0, amt = 0.5, glass = false, grain = 0, ribs = null } = {}) {   // ribs: { n, a0, a1, amt } axial grooves in a band of the axis
    const m = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, ink: { value: new THREE.Color() }, L: { value: LIGHT_DIR }, pitch: { value: pitch * S * TS }, amt: { value: amt }, acc: { value: accent }, lit: { value: 0 }, grain: { value: grain }, cell: { value: 0.9 * S * TS }, ribN: { value: ribs ? ribs.n : 0 }, ribZ0: { value: ribs ? AY(ribs.a1) * TS : 0 }, ribZ1: { value: ribs ? AY(ribs.a0) * TS : 0 }, ribAmt: { value: ribs ? ribs.amt ?? 0.6 : 0 }, axisY: { value: ZC * TS } },
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, clipping: true,
      vertexShader: `varying vec3 vN; varying vec3 vP;
#include <clipping_planes_pars_vertex>
        void main() { vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vP = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <clipping_planes_vertex>
        }`,
      fragmentShader: `uniform vec3 c0, c1, c2, c3, ink, L, acc; uniform float pitch, amt, lit, grain, cell, ribN, ribZ0, ribZ1, ribAmt, axisY; varying vec3 vN; varying vec3 vP;

#include <clipping_planes_pars_fragment>
        void main() {
#include <clipping_planes_fragment>

          vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
          float d = dot(n, L);
          vec3 col = d > 0.6 ? c3 : d > 0.25 ? c2 : d > -0.15 ? c1 : c0;
          if (pitch > 0.0 && abs(n.z) < 0.4) {                       // grooves only on the turned sides, not on the end faces
            float k = vP.z / pitch, f = fract(k), fw = max(fwidth(k), 1e-4);
            float line = (1.0 - clamp(min(f, 1.0 - f) / fw - 0.3, 0.0, 1.0)) * (1.0 - smoothstep(0.22, 0.45, fw));
            col = mix(col, ink, line * amt);
          }
          if (grain > 0.0) {                                          // leatherette: a pebbled stipple fixed to the part, dark pits and a few bright crowns
            vec3 q = floor(vP / cell); float h = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
            float far = 1.0 - smoothstep(0.6, 1.4, length(fwidth(vP / cell)));
            col = mix(col, ink, step(0.76, h) * grain * far);
            col = mix(col, c3, step(h, 0.06) * grain * 0.5 * far);
          }
          if (ribN > 0.0 && abs(n.z) < 0.4 && vP.z > ribZ0 && vP.z < ribZ1) {   // vertical grill: axial grooves round the ring, inside its band only
            float k = atan(vP.x, vP.y - axisY) / 6.2831853 * ribN, f = fract(k), fw = max(fwidth(k), 1e-4);
            float g = smoothstep(0.5 - fw, 0.5 + fw, f) - smoothstep(0.88 - fw, 0.88 + fw, f);
            float edge = 1.0 - clamp(abs(f - 0.5) / fw - 0.3, 0.0, 1.0);
            float fade = 1.0 - smoothstep(0.18, 0.4, fw);
            col = mix(col, c0 * 0.55, g * ribAmt * fade); col = mix(col, ink, edge * ribAmt * 0.7 * fade);
          }
          gl_FragColor = vec4(mix(col, acc, lit), 1.0);
        }` });
    m.userData.glass = glass; toons.push(m); return m;
  }
  themeHooks.push(t => { const L = t === 'light';
    const c = L ? [0xdcdddb, 0xe8e9e6, 0xf2f2f0, 0xfdfdfc] : [0x16171a, 0x1b1c1f, 0x212226, 0x292a2e];
    const g = L ? [0xd3dce2, 0xe1e8ec, 0xedf2f5, 0xf9fbfc] : [0x161b20, 0x1b2127, 0x222930, 0x2b333c];
    toons.forEach(m => { const pal = m.userData.glass ? g : c; ['c0', 'c1', 'c2', 'c3'].forEach((k, i) => m.uniforms[k].value.set(pal[i])); m.uniforms.ink.value.set(L ? 0xb4b8bb : 0x34373b); }); });
  const T_GLASS = toon({ glass: true });
  const T_PLAIN = toon(), T_FB = toon({ pitch: 0.8, amt: 0.55 }), T_OB = toon({ pitch: 0.9, amt: 0.4, ribs: { n: 220, a0: 4.7, a1: 8.3, amt: 0.6 } }), T_CM = toon({ pitch: 1.0, amt: 0.45 }), T_TB = toon({ pitch: 1.2, amt: 0.3 }), T_MT = toon({ pitch: 0.7, amt: 0.5 });

  // ── parts: each has a whole version and a half (section) version with hatched cut faces ──
  const parts = [], P = {};
  function part(key, name, info, moving) {
    const g = new THREE.Group(); g.userData.ln = key; g0.add(g);
    const w = new THREE.Group(), h = new THREE.Group(); g.add(w, h);
    const p = { key, name, info, moving, g, w, h, amin: 1e9, amax: -1e9 }; parts.push(p); P[key] = p; return p;
  }
  const area = pr => pr.reduce((s, [a, r], i) => { const [b, q] = pr[(i + 1) % pr.length]; return s + a * q - b * r; }, 0) / 2;
  function latheGeo(pr, seg, p0, pl) {
    const pts = pr.concat([pr[0]]).map(([a, r]) => new THREE.Vector2(Math.max(r, 0) * S * TS, -AY(a) * TS));
    let g = new THREE.LatheGeometry(pts, seg, p0, pl); g.rotateX(-Math.PI / 2); g.translate(0, ZC * TS, 0);
    g = toCreasedNormals(g, THREE.MathUtils.degToRad(35)); return g;
  }
  function capGeo(pr) {
    const sh = new THREE.Shape(pr.map(([a, r]) => new THREE.Vector2(a, r))), sg = new THREE.ShapeGeometry(sh), src = sg.attributes.position, ix = sg.index.array;
    const pos = [], idx = [];
    for (const sgn of [1, -1]) { const o = pos.length / 3;
      for (let i = 0; i < src.count; i++) pos.push(0, (ZC + sgn * src.getY(i) * S) * TS, AY(src.getX(i)) * TS);
      for (let i = 0; i < ix.length; i++) idx.push(o + ix[i]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function lathe(p, pr, mat, cut, { seg = 144, phi = null } = {}) {   // pr: closed (a, r) profile; phi = [start, length] for sectors
    if (area(pr) > 0) pr = pr.slice().reverse();
    pr.forEach(([a]) => { p.amin = Math.min(p.amin, a); p.amax = Math.max(p.amax, a); });
    const add = (geo, grp) => { const m = new THREE.Mesh(geo, mat); addOutline(m); twMeshes.push(m); grp.add(m); return m; };
    if (phi) {                                                    // a sector (bayonet lug): whole = itself, half = clipped to x ≤ 0
      add(latheGeo(pr, Math.ceil(seg * phi[1] / TAU), phi[0], phi[1]), p.w);
      const s0 = Math.max(phi[0], Math.PI), s1 = Math.min(phi[0] + phi[1], TAU);
      if (s1 > s0) add(latheGeo(pr, Math.ceil(seg * (s1 - s0) / TAU), s0, s1 - s0), p.h);
      return;
    }
    add(latheGeo(pr, seg, 0, TAU), p.w);
    add(latheGeo(pr, seg / 2, Math.PI, Math.PI), p.h);
    if (cut) {
      p.h.add(new THREE.Mesh(capGeo(pr), cut));
      for (const sgn of [1, -1]) { const arr = []; for (let i = 0; i < pr.length; i++) { const [a0, r0] = pr[i], [a1, r1] = pr[(i + 1) % pr.length]; if (r0 < 1e-6 && r1 < 1e-6) continue;   // the axis is not an edge
          arr.push(0.0004, (ZC + sgn * r0 * S) * TS, AY(a0) * TS, 0.0004, (ZC + sgn * r1 * S) * TS, AY(a1) * TS); }
        p.h.add(fat(arr, cutLine)); }
    }
  }
  const ring = (a0, a1, r0, r1) => [[a0, r0], [a0, r1], [a1, r1], [a1, r0]];
  // circle / arc / helix hairlines on a cylinder; half → only the x ≤ 0 side
  const ang = (phi, r) => [r * Math.sin(phi), r * Math.cos(phi)];
  function arcPts(a, r, p0, p1, n = 96) { const out = []; for (let i = 0; i <= n; i++) { const f = p0 + (p1 - p0) * i / n, [u, v] = ang(f, r); out.push(PT(a, u, v)); } return out; }
  const polyW = (pts, mat, grp) => { const arr = []; for (let i = 0; i < pts.length - 1; i++) arr.push(...pts[i].toArray(), ...pts[i + 1].toArray()); const l = fat(arr, mat); grp.add(l); return l; };
  function circle(p, a, r, mat = lineMat) { polyW(arcPts(a, r, 0, TAU, 144), mat, p.w); polyW(arcPts(a, r, Math.PI, TAU, 72), mat, p.h); }
  const inHalf = f => { f = ((f % TAU) + TAU) % TAU; return f >= Math.PI; };

  // ── glass elements (profile from the prescription; flat lands beyond the clear aperture, edge Ø ≈ clear Ø + 2 mm) ──
  function elementProfile(i1, i2, re, hc1 = SURF[i1].h, hc2 = SURF[i2].h) {
    const s1 = SURF[i1], s2 = SURF[i2], pr = [], N = 28;
    for (let k = 0; k <= N; k++) { const h = hc1 * k / N; pr.push([s1.a + sag(s1.R, h), h]); }
    pr.push([s1.a + sag(s1.R, hc1), re], [s2.a + sag(s2.R, hc2), re]);
    for (let k = N; k >= 0; k--) { const h = hc2 * k / N; pr.push([s2.a + sag(s2.R, h), h]); }
    return pr;
  }
  const fmt = (v, d = 2) => v === Infinity ? '∞' : v.toFixed(d);
  const glassInfo = (lbl, kind, i1, i2, re) => `<h2>${lbl} · ${kind}</h2><p>R ${fmt(SURF[i1].R)} / ${fmt(SURF[i2].R)} mm · centre ${(SURF[i2].a - SURF[i1].a).toFixed(2)} mm · nd ${SURF[i1].n.toFixed(5)} · νd ${{ 0: '57.0', 2: '41.2', 4: '32.1', 7: '30.1', 8: '42.2', 10: '50.2' }[i1]} · clear Ø ${(SURF[i1].h * 2).toFixed(1)} mm, edge Ø ≈ ${(re * 2).toFixed(0)} mm.</p><p class="src">Source: JP S62-087922, Example 1.</p>`;
  // hairline where each polished surface ends at its clear aperture (the land around it is ground flat)
  const apertureRings = (p, ...ix) => ix.forEach(i => circle(p, SURF[i].a + sag(SURF[i].R, SURF[i].h), SURF[i].h, lineMat));
  const L1 = part('l1', 'L1', glassInfo('L1', 'positive meniscus', 0, 1, 16.5), true); lathe(L1, elementProfile(0, 1, 16.5), T_GLASS, cutGlass); apertureRings(L1, 0, 1);
  const L2 = part('l2', 'L2', glassInfo('L2', 'positive meniscus', 2, 3, 13.8), true); lathe(L2, elementProfile(2, 3, 13.8), T_GLASS, cutGlass); apertureRings(L2, 2, 3);
  const L3 = part('l3', 'L3', glassInfo('L3', 'negative meniscus (dense flint)', 4, 5, 13.8), true); lathe(L3, elementProfile(4, 5, 13.8), T_GLASS, cutGlass); apertureRings(L3, 4, 5);
  const DB = part('db', 'L4 + L5', `<h2>L4 + L5 · cemented doublet</h2><p>L4 biconcave: R −15.83 / 135.97, centre 1.10 mm, nd 1.69895, νd 30.1. L5 biconvex: R 135.97 / −21.24, centre 5.70 mm, nd 1.79952, νd 42.2. Cementing a low-dispersion and a high-dispersion glass cancels colour fringing. Edge Ø ≈ 26 mm.</p><p class="src">Source: JP S62-087922, Example 1.</p>`, true);
  lathe(DB, elementProfile(7, 8, 12.9), T_GLASS, cutGlass); lathe(DB, elementProfile(8, 9, 12.9), T_GLASS, cutGlass); apertureRings(DB, 7, 9);
  const L6 = part('l6', 'L6', glassInfo('L6', 'biconvex', 10, 11, 12.8), true); lathe(L6, elementProfile(10, 11, 12.8), T_GLASS, cutGlass); apertureRings(L6, 10, 11);

  // ── iris (electromagnetic diaphragm): cover ring, 7 curved blades, base plate with pivots and its own stepper ──
  const A_STOP = SURF[STOP_I].a, IR = part('ir', 'Iris', `<h2>Aperture unit · 7 blades</h2><p>Seven curved blades pivot on pins in the base plate; a drive ring turned by the unit's own small stepper swings them in together. At f/1.8 the stop is Ø ${(rhoOf(1.8) * 2).toFixed(2)} mm (patent: 19.29); at f/22 it closes to Ø ${(rhoOf(22) * 2).toFixed(2)} mm. Curved blades keep the opening nearly round.</p>`, true);
  const irCover = new THREE.Group(), irBase = new THREE.Group(), irBlades = new THREE.Group(); IR.g.add(irCover, irBase, irBlades);
  { const tmp = { w: irCover, h: new THREE.Group(), amin: 1e9, amax: -1e9 }; lathe(tmp, ring(A_STOP - 0.95, A_STOP - 0.6, 12.6, 25.6), T_PLAIN, cutMetal); IR.coverW = irCover.children.slice(); IR.coverH = tmp.h; irCover.add(tmp.h); }
  { const tmp = { w: irBase, h: new THREE.Group(), amin: 1e9, amax: -1e9 }; lathe(tmp, ring(A_STOP + 0.45, A_STOP + 0.9, 10.4, 25.6), T_PLAIN, cutMetal);
    lathe(tmp, ring(A_STOP + 0.9, A_STOP + 1.3, 21.8, 25.6), T_PLAIN, cutMetal);                              // drive ring
    IR.baseW = irBase.children.slice(); IR.baseH = tmp.h; irBase.add(tmp.h);
    for (let k = 0; k < 7; k++) { const f = k * TAU / 7 + 0.2, [u, v] = ang(f, 23.4), m = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * S * TS, 0.55 * S * TS, 0.8 * S * TS, 12), bodyMat);
      m.rotation.x = Math.PI / 2; m.position.copy(PT(A_STOP + 0.05, u, v)); m.userData.pin = f; irBase.add(m); }
    const [su, sv] = ang(Math.PI * 1.62, 18.5), st = new THREE.Mesh(new THREE.CylinderGeometry(2.4 * S * TS, 2.4 * S * TS, 2.2 * S * TS, 32), bodyMat);
    st.rotation.x = Math.PI / 2; st.position.copy(PT(A_STOP + 2.4, su, sv)); addOutline(st); twMeshes.push(st); irBase.add(st); }
  IR.amin = A_STOP - 1; IR.amax = A_STOP + 3.5;
  const bladeMeshes = [];
  function clipHalf(pts) {          // keep u ≤ 0 (Sutherland–Hodgman against one plane)
    const out = []; for (let i = 0; i < pts.length; i++) { const A = pts[i], B = pts[(i + 1) % pts.length], ia = A[0] <= 0, ib = B[0] <= 0;
      if (ia) out.push(A); if (ia !== ib) { const t = A[0] / (A[0] - B[0]); out.push([0, A[1] + (B[1] - A[1]) * t]); } } return out;
  }
  function bladePts(k, rho) {
    const Rb = 16, ROUT = 24.6, th = k * TAU / 7 + (9.65 - rho) * 0.055, c = [-(Rb - rho) * Math.cos(th), -(Rb - rho) * Math.sin(th)], span = TAU / 7 * 1.85, inner = [], outer = [];
    for (let i = 0; i <= 28; i++) { const t = th - span / 2 + span * i / 28, d = [Math.cos(t), Math.sin(t)], uc = d[0] * c[0] + d[1] * c[1];
      const r = Math.min(uc + Math.sqrt(uc * uc - (c[0] * c[0] + c[1] * c[1]) + Rb * Rb), ROUT - 0.8); inner.push([r * d[0], r * d[1]]); outer.unshift([ROUT * d[0], ROUT * d[1]]); }
    return { poly: inner.concat(outer), inner };
  }
  function buildBlades(rho, half) {
    bladeMeshes.forEach(o => { irBlades.remove(o); o.geometry.dispose(); if (o.isLineSegments2) fatLines.splice(fatLines.indexOf(o), 1); }); bladeMeshes.length = 0;
    for (let k = 0; k < 7; k++) {
      const a = A_STOP - 0.25 + k * 0.07, { poly, inner } = bladePts(k, rho), pl = half ? clipHalf(poly) : poly; if (pl.length < 3) continue;
      const sg = new THREE.ShapeGeometry(new THREE.Shape(pl.map(([u, v]) => new THREE.Vector2(u, v)))), src = sg.attributes.position;
      for (let i = 0; i < src.count; i++) { const q = PT(a, src.getX(i), src.getY(i)); src.setXYZ(i, q.x, q.y, q.z); }
      sg.computeVertexNormals(); const m = new THREE.Mesh(sg, bladeMat2); irBlades.add(m); bladeMeshes.push(m);
      const edge = (half ? inner.filter(([u]) => u <= 0) : inner).map(([u, v]) => PT(a - 0.02, u, v)); if (edge.length > 1) { const l = polyW(edge, majorMat, irBlades); bladeMeshes.push(l); }
      const out = (half ? clipHalf(poly) : poly).map(([u, v]) => PT(a - 0.02, u, v)); out.push(out[0]); const l2 = polyW(out, lineMat, irBlades); bladeMeshes.push(l2);
    }
  }

  // ── barrel mechanics ──
  const FB = part('fb', 'Front barrel', '<h2>Front barrel · 49 mm filter thread</h2><p>The front of the moving inner tube. It carries the 49 mm filter thread and the retaining lip in front of L1, and slides forward with everything else when the lens focuses closer.</p>', true);
  lathe(FB, [[-10.15, 24.5], [-10.15, 26], [-1.5, 26], [-1.5, 17.6], [-3, 17.6], [-3, 24.5]], T_FB, cutMetal);
  for (let a = -9.4; a <= -4; a += 0.9) circle(FB, a, 24.46);
  const TB = part('tb', 'Inner tube', '<h2>Inner optical tube</h2><p>Holds all six elements and the iris as one block. Three cam pins on its outside ride in the cam ring\'s slots; straight keys in the fixed barrel stop it turning, so rotating the cam ring pushes the whole block forward: up to 10.9 mm for 0.35 m (unit focusing).</p>', true);
  lathe(TB, [[-1.5, 16.6], [-1.5, 26], [24, 26], [24, 21], [36, 21], [36, 12.9], [22.5, 12.9], [22.5, 26.6 - 0.6], [17, 26.6 - 0.6], [17, 13.9], [6, 13.9], [6, 16.6]], T_TB, cutMetal);
  const PINS = [0, 1, 2].map(k => Math.PI * 1.35 + k * TAU / 3), PIN_A = 10.5;   // pins ride 10.9 mm forward inside slots that stay on the ring (s −1.1 … 11.1)
  PINS.forEach(f => { const [u, v] = ang(f, 26.6), m = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * S * TS, 0.9 * S * TS, 1.6 * S * TS, 16), bodyMat);
    m.position.copy(PT(PIN_A, u, v)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(f), Math.cos(f), 0)); addOutline(m); twMeshes.push(m);
    (inHalf(f) ? TB.g : TB.w).add(m); });
  const CM = part('cm', 'Cam ring', '<h2>Cam ring</h2><p>Three helical slots turn rotation into straight travel: about 100° of turn moves the optics 10.9 mm. A gear band on its rear edge is driven by the stepping motor\'s pinion.</p>', false);
  lathe(CM, ring(-1.6, 14, 26.4, 27.4), T_CM, cutMetal); lathe(CM, ring(12, 14, 27.4, 28.2), T_CM, cutMetal);
  const FR = part('fr', 'Focus ring', '<h2>Focus ring · by wire</h2><p>Not linked to the optics. An encoder reads its turn and the camera tells the stepping motor where to drive, so it only works with the camera on. Autofocus moves the optics but leaves this ring still.</p>', false);
  const T_FR = toon({ ribs: { n: 150, a0: -7.6, a1: 2.7, amt: 0.75 } });
  lathe(FR, ring(-9.5, 3.5, 31.5, 34.6), T_FR, cutMetal);
  const OB = part('ob', 'Fixed barrel', '<h2>Fixed outer barrel</h2><p>Ø 69.2 mm, the outside you hold. Straight keys inside stop the inner tube rotating; the AF/MF switch sits on its side.</p>', false);
  lathe(OB, [[3.5, 33.8], [3.5, 34.6], [26, 34.6], [26, 23.5], [25, 23.5], [25, 33.8]], T_OB, cutMetal);
  { const sw = new THREE.Group(), f = Math.PI * 0.32, [u, v] = ang(f, 34.6); sw.position.copy(PT(15, u, v)); sw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(f), Math.cos(f), 0));
    const plate = new THREE.Mesh(new THREE.BoxGeometry(9 * S * TS, 0.8 * S * TS, 13 * S * TS), bodyMat), knob = new THREE.Mesh(new THREE.BoxGeometry(5 * S * TS, 1.6 * S * TS, 3 * S * TS), bodyMat);
    knob.position.set(0, 0.8 * S * TS, -2.5 * S * TS); [plate, knob].forEach(m => { addOutline(m); twMeshes.push(m); sw.add(m); }); OB.w.add(sw); }
  const MO = part('mo', 'Stepping motor', '<h2>Gear-type stepping motor (STM)</h2><p>Moves in exact steps, so the camera always knows where focus is, and it is nearly silent for video. Its pinion meshes with the cam ring\'s gear band.</p>', false);
  const MO_F = Math.PI * 1.75, [mu, mv] = ang(MO_F, 30.6), pinion = new THREE.Group();
  { const can = new THREE.Mesh(new THREE.CylinderGeometry(3 * S * TS, 3 * S * TS, 7.7 * S * TS, 40), bodyMat); can.rotation.x = Math.PI / 2; can.position.copy(PT(18.2, mu, mv)); addOutline(can); twMeshes.push(can); MO.g.add(can);
    pinion.position.copy(PT(13, mu, mv)); MO.g.add(pinion);
    const pg = new THREE.Mesh(new THREE.CylinderGeometry(2.1 * S * TS, 2.1 * S * TS, 2 * S * TS, 12), bodyMat); pg.rotation.x = Math.PI / 2; addOutline(pg); twMeshes.push(pg); pinion.add(pg);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * S * TS, 0.5 * S * TS, 0.6 * S * TS, 12), bodyMat); shaft.rotation.x = Math.PI / 2; shaft.position.copy(PT(14.2, mu, mv)); MO.g.add(shaft);
    MO.amin = 12; MO.amax = 22.1; }
  const PCB = part('pcb', 'Main board', '<h2>Main board</h2><p>The lens CPU and motor drivers on a ring board. Orange flex cables run to the stepping motor, the iris and the mount contacts. Every focus or aperture move is a command sent from the camera through those contacts.</p>', false);
  lathe(PCB, ring(22.6, 23.5, 26.6, 33), T_PLAIN, cutMetal);
  [[1.15, 4, 3], [1.45, 3, 2.4], [1.85, 5, 3]].forEach(([f, w, d]) => { const [u, v] = ang(Math.PI * f, 29.8), c = new THREE.Mesh(new THREE.BoxGeometry(w * S * TS, d * S * TS, 0.8 * S * TS), bodyMat);
    c.position.copy(PT(22.2, u, v)); c.rotation.z = -Math.PI * f; addOutline(c); twMeshes.push(c); PCB.g.add(c); });
  const MT = part('mt', 'Mount', '<h2>Bayonet mount + contacts</h2><p>Metal bayonet with three lugs. Its rear face sits 44.0 mm in front of the sensor (the mount\'s flange distance). Gold contacts carry power and data between camera and lens.</p>', false);
  lathe(MT, ring(26, A_MOUNT, 25, 31.5), T_MT, cutMetal);
  [0.1, 0.78, 1.42].forEach(f0 => lathe(MT, ring(A_MOUNT + 0.8, A_MOUNT + 1.9, 25.4, 29.6), bodyMat, null, { phi: [Math.PI * f0, Math.PI * 0.36] }));
  circle(MT, 26.02, 28.3, lineMat);
  const pins = [];
  { const f0 = Math.PI * 1.22; for (let k = 0; k < 8; k++) { const f = f0 + (k - 3.5) * 0.075, [u, v] = ang(f, 23.6), m = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * S * TS, 0.7 * S * TS, 0.4 * S * TS, 12), ledOffMat);
    m.rotation.x = Math.PI / 2; m.position.copy(PT(A_MOUNT + 0.4, u, v)); MT.g.add(m); pins.push(m); }
    const blk = new THREE.Mesh(new THREE.BoxGeometry(14 * S * TS, 4 * S * TS, 1.5 * S * TS), bodyMat), [bu, bv] = ang(f0, 23.6); blk.position.copy(PT(A_MOUNT - 0.5, bu, bv)); blk.rotation.z = -f0;
    addOutline(blk); twMeshes.push(blk); MT.g.add(blk); }
  const RB = part('rb', 'Rear baffle', '<h2>Rear baffle</h2><p>Plastic snap-in cover inside the mount that blocks stray light and dust around the rear element.</p>', false);
  lathe(RB, [[A_MOUNT + 2, 21.6], [A_MOUNT + 2, 25], [36.8, 25], [36.8, 22.2], [36.2, 21.6]], T_PLAIN, cutMetal);
  // sensor (part of the camera, shown as a dim plate so you can see where the light lands)
  const sensor = new THREE.Group(); g0.add(sensor);
  { const m = new THREE.Mesh(new THREE.BoxGeometry(36 * S * TS, 24 * S * TS, 1 * S * TS), bodyMat); m.position.copy(PT(A_IMG + 0.5, 0, 0)); addOutline(m); twMeshes.push(m); sensor.add(m);
    polyW([[-18, -12], [18, -12], [18, 12], [-18, 12], [-18, -12]].map(([u, v]) => PT(A_IMG - 0.02, u, v)), lineMat, sensor); }
  const spot = glowPoints([PT(A_IMG - 0.3, 0, 0, 0.3)], 0.5); g0.add(spot);
  const spotDot = new THREE.Mesh(new THREE.CircleGeometry(0.7 * S * TS, 20), ledOnMat); spotDot.position.copy(PT(A_IMG - 0.05, 0, 0)); sensor.add(spotDot);   // flat accent dot where the image forms (shows in the light theme too)

  // ── printed and machined texture: canvas bands wrapped on cylinders (whole + half), redrawn on theme change ──
  // canvas x ↔ cylinder angle θ (u = θ/2π), our angle f = π − θ; canvas top = the front end of the band
  const prints = [];
  function band(p, s0, s1, r, W, H, draw, { turns = null } = {}) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.wrapS = THREE.RepeatWrapping;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    const make = (half, grp) => {
      const g = new THREE.CylinderGeometry(r * S * TS, r * S * TS, (s1 - s0) * S * TS, 192, 1, true, half ? Math.PI : 0, half ? Math.PI : TAU);
      if (half) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 0.5 + uv.getX(i) * 0.5); }
      g.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(g, mat); m.position.set(0, ZC * TS, AY((s0 + s1) / 2) * TS); m.renderOrder = 3; grp.add(m);
    };
    make(false, p.w); make(true, p.h);
    const redraw = () => { const x = c.getContext('2d'); x.clearRect(0, 0, W, H); draw(x, pal3(), W, H); tex.needsUpdate = true; };
    prints.push({ redraw, tex, turns }); redraw(); return tex;
  }
  const atTheta = (f, W) => (((Math.PI - f) / TAU) % 1 + 1) % 1 * W;     // canvas x for our angle f
  const FACE = Math.PI / 4;                                                  // the angle that faces the viewer in the whole view
  const mono = (x, px, C, w = 500) => { x.font = `${w} ${px}px ui-monospace, "SF Mono", Menlo, monospace`; x.fillStyle = C.ink; x.strokeStyle = C.ink; x.textBaseline = 'middle'; x.textAlign = 'center'; };
  // focus ring: a printed distance scale on its front lip (turns with the ring) and two seams bounding the grip
  const DISTS_M = [['∞', 0], ['3', 0.06], ['1.5', 0.12], ['1', 0.18], ['.7', 0.25], ['.5', 0.33], ['.4', 0.41], ['.35', 0.46]];
  const frTex = band(FR, -9.5, -7.7, 34.63, 4096, 128, (x, C, W, H) => {
    mono(x, 46, C); const x0 = atTheta(FACE, W) - W * 0.06;
    DISTS_M.forEach(([t, k]) => { x.fillText(t, x0 + k * W * 0.35, H * 0.38); x.lineWidth = 3; x.beginPath(); x.moveTo(x0 + k * W * 0.35, H * 0.72); x.lineTo(x0 + k * W * 0.35, H); x.stroke(); });
    x.font = `500 30px ui-monospace, Menlo, monospace`; x.fillText('m', x0 + 0.53 * W * 0.35, H * 0.38);
  }, { turns: 'fr' });
  circle(FR, -7.7, 34.62, majorMat); circle(FR, 2.8, 34.62, majorMat);
  // fixed barrel: the focus index, and the lens's own engraving (focal length, aperture, filter size; no maker's name)
  band(OB, 3.6, 6.2, 34.63, 4096, 160, (x, C, W, H) => {
    mono(x, 40, C); const x0 = atTheta(FACE, W) - W * 0.06;
    x.lineWidth = 4; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0, H * 0.55); x.stroke();
    x.beginPath(); x.moveTo(x0 - 14, H * 0.55); x.lineTo(x0 + 14, H * 0.55); x.lineTo(x0, H * 0.32); x.closePath(); x.fill();
  });
  band(OB, 9.5, 14.5, 34.63, 4096, 220, (x, C, W, H) => {
    mono(x, 64, C, 600); x.textAlign = 'left'; const x0 = atTheta(FACE, W) - W * 0.11;
    x.fillText('50mm  1:1.8', x0, H * 0.38); x.font = `500 44px ui-monospace, Menlo, monospace`; x.fillStyle = C.line; x.fillText('Ø49mm', x0 + W * 0.075, H * 0.38);
    x.strokeStyle = C.line; x.lineWidth = 3; x.beginPath(); x.moveTo(x0, H * 0.78); x.lineTo(x0 + W * 0.115, H * 0.78); x.stroke();
  });
  // filter thread: 0.75 mm pitch rings inside the front barrel
  for (let a = -9.6; a <= -4.4; a += 0.75) circle(FB, a, 24.47, lineMat);
  // mount: index dot (where the lens lines up with the camera) on the bayonet ring
  { const [u, v] = ang(FACE + 0.12, 31.55), d = new THREE.Mesh(new THREE.SphereGeometry(0.9 * S * TS, 16, 12), bodyMat); d.position.copy(PT(27.6, u, v)); addOutline(d); MT.w.add(d); }
  // switch plate lettering
  { const c = document.createElement('canvas'); c.width = 256; c.height = 160; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9 * S * TS, 5.6 * S * TS), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
    const f = Math.PI * 0.32, [u, v] = ang(f, 35.05); m.position.copy(PT(19.2, u, v)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.sin(f), Math.cos(f), 0)); m.rotateZ(Math.PI / 2); OB.w.add(m);
    prints.push({ redraw: () => { const x = c.getContext('2d'), C = pal3(); x.clearRect(0, 0, 256, 160); mono(x, 54, C, 600); x.fillText('AF', 64, 80); x.fillText('MF', 192, 80); tex.needsUpdate = true; } }); prints[prints.length - 1].redraw(); }
  themeHooks.push(() => prints.forEach(q => q.redraw()));

  // live feature lines: cam slots + gear band (cam ring), ribs (focus ring), clipped to the half when cut
  const Z6 = [0, 0, 0, 0, 0, 0], camLines = fat(Z6, lineMat), camSlots = fat(Z6, majorMat), ribLines = fat(Z6, lineMat); CM.g.add(camLines, camSlots); FR.g.add(ribLines);
  const PSI = 100 * Math.PI / 180 / 11;                           // cam turn per mm of travel
  function featureLines(psi, zeta, half) {
    const ok = f => !half || inHalf(f), segs = [], slots = [], ribs = [], push = (arr, a, b) => arr.push(...a.toArray(), ...b.toArray());
    for (let k = 0; k < 120; k++) { const f = k * TAU / 120 + psi; if (!ok(f)) continue; const [u, v] = ang(f, 28.25); push(segs, PT(12.1, u, v), PT(13.9, u, v)); }
    PINS.forEach(fp => {                               // each slot is one closed outline: both edges along the helix, joined at the ends
      const edge = off => Array.from({ length: 25 }, (_, i) => { const d = -0.6 + 12.2 * i / 24; return [fp + psi - d * PSI + off * 0.055, PIN_A - d]; });
      const loop = [...edge(-1), ...edge(1).reverse()]; loop.push(loop[0]);
      for (let i = 1; i < loop.length; i++) { const [f0, a0] = loop[i - 1], [f1, a1] = loop[i]; if (!ok(f0) || !ok(f1)) continue; const [u0, v0] = ang(f0, 27.45), [u1, v1] = ang(f1, 27.45); push(slots, PT(a0, u0, v0), PT(a1, u1, v1)); } });
    for (let k = 0; k < 160; k++) { const f = k * TAU / 160 + zeta; if (!ok(f)) continue; const [u, v] = ang(f, 34.65); push(ribs, PT(-7.7, u, v), PT(2.8, u, v)); }   // grip ribs end on the two seams
    prints.forEach(q => { if (q.turns) q.tex.offset.x = -zeta / TAU; });
    camLines.geometry.setPositions(segs.length ? segs : [0, 0, 0, 0, 0, 0]); camSlots.geometry.setPositions(slots.length ? slots : [0, 0, 0, 0, 0, 0]); ribLines.geometry.setPositions(ribs.length ? ribs : [0, 0, 0, 0, 0, 0]);
  }
  // flex cables (shown assembled): board → motor, board → iris stepper, board → contacts
  const flexes = [
    [[23.3, 29.8, 1.72], [22.5, 30.2, 1.74], [22.1, 30.6, 1.75]],
    [[22.8, 27.4, 1.6], [22.4, 23.5, 1.61], [A_STOP + 3.4, 18.5, 1.62]],
    [[23.6, 27.6, 1.22], [27, 25.4, 1.22], [A_MOUNT - 1.3, 23.6, 1.22]],
  ].map(pts => { const W3 = pts.map(([a, r, f]) => { const [u, v] = ang(Math.PI * f, r); return PT(a, u, v); }); const l = polyW(W3, majorMat, g0); return { l, W3 }; });
  const pulse = glowPoints([new THREE.Vector3()], 0.16); g0.add(pulse);

  // ── camera body: a full-frame SLR stand-in on the same mount (flange 44.0 mm to the sensor), no maker's marks ──
  // the section cut is a clipping plane for the body (x ≤ 0 kept), so S opens it up like the lens
  renderer.localClippingEnabled = true;
  const CLIP = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.006);
  outlineMat.clipping = true;
  outlineMat.vertexShader = `uniform float thickness; uniform vec2 res;
#include <clipping_planes_pars_vertex>
    void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vec4 p = projectionMatrix * mvPosition; vec4 n = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0);
      vec2 d = length(n.xy) > 1e-5 ? normalize(n.xy) : vec2(0.0); p.xy += d * thickness * 2.0 / res * p.w; gl_Position = p;
#include <clipping_planes_vertex>
    }`;
  outlineMat.fragmentShader = `uniform vec3 color;
#include <clipping_planes_pars_fragment>
    void main() {
#include <clipping_planes_fragment>
      gl_FragColor = vec4(color, 1.0); }`;
  outlineMat.needsUpdate = true;
  const clipMats = [outlineMat, lineMat, majorMat, accentLineMat];
  const CAMB = part('cam', 'Camera body', `<h2>Mirrorless body + mount adapter</h2><p>A full-frame mirrorless body: its own mount sits 18.0 mm in front of the sensor, so this lens (made for a 44.0 mm flange) rides on a 26.0 mm adapter ring with pass-through contacts. 26 + 18 = 44: the light lands exactly where the lens was designed to put it. While light passes, the shutter curtain drops below the 36 × 24 mm sensor.</p>`, false);
  const T_BODY = toon(), T_SKIN = toon({ grain: 0.15 }), T_GRIPM = toon({ grain: 0.22 }), T_CGLASS = toon({ glass: true });
  [T_BODY, T_SKIN, T_GRIPM, T_CGLASS].forEach(m => clipMats.push(m));
  // the body comes apart in sub-assemblies (moves in mm: x across, a back along the axis, z up)
  const CG = {}, CMOVE = { top: [0, 0, 58], evf: [0, 0, 30], grip: [-46, 0, 0], battery: [0, 0, -78], back: [0, 120, 22], eyecup: [0, 152, 30], board: [0, 92, 16], ibis: [0, 64, 10], shutter: [0, 36, 4], joints: [0, 0, 0] };   // the rear stack also rises a little so it clears the body in the default view
  Object.keys(CMOVE).forEach(k => { CG[k] = new THREE.Group(); CAMB.g.add(CG[k]); });
  const CMT = part('cmt', 'Body mount', '<h2>Body mount</h2><p>The camera\'s own bayonet: a Ø 46 mm throat whose face sits 18.0 mm in front of the sensor.</p>', false);
  const ADP = part('adp', 'Mount adapter', '<h2>Mount adapter · 26.0 mm</h2><p>Takes the lens\'s 44 mm-flange bayonet at the front and the body\'s 18 mm mount at the back: 26 + 18 = 44.0 mm, exactly what the lens was designed for. Eight contacts pass through.</p>', false);
  CMT.camPart = ADP.camPart = CAMB.camPart = true;
  const A_EM = A_IMG - 18, AF = A_EM + 1.6, AB = A_IMG + 30;      // body mount face (18 mm flange), body front, body back
  const X3 = x => S * x * TS, Z3 = z => (ZC + S * z) * TS, Y3 = a => AY(a) * TS;
  const camMeshes = [];
  const WP0 = (x, a, z) => W(S * x, AY(a), ZC + S * z);
  const reg = (m, grp = CAMB.g, lines = true) => { if (lines) { addOutline(m); twMeshes.push(m); } grp.add(m); camMeshes.push(m); return m; };
  // rounded edges carry no crease, so draw their two tangent lines: where the flat cap ends (major) and where the wall begins (detail)
  function offsetLoop(pts, d) {                 // push a closed outline outward by d (three units)
    const cw = THREE.ShapeUtils.isClockWise(pts), n = pts.length, out = [];
    for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[(i + 1) % n], tx = p1.x - p0.x, ty = p1.y - p0.y, l = Math.hypot(tx, ty) || 1;
      const nx = (cw ? -ty : ty) / l, ny = (cw ? tx : -tx) / l; out.push(new THREE.Vector2(pts[i].x + nx * d, pts[i].y + ny * d)); }
    return out;
  }
  function edgeLines(shape, bt, map, c0, c1, grp) {
    const loop = (pts, c, mat) => { const arr = []; for (let i = 0; i < pts.length; i++) { const a = map(pts[i], c), q = map(pts[(i + 1) % pts.length], c); arr.push(...a.toArray(), ...q.toArray()); } grp.add(fat(arr, mat)); };
    const { shape: outer, holes } = shape.extractPoints(32);
    for (const c of [c0, c1]) { loop(outer, c, majorMat); holes.forEach(h => loop(h, c, majorMat)); }
    if (bt > 0) { const wall = offsetLoop(outer, -bt * 0 + bt); const inset = Math.sign(c1 - c0) * bt; loop(wall, c0 + inset, lineMat); loop(wall, c1 - inset, lineMat); }
  }
  // a front profile (x, z) extruded along the axis from a0 (front) to a1 (back), edges rounded by b mm
  function prof(shape, a0, a1, mat, b = 0, grp = CAMB.g) {
    const bt = X3(b), g = new THREE.ExtrudeGeometry(shape, { depth: Y3(a0) - Y3(a1) - 2 * bt, bevelEnabled: b > 0, bevelSize: bt, bevelThickness: bt, bevelSegments: 4, curveSegments: 24 });
    g.translate(0, 0, Y3(a1) + bt); const m = reg(new THREE.Mesh(toCreasedNormals(g, 0.6), mat), grp);
    edgeLines(shape, bt, (p, z) => new THREE.Vector3(p.x, p.y, z), Y3(a1), Y3(a0), grp); return m;
  }
  // a plan (x, a) extruded straight up from z0 to z1, edges rounded by b mm
  function plan(shape, z0, z1, mat, b = 0, grp = CAMB.g) {
    const bt = X3(b), g = new THREE.ExtrudeGeometry(shape, { depth: Z3(z1) - Z3(z0) - 2 * bt, bevelEnabled: b > 0, bevelSize: bt, bevelThickness: bt, bevelSegments: 4, curveSegments: 24 });
    g.rotateX(-Math.PI / 2); g.translate(0, Z3(z0) + bt, 0); const m = reg(new THREE.Mesh(toCreasedNormals(g, 0.6), mat), grp);
    edgeLines(shape, bt, (p, y) => new THREE.Vector3(p.x, y, -p.y), Z3(z0), Z3(z1), grp); return m;
  }
  const rr = (x0, z0, x1, z1, r, b = 0) => { const sh = new THREE.Shape(); roundRect(sh, X3(x0 + b), Z3(z0 + b), X3(x1 - x0 - 2 * b), Z3(z1 - b) - Z3(z0 + b), X3(Math.max(0.3, r - b))); return sh; };
  const P2 = (x, a) => new THREE.Vector2(X3(x), -Y3(a));                      // plan point for plan()
  // ── the body, built the way it comes apart (teardowns: eyecup → rear cover on one ribbon → EVF → top cover + grip rubber → main board → IBIS + sensor) ──
  const SEAM = AF + 26;                                                          // front / rear cover seam
  const rrb = (x0, z0, x1, z1, rt, rb, b = 0) => { const X0 = X3(x0 + b), X1 = X3(x1 - b), Z0 = Z3(z0 + b), Z1 = Z3(z1 - b), RT = X3(Math.max(0.05, rt - b)), RB = X3(Math.max(0.05, rb - b)), sh = new THREE.Shape();
    sh.moveTo(X0 + RB, Z0); sh.lineTo(X1 - RB, Z0); sh.quadraticCurveTo(X1, Z0, X1, Z0 + RB); sh.lineTo(X1, Z1 - RT); sh.quadraticCurveTo(X1, Z1, X1 - RT, Z1);
    sh.lineTo(X0 + RT, Z1); sh.quadraticCurveTo(X0, Z1, X0, Z1 - RT); sh.lineTo(X0, Z0 + RB); sh.quadraticCurveTo(X0, Z0, X0 + RB, Z0); return sh; };
  const withThroat = (sh, r = 23.6) => { const h = new THREE.Path(); h.absarc(0, Z3(0), X3(r), 0, TAU, true); sh.holes.push(h); return sh; };
  prof(withThroat(rrb(-62, -42, 62, 26.6, 0.6, 7, 2)), AF, SEAM, T_SKIN, 2);                         // front cover (stays, with the chassis)
  prof(withThroat(rr(-54, -36, 54, 22, 4), 25.2), SEAM - 2, AB - 10, T_MT, 0);                      // magnesium chassis behind it
  prof(rrb(-62, -42, 62, 26.6, 0.6, 7, 2), SEAM, AB, T_SKIN, 2, CG.back);                            // rear cover
  prof(rrb(-62, 26.6, 62, 36, 7, 0.6, 2), AF, AB, T_SKIN, 2, CG.top);                                // top cover
  // grip: a hard core on the front cover (with the battery chamber) under a rubber skin
  const gripPlan = (b, inset = 0) => { const g = new THREE.Shape(), i = inset;
    g.moveTo(...P2(-41 - b - i, AF + 4).toArray()); g.lineTo(...P2(-41 - b - i, AF - 16).toArray()); g.quadraticCurveTo(...P2(-42 - b - i, AF - 33 + b + i).toArray(), ...P2(-55, AF - 33 + b + i).toArray());
    g.quadraticCurveTo(...P2(-72 + b + i, AF - 33 + b + i).toArray(), ...P2(-72 + b + i, AF - 20).toArray()); g.lineTo(...P2(-72 + b + i, AB - 10).toArray());
    g.quadraticCurveTo(...P2(-72 + b + i, AB - b - i).toArray(), ...P2(-62, AB - b - i).toArray()); g.lineTo(...P2(-41 - b - i, AB - b - i).toArray()); g.closePath(); return g; };
  plan(gripPlan(1.5, 2.6), -40, 29, T_BODY, 1.5);                                                   // grip core
  plan(gripPlan(3.5), -42, 31, T_GRIPM, 3.5, CG.grip);                                              // grip rubber
  const boxAt = (w, h, d, pos, mat = T_BODY) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * S * TS, h * S * TS, d * S * TS), mat); m.position.copy(pos); return m; };
  reg(boxAt(17, 50, 37, WP0(-57, AF + 4, -14)), CG.battery);                                         // battery (16 Wh class pack) in the grip
  reg(boxAt(12, 2, 30, WP0(-57, AF + 4, -40)), CG.battery);                                          // its pull tab end
  // where two solids meet there is no crease to find: draw the joint lines (grip into the front face, hump onto the top plate)
  const joint = (pts, mat = majorMat, grpJ = null) => { const arr = []; for (let i = 1; i < pts.length; i++) arr.push(...WPJ(...pts[i - 1]).toArray(), ...WPJ(...pts[i]).toArray()); (grpJ || CG.joints).add(fat(arr, mat)); };
  const WPJ = (x, a, z) => W(S * x, AY(a), ZC + S * z);
  { const r = 3.5, arc = []; for (let k = 0; k <= 8; k++) { const t = k / 8 * Math.PI / 2; arc.push([-41 - r + r * Math.sin(t), AF - 0.05, 31 - r + r * Math.cos(t)]); }
    joint([[-59.5, AF - 0.05, 31], ...arc, [-41, AF - 0.05, -42 + r]]); }
  joint([[-62.05, AF + 2.5, 31], [-62.05, AB - 2.5, 31]]);
  // ── viewfinder housing: lofted through three rounded sections (base on the top plate, a facet break, the narrow deck) ──
  const HUMP = [{ z: 36, x: 27, a0: AF + 4, a1: AB + 2, r: 6 }, { z: 50, x: 23, a0: AF + 9.5, a1: AB + 1, r: 5 }, { z: 57, x: 16.5, a0: AF + 15, a1: AB - 1, r: 3.5 }];
  const ringOf = (L, n = 10) => { const pts = [], c = [[L.x - L.r, L.a0 + L.r, -Math.PI / 2], [L.x - L.r, L.a1 - L.r, 0], [-L.x + L.r, L.a1 - L.r, Math.PI / 2], [-L.x + L.r, L.a0 + L.r, Math.PI]];
    for (const [cx, ca, t0] of c) for (let k = 0; k <= n; k++) { const t = t0 + (k / n) * Math.PI / 2; pts.push([cx + L.r * Math.cos(t), ca + L.r * Math.sin(t)]); } return pts; };
  function loft(levels, mat, grp) {
    const rings = levels.map(L => ringOf(L).map(([x, a]) => WP0(x, a, L.z))), n = rings[0].length, pos = [];
    const tri = (A, B, C) => pos.push(...A.toArray(), ...B.toArray(), ...C.toArray());
    for (let l = 0; l < rings.length - 1; l++) for (let i = 0; i < n; i++) { const A = rings[l][i], B = rings[l][(i + 1) % n], C = rings[l + 1][(i + 1) % n], D = rings[l + 1][i]; tri(A, B, C); tri(A, C, D); }
    const top = ringOf(levels[levels.length - 1]), idx = THREE.ShapeUtils.triangulateShape(top.map(([x, a]) => new THREE.Vector2(x, a)), []);
    const T = rings[rings.length - 1]; idx.forEach(([i, j, k]) => tri(T[i], T[j], T[k]));
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g = toCreasedNormals(g, THREE.MathUtils.degToRad(28));
    const m = reg(new THREE.Mesh(g, mat), grp);
    rings.forEach((R, l) => grp.add(fat(R.flatMap((p, i) => [...p.toArray(), ...R[(i + 1) % n].toArray()]), l === 1 ? lineMat : majorMat)));   // base joint, facet break, deck edge
    return m;
  }
  loft(HUMP, T_SKIN, CG.top);
  { // a recessed badge panel on the front slope (left blank: no maker's mark)
    const L0 = HUMP[0], L1 = HUMP[1], at = (x, t) => WP0(x, L0.a0 + (L1.a0 - L0.a0) * t - 0.15, L0.z + (L1.z - L0.z) * t), loop = [];
    for (const [x, t] of [[-13, 0.22], [13, 0.22], [13, 0.78], [-13, 0.78], [-13, 0.22]]) loop.push(at(x, t));
    CG.top.add(fat(loop.flatMap((p, i) => i ? [...loop[i - 1].toArray(), ...p.toArray()] : []), lineMat)); }
  // hot shoe: a steel plate with two rails whose lips turn inward, three contact strips between them
  prof(rr(-10.5, 57, 10.5, 58.2, 0.8, 0.3), AF + 18, AB - 5, T_MT, 0.3, CG.top);
  for (const sx of [-1, 1]) { prof(rr(sx < 0 ? -10.5 : 9, 58.2, sx < 0 ? -9 : 10.5, 59.8, 0.3), AF + 20, AB - 7, T_MT, 0, CG.top);
    prof(rr(sx < 0 ? -10.5 : 7.3, 59.3, sx < 0 ? -7.3 : 10.5, 59.8, 0.3), AF + 20, AB - 7, T_MT, 0, CG.top); }
  [-2.4, 0, 2.4].forEach(x => prof(rr(x - 0.5, 58.2, x + 0.5, 58.45, 0.1), AF + 24, AB - 14, T_MT, 0, CG.top));
  prof(rr(-21, 38, 21, 60, 7, 2), AB + 2, AB + 14, T_GRIPM, 2, CG.eyecup);                           // eyecup
  prof(rr(-62, -38, -46, 24, 5, 2), AB - 2, AB + 4, T_GRIPM, 2, CG.back);                           // rear thumb rest
  // rear cover: the screen on its hinge, with the glass set into it
  prof(rr(-46, -34, 40, 20, 3, 1), AB, AB + 4.5, T_BODY, 1, CG.back);
  prof(rr(-43, -31, 37, 17, 2), AB + 4.5, AB + 5, T_CGLASS, 0, CG.back);
  // EVF module under the hump: OLED panel block and its eyepiece glass
  prof(rr(-13, 40, 13, 54, 2, 1), AF + 16, AB - 6, T_BODY, 1, CG.evf);
  prof(rr(-12, 41.5, 12, 53.5, 1), AB - 6, AB - 2, T_CGLASS, 0, CG.evf);
  // main board over its heavy shield, with the processor and memory on the board
  prof(rr(-50, -32, 50, 20, 3), AB - 13, AB - 11.6, T_BODY, 0.3, CG.board);
  prof(rr(-46, -28, 46, 16, 2), AB - 14.6, AB - 13, T_MT, 0.3, CG.board);
  [[-20, 2, 14, 14], [6, -6, 10, 8], [24, 8, 8, 6], [-34, -18, 8, 6]].forEach(([x, z, w, h]) => reg(boxAt(w, h, 1.2, WP0(x, AB - 10.9, z)), CG.board));
  // IBIS stage: the sensor board floats on a plate that four coil/magnet pairs push around
  prof(rr(-32, -27, 32, 27, 3), A_IMG + 3.2, A_IMG + 5, T_MT, 0.4, CG.ibis);
  reg(boxAt(46, 38, 1.6, PT(A_IMG + 2.2, 0, 0)), CG.ibis);
  [[-26, -21], [26, -21], [-26, 21], [26, 21]].forEach(([x, z]) => reg(boxAt(8, 8, 3, WP0(x, A_IMG + 6.6, z)), CG.ibis));
  CG.ibis.add(sensor);
  // shutter unit: a frame with a 36 × 24 window, curtains inside it
  { const sh = rr(-28, -23, 28, 23, 2), h = new THREE.Path(); roundRect(h, X3(-19), Z3(-13), X3(38), Z3(13) - Z3(-13), X3(0.5)); sh.holes.push(h); prof(sh, A_IMG - 6, A_IMG - 1.2, T_BODY, 0.4, CG.shutter); }
  const shutter = new THREE.Group(); CG.shutter.add(shutter);
  reg(boxAt(38, 26, 0.5, PT(A_IMG - 3.6, 0, 0)), shutter);
  // ── the body's own mount (Ø 46 throat) with four screws ──
  lathe(CMT, ring(A_EM, AF + 0.6, 23.6, 30), T_MT, cutMetal);
  for (const f of [0.25, 0.75, 1.25, 1.75]) { const [u, v] = ang(Math.PI * f, 27.8), sc = new THREE.Mesh(new THREE.SphereGeometry(0.7 * S * TS, 12, 8), T_BODY); sc.position.copy(PT(A_EM - 0.2, u, v)); (inHalf(Math.PI * f) ? CMT.g : CMT.w).add(sc); }
  // ── the adapter: takes this lens's bayonet at the front, 26.0 mm long, contacts passed through ──
  const T_ADP = toon({ pitch: 0.7, amt: 0.4, ribs: { n: 120, a0: A_MOUNT + 1.5, a1: A_MOUNT + 12.5, amt: 0.6 } }); clipMats.push(T_ADP);
  lathe(ADP, [[A_MOUNT, 25.6], [A_MOUNT, 33.4], [A_MOUNT + 14, 33.4], [A_EM - 2, 30.8], [A_EM, 30.8], [A_EM, 23.6], [A_MOUNT + 9, 23.6], [A_MOUNT + 9, 25.6]], T_ADP, cutMetal);
  circle(ADP, A_MOUNT + 14, 33.4, majorMat);
  { const f = Math.PI * 0.38, [u, v] = ang(f, 33.4), b = new THREE.Mesh(new THREE.CylinderGeometry(3.4 * S * TS, 3.4 * S * TS, 3 * S * TS, 32), T_BODY);
    b.position.copy(PT(A_MOUNT + 7, ang(f, 34.9)[0], ang(f, 34.9)[1])); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(f), Math.cos(f), 0)); reg(b, ADP.w); }
  { const f0 = Math.PI * 1.22; for (let k = 0; k < 8; k++) { const f = f0 + (k - 3.5) * 0.075, [u, v] = ang(f, 23.6), m = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * S * TS, 0.6 * S * TS, 0.5 * S * TS, 12), ledOffMat);
    m.rotation.x = Math.PI / 2; m.position.copy(PT(A_MOUNT + 1.1, u, v)); ADP.g.add(m); pins.push(m); } }
  const cyl = (r, h, mat, pos, axis = 'z', grp) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * S * TS, r * S * TS, h * S * TS, 48), mat);
    if (axis === 'a') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2; m.position.copy(pos); return reg(m, grp); };
  const WP = (x, a, z) => W(S * x, AY(a), ZC + S * z);
  const knurl = (cx, ca, z0, z1, r, n, grp = CG.top) => { const s = []; for (let k = 0; k < n; k++) { const t = k / n * TAU, x = cx + r * Math.cos(t), a = ca + r * Math.sin(t); s.push(...WP(x, a, z0).toArray(), ...WP(x, a, z1).toArray()); } grp.add(fat(s, lineMat)); };
  // ── top: shutter button in its power collar on the grip, front dial, stacked mode dial, exposure dial, two custom buttons ──
  cyl(7.2, 2, T_BODY, WP(-57, AF - 20, 32), 'z', CG.top); cyl(5, 2.6, T_BODY, WP(-57, AF - 20, 34.2), 'z', CG.top); knurl(-57, AF - 20, 31.1, 32.9, 7.25, 60, CG.top);
  cyl(6.5, 6, T_BODY, WP(-60, AF - 29, 25), 'x', CG.top); { const s = []; for (let k = 0; k < 44; k++) { const t = k / 44 * TAU; s.push(...WP(-56.9, AF - 29 + 6.55 * Math.cos(t), 25 + 6.55 * Math.sin(t)).toArray(), ...WP(-63.1, AF - 29 + 6.55 * Math.cos(t), 25 + 6.55 * Math.sin(t)).toArray()); } CG.top.add(fat(s, lineMat)); }
  cyl(12.5, 6, T_BODY, WP(30, AF + 24, 39), 'z', CG.top); knurl(30, AF + 24, 36.2, 41.8, 12.55, 90);
  cyl(9.5, 4, T_BODY, WP(30, AF + 24, 44), 'z', CG.top); knurl(30, AF + 24, 42.2, 45.8, 9.55, 70); cyl(3.4, 1.6, T_BODY, WP(30, AF + 24, 46.8), 'z', CG.top);
  cyl(11, 6.5, T_BODY, WP(51, AB - 13, 39), 'z', CG.top); knurl(51, AB - 13, 36, 42, 11.05, 80);
  cyl(3.6, 2, T_BODY, WP(-36, AF + 10, 37), 'z', CG.top); cyl(3.6, 2, T_BODY, WP(-36, AF + 20, 37), 'z', CG.top);
  // ── front: lens release, AF-assist lamp (lights while it focuses), function button by the mount ──
  cyl(4.6, 3, T_BODY, WP(33, AF - 1.4, -15), 'a'); cyl(2.4, 2, T_BODY, WP(31, AF - 1, -29), 'a');
  const assist = new THREE.Mesh(new THREE.CircleGeometry(2.6 * S * TS, 24), ledOffMat); assist.position.copy(WP(-33, AF - 0.05, 20)); CAMB.g.add(assist);
  const assistGlow = glowPoints([WP(-33, AF - 1, 20)], 0.5); g0.add(assistGlow);
  // ── visible side: port doors (seams), strap lug ──
  { const side = (pts) => CG.back.add(fat(pts.flatMap((p, i) => i ? [...WP(...pts[i - 1]).toArray(), ...WP(...p).toArray()] : []), majorMat));
    const door = (a0, a1, z0, z1) => side([[62.05, a0, z0], [62.05, a1, z0], [62.05, a1, z1], [62.05, a0, z1], [62.05, a0, z0]]);
    door(SEAM + 4, AB - 6, -4, 20); door(SEAM + 4, AB - 6, -34, -10); }
  { const lug = new THREE.Mesh(new THREE.TorusGeometry(3 * S * TS, 0.9 * S * TS, 10, 28), T_BODY); lug.position.copy(WP(64.5, AF + 22, 27)); lug.rotation.y = Math.PI / 2; reg(lug); }
  camMeshes.forEach(m => { if (m.material && !clipMats.includes(m.material)) clipMats.push(m.material); });

  creases(first);

  // ── explode layout: stack the parts front → back with gaps, the iris stays put ──
  const ORDER = ['fb', 'fr', 'l1', 'l2', 'l3', 'ir', 'db', 'l6', 'tb', 'cm', 'ob', 'pcb', 'mt', 'rb'];
  { let cur = null; ORDER.forEach(k => { const p = P[k], gap = (['l1', 'l2', 'l3', 'db', 'l6'].includes(k) ? 9 : 11) + (k === 'l3' ? 12 : 0); if (cur === null) cur = p.amin; p.off = cur - p.amin; cur = p.amax + p.off + gap + (k === 'ir' ? 12 : 0); });
    const deep = Math.max(...ORDER.map(k => P[k].amax + P[k].off)) - P.rb.amax; ORDER.forEach(k => P[k].off -= deep); P.mo.off = P.cm.off; P.mo.radial = 26; }   // the body stays; the lens leaves forward
  const EXP_A0 = Math.min(...ORDER.map(k => P[k].amin + P[k].off)) - 10, EXP_A1 = A_IMG + 46;

  // ── state ──
  const st = { N: 1.8, rho: rhoOf(1.8), di: 0, dist: Infinity, ext: 0, extT: 0, exp: 0, expT: 0, cexp: 0, cexT: 0, cut: true, light: true, psiSpin: 0, zeta: 0, zetaT: 0, mot: 0, busy: 0, af: false, lastTick: 0, spotUm: 0, cutShown: null };
  let rays = null;
  function setCut(on) {
    st.cut = on; parts.forEach(p => { p.w.visible = !on; p.h.visible = on; });
    IR.coverW.forEach(m => m.visible = !on); IR.coverH.visible = on; IR.baseW.forEach(m => m.visible = !on); IR.baseH.visible = on;
    irBase.children.forEach(m => { if (m.userData.pin !== undefined) m.visible = !on || inHalf(m.userData.pin); });
    clipMats.forEach(m => { m.clippingPlanes = on ? [CLIP] : []; m.needsUpdate = true; });
    buildBlades(st.rho, on); featureLines(st.ext * PSI, st.zeta, on); if (typeof sel !== 'undefined' && sel) applySel(sel); render();
  }
  function traceFan() {
    const shift = st.ext, rho = st.rho, out = [], dim = [], d = st.dist, aObj = A_IMG - d, aStart = Math.max(-700, isFinite(d) ? aObj : -700);   // light enters from off-screen (or from the real object point when it is close)
    const solve = (fn, target) => { let lo = -1, hi = 1; for (let k = 0; k < 44; k++) { const m = (lo + hi) / 2, r = fn(m); const s = r ? r.stopH : (m > 0 ? 1e9 : -1e9); if (s < target) lo = m; else hi = m; } return fn((lo + hi) / 2); };
    const bundle = (theta, into, n, frac = 0.985) => {
      const fn = isFinite(d) ? m => { const h0 = -Math.tan(theta) * (A_IMG - aObj - 40); return trace(aObj, h0, 1, m * 0.25 + Math.tan(theta), shift, rho * 1.0001); }
                             : m => trace(aStart, m * 30 - Math.tan(theta) * 20, Math.cos(theta), Math.sin(theta), shift, rho * 1.0001);
      const hs = []; for (let k = 0; k < n; k++) { const r = solve(fn, rho * frac * (2 * k / (n - 1) - 1)); if (r) { into.push(r); hs.push(r.hImg); } } return hs;
    };
    const hs = bundle(0, out, 11), mean = hs.reduce((s, v) => s + v, 0) / (hs.length || 1);
    st.spotUm = hs.length ? 1000 * 2 * Math.sqrt(hs.reduce((s, v) => s + (v - mean) ** 2, 0) / hs.length) : 0;
    bundle(12 * Math.PI / 180, dim, 3);             // 12° lands 11 mm off axis, inside the 24 mm sensor height
    return { out, dim, aStart };
  }
  const rayLines = fat(Z6, rayMat), rayLinesDim = fat(Z6, rayDim); g0.add(rayLines, rayLinesDim);
  function drawRays() {
    const { out, dim, aStart } = traceFan(), toArr = list => { const arr = [];
      list.forEach(r => { let pts = r.pts; const first = pts[0];
        if (first[0] < aStart) { const [a1, h1] = pts[1], t = (aStart - first[0]) / (a1 - first[0]); pts = [[aStart, first[1] + (h1 - first[1]) * t], ...pts.slice(1)]; }
        for (let i = 0; i < pts.length - 1; i++) arr.push(...PT(pts[i][0], 0, pts[i][1], 0.3).toArray(), ...PT(pts[i + 1][0], 0, pts[i + 1][1], 0.3).toArray()); });
      return arr.length ? arr : [0, 0, 0, 0, 0, 0]; };
    rayLines.geometry.setPositions(toArr(out)); rayLinesDim.geometry.setPositions(toArr(dim));
  }
  const fmtD = d => !isFinite(d) ? '∞' : d >= 1000 ? (d / 1000).toFixed(d % 1000 ? 1 : 0) + ' m' : (d / 1000).toFixed(2) + ' m';
  function readout() {
    if (active !== 'ln') return;
    const r = document.getElementById('read');
    if (st.expT > 0.5 && st.cexT > 0.5) r.textContent = `lens and camera apart · 6 elements / 5 groups`;
    else if (st.cexT > 0.5) r.textContent = `camera apart · 12 assemblies · lens on its adapter`;
    else if (st.expT > 0.5) r.textContent = `lens apart · 6 elements / 5 groups · 7-blade iris`;
    else r.textContent = `f/${st.N} · focus ${fmtD(st.dist)} · extension ${st.ext.toFixed(1)} mm` + (st.light ? ` · spot ${Math.round(st.spotUm)} µm` : '');
  }
  function render() {
    const lit = st.light && st.exp < 0.02 && st.cexp < 0.02;
    glassBody.emissiveIntensity = lit ? 0.05 : 0; T_GLASS.uniforms.lit.value = lit ? (theme === 'light' ? 0.1 : 0.06) : 0; cutGlass.uniforms.lit.value = lit ? (theme === 'light' ? 0.07 : 0.035) : 0;
    rayLines.visible = rayLinesDim.visible = lit; if (lit) drawRays();
    readout();
  }
  // ── actions ──
  const camSig = (ms = 500) => { st.busy = Math.max(st.busy, performance.now() + ms); };
  function setAperture(i) {
    const k = Math.max(0, Math.min(STOPS.length - 1, i)); if (STOPS[k] === st.N) return true;
    st.N = STOPS[k]; tap(2600, 0.2, 5); tone(180, 0.06, 0.02, { type: 'square' }); camSig(350); st.pulse = { f: 1, t0: performance.now() }; return true;
  }
  const stopDown = () => setAperture(STOPS.indexOf(st.N) + 1), openUp = () => setAperture(STOPS.indexOf(st.N) - 1);
  function focusTo(i, byRing) {
    st.di = Math.max(0, Math.min(DISTS.length - 1, i)); st.dist = DISTS[st.di]; st.extT = extFor(st.dist);
    if (byRing) { st.zetaT += (byRing > 0 ? 1 : -1) * 0.22; SFX.detent(); }
    camSig(900); st.pulse = { f: 0, t0: performance.now() }; render(); return true;
  }
  const nearer = () => focusTo(st.di + 1, 1), farther = () => focusTo(st.di - 1, -1);
  function autofocus() { let i; do { i = Math.floor(Math.random() * DISTS.length); } while (i === st.di); st.af = true; return focusTo(i, 0); }
  function toggleExplode() { st.expT = st.expT > 0.5 ? 0 : 1; SFX.thunk(); camAnimTo(); return true; }        // the section cut stays as it is
  function toggleCamExplode() { st.cexT = st.cexT > 0.5 ? 0 : 1; SFX.thunk(); camAnimTo(); return true; }
  const toggleCut = () => { setCut(!st.cut); try { localStorage.setItem('lens-cut', st.cut ? '1' : '0'); } catch (e) {} SFX.switch(); return true; }, toggleLight = () => { st.light = !st.light; SFX.button(); render(); return true; };

  // camera follows explode: keeps the user's orbit direction, eases the target and distance
  const VIEW_A = { target: PT((-48 + A_IMG + 46) / 2, -10, 10), dist: 13 }, VIEW_E = { target: PT(EXP_A0 + (EXP_A1 - EXP_A0) * 0.46, -10, 10), dist: 13 * (EXP_A1 - EXP_A0) / (A_IMG + 46 + 48) * 0.85 };
  const view = { target: VIEW_A.target.clone(), dist: VIEW_A.dist };      // the shell's Iso view frames whichever state is showing
  let cam = null;
  function camAnimTo() {
    const e = st.expT > 0.5, c = st.cexT > 0.5, b = e ? VIEW_E : VIEW_A;
    const v = { target: b.target.clone().add(new THREE.Vector3(0, c ? 18 * S * TS : 0, c ? -40 * S * TS : 0)), dist: b.dist * (c ? (e ? 1.35 : 1.75) : 1) };
    const prevDist = view.dist; view.target.copy(v.target); view.dist = v.dist; const dir = camera.position.clone().sub(controls.target).normalize(), scale = Math.max(1, 1.45 / persp.aspect);
    cam = { t: 0, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: v.target.clone(), toP: v.target.clone().addScaledVector(dir, v.dist * scale), z0: ortho.zoom, z1: ortho.zoom * prevDist / v.dist };
  }

  function key(e) {
    const k = e.key.toLowerCase();
    if (k === 'e') return e.repeat ? true : toggleExplode();
    if (k === 'c') return e.repeat ? true : toggleCamExplode();
    if (k === 's') return e.repeat ? true : toggleCut();
    if (k === 'l') return e.repeat ? true : toggleLight();
    if (k === 'a' || e.key === ' ') return e.repeat ? true : autofocus();
    if (e.key === 'ArrowUp') return nearer();
    if (e.key === 'ArrowDown') return farther();
    if (e.key === 'ArrowRight' || e.key === ']') return stopDown();
    if (e.key === 'ArrowLeft' || e.key === '[') return openUp();
    return false;
  }
  function click(hit) {
    let o = hit?.object; while (o && !o.userData.ln) o = o.parent;
    const p = o && P[o.userData.ln];
    document.getElementById('info').innerHTML = p ? p.info : INFO0; applySel(p ? p.key : null);
    if (p && p.key === 'fr') nearer(); else if (p && p.key === 'ir') stopDown(); else if (p && p.key === 'mo') autofocus();
  }
  // the part you clicked is the live one: its hairlines and silhouette switch to the accent
  const selOutline = outlineMat.clone(); selOutline.uniforms.res = outlineMat.uniforms.res; selOutline.uniforms.thickness = outlineMat.uniforms.thickness; selOutline.uniforms.color.value = accent.clone();
  themeHooks.push(() => selOutline.uniforms.color.value.copy(accent));
  let sel = null;
  function applySel(key) {
    const swap = (p, on) => p.g.traverse(o => {
      if (o.isLineSegments2 && o !== rayLines && o !== rayLinesDim) { if (on) { if (!o.userData.mat0) o.userData.mat0 = o.material; o.material = accentLineMat; } else if (o.userData.mat0) { o.material = o.userData.mat0; delete o.userData.mat0; } }
      else if (o.userData.outline) o.material = on ? selOutline : outlineMat; });
    if (sel && P[sel]) swap(P[sel], false); sel = key || null; if (sel && P[sel]) swap(P[sel], true);
  }

  // ── labels for the exploded views: a mono title and a true line or two, with a leader to the part (follows the orbit) ──
  const labelBox = document.createElement('div'); labelBox.className = 'lz-labels'; document.body.appendChild(labelBox);
  const labelSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); labelSvg.setAttribute('class', 'lz-leaders'); labelBox.appendChild(labelSvg);
  const css = document.createElement('style'); css.textContent = `
    .lz-labels { position:fixed; inset:0; pointer-events:none; z-index:1; }
    .lz-leaders { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
    .lz-leaders path { fill:none; stroke:var(--dim); stroke-width:.8; opacity:.75; }
    .lz-leaders circle { fill:var(--dim); }
    .lz-label { position:absolute; width:190px; font:11px/1.45 ui-monospace, "SF Mono", Menlo, monospace; color:var(--dim); transition:none; }
    .lz-label b { display:block; font-weight:600; color:var(--ink); letter-spacing:.04em; margin-bottom:2px; }
    .lz-label[data-side="r"] { text-align:right; }
    .lz-leaders text { font:600 9px ui-monospace, Menlo, monospace; fill:var(--bg); text-anchor:middle; dominant-baseline:central; }
    .lz-leaders .lz-pin { fill:var(--ink); }
    .lz-legend { position:fixed; left:10px; right:10px; bottom:84px; max-height:30vh; overflow-y:auto; display:none; z-index:2; padding:8px 10px; border:1px solid var(--line); border-radius:10px;
      background:var(--panel); font:11px/1.45 ui-monospace, "SF Mono", Menlo, monospace; color:var(--dim); -webkit-overflow-scrolling:touch; }
    .lz-legend div { display:grid; grid-template-columns:20px 1fr; gap:2px 6px; padding:3px 0; }
    .lz-legend i { font-style:normal; width:16px; height:16px; border-radius:50%; background:var(--ink); color:var(--bg); font-size:9px; font-weight:600; display:grid; place-items:center; }
    .lz-legend b { color:var(--ink); font-weight:600; letter-spacing:.04em; }
    .ctl .ls { display:none; }
    @media (max-width: 720px) {
      #ctl-ln { top:auto !important; bottom:10px !important; left:10px !important; right:10px !important; width:auto !important; flex-direction:row !important; flex-wrap:nowrap; overflow-x:auto; gap:6px !important; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
      #ctl-ln::-webkit-scrollbar { display:none; }
      #ctl-ln button { flex:none; white-space:nowrap; font-size:12px; line-height:1; padding:0 12px !important; height:38px !important; min-height:0 !important; align-items:center; justify-content:center; }
      #ctl-ln kbd, #ctl-ln .sep, #ctl-ln .lf { display:none; }
      #ctl-ln .ls { display:inline; }
      #info { display:none !important; }
      #read { left:10px !important; right:10px !important; bottom:58px !important; text-align:center !important; font-size:11px; }
    }`;
  document.head.appendChild(css);
  const legend = document.createElement('div'); legend.className = 'lz-legend'; document.body.appendChild(legend);
  const narrow = () => innerWidth < 720;
  const LBL = (obj, a, r, f, title, text) => ({ obj, at: () => PT(a, ...ang(f, r)), title, text });
  const TOP = 0.05, BACK = Math.PI * 1.45, LOW = Math.PI * 0.85;
  const LENS_LABELS = [
    LBL(P.fb.g, -6, 26, TOP, 'Front barrel', '49 mm filter thread. Slides forward with the optics to focus.'),
    LBL(P.fr.g, -3, 34.6, LOW, 'Focus ring', 'By wire: an encoder reads the turn, the motor does the moving.'),
    LBL(P.l1.g, 2, 16.5, TOP, 'L1 · front element', 'R 34.30 / 247.65 mm, nd 1.6228, clear Ø 31 mm.'),
    LBL(P.ir.g, A_STOP, 25.6, LOW, 'Iris · 7 blades', `Ø ${(rhoOf(1.8) * 2).toFixed(1)} mm at f/1.8, Ø ${(rhoOf(22) * 2).toFixed(1)} mm at f/22.`),
    LBL(P.db.g, 26, 12.9, TOP, 'L4 + L5 doublet', 'Flint and crown cemented: colour fringes cancel.'),
    LBL(P.l6.g, 33, 12.8, LOW, 'L6 · rear element', 'Its back surface sits 37.9 mm from the sensor at ∞.'),
    LBL(P.tb.g, 10, 26, TOP, 'Inner tube', 'Carries all six elements: 10.9 mm of travel for 0.35 m.'),
    LBL(P.cm.g, 6, 27.4, LOW, 'Cam ring', '100° of turn = 10.9 mm, through three helical slots.'),
    LBL(P.mo.g, 17, 30.6, MO_F, 'Stepping motor', 'Exact, near-silent steps: the camera always knows focus.'),
    LBL(P.mt.g, 27.5, 31.5, TOP, 'Lens mount', 'Its face sits 44.0 mm from the sensor; 8 contacts.'),
  ];
  const CPT = (g, x, a, z) => ({ obj: g, at: () => W(S * x, AY(a), ZC + S * z) });
  const CAM_LABELS = [
    { ...CPT(CG.top, 0, AF + 20, 59), title: 'Top cover', text: 'Dials, shutter button and hot shoe lift off as one: seven screws.' },
    { ...CPT(CG.evf, 0, AF + 30, 55), title: 'EVF module', text: 'OLED panel and eyepiece optics, held to the frame on a thermal pad.' },
    { ...CPT(CG.grip, -72, AF - 10, 0), title: 'Grip rubber', text: 'A rubber skin; two top-cover screws hide under it.' },
    { ...CPT(CG.battery, -57, AF + 4, -39), title: 'Battery', text: 'Slides out of the grip from the bottom.' },
    { ...CPT(CG.back, 40, AB + 4, 20), title: 'Rear cover + screen', text: 'Tied to the body by a single ribbon cable.' },
    { ...CPT(CG.eyecup, 0, AB + 14, 60), title: 'Eyecup', text: 'Comes off first: four screws behind it.' },
    { ...CPT(CG.board, 50, AB - 12, 20), title: 'Main board', text: 'Processor and memory over a heavy shield and thermal pads.' },
    { ...CPT(CG.ibis, 32, A_IMG + 4, -27), title: 'Sensor + IBIS stage', text: '36 × 24 mm sensor on a plate that coils shift to cancel shake.' },
    { ...CPT(CG.shutter, 28, A_IMG - 3, 23), title: 'Shutter unit', text: 'Focal-plane curtains just in front of the sensor.' },
    { ...CPT(CAMB.g, 62, AF + 18, -20), title: 'Front cover + chassis', text: 'The metal frame everything bolts to; it stays put.' },
    { ...CPT(CMT.g, 0, A_EM, -30), title: 'Body mount', text: 'Ø 46 mm throat, 18.0 mm in front of the sensor.' },
    { ...CPT(ADP.g, 0, A_MOUNT + 12, 33.4), title: 'Mount adapter', text: '26.0 mm long: 26 + 18 = 44.0 mm, what the lens expects.' },
  ];

  const labelEls = new Map();
  function labelEl(l) {
    if (!labelEls.has(l)) { const d = document.createElement('div'); d.className = 'lz-label'; d.innerHTML = `<b>${l.title.toUpperCase()}</b>${l.text}`; labelBox.appendChild(d); labelEls.set(l, d); }
    return labelEls.get(l);
  }
  const vv = new THREE.Vector3();
  function drawLabels(E, CE) {
    const kL = sm((E - 0.6) / 0.4), kC = sm((CE - 0.6) / 0.4), show = active === 'ln' && g0.visible;
    const list = [...(kL > 0 ? LENS_LABELS.map(l => [l, kL]) : []), ...(kC > 0 ? CAM_LABELS.map(l => [l, kC]) : [])];
    for (const [l, d] of labelEls) if (!list.some(([q]) => q === l)) d.style.display = 'none';
    const info = document.getElementById('info'); if (info) { const k = Math.max(kL, kC); info.style.opacity = (1 - k).toFixed(2); info.style.pointerEvents = k > 0.5 ? 'none' : ''; }   // the labels take over from the text panel
    if (!show || !list.length) { if (lastLabelKey) { labelSvg.innerHTML = ''; legend.style.display = 'none'; lastLabelKey = ''; } return; }
    const r = renderer.domElement.getBoundingClientRect(), Wd = r.width, Hd = r.height;
    const pts = list.map(([l, k]) => { l.obj.updateMatrixWorld(); vv.copy(l.at()).applyMatrix4(l.obj.matrixWorld); vv.project(camera); return { l, k, x: (vv.x + 1) / 2 * Wd, y: (1 - vv.y) / 2 * Hd }; });
    const key = `${Wd}x${Hd}|` + pts.map(p => `${Math.round(p.x)},${Math.round(p.y)},${p.k.toFixed(2)}`).join(';');
    if (key === lastLabelKey) return;                               // nothing moved: leave the DOM alone
    lastLabelKey = key;
    if (narrow()) {                                                 // phone: numbered pins on the parts, the words in a legend sheet
      for (const [, d] of labelEls) d.style.display = 'none';
      let svg = ''; const placed = [];
      pts.forEach((p, i) => { let x = p.x, y = p.y; for (const q of placed) if (Math.hypot(q.x - x, q.y - y) < 17) y -= 17; placed.push({ x, y });
        if (Math.abs(y - p.y) > 1) svg += `<path style="opacity:${p.k.toFixed(2)}" d="M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${x.toFixed(1)} ${(y + 8).toFixed(1)}"/>`;
        svg += `<g style="opacity:${p.k.toFixed(2)}"><circle class="lz-pin" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"/><text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${i + 1}</text></g>`; });
      labelSvg.innerHTML = svg;
      const html = pts.map((p, i) => `<div><i>${i + 1}</i><span><b>${p.l.title.toUpperCase()}</b><br>${p.l.text}</span></div>`).join('');
      if (legend.dataset.html !== html) { legend.innerHTML = html; legend.dataset.html = html; }
      legend.style.display = 'block'; legend.style.opacity = Math.max(...pts.map(p => p.k)).toFixed(2);
      return;
    }
    legend.style.display = 'none';
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const colL = 24, colR = Wd - 236 - 200, top = 64, gap = 66;
    let svg = '';
    for (const side of ['l', 'r']) {
      const g = pts.filter(p => (p.x < cx) === (side === 'l')).sort((a, b) => a.y - b.y);
      const bottom = Hd - 70;
      g.forEach(p => { const d = labelEl(p.l); d.style.display = 'block'; d.dataset.side = side; p.h = d.offsetHeight; });
      let y = top; g.forEach(p => { p.ly = Math.max(y, p.y - 10); y = p.ly + p.h + 10; });          // stack by real heights, never overlapping
      let lim = bottom; for (let i = g.length - 1; i >= 0; i--) { g[i].ly = Math.min(g[i].ly, lim - g[i].h); lim = g[i].ly - 10; }   // and inside the band
      g.forEach(p => {
        const d = labelEl(p.l); d.style.opacity = p.k.toFixed(2);
        d.style.left = `${side === 'l' ? colL : colR}px`; d.style.top = `${p.ly}px`;
        const ex = side === 'l' ? colL + 194 : colR - 4, ey = p.ly + 8, bend = side === 'l' ? ex + 36 : ex - 36;
        svg += `<path style="opacity:${(0.75 * p.k).toFixed(2)}" d="M${ex} ${ey}H${bend}L${p.x.toFixed(1)} ${p.y.toFixed(1)}"/><circle style="opacity:${p.k.toFixed(2)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.8"/>`;
      });
    }
    labelSvg.innerHTML = svg;
  }
  const SHORT = { 'Explode lens': 'Lens apart', 'Explode camera': 'Camera apart', 'Section cut': 'Section', 'Light path': 'Light', 'Autofocus': 'AF', 'Focus nearer': 'Near', 'Focus farther': 'Far', 'Stop down': 'f +', 'Open up': 'f −', 'Iso view': 'Iso' };
  let shortDone = false;
  function shortLabels() {                                          // phone toolbar: short names, swipeable row (the full names stay on desktop)
    const panel = document.getElementById('ctl-ln'); if (!panel) return; shortDone = true;
    panel.querySelectorAll('button').forEach(b => { const kbd = b.querySelector('kbd'), full = b.childNodes[0]?.textContent?.trim(); if (!full || !SHORT[full]) return;
      b.innerHTML = `<span class="lf">${full}</span><span class="ls">${SHORT[full]}</span>`; if (kbd) b.appendChild(kbd); });
  }
  let lastBlade = -1, lastFeat = '', lastLabelKey = '';
  (function waitPanel(n) { if (shortDone || n > 100) return; shortLabels(); if (!shortDone) setTimeout(() => waitPanel(n + 1), 50); })(0);   // independent of animation frames
  function tick(now, dt) {
    dt = Math.min(dt, 0.05);
    // explode
    const e0 = st.exp; st.exp += (st.expT - st.exp) * Math.min(1, dt * 2.6); if (Math.abs(st.exp - st.expT) < 1e-3) st.exp = st.expT;
    const c0 = st.cexp; st.cexp += (st.cexT - st.cexp) * Math.min(1, dt * 2.6); if (Math.abs(st.cexp - st.cexT) < 1e-3) st.cexp = st.cexT;
    // focus travel at stepping-motor speed (~30 mm/s), ticking as it steps
    const e1 = st.ext, dE = st.extT - st.ext; st.ext += Math.sign(dE) * Math.min(Math.abs(dE), dt * 30);
    const moving = Math.abs(st.ext - e1) > 1e-5;
    if (moving) { st.mot += (st.ext - e1) * 9; if (now - st.lastTick > 34) { st.lastTick = now; tap(1900 + Math.random() * 300, 0.05, 7); } }
    else if (st.af && Math.abs(dE) < 1e-5) { st.af = false; tone(2093, 0.07, 0.03); tone(2637, 0.09, 0.03, { at: 0.08 }); }
    st.zeta += (st.zetaT - st.zeta) * Math.min(1, dt * 10);
    // aperture: blades swing toward the new stop
    const rT = rhoOf(st.N); st.rho += (rT - st.rho) * Math.min(1, dt * 9); if (Math.abs(st.rho - rT) < 0.004) st.rho = rT;
    if (Math.abs(st.rho - lastBlade) > 1e-3) { lastBlade = st.rho; buildBlades(st.rho, st.cut); if (sel === 'ir') applySel('ir'); }
    const fk = `${st.ext.toFixed(3)}|${st.zeta.toFixed(3)}|${st.cut}`; if (fk !== lastFeat) { lastFeat = fk; featureLines(st.ext * PSI, st.zeta, st.cut); }
    // place parts: explode offset (back = +a) and focus extension for the moving block
    const E = sm(st.exp);
    const CE = sm(st.cexp);
    parts.forEach(p => { const da = (p.moving ? -st.ext : 0) + E * (p.off || 0) + (p.key === 'adp' || !p.camPart ? -58 * CE : p.key === 'cmt' ? -18 * CE : 0); p.g.position.set(0, 0, -da * S * TS);
      if (p.radial) { const [u, v] = ang(MO_F, p.radial * E); p.g.position.x += S * u * TS; p.g.position.y += S * v * TS; } });
    irCover.position.z = E * 9 * S * TS; irBase.position.z = -E * 9 * S * TS;
    for (const k in CG) { const [x, a, z] = CMOVE[k]; CG[k].position.set(x * S * TS * CE, z * S * TS * CE, -a * S * TS * CE); }
    CG.joints.visible = CE < 0.02;
    pinion.rotation.z = st.mot;
    // light passing = an exposure: the shutter curtain drops below the sensor
    const exposing = st.light && st.exp < 0.02 && st.cexp < 0.02 ? 1 : 0; st.mirrorT = (st.mirrorT ?? 1) + (exposing - (st.mirrorT ?? 1)) * Math.min(1, dt * 7);
    shutter.position.y = -sm(st.mirrorT) * 30 * S * TS;
    const afOn = st.af && moving; assist.material = afOn ? ledOnMat : ledOffMat; assistGlow.material.uniforms.intensity.value = afOn ? 0.9 : 0;

    flexes.forEach(f => { f.l.visible = st.exp < 0.02; f.l.material = now < st.busy ? flexOn : majorMat; });
    pins.forEach(m => m.material = now < st.busy ? ledOnMat : ledOffMat);
    // a light pulse runs along the flex that carries the current command
    if (st.pulse && now < st.busy && st.exp < 0.02) { const f = flexes[st.pulse.f], t = (Math.max(0, now - st.pulse.t0) / 420) % 1, k = t * 2, i = Math.min(1, Math.floor(k)), q = f.W3[i].clone().lerp(f.W3[i + 1], k - i);
      pulse.geometry.attributes.position.setXYZ(0, q.x, q.y, q.z); pulse.geometry.attributes.position.needsUpdate = true; pulse.material.uniforms.intensity.value = 0.9; }
    else pulse.material.uniforms.intensity.value = 0;
    const lit = st.light && st.exp < 0.02 && st.cexp < 0.02;
    spot.material.uniforms.intensity.value = lit ? Math.max(0.25, 1.1 - st.spotUm / 120) : 0; spotDot.visible = lit;
    if (moving || Math.abs(st.rho - rT) > 1e-4 || (e0 < 0.02) !== (st.exp < 0.02) || (c0 < 0.02) !== (st.cexp < 0.02) || (st.exp > 0 && e0 === 0)) render();
    else if (Math.abs(e0 - st.exp) > 0 || Math.abs(c0 - st.cexp) > 0) readout();
    drawLabels(E, CE);
    if (cam) { cam.t = Math.min(1, cam.t + dt / 1.1); const k = sm(cam.t);
      controls.target.lerpVectors(cam.fromT, cam.toT, k);
      if (camera === ortho) { ortho.zoom = THREE.MathUtils.lerp(cam.z0, cam.z1, k); ortho.updateProjectionMatrix(); camera.position.copy(controls.target).add(cam.fromP.clone().sub(cam.fromT)); }
      else camera.position.lerpVectors(cam.fromP, cam.toP, k);
      if (cam.t >= 1) cam = null; }
    if (!shortDone) shortLabels();
    tickFlashes(now);
  }
  function demo() { [[300, autofocus], [1500, stopDown], [1900, stopDown], [2300, stopDown], [3300, openUp], [3600, openUp], [3900, openUp]].forEach(([t, f]) => setTimeout(f, t)); }
  const INFO0 = `<h2>50 mm f/1.8 lens</h2><p>Six elements in five groups, traced with the real prescription: the light you see is computed with Snell's law surface by surface. Click a part for its numbers. It rides a mirrorless body on a 26 mm adapter: 26 + 18 = 44.0 mm to the sensor. E takes the lens apart, C the camera, S toggles the section cut, ↑ ↓ focus, ← → aperture, A autofocus.</p>`;
  { const haze = hazeAndShadow(g0, 0, AY(30), 4.4, 6.6); haze.uniforms.opacity.value = 0; }
  let cut0 = false; try { cut0 = localStorage.getItem('lens-cut') === '1'; } catch (e) {}   // opens whole; remembers the last choice
  setCut(cut0); render();
  return { group: g0, key, click, tick, readout, demo, stop: () => {},
    panel: [['Explode lens', 'E', toggleExplode], ['Explode camera', 'C', toggleCamExplode], ['Section cut', 'S', toggleCut], ['Light path', 'L', toggleLight], ['Autofocus', 'A', autofocus],
      ['Focus nearer', '↑', nearer], ['Focus farther', '↓', farther], ['Stop down', '→', stopDown], ['Open up', '←', openUp]],
    view, info: INFO0, hint: 'e lens apart · c camera apart · s section · ↑↓ focus · ←→ aperture · a autofocus' };
})() });
