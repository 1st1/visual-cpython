import {paintPython} from './python-syntax.mjs';
import { extractGraph, projectReplay } from './graph.mjs';
import { ParsingReplay } from './parsing.mjs';
import { Factory } from './factory.mjs';
import { instructionText } from './opcodes.mjs';
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
let parsingReplay, parsingMode=false, lastLayout;
let factory, viewMode = '3d', layoutAspect, resizeTimer;
const windowAspect=()=>window.innerWidth/Math.max(1,window.innerHeight);
$('source').value = examples.accumulate;
let exampleRequest=0;
$('example').onchange = async () => {
  const request=++exampleRequest, name=$('example').value;
  if(name!=='shortest') { $('source').value=examples[name]; $('run').disabled=Boolean(worker); previewSource(); return; }
  $('run').disabled=true;
  try {
    const response=await fetch('./programs/shortest_path.py');
    if(!response.ok) throw new Error('Could not load shortest-path example.');
    const source=await response.text(); if(request===exampleRequest) { $('source').value=source; previewSource(); }
  } catch(error) { if(request===exampleRequest) $('message').textContent=error.message; }
  finally { if(request===exampleRequest) $('run').disabled=Boolean(worker); }
};

function stopPlayback() { factory?.starfield?.setPlaying(false); clearInterval(playback); playback = null; $('play').textContent = 'Play'; }
function stopWorker(endFlight=true) { if(endFlight) factory?.starfield?.setCapturing(false); generation++; clearTimeout(timer); worker?.terminate(); worker = null; $('run').disabled = false; $('cancel').disabled = true; }
function fail(message) { stopWorker(); $('state').textContent = 'Stopped'; $('message').textContent = message; }
$('cancel').onclick = () => fail('Capture cancelled. Run again to start a fresh interpreter.');
$('run').onclick = () => {
  parsingReplay?.stop();parsingMode=false;setParsingUI(false);$('view-parsing').disabled=true;lastLayout=null;
  layoutWorker?.terminate(); clearTimeout(layoutTimer); graph = null; mapStates = []; selectedBlock = null;
  $('block-select').replaceChildren(new Option('Select a building or block…',''));
  $('map').replaceChildren(); $('map-status').textContent = 'Waiting for capture'; $('block-detail').textContent = '';
  stopPlayback(); stopWorker(); recording = null; render();
  $('message').textContent = '';
  $('run').disabled = true; $('cancel').disabled = false; $('state').textContent = 'Loading WASM';
  factory?.starfield?.setCapturing(true);
  worker = new Worker('./worker.mjs?loader=2', { type: 'module' });
  const runGeneration = generation;
  timer = setTimeout(() => fail('Runtime loading exceeded 60 seconds.'), 60000);
  worker.onerror = e => { if (generation === runGeneration) fail(e.message); };
  worker.onmessage = ({ data }) => {
    if (generation !== runGeneration) return;
    if (data.type === 'running') {
      clearTimeout(timer); $('state').textContent = 'Capturing';
      timer = setTimeout(() => fail('Execution stopped after 5 seconds. The worker has been discarded.'), 5000);
    } else if (data.type === 'result') {
      stopWorker(false); recording = data.trace; index = 0;
      $('state').textContent = recording.status;
      $('message').textContent = recording.error || '';
      $('provenance').textContent = `CPython ${recording.provenance.python.split(' ')[0]} · ${recording.provenance.revision.slice(0, 8)}`;
      if(!recording.codes.length) factory?.load(null,null,[],recording.source,recording.parsing,true);
      $('view-parsing').disabled=!factory||!recording.parsing;
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
  factory?.starfield?.setPlaying(true);
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
    const span = document.createElement('span'); span.className = 'source-line' + (i + 1 === event.line ? ' active' : ''); paintPython(span,`${String(i + 1).padStart(2)}  ${line}`); return span;
  }));
  $('instructions').replaceChildren(...code.instructions.map(ins => {
    const div = document.createElement('div'); div.className = 'instruction' + (ins.offset === event.offset ? ' active' : '');
    div.textContent = instructionText(ins); return div;
  }));
  const activeInstruction = $('instructions').querySelector('.active');
  if (activeInstruction) $('instructions').scrollTop += activeInstruction.getBoundingClientRect().top - $('instructions').getBoundingClientRect().top - 70;
  rows($('locals'), Object.entries(event.locals).map(([name, value]) => `${name} → ${describe(value)}`));
  rows($('stack'), event.stack ? [...event.stack].reverse().map(v => v.kind === 'object' ? describe(v.value) : v.kind === 'null' ? 'NULL · internal call sentinel' : `tagged integer: ${v.value}`) : ['Stack sampled at opcode events only']);
  $('stdout').textContent = index === count ? recording.stdout : event.stdout;
}

function buildMap(relayout=false) {
  layoutWorker?.terminate(); clearTimeout(layoutTimer);
  const targetAspect=windowAspect(); layoutAspect=targetAspect;
  try {
    graph = extractGraph(recording);
    mapStates = projectReplay(recording, graph);
    if (!graph.blocks.length) { factory?.starfield?.setCapturing(false); $('map-status').textContent = 'No compiled program'; return; }
    $('map-status').textContent = 'Laying out program…';
    const current = graph;
    layoutWorker = new Worker('./layout-worker.mjs', { type: 'module' });
    const stop = () => { clearTimeout(layoutTimer); layoutWorker?.terminate(); layoutWorker = null; };
    const error = message => { stop(); factory?.starfield?.setCapturing(false); $('map-status').textContent = `Layout failed: ${message}`; $('message').textContent=$('map-status').textContent; };
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
      lastLayout=data.layout;
      factory?.load(data.layout,graph,recording.events,recording.source,recording.parsing,!relayout);
      if(parsingMode) {factory?.loadParsing();parsingReplay.render();}
      if(relayout&&!parsingMode) factory?.finishConstruction();
      if(relayout&&parsingMode) factory?.view('iso');
      $('factory').dataset.layoutAspect=String(data.layout.placement.targetAspect);
      $('block-select').replaceChildren(new Option('Select a building or block…',''), ...graph.blocks.map(b=>new Option(`${b.id} · ${b.instructions.at(-1).opname}`,b.id)));
      $('block-select').value=selectedBlock || '';
      for (const block of graph.blocks) {
        const node = document.getElementById(block.id);
        node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button');
        node.setAttribute('aria-label', `Inspect ${block.id}`);
        const select = () => selectBlock(block.id);
        node.onclick = select;
        node.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } };
      }
      $('map-status').textContent = `Graphviz ${data.version} · ${graph.blocks.reduce((n,b)=>n+b.instructions.length,0)} opcodes · ${graph.blocks.length} blocks · ${graph.edges.length} connections`;
      if (graph.diagnostics.length) $('map-status').textContent += ` · ${graph.diagnostics.length} mapping warnings`;
      renderMapState();
      factory?.starfield?.setCapturing(false);
    };
    layoutWorker.postMessage({ graph, targetAspect });
  } catch (error) { factory?.starfield?.setCapturing(false); $('map-status').textContent = `Map unavailable: ${error.message}`; $('message').textContent=$('map-status').textContent; }
}
function setZoom() {
  const svg = $('map').querySelector('svg');
  if (svg) svg.style.width = `${zoom * 100}%`;
}
$('zoom-in').onclick = () => { if(viewMode==='3d') return factory?.zoom(1.25); zoom = Math.min(4, zoom * 1.25); setZoom(); };
$('zoom-out').onclick = () => { if(viewMode==='3d') return factory?.zoom(.8); zoom = Math.max(0.5, zoom / 1.25); setZoom(); };
$('zoom-fit').onclick = () => { if(viewMode==='3d') return factory?.view('iso'); zoom = 1; setZoom(); };
$('visit-block').onclick = () => {
  if (!selectedBlock) return;
  const visits = mapStates.flatMap((state, i) => state.block === selectedBlock && recording.events[i].kind === 'opcode' ? [i] : []);
  const target = visits.find(i => i > index) ?? visits[0];
  if (target !== undefined) { stopPlayback(); move(target); }
};
function renderMapState() {
  const state = mapStates[Math.min(index, mapStates.length - 1)];
  if(!parsingMode) factory?.setState(state,recording?.events[Math.min(index,mapStates.length-1)],selectedBlock,index===mapStates.length);
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
    $('block-detail').textContent = `${selected.id}\n` + selected.instructions.map(i => `${instructionText(i)} · line ${i.line ?? '—'}`).join('\n');
  } else $('block-detail').textContent='';
}

function selectBlock(id) { selectedBlock=id; $('block-select').value=id; renderMapState(); }
function changeView(mode) {
  if(mode==='map'&&parsingMode) showExecution();
  viewMode=mode; $('factory').hidden=mode!=='3d'; $('map').hidden=mode!=='map'; $('scene-hint').hidden=mode!=='3d';
  $('view-3d').setAttribute('aria-pressed',String(mode==='3d')); $('view-map').setAttribute('aria-pressed',String(mode==='map'));
  for(const id of ['camera-iso','camera-top','finish-build','focus-block','focus-stack','focus-source','show-opcodes']) $(id).disabled=mode!=='3d';
  if(mode==='3d') factory?.resize();
}
$('view-3d').onclick=()=>changeView('3d'); $('view-map').onclick=()=>changeView('map');
$('camera-iso').onclick=()=>factory?.view('iso'); $('camera-top').onclick=()=>factory?.view('top');
$('finish-build').onclick=()=>factory?.finishConstruction();
$('focus-block').onclick=()=>factory?.focus(selectedBlock || mapStates[index]?.block);
$('focus-source').onclick=()=>factory?.focusSource();
$('focus-stack').onclick=()=>factory?.focusStack();
$('show-opcodes').onclick=()=>{
  const show=$('show-opcodes').getAttribute('aria-pressed')!=='true';
  $('show-opcodes').setAttribute('aria-pressed',String(show)); factory?.showOpcodes(show);
};
$('block-select').onchange=()=>selectBlock($('block-select').value);
function seekInstruction(blockId,offset) {
  const block=graph.blocks.find(b=>b.id===blockId);
  const visits=recording.events.filter(e=>e.kind==='opcode'&&e.code===block.code&&e.offset===offset);
  const visit=visits.find(e=>e.seq>index)??visits[0];
  if(visit) { stopPlayback(); move(visit.seq); }
}
function previewSource() { paintPython($('source-highlight'),$('source').value+'\n'); if(!recording&&!worker) factory?.load(null,null,[],$('source').value,null,true); }
let previewTimer;
$('source').addEventListener('input',()=>{ paintPython($('source-highlight'),$('source').value+'\n'); clearTimeout(previewTimer); previewTimer=setTimeout(previewSource,180); });
for(const name of ['editor','inspector']) $('toggle-'+name).onclick=()=>{
  const panel=$(name+'-panel'); panel.hidden=!panel.hidden;
  $('toggle-'+name).setAttribute('aria-expanded',String(!panel.hidden));
};
try { factory=new Factory($('factory'),selectBlock,seekInstruction); parsingReplay=new ParsingReplay(factory); previewSource(); factory.view('iso'); }
catch(error) { $('scene-hint').textContent=`3D unavailable: ${error.message}. The schematic is available.`; changeView('map'); $('view-3d').disabled=true; $('message').textContent='3D graphics unavailable; using the schematic.'; }
window.addEventListener('pagehide',event=>{ if(!event.persisted) factory?.dispose(); });

window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    if(recording?.codes.length && Math.abs(windowAspect()-(layoutAspect || 0))>.01) buildMap(true);
    else if(!recording&&!worker) factory?.view('iso');
  },250);
});

function setParsingUI(active) {
  $('parse-panel').hidden=!active;
  $('map-status').hidden=active;$('scene-hint').hidden=active||viewMode!=='3d';
  for(const id of ['finish-build','show-opcodes']) $(id).disabled=active||viewMode!=='3d';
  document.querySelector('.transport').hidden=active;
  $('view-parsing').setAttribute('aria-pressed',String(active));
  $('view-execution').setAttribute('aria-pressed',String(!active));
  factory?.showOpcodes(!active&&$('show-opcodes').getAttribute('aria-pressed')==='true');
}
function showExecution() {
  parsingReplay?.stop();parsingMode=false;setParsingUI(false);
  if(!recording) factory?.load(null,null,[],$('source').value,null,true);
  factory?.finishConstruction();renderMapState();
}
$('view-execution').onclick=showExecution;
$('view-parsing').onclick=()=>{
  stopPlayback();changeView('3d');parsingMode=true;setParsingUI(true);parsingReplay.load(recording);
};

$('source').addEventListener('scroll',()=>{ $('source-highlight').scrollTop=$('source').scrollTop; $('source-highlight').scrollLeft=$('source').scrollLeft; });
paintPython($('source-highlight'),$('source').value+'\n');
