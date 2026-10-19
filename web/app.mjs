const $ = id => document.getElementById(id);
const examples = {
  accumulate: "def accumulate(n, step):\n    total = 0\n    for i in range(n):\n        total = total + step\n    return total\n\nprint(accumulate(8, 1))",
  branch: "def choose(x):\n    if x > 3:\n        return x * 2\n    return x + 1\n\nprint(choose(2), choose(7))",
  alias: "a = [1, 2]\nb = a\na[0] = 9\nprint(b[0])",
  error: "def divide(x):\n    return 10 / x\n\nprint(divide(0))",
  loop: "while True:\n    pass",
};
let worker, timer, playback, recording, index = 0, generation = 0;
$('source').value = examples.accumulate;
$('example').onchange = () => { $('source').value = examples[$('example').value]; };

function stopPlayback() { clearInterval(playback); playback = null; $('play').textContent = 'Play'; }
function stopWorker() { generation++; clearTimeout(timer); worker?.terminate(); worker = null; $('run').disabled = false; $('cancel').disabled = true; }
function fail(message) { stopWorker(); $('state').textContent = 'Stopped'; $('message').textContent = message; }
$('cancel').onclick = () => fail('Capture cancelled. Run again to start a fresh interpreter.');
$('run').onclick = () => {
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
  $('instructions').querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  rows($('locals'), Object.entries(event.locals).map(([name, value]) => `${name} → ${describe(value)}`));
  rows($('stack'), event.stack ? [...event.stack].reverse().map(v => v.kind === 'object' ? describe(v.value) : v.kind === 'null' ? 'NULL · internal call sentinel' : `tagged integer: ${v.value}`) : ['Stack sampled at opcode events only']);
  $('stdout').textContent = index === count ? recording.stdout : event.stdout;
}
