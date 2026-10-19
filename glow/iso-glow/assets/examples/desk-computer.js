/* Fig 1 — Desk computer: type on it, click it to switch. */
FIGS.push({
  id: 'computer',
  name: 'Desk computer',
  hint: 'Type on it · click it to switch',
  aria: 'Isometric desk computer with keyboard. Type on your keyboard or click its keys to write on the screen; click the computer to switch it on or off.',
  css: `
    [data-fig="computer"] #cpu { cursor:pointer; }
    [data-fig="computer"] #cpu:hover .face.top { stroke:var(--ink); }
    [data-fig="computer"] .crt { opacity:0; transition:opacity .3s; }
    [data-fig="computer"].on .crt { opacity:1; }
    [data-fig="computer"] .logo { fill:var(--accent); }
  `,
  mount(stage, api) {
    /*  boxes            x    y    z    w    d    h
        plate            0    0    0  300  268    7
        plinth         112   22    7  132  140    6
        case           108   18   13  140  148  187   -> front y=166, top z=200
        keyboard        18  186    7  194   70   12   -> deck z=19
        keys          grid on the deck, h 4                                   */
    const K = api.iso.frame([[0,268,0],[300,0,7],[300,268,0],[108,18,200],[248,18,200],[108,166,200],[280,190,10]]);
    const { P, TOP, FRONT, SIDE, box, path } = K, slits = api.iso.slits;
    const PLZ = 7, CX = 108, CY = 18, CW = 140, CD = 148, CZ = 13, CH = 187, CT = CZ + CH, CF = CY + CD;
    const KX = 18, KY = 186, KW = 194, KD = 70, KZ = 7, KH = 12, KT = KZ + KH;

    let svg = `<defs><clipPath id="computer-glass"><rect x="22" y="22" width="96" height="86" rx="12"/></clipPath></defs>`;
    svg += box(0,0,0, 300,268,PLZ, 14);
    svg += `<g transform="${TOP(0,0,PLZ)}">
      <rect class="detail" x="9" y="9" width="282" height="250" rx="10"/>
      ${[[18,18],[282,18],[18,250],[282,250]].map(([x,y]) => `<circle class="face recess" cx="${x}" cy="${y}" r="3"/><line class="detail" x1="${x-1.8}" y1="${y}" x2="${x+1.8}" y2="${y}"/>`).join('')}
      <rect class="face recess" x="22" y="236" width="56" height="5" rx="2.5"/>
    </g>`;

    svg += `<g id="cpu">`;
    svg += box(CX+4, CY+4, PLZ, CW-8, CD-8, CZ-PLZ, 3);
    svg += box(CX, CY, CZ, CW, CD, CH, 10);
    svg += `<g transform="${TOP(CX,CY,CT)}"><rect class="face recess" x="30" y="14" width="80" height="12" rx="6"/>${slits(36, 58, 3.2, 40, 104, false)}</g>`;
    svg += `<g transform="${FRONT(CX,CF,CT)}">
      <rect class="face" x="10" y="12" width="120" height="108" rx="11"/>
      <rect class="face recess" x="15" y="17" width="110" height="98" rx="12"/>
      <rect class="halo" x="22" y="22" width="96" height="86" rx="12" filter="url(#bloom)"/>
      <rect class="face glass" filter="url(#soft)" x="22" y="22" width="96" height="86" rx="12"/>
      <g class="crt" clip-path="url(#computer-glass)"><g filter="url(#soft)">
        <g class="logo" transform="translate(70 51)"><path d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z"/></g>
        <text class="scr" id="computer-term" x="30" y="94" font-size="6">&gt; </text>
        <rect id="computer-cur" class="scr-accent blink" x="38" y="89" width="3.4" height="6"/>
      </g></g>
      ${slits(14, 38, 2.6, 128, 146)}
      <circle class="led" filter="url(#soft)" cx="15" cy="156" r="1.4"/>
      <rect class="face recess" x="72" y="148" width="54" height="5" rx="2.5"/>
    </g>`;
    svg += `<g transform="${SIDE(CX+CW,CF,CT)}">${slits(96, 136, 3.4, 12, 70)}${slits(40, 64, 3.4, 130, 168)}<rect class="face recess" x="8" y="148" width="16" height="26" rx="2"/></g>`;
    svg += `</g>`;

    svg += box(KX,KY,KZ, KW,KD,KH, 6);
    svg += `<g transform="${TOP(KX,KY,KT)}"><rect class="face recess" x="6" y="5" width="${KW-12}" height="${KD-10}" rx="3"/></g>`;
    const ROWS = [
      [['`',1],['1',1],['2',1],['3',1],['4',1],['5',1],['6',1],['7',1],['8',1],['9',1],['0',1],['-',1],['=',1],['Backspace',1]],
      [['Tab',1.5],['q',1],['w',1],['e',1],['r',1],['t',1],['y',1],['u',1],['i',1],['o',1],['p',1],['[',1],[']',1.5]],
      [['CapsLock',1.75],['a',1],['s',1],['d',1],['f',1],['g',1],['h',1],['j',1],['k',1],['l',1],[';',1],["'",1],['Enter',1.25]],
      [['Shift',2.25],['z',1],['x',1],['c',1],['v',1],['b',1],['n',1],['m',1],[',',1],['.',1],['/',1],['ShiftRight',1.75]],
      [['Control',1.25],['Alt',1.25],['Meta',1.25],[' ',7],['MetaRight',1.25],['AltRight',1],['ControlRight',1]],
    ];
    const AX = KX + 9, AY = KY + 7, U = (KW - 18) / 14, RD = (KD - 14) / ROWS.length, G = 1.3;
    ROWS.forEach((row, r) => { let x = AX; row.forEach(([k, w]) => {
      svg += `<g class="press key" data-key="${k.replace(/"/g,'&quot;')}">${box(x + G/2, AY + r*RD + G/2, KT, w*U - G, RD - G, 4, 1.5)}</g>`;
      x += w * U; }); });

    // coiled cable: keyboard right face -> computer side port
    const plugK = [KX+KW, 226, 9], plugC = [CX+CW, CF-16, CT-161];
    const P0 = [plugK[0]+6, plugK[1]+4, plugK[2]+4], P1 = [P0[0]+34, P0[1]+6, 8], P2 = [plugC[0]+30, plugC[1]+30, 8], P3 = [plugC[0]+6, plugC[1]+4, plugC[2]+5];
    const bez = t => P0.map((_, i) => (1-t)**3*P0[i] + 3*(1-t)**2*t*P1[i] + 3*(1-t)*t**2*P2[i] + t**3*P3[i]);
    const pts = [];
    for (let i = 0; i <= 900; i++) {
      const t = i / 900, p = bez(t), a = bez(Math.max(0, t - 1e-3)), b = bez(Math.min(1, t + 1e-3));
      let T = b.map((v, j) => v - a[j]); const tl = Math.hypot(...T); T = T.map(v => v / tl);
      let N1 = [T[1], -T[0], 0]; const nl = Math.hypot(...N1) || 1; N1 = N1.map(v => v / nl);
      const N2 = [T[1]*N1[2]-T[2]*N1[1], T[2]*N1[0]-T[0]*N1[2], T[0]*N1[1]-T[1]*N1[0]];
      const env = Math.min(1, Math.max(0, (t - .08) / .06)) * Math.min(1, Math.max(0, (.9 - t) / .06));
      const ang = t * 34 * 2 * Math.PI;
      pts.push(p.map((v, j) => v + env * 2.6 * (Math.cos(ang) * N1[j] + Math.sin(ang) * N2[j])));
    }
    const d = path(pts);
    svg += box(plugK[0], plugK[1], plugK[2], 6, 8, 8, 1.5);
    svg += box(plugC[0], plugC[1], plugC[2], 6, 8, 10, 1.5);
    svg += `<path class="wire-under" d="${d}"/><path class="wire" filter="url(#soft)" d="${d}"/><path class="pulse" filter="url(#glow)" pathLength="1000" d="${d}"/>`;

    stage.setAttribute('viewBox', K.viewBox);
    stage.innerHTML = svg;

    const st = { on: true, text: '', key: null };
    const q = s => stage.querySelector(s);
    const keys = new Map([...stage.querySelectorAll('.key')].map(k => [k.dataset.key, k]));
    const TAIL = 15, CW6 = 6 * 0.6;
    function render() {
      stage.classList.toggle('on', st.on);
      api.power(st.on);
      q('.glass').classList.toggle('hot', st.on); q('.halo').classList.toggle('hot', st.on);
      q('.led').classList.toggle('hot', st.on);
      stage.querySelectorAll('.wire').forEach(w => w.classList.toggle('hot', st.on));
      const vis = st.text.slice(-TAIL);
      q('#computer-term').textContent = '> ' + vis;
      q('#computer-cur').setAttribute('x', 30 + (2 + vis.length) * CW6 + .4);
      const parts = [st.on ? 'on' : 'off'];
      if (st.on || st.text) parts.push(`${st.text.length} chars`);
      if (st.key) parts.push(`key ${st.key}`);
      api.readout(parts.join(' · '));
    }
    const BASE = { '!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7','*':'8','(':'9',')':'0','_':'-','+':'=','{':'[','}':']',':':';','"':"'",'<':',','>':'.','?':'/','~':'`' };
    function press(k, code = '') {
      let id = k.length === 1 ? (BASE[k] || k.toLowerCase()) : k;
      if (/Right$/.test(code)) id = code.replace(/Left|Right/, '') + 'Right';
      const el = keys.get(id); if (!el) return false;
      api.flash(el);
      if (st.on) api.replay(q('.pulse'));
      st.key = k === ' ' ? 'space' : k.length === 1 ? k : id.replace('Right','').toLowerCase();
      if (st.on) {
        if (k === 'Backspace') st.text = st.text.slice(0, -1);
        else if (k === 'Enter') st.text = '';
        else if (k.length === 1) st.text += k;
      }
      render(); return true;
    }
    stage.addEventListener('click', e => {
      const k = e.target.closest('.key');
      if (k) { const id = k.dataset.key; press(id.replace('Right', ''), /Right$/.test(id) ? id : ''); return; }
      if (e.target.closest('#cpu')) { st.on = !st.on; render(); }
    });
    render();
    return {
      key: e => press(e.key, e.code),
      demo: () => { 'hello claude'.split('').forEach((c, i) => api.after(i * 40, () => press(c))); },
    };
  },
});
