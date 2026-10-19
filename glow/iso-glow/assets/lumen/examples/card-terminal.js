FIGS.push({
  id: 'term', name: 'Card terminal', hint: 'Click card · coin · ✕ — or Enter · C · X',
  aria: 'Isometric payment terminal with a card hovering over a glowing slot. Click the card or press Enter to pay, click the coin or press C to drop a coin, press X to clear.',
  css: `
    [data-fig="term"] .t-halo { opacity:.14; transition:opacity .4s; }
    [data-fig="term"] .t-halo.hot { opacity:.3; }
    [data-fig="term"] .t-beam { opacity:.85; transition:opacity .5s; }
    [data-fig="term"] .t-beam.hot { opacity:1; }
    [data-fig="term"] .t-tick { stroke:var(--accent); stroke-opacity:.55; } [data-fig="term"] .t-tick.hot { stroke:var(--accent-hi); stroke-opacity:1; }
    [data-fig="term"] .t-bar { fill:${RW.mix(55)}; }
    [data-fig="term"] .t-bar.new { fill:url(#rw-themehi); }
    [data-fig="term"] .t-area { fill:url(#rw-theme); fill-opacity:.4; stroke:var(--accent-hi); stroke-width:1.2; vector-effect:non-scaling-stroke; }
    [data-fig="term"] .t-strip { fill:url(#rw-themehi); }
    [data-fig="term"] .t-well { fill:url(#rw-well); }
    [data-fig="term"] .t-xface { fill:url(#rw-well); }
    [data-fig="term"] .press.lit .t-xface { fill:url(#rw-themehi); }
    [data-fig="term"] .t-x { fill:none; stroke:${RW.mix(12)}; stroke-width:2.6; stroke-linecap:round; vector-effect:non-scaling-stroke; }
    [data-fig="term"] .t-ctxt { fill:url(#rw-themehi); }
    #stage[data-fig="term"] .rw-dim.rw-front { fill:${RW.mix(4)}; } #stage[data-fig="term"] .rw-dim.rw-side { fill:${RW.mix(2)}; }
    [data-fig="term"] .grab { cursor:pointer; }
  `,
  mount(stage, api) {
    const W = 160, H = 64, CX = 80, CY = 80, R = 46;          // H = rim of the slot ring
    const DOTS = [[-30, 40, 120], [178, 20, 118], [176, 168, 30], [20, 196, 96]];
    const K = api.iso.frame([[0,0,0],[W,0,0],[0,W,0],[W+10,W,0],[20,CY,150],[140,CY,150],[CX-R*1.5*.71,CY-R*1.5*.71,164],[CX-R*1.5*.71,CY+R*1.5*.71,164],[CX+R*1.5*.71,CY-R*1.5*.71,164], ...DOTS]);
    const { P, D, TOP, FRONT, SIDE } = K, G = RW.kit(K);
    const pt = p => p.map(v => v.toFixed(2)).join(',');
    const q = Math.PI / 4;

    let svg = RW.defs + `<defs>
      <clipPath id="term-clip"><polygon points="${[P(-200,CY,H),P(360,CY,H),P(360,CY,400),P(-200,CY,400)].map(pt).join(' ')}"/></clipPath>
    </defs>`;
    svg += G.ground(W/2, W/2, 120, 120);
    // tiers: plinth, recessed groove band, main body (top at z 62)
    svg += G.box(0,0,0, W,W,16, 20);
    svg += G.box(6,6,16, W-12,W-12,6, 16, 'rw-dim');
    svg += G.box(2,2,22, W-4,W-4,40, 18);

    // lit strips on the plinth: solid lime + crisp halo
    const strip = `<rect class="rw-halo t-halo" x="16" y="2.5" width="${W-32}" height="11" rx="5.5"/><rect class="t-strip" x="20" y="6" width="${W-40}" height="4" rx="2"/>`;
    svg += `<g transform="${FRONT(0, W, 16)}">${strip}</g><g transform="${SIDE(W, W, 16)}">${strip}</g>`;

    // sunken top deck inside a raised frame, ticks + light rings on the deck floor
    let deck = `<g transform="${TOP(0,0,57)}">
`;
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2, r0 = R + 10, r1 = R + (i % 4 === 0 ? 16 : 13);
      deck += `<line class="rw-etch t-tick" x1="${CX + r0*Math.cos(a)}" y1="${CY + r0*Math.sin(a)}" x2="${CX + r1*Math.cos(a)}" y2="${CY + r1*Math.sin(a)}"/>`;
    }
    deck += `${[[26,26],[W-26,26],[26,W-26],[W-26,W-26]].map(([x,y]) => `<circle class="rw-pit" cx="${x}" cy="${y}" r="3"/>`).join('')}</g>`;
    const deckShape = (c, tf) => `<rect class="${c}" transform="${tf}" x="16" y="16" width="${W-32}" height="${W-32}" rx="10"/>`;
    svg += G.recess(deckShape, TOP(0,0,62), TOP(0,0,57), 'rw-wall', 'rw-top', deck);
    svg += `<g transform="${TOP(0,0,62)}"><rect class="rw-rim" x="16" y="16" width="${W-32}" height="${W-32}" rx="10"/></g>`;

    const k = R / Math.SQRT2;
    // raised slot ring, then a deep well: lit inner walls, bright floor
    svg += G.cyl(CX, CY, 57, R+7, H-57);
    const wellShape = (c, tf) => `<circle class="${c}" transform="${tf}" cx="${CX}" cy="${CY}" r="${R}"/>`;
    svg += G.recess(wellShape, TOP(0,0,H), TOP(0,0,H-16), 'rw-litwall', 't-well');
    svg += `<g transform="${TOP(0,0,H)}"><circle class="rw-line" cx="${CX}" cy="${CY}" r="${R}"/></g>`;
    // light: an expanding cone — round base on the slot opening, bigger round top, fading upward
    const LH = 100, ZT = H + LH;
    const hull = pts => { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cr = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]); const lo = [], up = [];
      for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); }
      for (const p of pts.slice().reverse()) { while (up.length > 1 && cr(up[up.length-2], up[up.length-1], p) <= 0) up.pop(); up.push(p); }
      return 'M' + lo.slice(0, -1).concat(up.slice(0, -1)).map(p => p.map(v => v.toFixed(2)).join(' ')).join('L') + 'Z'; };
    const cone = (r0, r1) => hull([...G.arc(CX, CY, r0, 0, 2*Math.PI, 48).map(([x, y]) => P(x, y, H)),
                                   ...G.arc(CX, CY, r1, 0, 2*Math.PI, 48).map(([x, y]) => P(x, y, ZT))]);
    svg += `<g id="term-beam" class="t-beam">
      <path class="rw-cone" d="${cone(R, R * 1.5)}"/>
    </g>`;

    svg += `<g id="term-pback"></g>`;
    // card: solid, 3 units thick, casts a faint shadow onto the ring (kept low so it never reads as a smear); coin: thick disc
    const cw = 84, ch = 54, cx0 = CX - cw/2, cz0 = H + 30;   // hole (2R = 92) is wider than the card
    svg += `<g transform="${TOP(0,0,H)}"><ellipse id="term-cast" class="rw-shadow" cx="${CX+4}" cy="${CY+6}" rx="${cw/2+6}" ry="12"/></g>`;
    const cardR = `<rect width="${cw}" height="${ch}" rx="5"/>`;
    const coinC = `<circle cx="0" cy="0" r="10"/>`;
    svg += `<g clip-path="url(#term-clip)">
      <g id="term-cardg" class="grab">
        ${G.ext(i => FRONT(cx0, CY - 3 + i, cz0 + ch), 3, cardR, `
          <rect class="rw-cardf" width="${cw}" height="${ch}" rx="5"/>
          <rect class="rw-hi" x="6" y="7" width="24" height="3" rx="1.5"/>
          <rect class="rw-flat" x="6" y="12" width="14" height="2" rx="1" opacity=".7"/>
          <rect class="rw-flat" x="${cw-21}" y="8" width="14" height="11" rx="2.5"/>
          <path class="rw-etch" style="stroke:${RW.mix(25)}" d="M${cw-21} 13.5h14M${cw-14} 8v11"/>
          <circle class="rw-flat" cx="${cw-12}" cy="${ch-9}" r="4"/>
          <text class="t-ctxt" x="7" y="36" font-size="6.5" letter-spacing=".8">0000 0000 4021</text>`)}
      </g>
      <g id="term-coing" class="grab">
        ${G.ext(i => FRONT(CX + 62, CY - 4 + i, H + 70), 4, coinC,
          `<circle class="rw-halo" r="15"/><circle class="rw-orb" r="10"/><circle class="rw-etch" style="stroke:${RW.mix(55)}" r="6.5"/>`)}
      </g>
    </g>`;

    svg += `<g id="term-pfront"></g>`;

    // front of the body: two screens set into the face
    const scr = x => (c, tf) => `<rect class="${c}" transform="${tf}" x="${x}" y="6" width="64" height="26" rx="4"/>`;
    const F0 = FRONT(2, W-2, 62), F1 = FRONT(2, W-6, 62);
    svg += G.recess(scr(10), F0, F1, 'rw-wall', 'rw-pit', `<g transform="${F1}" id="term-bars"></g>`);
    svg += G.recess(scr(82), F0, F1, 'rw-wall', 'rw-pit', `<g transform="${F1}"><path id="term-area" class="t-area"/></g>`);
    svg += `<g transform="${F0}"><rect class="rw-rim" x="10" y="6" width="64" height="26" rx="4"/><rect class="rw-rim" x="82" y="6" width="64" height="26" rx="4"/></g>`;

    // side of the body: vents, label, protruding X disc
    const XU = 104, XV = 20, disc = `<circle cx="${XU}" cy="${XV}" r="13"/>`;
    svg += `<g transform="${SIDE(W-2, W-2, 62)}">
      ${api.iso.slits(16, 36, 4, 8, 26, true, 'rw-etch')}
      <text class="rw-txt" x="16" y="34" font-size="6" letter-spacing="1">PAY</text>
    </g>
    <g class="press" id="term-x">
      ${G.ext(i => SIDE(W - 2 + i * 1.3, W-2, 62), 5, disc,
        `<circle class="rw-halo t-halo" cx="${XU}" cy="${XV}" r="19"/>
         <circle class="t-xface" cx="${XU}" cy="${XV}" r="13"/>
         <path class="t-x" d="M${XU-4.5} ${XV-4.5} L${XU+4.5} ${XV+4.5} M${XU+4.5} ${XV-4.5} L${XU-4.5} ${XV+4.5}"/>`)}
    </g>`;

    svg += DOTS.map((p, i) => G.dot(...p, i % 2 ? 1.6 : 2.2, 'term-dot' + i)).join('');

    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;
    const $ = s => stage.querySelector(s);
    const halos = [...stage.querySelectorAll('.t-halo')], beam = $('#term-beam'), cast = $('#term-cast');
    const cardg = $('#term-cardg'), coing = $('#term-coing'), bars = $('#term-bars'), area = $('#term-area');
    const xbtn = $('#term-x');
    const ticks = [...stage.querySelectorAll('.t-tick')], dots = DOTS.map((_, i) => $('#term-dot' + i));

    // floating motes rising through the light column
    const PN = 14, parts = [];
    const pback = $('#term-pback'), pfront = $('#term-pfront');
    for (let i = 0; i < PN; i++) {
      const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (R + 2);
      const x = CX + rr * Math.cos(ang), y = CY + rr * Math.sin(ang);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const sz = .7 + Math.random() * 1.1;
      g.innerHTML = `<rect class="rw-dot" x="${-sz}" y="${-sz}" width="${sz * 2}" height="${sz * 2 * (.6 + Math.random() * .4)}" rx=".2"/>`;
      (y > CY ? pfront : pback).appendChild(g);
      parts.push({ g, x, y, off: Math.random(), spd: 3200 + Math.random() * 2600, drift: (Math.random() - .5) * 8, rot: Math.random() * 360, spin: (Math.random() - .5) * 200 });
    }
    const AMTS = [4.5, 12, 24, 8.75, 36.2, 17.4, 6.25];
    const st = { hist: [6, 14, 9, 22, 11, 18, 7, 15], total: 0, n: 0, last: null, glow: 0, anim: null, ai: 0 };

    function drawCharts() {
      const h = st.hist.slice(-8), mx = Math.max(...h, 1);
      bars.innerHTML = h.map((v, i) => {
        const bh = Math.max(1, 18 * v / mx);
        return `<rect class="t-bar${i === h.length-1 && st.last ? ' new' : ''}" x="${17 + i*7}" y="${29 - bh}" width="4" height="${bh}" rx="1"/>`;
      }).join('');
      let acc = 0; const cum = h.map(v => acc += v), cm = acc || 1;
      const pts = cum.map((v, i) => `${88 + i * 52/7},${29 - 18 * v / cm}`);
      area.setAttribute('d', `M88,29 L${pts.join(' L')} L140,29 Z`);
    }
    function render() {
      const on = st.glow > 0 || !!st.anim;
      halos.forEach(el => el.classList.toggle('hot', on));
      beam.classList.toggle('hot', on);
      api.power(on);
      api.readout(st.last ? `approved · $${st.last.toFixed(2)} · total $${st.total.toFixed(2)} · ${st.n} tx` : 'ready · tap card');
    }
    function settle(amt) {
      st.last = amt; st.total += amt; st.n++; st.hist.push(amt);
      st.glow++; api.after(2600, () => { st.glow--; render(); });
      drawCharts(); render();
    }
    function pay() { if (st.anim) return; st.anim = { kind: 'card', t0: performance.now(), done: false, amt: AMTS[st.ai++ % AMTS.length] }; render(); }
    function coin() { if (st.anim) return; st.anim = { kind: 'coin', t0: performance.now(), done: false, amt: 1 }; render(); }
    function clear() {
      api.flash(xbtn);
      st.hist = st.hist.slice(-8).map(() => 0); st.total = 0; st.n = 0; st.last = null; st.glow = 0;
      drawCharts(); render(); api.readout('cleared');
    }

    const ease = p => p < .5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
    const tr = (el, dx, dz) => { const d = D(dx, 0, dz); el.setAttribute('transform', `translate(${d[0].toFixed(2)} ${d[1].toFixed(2)})`); };
    api.loop(t => {
      let cardZ = Math.sin(t / 700) * 3, coinX = 0, coinZ = Math.sin(t / 520 + 1) * 4, coinO = 1;
      const a = st.anim;
      if (a) {
        const p = Math.min(1, (t - a.t0) / (a.kind === 'card' ? 1900 : 1300));
        if (a.kind === 'card') {
          if (p < .35) cardZ = -(ch + 30) * ease(p / .35);
          else if (p < .55) cardZ = -(ch + 30);
          else cardZ = -(ch + 30) * (1 - ease((p - .55) / .45));
        } else {
          const q = Math.min(1, p / .55);
          coinX = -62 * ease(q); coinZ = 4 - 86 * q * q;
          if (p > .7) { coinX = 0; coinZ = 0; coinO = (p - .7) / .3; }
        }
        if (!a.done && p >= (a.kind === 'card' ? .35 : .5)) { a.done = true; settle(a.amt); }
        if (p >= 1) { st.anim = null; render(); }
      }
      tr(cardg, 0, cardZ); cast.style.opacity = (.3 * Math.max(0, Math.min(1, (cardZ + 24) / 24))).toFixed(2); tr(coing, coinX, coinZ); coing.style.opacity = coinO;
      const boost = (st.anim || st.glow > 0) ? 1.8 : 1;
      parts.forEach(p => {
        const u = ((t * boost / p.spd) + p.off) % 1, z = H - 6 + u * 100;
        const [px, py] = P(p.x + Math.sin(u * 6 + p.off * 9) * p.drift * .3, p.y, z);
        p.g.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${(p.rot + u * p.spin).toFixed(1)})`);
        p.g.style.opacity = (Math.min(1, u * 6) * (1 - u)).toFixed(2);
      });
      dots.forEach((el, i) => { el.setAttribute('transform', `translate(0 ${(Math.sin(t / 900 + i * 1.7) * 4).toFixed(2)})`); });
      const lit = st.anim || st.glow > 0, head = Math.floor(t / 30) % 48;
      ticks.forEach((el, i) => el.classList.toggle('hot', !!lit && ((head - i + 48) % 48) < 14));
    });

    cardg.addEventListener('click', pay);
    coing.addEventListener('click', coin);
    xbtn.addEventListener('click', clear);
    drawCharts(); render();
    let ak = 0; const mark = RW.auto(api, stage, 3200, () => (ak++ % 2 ? coin() : pay()));
    return {
      key: e => {
        mark();
        if (e.key === 'Enter' || e.key === ' ') return pay(), true;
        if (e.key === 'c' || e.key === 'C') return coin(), true;
        if (e.key === 'x' || e.key === 'X' || e.key === 'Escape') return clear(), true;
        return false;
      },
      demo: () => api.after(300, pay),
    };
  },
});
