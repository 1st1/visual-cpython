FIGS.push({
  id: 'eth', name: 'ETH blocks', hint: 'Click or Enter to split / assemble',
  aria: 'Isometric Ethereum coin hovering over a lit platform; the whole token breaks into blocks and reassembles. Click or press Enter to split or assemble it.',
  css: `
    [data-fig="eth"] .e-rim { fill:${RW.mix(34)}; }
    [data-fig="eth"] .e-edge { fill:${RW.mix(20)}; }
    [data-fig="eth"] .e-face { fill:url(#eth-faceg); }
    [data-fig="eth"] .e-ring { fill:none; stroke:${RW.mix(30)}; stroke-width:1.2; vector-effect:non-scaling-stroke; }
    [data-fig="eth"] .e-g1 { fill:url(#rw-lit); } [data-fig="eth"] .e-g2 { fill:url(#rw-theme); }
    [data-fig="eth"] .e-gl { fill:url(#rw-theme); opacity:.22; }
    #stage[data-fig="eth"] .cg.rw-side { fill:url(#rw-lit); } #stage[data-fig="eth"] .cg.rw-top { fill:url(#rw-themehi); } #stage[data-fig="eth"] .cg.rw-front { fill:${RW.mix(60)}; }
    #stage[data-fig="eth"] .cf.rw-side { fill:${RW.mix(18)}; } #stage[data-fig="eth"] .cf.rw-top { fill:${RW.mix(42)}; } #stage[data-fig="eth"] .cf.rw-front { fill:${RW.mix(11)}; }
    #stage[data-fig="eth"] .cr.rw-side { fill:${RW.mix(34)}; } #stage[data-fig="eth"] .cr.rw-top { fill:${RW.mix(56)}; } #stage[data-fig="eth"] .cr.rw-front { fill:${RW.mix(22)}; }
    [data-fig="eth"] .grab { cursor:pointer; }
  `,
  mount(stage, api) {
    const X0 = 96, T = 12, YC = 84, ZC = 92, R = 50, VS = 12.5, NCUBE = 21;   // coin face plane x, thickness, centre, radius, cube size
    const DOTS = [[20, 10, 150], [130, -20, 170], [150, 150, 30], [10, 160, 90]];
    const K = api.iso.frame([[X0-50,YC-50,0],[X0+40,YC+50,0],[X0-50,YC+50,0],[X0+40,YC-50,0],[X0,YC+R+34,ZC],[X0,YC-R-40,ZC],[X0,YC,ZC+R+34],[X0+24,YC+20,ZC-R],[X0-24,YC-20,ZC+R], ...DOTS]);
    const { P, SIDE } = K, G = RW.kit(K);
    const f = v => v.toFixed(2);

    // the whole coin as a grid of cubes; each cube is coloured by what it covers (glyph / face / rim)
    // and leaves on a stagger: right edge first, sweeping left; returning in reverse
    const vox = [];
    for (let v0 = 0; v0 < 2 * R; v0 += VS) for (let u0 = 0; u0 < 2 * R; u0 += VS) {
      const nx = Math.max(u0, Math.min(R, u0 + VS)) - R, ny = Math.max(v0, Math.min(R, v0 + VS)) - R;
      if (nx * nx + ny * ny > (R - 1) ** 2) continue;                   // cell doesn't touch the disc
      const cu = u0 + VS / 2, cv = v0 + VS / 2, dist = Math.hypot(cu - R, cv - R);
      const c = Math.abs(cu - R) / 20 + Math.abs(cv - R - 1) / 33 <= 1 ? 'cg' : dist > R - 8 ? 'cr' : 'cf';
      vox.push({ u0, v0, c, x: X0 - VS, y: YC + R - u0 - VS, z: ZC + R - v0 - VS,
        del: .3 * (1 - Math.hypot(cu - R, cv - R) / R) + Math.random() * .12,
        // burst outward along the cell's own direction from the centre, plus depth scatter both ways
        d: (() => { const ru = (cu - R) / R, rv = (cv - R) / R, a = Math.atan2(rv, ru) + (Math.random() - .5) * .7,
                    m = 20 + Math.random() * 18 + Math.hypot(ru, rv) * 12;
                    return [(Math.random() - .5) * 40, -Math.cos(a) * m, -Math.sin(a) * m * .7]; })(), ph: Math.random() * 6 });
    }

    // keep NCUBE cells spread evenly across the disc (golden-ratio stride through the cell list)
    { const all = vox.splice(0), step = all.length / NCUBE;
      const gl = all.filter(c => c.c === 'cg'); for (let j = 0; j < 5 && j < gl.length; j++) vox.push(gl[Math.floor(j * gl.length / 5)]);
      for (let j = 0; vox.length < NCUBE + 5 && j < NCUBE * 2; j++) vox.push(all[Math.floor((j * step * 1.618) % all.length)]);
      const seen = new Set(); for (let j = 0; j < vox.length; j++) { if (seen.has(vox[j])) vox.splice(j--, 1); else seen.add(vox[j]); }
      vox.length = Math.min(vox.length, NCUBE);
      for (const c of all) { if (vox.length >= NCUBE) break; if (!seen.has(c)) { vox.push(c); seen.add(c); } } }

    let svg = RW.defs + `<defs><clipPath id="eth-solid"><rect x="-10" y="-10" width="${2 * R + 20}" height="${2 * R + 20}"/></clipPath>
      <radialGradient id="eth-faceg" cx=".4" cy=".35" r=".75"><stop offset="0" style="stop-color:${RW.mix(26)}"/><stop offset="1" style="stop-color:${RW.mix(9)}"/></radialGradient></defs>`;
    svg += G.ground(X0 - 5, YC, 70, 70);
    svg += G.cyl(X0 - 5, YC, 0, 44, 6) + G.cyl(X0 - 5, YC, 6, 34, 3);
    svg += `<g transform="${K.TOP(0, 0, 9)}"><circle class="rw-line" style="stroke-opacity:.7" cx="${X0 - 5}" cy="${YC}" r="28"/></g>`;
    svg += `<path class="rw-cone" d="${G.cone(X0 - 5, YC, 9, 26, 44, ZC - R - 4)}"/>`;
    svg += `<g id="eth-voxb"></g>`;
    // the solid coin: shows only the cells whose cube is home
    const disc = `<circle cx="${R}" cy="${R}" r="${R}"/>`;
    const gpts = [[R, R - 34], [R + 20, R + 1], [R, R + 34], [R - 20, R + 1]];
    const glyph = `
      <polygon class="e-gl" points="${gpts.map(([x, y]) => `${x + (x - R) * .25},${y + (y - R) * .12}`).join(' ')}"/>
      <polygon class="e-g1" points="${R},${R - 32} ${R - 18},${R + 1} ${R},${R + 10}"/>
      <polygon class="e-g2" points="${R},${R - 32} ${R + 18},${R + 1} ${R},${R + 10}"/>
      <polygon class="e-g1" points="${R},${R + 15} ${R - 18},${R + 6} ${R},${R + 32}"/>
      <polygon class="e-g2" points="${R},${R + 15} ${R + 18},${R + 6} ${R},${R + 32}"/>`;
    svg += `<g id="eth-coin" class="grab">`;
    for (let i = 0; i <= T; i += 2) svg += `<g transform="${SIDE(X0 - T + i, YC + R, ZC + R)}"><g clip-path="url(#eth-solid)">${i < T
      ? `<g class="e-edge">${disc}</g>`
      : `<circle class="e-rim" cx="${R}" cy="${R}" r="${R}"/><circle class="e-face" cx="${R}" cy="${R}" r="${R - 5}"/>
         <circle class="e-ring" cx="${R}" cy="${R}" r="${R - 12}"/>${glyph}`}</g></g>`;
    svg += `</g><g id="eth-voxf"></g><g id="eth-motes"></g>`;
    svg += DOTS.map((p, i) => G.dot(...p, i % 2 ? 1.6 : 2.2, 'eth-dot' + i)).join('');

    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;
    const $ = s => stage.querySelector(s);
    const voxB = $('#eth-voxb'), voxF = $('#eth-voxf'), coin = $('#eth-coin'), dots = DOTS.map((_, i) => $('#eth-dot' + i));
    const tickMotes = G.motes($('#eth-motes'), { cx: X0 - 5, cy: YC - 20, r: 30, z0: 20, h: 140, n: 14 });

    const st = { target: 0, v: 0, block: 18204331, tx: 0, homeN: -1, last: 0 };
    const clipEl = stage.querySelector('#eth-solid');
    function render() {
      api.power(true);
      api.readout(st.target ? 'splitting into blocks…' : st.tx ? `block #${st.block.toLocaleString()} · ${st.tx} tx · mined` : `block #${st.block.toLocaleString()} · assembled`);
    }
    function flip() {
      st.target = st.target ? 0 : 1;
      if (!st.target) { st.block++; st.tx = 80 + (Math.random() * 120 | 0); }
      render();
    }

    const ease = p => p < .5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
    const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    api.loop(t => {
      const dt = st.last ? Math.min(50, t - st.last) : 0; st.last = t;
      st.v = Math.max(0, Math.min(1, st.v + (st.target ? 1 : -1) * dt / 1700));
      const hov = Math.sin(t / 900) * 3;
      const list = vox.map(b => {
        const k = smooth((st.v - b.del) / .5);                     // 0 = home, merged into the round coin
        const fl = k * Math.sin(t / 700 + b.ph) * 3;
        return { ...b, k, X: b.x + b.d[0] * k, Y: b.y + b.d[1] * k, Z: Math.max(14 + 12 * k, b.z + b.d[2] * k) + hov + fl };
      });
      const coinOp = 1 - smooth(st.v / .3);
      coin.style.opacity = coinOp.toFixed(3);
      const away = st.v > .005 ? list.slice().sort((a, b) => (a.X + a.Y) - (b.X + b.Y) || a.Z - b.Z) : [];
      const cube = b => G.box(b.X, b.Y, b.Z, VS, VS, VS, 1.2, b.c);
      voxB.innerHTML = away.filter(b => b.X <= b.x + 3).map(cube).join('');
      voxF.innerHTML = away.filter(b => b.X > b.x + 3).map(cube).join('');
      const e = st.v;
      const d = K.D(0, 0, hov);
      coin.setAttribute('transform', `translate(${f(d[0])} ${f(d[1])})`);
      tickMotes(t, .4 + .6 * e, 1 + e);
      dots.forEach((el, i) => el.setAttribute('transform', `translate(0 ${(Math.sin(t / 900 + i * 1.7) * 4).toFixed(2)})`));
    });

    stage.addEventListener('click', flip);
    const mark = RW.auto(api, stage, 2400, flip);
    render();
    return {
      key: e => { mark(); if (e.key === 'Enter' || e.key === ' ') return flip(), true; return false; },
      demo: () => api.after(500, flip),
    };
  },
});
