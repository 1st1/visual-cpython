/* Fig 1 — Office tower: 24 floors you can switch on, a night-shift cascade, a blinking spire. */
FIGS.push({
  id: 'tower',
  name: 'Office tower',
  hint: 'Click a floor · ↑↓ + space · n night shift · o all off',
  aria: 'Isometric modernist office tower with 24 floors on a city block. Click a floor’s facade to toggle its lights. Arrow up and down move the floor cursor, space or enter toggles that floor, n lights the whole tower floor by floor, o switches it off from the top down.',
  css: `
    [data-fig="tower"] .fl { cursor:pointer; }
    [data-fig="tower"] .fl .band { transition:fill .3s; }
    [data-fig="tower"] .fl:hover .band { stroke:var(--ink); }
    [data-fig="tower"] .pn { fill:var(--recess); stroke:var(--detail); stroke-width:.6; vector-effect:non-scaling-stroke; transition:fill .25s, opacity .25s; }
    [data-fig="tower"] .fl.on .pn { fill:var(--accent); stroke:var(--accent-hi); }
    [data-fig="tower"] .fl.on .pn.hi { fill:var(--accent-hi); }
    [data-fig="tower"] .fl.on .pn.dim { opacity:.45; }
    [data-fig="tower"] .fl.on .pn.off { fill:var(--recess); stroke:var(--detail); }
    [data-fig="tower"] .fl.on .win { filter:url(#soft); }
    [data-fig="tower"] .fl.on .halo { opacity:.38; }
    [data-fig="tower"] .cur { fill:none; stroke:var(--accent-hi); stroke-width:1.6; vector-effect:non-scaling-stroke; opacity:0; pointer-events:none; }
    [data-fig="tower"] .fl.cursor .cur { opacity:1; filter:url(#soft); }
    [data-fig="tower"] .beacon { fill:var(--accent-hi); animation:tower-blink 1.4s steps(1) infinite; }
    [data-fig="tower"] .beacon-halo { fill:var(--accent); opacity:.5; animation:tower-blink 1.4s steps(1) infinite; }
    [data-fig="tower"] .mast { fill:none; stroke:var(--line); stroke-width:1.2; vector-effect:non-scaling-stroke; }
    [data-fig="tower"] .lobby-glass { fill:var(--glass); stroke:var(--line); stroke-width:1; vector-effect:non-scaling-stroke; transition:fill .4s, stroke .4s; }
    [data-fig="tower"].lit .lobby-glass { fill:var(--accent); stroke:var(--accent-hi); opacity:.85; }
    [data-fig="tower"].lit .lobby-door { fill:var(--accent-hi); }
    [data-fig="tower"].lit .lobby-fx { filter:url(#soft); }
    [data-fig="tower"] .lobby-door { fill:var(--recess); stroke:var(--line); stroke-width:1; vector-effect:non-scaling-stroke; transition:fill .4s; }
    @keyframes tower-blink { 0% { opacity:1; } 45% { opacity:.08; } }
    @media (prefers-reduced-motion:reduce) { [data-fig="tower"] .beacon, [data-fig="tower"] .beacon-halo { animation:none; } [data-fig="tower"] .pn { transition:none; } }
  `,
  mount(stage, api) {
    /*  boxes             x    y    z    w    d    h
        plate             0    0    0  210  180    7
        lobby (recessed) 54   38    7  102   72   18   -> front y=110
        shaft            50   34   25  110   80  180   -> floors 1–20, 9 high, front y=114, side x=160
        setback crown    58   42  205   94   64   36   -> floors 21–24, front y=106, side x=152
        mech floor       64   48  241   82   52   14   -> louvers, roof z=255
        spire           100   68  255    8    8   10 + mast to z=335                            */
    const K = api.iso.frame([[0,180,0],[210,0,7],[210,180,0],[0,0,7],[104,72,340],[50,114,205],[160,34,205]], 0.06);
    const { P, TOP, FRONT, SIDE, box } = K, slits = api.iso.slits;
    const PZ = 7, FH = 9, NF = 24;
    const SH = { x: 50, y: 34, w: 110, d: 80, z: 25 };
    const SB = { x: 58, y: 42, w: 94, d: 64, z: 205 };
    const MC = { x: 64, y: 48, w: 82, d: 52, z: 241, h: 14 };
    const RZ = MC.z + MC.h;

    // deterministic "lived-in" pane variants
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const variant = () => { const r = rnd(); return r < .1 ? ' off' : r < .27 ? ' dim' : r < .4 ? ' hi' : ''; };

    function panes(w, n) {
      const pitch = w / n, pw = pitch - 1.6;
      let s = '';
      for (let i = 0; i < n; i++) s += `<rect class="pn${variant()}" x="${(i * pitch + .8).toFixed(2)}" y="1.6" width="${pw.toFixed(2)}" height="${FH - 3.4}"/>`;
      return s;
    }
    function floor(i) {          // i: 1..24
      const B = i <= 20 ? SH : SB;
      const zTop = i <= 20 ? SH.z + i * FH : SB.z + (i - 20) * FH;
      const fy = B.y + B.d, sx = B.x + B.w;
      const nF = i <= 20 ? 14 : 12, nS = i <= 20 ? 10 : 8;
      const face = (t, w, n) => `<g transform="${t}">
        <rect class="face band" width="${w}" height="${FH}"/>
        <rect class="halo" x="-2" y="-1" width="${w + 4}" height="${FH + 2}" filter="url(#bloom)"/>
        <g class="win">${panes(w, n)}</g>
        <rect class="cur" x="-.6" y="-.6" width="${w + 1.2}" height="${FH + 1.2}"/>
      </g>`;
      return `<g class="fl" data-f="${i}">${face(SIDE(sx, fy, zTop), B.d, nS)}${face(FRONT(B.x, fy, zTop), B.w, nF)}</g>`;
    }

    let svg = '';
    // ---- plate: city block with sidewalk ----
    svg += box(0, 0, 0, 210, 180, PZ, 12);
    svg += `<g transform="${TOP(0, 0, PZ)}">
      <rect class="detail" x="7" y="7" width="196" height="166" rx="8"/>
      <rect class="detail" x="14" y="14" width="182" height="152" rx="4"/>
      ${slits(24, 186, 12, 128, 166)}
      ${slits(26, 118, 12, 168, 196, false)}
      ${[[20, 20], [190, 20], [20, 160], [190, 160]].map(([x, y]) => `<circle class="face recess" cx="${x}" cy="${y}" r="2.6"/><line class="detail" x1="${x - 1.6}" y1="${y}" x2="${x + 1.6}" y2="${y}"/>`).join('')}
    </g>`;
    svg += `<g transform="${FRONT(0, 180, PZ)}"><text class="label" x="16" y="5.2" font-size="4" letter-spacing=".6">240 MERIDIAN · BLOCK 24</text></g>`;
    svg += `<g transform="${SIDE(210, 180, PZ)}">${slits(120, 168, 3, 2, 5)}</g>`;

    // ---- recessed glass lobby ----
    svg += box(54, 38, PZ, 102, 72, 18, 0);
    const lobbyFace = (t, w) => {
      let s = `<g transform="${t}"><g class="lobby-fx"><rect class="lobby-glass" x="2" y="2" width="${w - 4}" height="16"/>`;
      s += `</g>${slits(2 + (w - 4) / 8, w - 2 - (w - 4) / 8 + .01, (w - 4) / 8, 2, 18)}<line class="detail" x1="2" y1="7" x2="${w - 2}" y2="7"/>`;
      return s;
    };
    svg += `<g class="halo lobby-halo" filter="url(#bloom)"><g transform="${FRONT(54, 110, 25)}"><rect width="102" height="18"/></g></g>`;
    svg += lobbyFace(SIDE(156, 110, 25), 72) + `</g>`;
    svg += lobbyFace(FRONT(54, 110, 25), 102) + `<rect class="lobby-door" x="41" y="8" width="20" height="10"/><line class="detail" x1="51" y1="8" x2="51" y2="18"/></g>`;
    // pilotis along the front edge
    [50, 77, 104, 131, 158].forEach(x => { svg += box(x, 112, PZ, 2, 2, 18, 0); });
    [126, 99, 72, 45].forEach(y => { svg += box(158, y, PZ, 2, 2, 18, 0); });

    // ---- shaft + crown ----
    svg += box(SH.x, SH.y, SH.z, SH.w, SH.d, 20 * FH, 2);
    svg += `<g transform="${TOP(SH.x, SH.y, SH.z + 20 * FH)}"><rect class="detail" x="3" y="3" width="${SH.w - 6}" height="${SH.d - 6}" rx="1"/></g>`;
    for (let i = 1; i <= 20; i++) svg += floor(i);
    svg += box(SB.x, SB.y, SB.z, SB.w, SB.d, 4 * FH, 1);
    for (let i = 21; i <= 24; i++) svg += floor(i);
    svg += `<g transform="${TOP(SB.x, SB.y, SB.z + 4 * FH)}"><rect class="detail" x="2.5" y="2.5" width="${SB.w - 5}" height="${SB.d - 5}"/></g>`;
    // mechanical floor with louvers
    svg += box(MC.x, MC.y, MC.z, MC.w, MC.d, MC.h, 1);
    svg += `<g transform="${FRONT(MC.x, MC.y + MC.d, RZ)}">${slits(2.5, 11.5, 1.8, 3, MC.w - 3, false)}</g>`;
    svg += `<g transform="${SIDE(MC.x + MC.w, MC.y + MC.d, RZ)}">${slits(2.5, 11.5, 1.8, 3, MC.d - 3, false)}</g>`;
    svg += `<g transform="${TOP(MC.x, MC.y, RZ)}"><rect class="detail" x="2" y="2" width="${MC.w - 4}" height="${MC.d - 4}"/></g>`;
    // rooftop units + spire
    svg += box(70, 53, RZ, 16, 12, 6, 1) + `<g transform="${TOP(70, 53, RZ + 6)}"><circle class="detail" cx="8" cy="6" r="4"/></g>`;
    svg += box(100, 68, RZ, 8, 8, 10, 1);
    const mt = [104, 72], m = (z) => P(mt[0], mt[1], z).map(n => n.toFixed(2)).join(' ');
    svg += `<path class="mast" d="M${m(RZ + 10)}L${m(334)}"/>`;
    svg += `<path class="mast" d="M${P(101, 72, 290).join(' ')}L${P(107, 72, 290).join(' ')}M${P(104, 69, 305).join(' ')}L${P(104, 75, 305).join(' ')}"/>`;
    const bp = P(104, 72, 336);
    svg += `<circle class="beacon-halo" cx="${bp[0]}" cy="${bp[1]}" r="7" filter="url(#bloom)"/><circle class="beacon" filter="url(#glow)" cx="${bp[0]}" cy="${bp[1]}" r="2.2"/>`;
    svg += box(122, 82, RZ, 18, 12, 7, 1) + `<g transform="${FRONT(122, 94, RZ + 7)}">${slits(3, 15, 2, 1.5, 5.5)}</g>`;

    // ---- canopy over the entrance ----
    svg += box(76, 114, 19, 58, 14, 2, 0);
    svg += `<g transform="${FRONT(76, 128, 21)}"><text class="label" x="18" y="1.7" font-size="1.9" letter-spacing=".4">MERIDIAN</text></g>`;

    // ---- street trees (nearest last) ----
    const trees = [[188, 22], [188, 62], [188, 102], [24, 154], [64, 154], [150, 154], [188, 142]];
    trees.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])).forEach(([x, y]) => {
      svg += box(x - 4, y - 4, PZ, 8, 8, 2, 1);
      const a = P(x, y, PZ + 2), b = P(x, y, PZ + 14), c = P(x, y, PZ + 20);
      svg += `<path class="mast" d="M${a.join(' ')}L${b.join(' ')}"/><circle class="face" cx="${c[0]}" cy="${c[1]}" r="8.5"/><circle class="detail" cx="${c[0] - 1.5}" cy="${c[1] - 1.5}" r="4.5"/>`;
    });

    stage.setAttribute('viewBox', K.viewBox);
    stage.innerHTML = svg;

    // ---- state ----
    const st = { lit: new Array(NF + 1).fill(false), cursor: 1, mode: '' };
    const fl = [null, ...[...stage.querySelectorAll('.fl')].sort((a, b) => a.dataset.f - b.dataset.f)];
    const lobbyHalo = stage.querySelector('.lobby-halo');
    let cascadeTimers = [];
    function render() {
      let n = 0;
      for (let i = 1; i <= NF; i++) {
        fl[i].classList.toggle('on', st.lit[i]);
        fl[i].classList.toggle('cursor', st.cursor === i);
        if (st.lit[i]) n++;
      }
      stage.classList.toggle('lit', n > 0);
      lobbyHalo.classList.toggle('hot', n > 0);
      api.power(n > 0);
      api.readout(`${n}/${NF} floors lit · cursor ${st.cursor}F` + (st.mode ? ` · ${st.mode}` : ''));
    }
    function stopCascade() { cascadeTimers.forEach(clearTimeout); cascadeTimers = []; st.mode = ''; }
    function toggle(i) { st.lit[i] = !st.lit[i]; st.cursor = i; render(); }
    function move(d) { st.cursor = Math.max(1, Math.min(NF, st.cursor + d)); render(); }
    // lights cascade lobby → crown (on) or crown → lobby (off), ~2s end to end
    function cascade(on, upto = NF, step = 80) {
      stopCascade();
      st.mode = on ? 'night shift' : 'lights out';
      const order = [];
      for (let i = 1; i <= upto; i++) order.push(i);
      if (!on) order.reverse();
      order.forEach((f, k) => cascadeTimers.push(api.after(k * step, () => {
        st.lit[f] = on;
        if (k === order.length - 1) st.mode = '';
        render();
      })));
      render();
    }

    stage.addEventListener('click', e => {
      const f = e.target.closest('.fl');
      if (f) toggle(+f.dataset.f);
    });
    render();
    return {
      key(e) {
        if (e.key === 'ArrowUp') { move(1); return true; }
        if (e.key === 'ArrowDown') { move(-1); return true; }
        if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) toggle(st.cursor); return true; }
        if (e.key === 'n' || e.key === 'N') { cascade(true); return true; }
        if (e.key === 'o' || e.key === 'O') { cascade(false); return true; }
        return false;
      },
      unmount() { stopCascade(); },
      demo() {
        cascade(true, 16, 45);
        [1, 2, 3, 4, 5, 6].forEach(k => api.after(200 + k * 60, () => move(3)));
        api.after(850, () => toggle(9));
        api.after(950, () => move(10));
      },
    };
  },
});
