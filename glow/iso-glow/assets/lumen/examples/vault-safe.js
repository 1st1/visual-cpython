FIGS.push({
  id: 'vault', name: 'Vault safe', hint: 'Click the door or Enter · C deposit · ←→ dial',
  aria: 'Isometric vault safe with a round door and a dial. Press Enter or click the door to spin the dial and swing it open, press C to deposit a coin, arrow keys turn the dial.',
  css: `
    [data-fig="vault"] .v-edge { fill:${RW.mix(13)}; }
    [data-fig="vault"] .v-face { fill:url(#rw-top); }
    [data-fig="vault"] .v-ring { fill:none; stroke:${RW.mix(42)}; stroke-width:1.2; vector-effect:non-scaling-stroke; }
    [data-fig="vault"] .v-dial { fill:${RW.mix(30)}; transition:fill .3s; }
    [data-fig="vault"] .v-dial.hot { fill:url(#rw-orb); }
    [data-fig="vault"] .v-spoke { fill:none; stroke:${RW.mix(60)}; stroke-width:2.6; stroke-linecap:round; vector-effect:non-scaling-stroke; }
    [data-fig="vault"] .v-back { fill:url(#rw-well); }
    [data-fig="vault"] .v-spill { fill:url(#vault-spillg); }
    [data-fig="vault"] .v-led { fill:${RW.mix(28)}; } [data-fig="vault"] .v-led.hot { fill:url(#rw-themehi); }
    [data-fig="vault"] .v-strip { fill:url(#rw-themehi); }
    [data-fig="vault"] .grab { cursor:pointer; }
  `,
  mount(stage, api) {
    const W = 140, DP = 120, H = 130;                          // body width, depth, height
    const HX = 26, DZ = 115, DR = 42, DCU = 44, DCV = 50;      // hinge x, door top z, door radius, door centre (door-local)
    const OX = HX + DCU, OZ = DZ - DCV, OR = DR - 3;           // opening centre x / z and radius
    const DOTS = [[-34, 20, 150], [176, 10, 128], [170, 150, 30], [-14, 196, 96]];
    const K = api.iso.frame([[-4,-4,0],[W+4,-4,0],[-4,DP+84,0],[W+4,DP+4,0],[0,0,H],[W,0,H],[HX,DP+90,DZ],[HX-6,DP+88,0], ...DOTS]);
    const { P, TOP, FRONT, SIDE, plane } = K, G = RW.kit(K);
    const deg = Math.PI / 180;

    let svg = RW.defs + `<defs><linearGradient id="vault-spillg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--accent);stop-opacity:.45"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>`;
    svg += G.ground(W/2, DP/2 + 10, 115, 100);
    // light spilling out of the open door onto the ground
    svg += `<g transform="${TOP(0,0,0)}"><path id="vault-spill" class="v-spill" style="opacity:0" d="M${OX-34} ${DP+4} L${OX+34} ${DP+4} L${OX+48} ${DP+52} L${OX-48} ${DP+52} Z"/></g>`;
    // plinth + body
    svg += G.box(-4,-4,0, W+8,DP+8,10, 18);
    svg += G.box(0,0,10, W,DP,H-10, 14);
    const strip = w => `<rect class="v-strip" x="14" y="4" width="${w - 28}" height="3" rx="1.5"/>`;
    svg += `<g transform="${FRONT(-4, DP+4, 10)}">${strip(W+8)}</g><g transform="${SIDE(W+4, DP+4, 10)}">${strip(DP+8)}</g>`;
    // top: inset lid line + bolts
    svg += `<g transform="${TOP(0,0,H)}"><rect class="rw-etch" x="10" y="10" width="${W-20}" height="${DP-20}" rx="10"/>
      ${[[18,18],[W-18,18],[18,DP-18],[W-18,DP-18]].map(([x,y]) => `<circle class="rw-pit" cx="${x}" cy="${y}" r="3"/>`).join('')}</g>`;
    // side: keypad + label + vents
    let pad = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) pad += `<rect class="rw-pit" x="${22 + c*12}" y="${30 + r*10}" width="9" height="7" rx="1.5"/>`;
    svg += `<g transform="${SIDE(W, DP, H)}">${pad}
      <rect id="vault-led" class="v-led" x="22" y="18" width="33" height="4" rx="2"/>
      <text class="rw-txt" x="22" y="74" font-size="6" letter-spacing="1">VAULT·07</text>
      ${api.iso.slits(76, 100, 4, 24, 60, true, 'rw-etch')}</g>`;
    // opening in the front face: lit tunnel walls, glowing back, coin stacks inside
    const hole = (c, tf) => `<circle class="${c}" transform="${tf}" cx="${OX}" cy="${H - OZ}" r="${OR}"/>`;
    svg += G.recess(hole, FRONT(0, DP, H), FRONT(0, DP - 46, H), 'rw-litwall', 'v-back', `<g id="vault-in"></g>`);
    svg += `<g transform="${FRONT(0, DP, H)}"><circle class="rw-line" style="stroke-opacity:.85" cx="${OX}" cy="${H - OZ}" r="${OR + 4}"/></g>`;
    // hinges
    svg += G.cyl(HX - 2, DP + 3, OZ + 14, 4, 16) + G.cyl(HX - 2, DP + 3, OZ - 30, 4, 16);
    // door: stacked layers on a plane that swings about the hinge (transforms set per frame)
    svg += `<g id="vault-door" class="grab">`;
    svg += `<g data-l="0"><circle class="v-face" cx="${DCU}" cy="${DCV}" r="${DR}"/><circle class="v-ring" cx="${DCU}" cy="${DCV}" r="${DR - 8}"/></g>`;
    for (let i = 1; i < 7; i++) svg += `<g class="v-edge" data-l="${i}"><circle cx="${DCU}" cy="${DCV}" r="${DR}"/></g>`;
    svg += `<g data-l="7">
        <circle class="v-face" cx="${DCU}" cy="${DCV}" r="${DR}"/>
        <circle class="v-ring" cx="${DCU}" cy="${DCV}" r="${DR - 5}"/>
        ${Array.from({ length: 10 }, (_, i) => { const a = i * 36 * deg; return `<circle class="rw-pit" cx="${DCU + (DR - 10) * Math.cos(a)}" cy="${DCV + (DR - 10) * Math.sin(a)}" r="2.2"/>`; }).join('')}
        <circle id="vault-dial" class="v-dial" cx="${DCU}" cy="${DCV}" r="15"/>
        <circle class="v-ring" cx="${DCU}" cy="${DCV}" r="11"/>
        <g id="vault-spokes">${[0, 120, 240].map(a => `<line class="v-spoke" x1="${DCU}" y1="${DCV}" x2="${DCU + 22 * Math.cos(a * deg)}" y2="${DCV + 22 * Math.sin(a * deg)}"/>`).join('')}
          <circle class="rw-hi" cx="${DCU}" cy="${DCV}" r="4"/></g>
      </g></g>`;
    // beam of light blasting out of the open door, fading as it travels
    const B0 = [OX, DP + 4, OZ], B1 = [OX + 4, DP + 92, OZ - 26], b0 = P(...B0), b1 = P(...B1);
    svg += `<defs><linearGradient id="vault-beamg" gradientUnits="userSpaceOnUse" x1="${b0[0].toFixed(1)}" y1="${b0[1].toFixed(1)}" x2="${b1[0].toFixed(1)}" y2="${b1[1].toFixed(1)}">
      <stop offset="0" style="stop-color:var(--accent);stop-opacity:.5"/><stop offset=".6" style="stop-color:var(--accent);stop-opacity:.14"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
      <path id="vault-beam" class="rw-beam" style="fill:url(#vault-beamg);opacity:0" d="${G.coneAx(B0, B1, OR - 6, OR + 22)}"/>`;
    svg += `<g id="vault-motes"></g>`;
    svg += DOTS.map((p, i) => G.dot(...p, i % 2 ? 1.6 : 2.2, 'vault-dot' + i)).join('');

    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;
    const $ = s => stage.querySelector(s);
    const door = $('#vault-door'), layers = [...door.querySelectorAll('[data-l]')], spokes = $('#vault-spokes');
    const beamEl = $('#vault-beam'), dial = $('#vault-dial'), led = $('#vault-led'), spill = $('#vault-spill'), inner = $('#vault-in');
    const dots = DOTS.map((_, i) => $('#vault-dot' + i));
    const tickMotes = G.motes($('#vault-motes'), { cx: OX, cy: DP + 8, r: 26, z0: OZ - 30, h: 120, n: 14 });

    const st = { open: false, th: 0, dial: 0, anim: null, coins: 14, boost: 0 };
    const STACKS = [[52, DP - 30], [88, DP - 30], [62, DP - 16], [80, DP - 16], [70, DP - 4]];
    function drawInside() {
      let s = '', left = st.coins;
      const per = STACKS.map((_, i) => { const n = Math.min(7, Math.ceil(left / (STACKS.length - i))); left -= n; return n; });
      STACKS.forEach(([x, y], i) => {
        const z0 = OZ - Math.sqrt(Math.max(0, OR * OR - (x - OX) ** 2)) + 2;
        for (let c = 0; c < per[i]; c++) s += G.cyl(x, y, z0 + c * 3.2, 8, 2.8, 'rw-litcyl', 'rw-hi');
      });
      inner.innerHTML = s;
    }
    let flip = false;
    function setDoor(th) {
      const c = Math.cos(th * deg), s = Math.sin(th * deg);
      // past 45° the outer face turns away: paint layers front-to-back so the plain back face ends on top
      if ((c - s < 0) !== flip) { flip = !flip; (flip ? layers.slice().reverse() : layers).forEach(g => door.appendChild(g)); }
      layers.forEach(g => { const i = +g.dataset.l * 1.6;
        g.setAttribute('transform', plane([HX - s * i, DP + c * i, DZ], [c, s, 0], [0, 0, -1])); });
    }
    function render() {
      dial.classList.toggle('hot', st.open || !!st.anim); led.classList.toggle('hot', st.open);
      api.power(st.open);
      const total = st.coins * 50 + 540;
      api.readout(st.open ? `open · ${st.coins} coins · $${total.toLocaleString()}` : `locked · dial ${String(((st.dial % 360) + 360) % 360 / 9 | 0).padStart(2, '0')}`);
    }
    function toggle() {
      if (st.anim) return;
      st.anim = { kind: st.open ? 'close' : 'open', t0: performance.now(), d0: st.dial };
      render();
    }
    function deposit() {
      if (!st.open) { api.readout('locked · open the door to deposit'); return; }
      if (st.coins >= 30) { api.readout('vault full'); return; }
      st.coins++; st.boost = performance.now(); drawInside(); api.flash(led); render();
    }
    function turn(d) { if (st.anim || st.open) return; st.dial += d; spokes.setAttribute('transform', `rotate(${st.dial} ${DCU} ${DCV})`); render(); }

    const ease = p => p < .5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
    api.loop(t => {
      const a = st.anim;
      if (a) {
        const e = t - a.t0;
        if (a.kind === 'open') {
          st.dial = a.d0 + 540 * ease(Math.min(1, e / 700));
          st.th = 105 * ease(Math.max(0, Math.min(1, (e - 700) / 900)));
          if (e > 700 && !st.open) { st.open = true; render(); }
          if (e >= 1600) { st.anim = null; render(); }
        } else {
          st.th = 105 * (1 - ease(Math.min(1, e / 800)));
          st.dial = a.d0 - 180 * ease(Math.max(0, Math.min(1, (e - 800) / 400)));
          if (e > 800 && st.open) { st.open = false; render(); }
          if (e >= 1200) { st.anim = null; render(); }
        }
        spokes.setAttribute('transform', `rotate(${st.dial.toFixed(1)} ${DCU} ${DCV})`);
      }
      setDoor(st.th);
      const lv = st.th / 105;
      spill.style.opacity = lv.toFixed(2); beamEl.style.opacity = lv.toFixed(2);
      tickMotes(t, lv, t - st.boost < 1200 ? 2.2 : 1);
      dots.forEach((el, i) => el.setAttribute('transform', `translate(0 ${(Math.sin(t / 900 + i * 1.7) * 4).toFixed(2)})`));
    });

    door.addEventListener('click', toggle);
    stage.addEventListener('click', e => { if (st.open && e.target.closest('#vault-in, .v-back, .rw-litwall')) deposit(); });
    drawInside(); setDoor(0); render();
    let ak = 0; const mark = RW.auto(api, stage, 2400, () => { if (st.anim) return; if (!st.open) { ak = 0; toggle(); } else if (ak++ < 2) deposit(); else toggle(); });
    return {
      key: e => {
        mark();
        if (e.key === 'Enter' || e.key === ' ') return toggle(), true;
        if (e.key === 'c' || e.key === 'C') return deposit(), true;
        if (e.key === 'ArrowLeft') return turn(-18), true;
        if (e.key === 'ArrowRight') return turn(18), true;
        return false;
      },
      demo: () => { api.after(300, toggle); api.after(2100, deposit); api.after(2600, deposit); },
    };
  },
});
