/* Lumen gradient picker: one gradient chip in the header opens a Figma-style editor —
   presets, a gradient bar with two draggable stops (colour, hex, position %), an angle dial,
   reverse and rotate. Drives --accent / --accent2 and the shared #rw-theme / #rw-themehi
   gradients (angle + stop offsets) in whichever figure is mounted. Remembered per viewer. */
(() => {
  // Lumen is dark-only: lock the theme, whatever the system or a theme toggle says
  const lockDark = () => { if (document.documentElement.dataset.theme !== 'dark') document.documentElement.dataset.theme = 'dark'; };
  lockDark(); new MutationObserver(lockDark).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const KEY = 'iso-glow-lumen-grad';
  const PRESETS = [   // curated: neighbouring hues, both ends bright enough to glow on dark faces (no grey middle)
    ['Aurora', '#b8f53d', '#2ee6d6'], ['Sunset', '#ff8a3d', '#ff4fa3'], ['Ocean', '#38e1ff', '#6c7bff'], ['Nebula', '#c084fc', '#f472b6'],
    ['Solar', '#ffd23f', '#ff4d5e'], ['Mint', '#5cffb0', '#38bdf8'], ['Ultraviolet', '#8b7bff', '#22d3ee'], ['Rose gold', '#ffb38a', '#ff6fa8'],
  ];
  const DEF = { stops: [{ c: '#b8f53d', p: 0 }, { c: '#2ee6d6', p: 100 }], angle: 135 };
  const hexOk = s => /^#[0-9a-f]{6}$/i.test(s);
  // body tint: orange/gold/yellow turn muddy brown when darkened, so tint bodies with the other stop;
  // if both are warm, use the redder one
  const hue = h => { const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1;
    const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
  const muddy = h => { const x = hue(h); return x >= 18 && x <= 70; };
  const tintOf = (a, b) => !muddy(a) ? a : !muddy(b) ? b : (hue(a) < hue(b) ? a : b);
  const css = g => `linear-gradient(${g.angle}deg, ${g.stops[0].c} ${g.stops[0].p}%, ${g.stops[1].c} ${g.stops[1].p}%)`;

  const init = () => {
    const sw = document.getElementById('swatches');
    if (!sw || sw.dataset.lumen) return;
    sw.dataset.lumen = '1';
    const root = document.documentElement, holder = document.getElementById('stageHolder');
    let g; try { g = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { g = null; }
    if (!g || !g.stops || g.stops.length !== 2 || !g.stops.every(s => hexOk(s.c))) g = JSON.parse(JSON.stringify(DEF));
    let sel = 0;

    const style = document.createElement('style');
    style.textContent = `
      #swatches > button[data-accent] { display:none; }
      #swatches { flex-wrap:wrap !important; height:auto !important; max-width:100%; row-gap:6px; border-radius:16px; overflow:visible !important; }
      .dh-theme { display:none !important; }
      #swatches .lg-pre i { width:14px; height:14px; }
      #swatches .lg-pre[aria-checked="true"] i { box-shadow:0 0 0 2px var(--panel), 0 0 0 3px var(--ink-hi); }
      #swatches .lg-chip { width:auto; display:flex; place-items:normal; align-items:center; gap:7px; height:26px; padding:0 10px 0 3px; margin-left:4px; border:1px solid var(--edge); border-radius:999px;
        background:none; color:var(--ink-hi); font:inherit; font-size:11px; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; }
      #swatches .lg-chip:hover, #swatches .lg-chip[aria-expanded="true"] { border-color:var(--line); }
      #swatches .lg-chip[aria-checked="true"] { border-color:var(--ink-hi); }
      #swatches .lg-chip i { width:18px; height:18px; border-radius:50%; border:1px solid var(--line); box-shadow:none; transform:none; flex:none; }
      .lg-pop { position:fixed; z-index:50; width:272px; padding:14px; border:1px solid var(--edge); border-radius:14px; background:var(--panel);
        box-shadow:0 18px 50px rgba(0,0,0,.45); display:grid; gap:12px; font-family:var(--mono); font-size:11px; color:var(--ink); text-transform:none; letter-spacing:.02em; }
      .lg-pop[hidden] { display:none; }
      .lg-h { display:flex; justify-content:space-between; align-items:center; color:var(--ink-hi); text-transform:uppercase; letter-spacing:.14em; }
      .lg-h small { color:var(--ink); letter-spacing:.06em; text-transform:none; }
      .lg-presets { display:grid; grid-template-columns:repeat(8, 1fr); gap:6px; }
      .lg-presets button { aspect-ratio:1; border-radius:7px; border:1px solid var(--edge); cursor:pointer; padding:0; }
      .lg-presets button:hover { outline:1px solid var(--line); outline-offset:1px; }
      .lg-bar { position:relative; height:26px; border-radius:7px; border:1px solid var(--edge); margin:6px 7px 4px; cursor:copy; }
      .lg-stop { position:absolute; top:50%; width:16px; height:16px; margin:-8px 0 0 -8px; border-radius:5px; border:2px solid #fff;
        box-shadow:0 0 0 1px rgba(0,0,0,.6), 0 2px 6px rgba(0,0,0,.4); cursor:grab; touch-action:none; }
      .lg-stop.on { outline:2px solid var(--ink-hi); outline-offset:2px; }
      .lg-row { display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; }
      .lg-sw { position:relative; width:28px; height:28px; border-radius:7px; border:1px solid var(--edge); overflow:hidden; }
      .lg-sw input { position:absolute; inset:-6px; width:40px; height:40px; border:0; padding:0; cursor:pointer; }
      .lg-pop input[type="text"], .lg-pop input[type="number"] { width:100%; height:28px; box-sizing:border-box; padding:0 8px; border:1px solid var(--edge); border-radius:7px;
        background:var(--bg); color:var(--ink-hi); font:inherit; }
      .lg-pop input[type="number"] { width:64px; }
      .lg-pop input:focus { outline:1px solid var(--line); }
      .lg-ang { display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:center; }
      .lg-dial { position:relative; width:52px; height:52px; border-radius:50%; border:1px solid var(--line); cursor:grab; touch-action:none; background:var(--bg); }
      .lg-dial b { position:absolute; left:50%; top:50%; width:2px; height:22px; margin-left:-1px; transform-origin:50% 0; background:var(--ink-hi); border-radius:1px; }
      .lg-dial b::after { content:''; position:absolute; left:-3px; bottom:-4px; width:8px; height:8px; border-radius:50%; background:var(--ink-hi); }
      .lg-tools { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .lg-tools button { height:28px; padding:0 9px; border:1px solid var(--edge); border-radius:7px; background:none; color:var(--ink-hi); font:inherit; cursor:pointer; }
      .lg-tools button:hover { border-color:var(--line); }
      .lg-lbl { color:var(--ink); }`;
    document.head.appendChild(style);

    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'lg-chip'; chip.setAttribute('aria-haspopup', 'dialog'); chip.setAttribute('aria-expanded', 'false');
    chip.innerHTML = '<i></i>Custom'; chip.title = 'Edit gradient: stops, angle, colours';
    // the presets live in the row itself, always visible; the chip opens the full editor
    const pres = PRESETS.map(([n, a, b], i) => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'lg-pre'; el.title = n; el.setAttribute('role', 'radio'); el.setAttribute('aria-label', `${n} gradient`);
      el.innerHTML = `<i style="background:linear-gradient(135deg, ${a}, ${b})"></i>`;
      el.addEventListener('click', () => { g.stops = [{ c: a, p: 0 }, { c: b, p: 100 }]; apply(); });
      sw.appendChild(el); return el;
    });
    sw.appendChild(chip);
    const pop = document.createElement('div');
    pop.className = 'lg-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Gradient');
    pop.innerHTML = `
      <div class="lg-h">Custom gradient <small>linear</small></div>
      <div class="lg-bar" title="Drag a stop to move it"><div class="lg-stop" data-s="0" tabindex="0" aria-label="Start colour stop"></div><div class="lg-stop" data-s="1" tabindex="0" aria-label="End colour stop"></div></div>
      <div class="lg-row"><label class="lg-sw" title="Stop colour"><input type="color" aria-label="Stop colour"></label>
        <input type="text" class="lg-hex" aria-label="Stop hex colour" spellcheck="false" maxlength="7">
        <input type="number" class="lg-pos" min="0" max="100" step="1" aria-label="Stop position %"></div>
      <div class="lg-ang"><div class="lg-dial" tabindex="0" aria-label="Angle"><b></b></div>
        <div style="display:grid; gap:8px">
          <div class="lg-tools"><span class="lg-lbl">Angle</span><input type="number" class="lg-deg" min="0" max="359" step="1" aria-label="Angle in degrees"><span class="lg-lbl">°</span></div>
          <div class="lg-tools"><button type="button" data-act="rot" title="Rotate 90°">↻ 90°</button><button type="button" data-act="rev" title="Reverse">⇄ Reverse</button></div>
        </div></div>`;
    document.body.appendChild(pop);
    const $ = s => pop.querySelector(s);
    const bar = $('.lg-bar'), stops = [...pop.querySelectorAll('.lg-stop')], colIn = $('.lg-sw input'), hexIn = $('.lg-hex'), posIn = $('.lg-pos'),
          degIn = $('.lg-deg'), dial = $('.lg-dial'), needle = dial.querySelector('b');

    // ---- apply to the page + current figure ----
    function applySvg() {
      const a = g.angle * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
      document.querySelectorAll('#rw-theme, #rw-themehi').forEach(el => {
        el.setAttribute('x1', (.5 - dx / 2).toFixed(3)); el.setAttribute('y1', (.5 - dy / 2).toFixed(3));
        el.setAttribute('x2', (.5 + dx / 2).toFixed(3)); el.setAttribute('y2', (.5 + dy / 2).toFixed(3));
        const st = el.querySelectorAll('stop');
        if (st[0]) st[0].setAttribute('offset', (g.stops[0].p / 100).toFixed(3));
        if (st[1]) st[1].setAttribute('offset', (g.stops[1].p / 100).toFixed(3));
      });
    }
    function apply(save = true) {
      const [s0, s1] = g.stops;
      root.style.setProperty('--accent', s0.c);
      root.style.setProperty('--accent2', s1.c);
      root.style.setProperty('--rw-tint', tintOf(s0.c, s1.c));
      root.style.setProperty('--accent-hi', `color-mix(in srgb, ${s0.c} 55%, #ffffff)`);
      root.style.setProperty('--accent-dim', `color-mix(in srgb, ${s0.c} 10%, transparent)`);
      root.style.setProperty('--glass-on', `color-mix(in srgb, ${s0.c} 9%, #101112)`);
      applySvg();
      const bg = css(g);
      chip.querySelector('i').style.background = bg;
      const k = PRESETS.findIndex(([, a, b]) => a === s0.c && b === s1.c && s0.p === 0 && s1.p === 100);
      pres.forEach((el, i) => el.setAttribute('aria-checked', i === k ? 'true' : 'false'));
      chip.setAttribute('aria-checked', k < 0 ? 'true' : 'false');
      bar.style.background = `linear-gradient(90deg, ${s0.c} ${s0.p}%, ${s1.c} ${s1.p}%)`;
      stops.forEach((el, i) => { el.style.left = g.stops[i].p + '%'; el.style.background = g.stops[i].c; el.classList.toggle('on', i === sel); });
      const s = g.stops[sel];
      colIn.value = s.c; if (document.activeElement !== hexIn) hexIn.value = s.c.toUpperCase();
      if (document.activeElement !== posIn) posIn.value = Math.round(s.p);
      if (document.activeElement !== degIn) degIn.value = Math.round(g.angle);
      needle.style.transform = `rotate(${g.angle + 180}deg)`;
      if (save) { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch (e) {} }
    }
    // re-apply angle/offsets whenever a new figure mounts
    if (holder) new MutationObserver(applySvg).observe(holder, { childList: true });

    // ---- popover open/close ----
    function place() {
      const r = chip.getBoundingClientRect(), w = 272, h = pop.offsetHeight || 330;
      let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w));
      let top = r.bottom + 8; if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }
    function open(v) { pop.hidden = !v; chip.setAttribute('aria-expanded', v ? 'true' : 'false'); if (v) { place(); } }
    chip.addEventListener('click', e => { e.stopPropagation(); open(pop.hidden); });
    document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !chip.contains(e.target)) open(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { open(false); chip.focus(); } });
    window.addEventListener('resize', () => { if (!pop.hidden) place(); });
    window.addEventListener('scroll', () => { if (!pop.hidden) place(); }, true);
    pop.addEventListener('keydown', e => e.stopPropagation());       // typing in the editor never drives the figure

    // ---- stops: select + drag along the bar ----
    const pct = x => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(100, (x - r.left) / r.width * 100)); };
    stops.forEach((el, i) => {
      el.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); sel = i; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing';
        const mv = ev => { g.stops[i].p = Math.round(pct(ev.clientX)); apply(false); };
        const up = () => { el.removeEventListener('pointermove', mv); el.style.cursor = ''; apply(); };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up, { once: true }); apply(false);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { sel = i; g.stops[i].p = Math.max(0, Math.min(100, g.stops[i].p + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1))); apply(); e.preventDefault(); }
      });
      el.addEventListener('focus', () => { sel = i; apply(false); });
    });
    // clicking the bar moves the nearest stop there
    bar.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('lg-stop')) return;
      const p = pct(e.clientX), i = Math.abs(g.stops[0].p - p) <= Math.abs(g.stops[1].p - p) ? 0 : 1;
      sel = i; g.stops[i].p = Math.round(p); apply();
    });
    // ---- selected stop: colour, hex, position ----
    colIn.addEventListener('input', () => { g.stops[sel].c = colIn.value; apply(); });
    hexIn.addEventListener('input', () => { let v = hexIn.value.trim(); if (v[0] !== '#') v = '#' + v; if (hexOk(v)) { g.stops[sel].c = v.toLowerCase(); apply(); } });
    hexIn.addEventListener('blur', () => apply(false));
    posIn.addEventListener('input', () => { const v = +posIn.value; if (!isNaN(v)) { g.stops[sel].p = Math.max(0, Math.min(100, v)); apply(); } });
    // ---- angle: dial + number + tools ----
    const setAngle = a => { g.angle = ((Math.round(a) % 360) + 360) % 360; apply(); };
    degIn.addEventListener('input', () => { const v = +degIn.value; if (!isNaN(v)) setAngle(v); });
    dial.addEventListener('pointerdown', e => {
      e.preventDefault(); dial.setPointerCapture(e.pointerId);
      const mv = ev => { const r = dial.getBoundingClientRect(), x = ev.clientX - (r.left + r.width / 2), y = ev.clientY - (r.top + r.height / 2);
        let a = Math.atan2(x, -y) * 180 / Math.PI; if (ev.shiftKey) a = Math.round(a / 15) * 15; setAngle(a); };
      mv(e); dial.addEventListener('pointermove', mv); dial.addEventListener('pointerup', () => dial.removeEventListener('pointermove', mv), { once: true });
    });
    dial.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setAngle(g.angle - (e.shiftKey ? 15 : 1)); e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setAngle(g.angle + (e.shiftKey ? 15 : 1)); e.preventDefault(); } });
    pop.querySelector('[data-act="rot"]').addEventListener('click', () => setAngle(g.angle + 90));
    pop.querySelector('[data-act="rev"]').addEventListener('click', () => {
      const [a, b] = g.stops; g.stops = [{ c: b.c, p: 100 - b.p }, { c: a.c, p: 100 - a.p }]; apply();
    });

    apply(false);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})();
