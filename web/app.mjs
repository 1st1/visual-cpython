import { extractGraph, projectReplay } from './graph.mjs';
const $ = id => document.getElementById(id);
const examples = {
  accumulate: "def accumulate(n, step):\n    total = 0\n    for i in range(n):\n        total = total + step\n    return total\n\nprint(accumulate(8, 1))",
  branch: "def choose(x):\n    if x > 3:\n        return x * 2\n    return x + 1\n\nprint(choose(2), choose(7))",
  alias: "a = [1, 2]\nb = a\na[0] = 9\nprint(b[0])",
  error: "def divide(x):\n    return 10 / x\n\nprint(divide(0))",
  loop: "while True:\n    pass",
};
let worker, timer, playback, recording, index = 0, generation = 0;
let layoutWorker, layoutTimer, graph, mapStates = [], selectedBlock, zoom = 1;
$('source').value = examples.accumulate;
$('example').onchange = () => { $('source').value = examples[$('example').value]; };

function stopPlayback() { clearInterval(playback); playback = null; $('play').textContent = 'Play'; }
function stopWorker() { generation++; clearTimeout(timer); worker?.terminate(); worker = null; $('run').disabled = false; $('cancel').disabled = true; }
function fail(message) { stopWorker(); $('state').textContent = 'Stopped'; $('message').textContent = message; }
$('cancel').onclick = () => fail('Capture cancelled. Run again to start a fresh interpreter.');
$('run').onclick = () => {
  layoutWorker?.terminate(); clearTimeout(layoutTimer); graph = null; mapStates = []; selectedBlock = null;
  $('map').replaceChildren(); $('map-status').textContent = 'Waiting for capture'; $('block-detail').textContent = '';
  stopPlayback(); stopWorker(); recording = null; render();
  $('message').textContent = '';
  $('run').disabled = true; $('cancel').disabled = false; $('state').textContent = 'Loading WASM';
  worker = new Worker('./worker.mjs', { type: 'module' });
  const runGeneration = generation;
  timer = setTimeout(() => fail('Runtime loading exceeded 60 seconds.'), 60000);
  worker.onerror = e => { if (generation === runGeneration) fail(e.message); };
  worker.onmessage = ({ data }) => {
    if (generation !== runGeneration) return;
    if (data.type === 'running') {
      clearTimeout(timer); $('state').textContent = 'Capturing';
      timer = setTimeout(() => fail('Execution stopped after 5 seconds. The worker has been discarded.'), 5000);
    } else if (data.type === 'result') {
      stopWorker(); recording = data.trace; index = 0;
      $('state').textContent = recording.status;
      $('message').textContent = recording.error || '';
      $('provenance').textContent = `CPython ${recording.provenance.python.split(' ')[0]} · ${recording.provenance.revision.slice(0, 8)}`;
      render();
      buildMap();
    } else if (data.type === 'error') fail(data.message);
  };
  worker.postMessage({ source: $('source').value });
};
function move(value) { index = Math.max(0, Math.min(recording.events.length, value)); render(); }
$('first').onclick = () => { stopPlayback(); move(0); };
$('back').onclick = () => { stopPlayback(); move(index - 1); };
$('next').onclick = () => { stopPlayback(); move(index + 1); };
$('seek').oninput = () => { stopPlayback(); move(Number($('seek').value)); };
$('play').onclick = () => {
  if (playback) return stopPlayback();
  if (index === recording.events.length) move(0);
  $('play').textContent = 'Pause';
  playback = setInterval(() => { move(index + 1); if (index === recording.events.length) stopPlayback(); }, 250);
};
function describe(value) {
  if (!value) return '—';
  if ('value' in value) return `${value.type}: ${JSON.stringify(value.value)} · ${value.id}`;
  if (value.items) {
    const preview = value.items.map(item => Array.isArray(item) ? `${describe(item[0])}: ${describe(item[1])}` : describe(item)).join(', ');
    return `${value.type} [${value.length}] · ${value.id} → ${preview}${value.length > value.items.length ? ', …' : ''}`;
  }
  return `${value.type}${value.name ? ' ' + value.name : ''}${value.length !== undefined ? ' [' + value.length + ']' : ''} · ${value.id}${value.cycle ? ' ↩' : ''}`;
}
function rows(target, items) {
  target.replaceChildren(...items.map(text => { const div = document.createElement('div'); div.className = 'value'; div.textContent = text; return div; }));
}
function render() {
  renderMapState();
  const count = recording?.events.length || 0;
  for (const id of ['first', 'back', 'next', 'play', 'seek']) $(id).disabled = !count;
  $('back').disabled = !count || index === 0; $('next').disabled = !count || index === count;
  $('seek').max = count; $('seek').value = index;
  $('counter').textContent = count ? `${Math.min(index + 1, count)} / ${count}${index === count ? ' · end' : ''}` : 'No recording';
  const event = recording?.events[Math.min(index, count - 1)];
  if (!event) {
    for (const id of ['source-view', 'instructions', 'locals', 'stack', 'stdout']) $(id).replaceChildren();
    $('stdout').textContent = recording?.stdout || '';
    $('event').textContent = 'Run a program to inspect its execution.';
    return;
  }
  const code = recording.codes.find(c => c.id === event.code);
  $('event').textContent = index === count ? `Capture ${recording.status}` : `${event.kind} · ${code.name} · ${event.frame} · line ${event.line} · offset ${event.offset}`;
  $('source-view').replaceChildren(...recording.source.split('\n').map((line, i) => {
    const span = document.createElement('span'); span.className = 'source-line' + (i + 1 === event.line ? ' active' : ''); span.textContent = `${String(i + 1).padStart(2)}  ${line}`; return span;
  }));
  $('instructions').replaceChildren(...code.instructions.map(ins => {
    const div = document.createElement('div'); div.className = 'instruction' + (ins.offset === event.offset ? ' active' : '');
    div.textContent = `${String(ins.offset).padStart(3)}  ${ins.opname}${ins.arg === null ? '' : ' ' + ins.arg}`; return div;
  }));
  const activeInstruction = $('instructions').querySelector('.active');
  if (activeInstruction) $('instructions').scrollTop += activeInstruction.getBoundingClientRect().top - $('instructions').getBoundingClientRect().top - 70;
  rows($('locals'), Object.entries(event.locals).map(([name, value]) => `${name} → ${describe(value)}`));
  rows($('stack'), event.stack ? [...event.stack].reverse().map(v => v.kind === 'object' ? describe(v.value) : v.kind === 'null' ? 'NULL · internal call sentinel' : `tagged integer: ${v.value}`) : ['Stack sampled at opcode events only']);
  $('stdout').textContent = index === count ? recording.stdout : event.stdout;
}

function buildMap() {
  try {
    graph = extractGraph(recording);
    mapStates = projectReplay(recording, graph);
    if (!graph.blocks.length) { $('map-status').textContent = 'No compiled program'; return; }
    $('map-status').textContent = 'Laying out program…';
    const current = graph;
    layoutWorker = new Worker('./layout-worker.mjs', { type: 'module' });
    const stop = () => { clearTimeout(layoutTimer); layoutWorker?.terminate(); layoutWorker = null; };
    const error = message => { stop(); $('map-status').textContent = `Layout failed: ${message}`; };
    layoutTimer = setTimeout(() => error('exceeded 15 seconds'), 15000);
    layoutWorker.onerror = e => error(e.message);
    layoutWorker.onmessage = ({ data }) => {
      if (graph !== current) return;
      stop();
      if (data.error) return error(data.error);
      const svg = new DOMParser().parseFromString(data.svg, 'image/svg+xml').documentElement;
      svg.setAttribute('aria-label', 'Program control-flow map');
      svg.removeAttribute('width'); svg.removeAttribute('height');
      $('map').replaceChildren(document.importNode(svg, true)); zoom = 1; setZoom();
      for (const block of graph.blocks) {
        const node = document.getElementById(block.id);
        node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button');
        node.setAttribute('aria-label', `Inspect ${block.id}`);
        const select = () => { selectedBlock = block.id; renderMapState(); };
        node.onclick = select;
        node.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } };
      }
      $('map-status').textContent = `Graphviz ${data.version} · ${graph.blocks.length} blocks · ${graph.edges.length} connections`;
      if (graph.diagnostics.length) $('map-status').textContent += ` · ${graph.diagnostics.length} mapping warnings`;
      renderMapState();
    };
    layoutWorker.postMessage({ graph });
  } catch (error) { $('map-status').textContent = `Map unavailable: ${error.message}`; }
}
function setZoom() {
  const svg = $('map').querySelector('svg');
  if (svg) svg.style.width = `${zoom * 100}%`;
}
$('zoom-in').onclick = () => { zoom = Math.min(4, zoom * 1.25); setZoom(); };
$('zoom-out').onclick = () => { zoom = Math.max(0.5, zoom / 1.25); setZoom(); };
$('zoom-fit').onclick = () => { zoom = 1; setZoom(); };
$('visit-block').onclick = () => {
  if (!selectedBlock) return;
  const visits = mapStates.flatMap((state, i) => state.block === selectedBlock && recording.events[i].kind === 'opcode' ? [i] : []);
  const target = visits.find(i => i > index) ?? visits[0];
  if (target !== undefined) { stopPlayback(); move(target); }
};
function renderMapState() {
  const state = mapStates[Math.min(index, mapStates.length - 1)];
  $('map').querySelectorAll('.executing,.traversed,.selected').forEach(n => n.classList.remove('executing', 'traversed', 'selected'));
  if (state) {
    document.getElementById(state.block)?.classList.add('executing');
    if (state.edge) document.getElementById(state.edge)?.classList.add('traversed');
  }
  $('frames').textContent = state ? state.frames.map(f => `${recording.codes.find(c => c.id === f.code).name} [${f.id}]`).join(' → ') + ` · ${index === mapStates.length ? recording.status : state.kind}` : '';
  const selected = graph?.blocks.find(b => b.id === selectedBlock);
  $('visit-block').disabled = !selected || !mapStates.some((s, i) => s.block === selected.id && recording.events[i].kind === 'opcode');
  if (selected) {
    document.getElementById(selected.id)?.classList.add('selected');
    $('block-detail').textContent = `${selected.id}\n` + selected.instructions.map(i => `${i.offset}  ${i.opname}${i.arg === null ? '' : ' ' + i.arg} · line ${i.line ?? '—'}`).join('\n');
  }
}
