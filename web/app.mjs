import {isMobileNavigationDevice,preventPageZoom} from './navigation.mjs';
import {sourceVisits,nextSourceVisit} from './source-navigation.mjs';
import {paintPython} from './python-syntax.mjs';
import { extractGraph, projectReplay, createReplayProjector } from './graph.mjs';
import { ParsingReplay } from './parsing.mjs';
import { Factory } from './factory.mjs';
const $ = id => document.getElementById(id);
preventPageZoom();
document.documentElement.classList.toggle('mobile-device',isMobileNavigationDevice());
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
let resetAllowed=false;
let livePlaying=false,liveWaiting=false,liveTimer,projectLive;
const HISTORY_LIMIT=2000;
let operation=null,runAfterLayout=false;
const windowAspect=()=>window.innerWidth/Math.max(1,window.innerHeight);
$('source').value = examples.accumulate;
let exampleRequest=0;
let appliedSource=$('source').value;
$('example').onchange = async () => {
  const request=++exampleRequest, name=$('example').value;
  if(name==='custom')return;
  const applyExample=source=>{ $('source').value=source;resetProgram();previewSource();factory?.view(); };
  const file={shortest:new URL('./programs/shortest_path.py',import.meta.url),asyncio:new URL('./programs/asyncio_numbers.py',import.meta.url)}[name];
  if(!file) { applyExample(examples[name]); return; }
  $('run').disabled=true;
  try {
    const response=await fetch(file);
    if(!response.ok) throw new Error('Could not load program example.');
    const source=await response.text(); if(request===exampleRequest) { applyExample(source); }
  } catch(error) { if(request===exampleRequest) $('message').textContent=error.message; }
  finally { if(request===exampleRequest) $('run').disabled=operation==='compile'; }
};

function setPlaybackLabel(label) {
  const button=$('play');
  if(button.getAttribute('aria-label')===label)return;
  button.setAttribute('aria-label',label);button.title=label;
  button.innerHTML=label==='Pause'
    ?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16M16 4v16"/></svg>'
    :'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8Z"/></svg>';
}
function stopPlayback() { livePlaying=false;clearTimeout(liveTimer); factory?.starfield?.setPlaying(false); clearInterval(playback); playback = null; setPlaybackLabel(recording?.events.length&&index<recording.events.length?'Resume':'Run'); }
function stopWorker(endFlight=true) {
  if(endFlight)factory?.starfield?.setCapturing(false);
  resetAllowed=false;liveWaiting=false;projectLive=null;clearTimeout(liveTimer);livePlaying=false;
  generation++;clearTimeout(timer);worker?.terminate();worker=null;operation=null;
  $('run').disabled=false;$('run').textContent='Compile';
}
function fail(message) { stopPlayback();stopWorker();runAfterLayout=false;$('state').textContent='Stopped';$('message').textContent=message;render(); }
$('skip-animation').onclick=()=>{factory?.finishConstruction();$('skip-animation').hidden=true;};
let compileHintTimer,compileHintHideTimer;
function hideCompileHint(){
  clearTimeout(compileHintTimer);clearTimeout(compileHintHideTimer);
  $('compile-hint').hidden=true;$('compile-hint').classList.remove('visible');
}
document.querySelector('.playback-run-slot').addEventListener('click',()=>{
  if(!$('play').disabled||operation||layoutWorker)return;
  hideCompileHint();
  $('compile-hint').hidden=false;$('compile-hint').classList.add('visible');
  compileHintTimer=setTimeout(()=>{
    $('compile-hint').classList.remove('visible');
    compileHintHideTimer=setTimeout(hideCompileHint,300);
  },2200);
});
$('run').onclick=()=>{hideCompileHint();startOperation('compile');};
function startOperation(mode) {
  const source=mode==='compile'?$('source').value:recording?.source;
  if(mode==='run'&&(!recording||source!==$('source').value))return;
  parsingReplay?.stop();parsingMode=false;setParsingUI(false);
  stopPlayback();stopWorker();runAfterLayout=false;
  layoutWorker?.terminate();clearTimeout(layoutTimer);layoutWorker=null;
  if(mode==='compile'){
    appliedSource=source;
    lastLayout=null;graph=null;mapStates=[];selectedBlock=null;recording=null;
    $('map').replaceChildren();
    factory?.load(null,null,[],source,null,false);
  } else {
    recording={...recording,events:[],stdout:'',status:'compiled'};delete recording.error;
    mapStates=[];selectedBlock=null;index=0;
    if(factory){factory.instructionVisits.clear();factory.panelBlock=null;factory.opcodeTrail.clear();factory.previousOpcodeTile=null;}
    factory?.finishConstruction();
  }
  operation=mode;
  if(mode==='run'){projectLive=createReplayProjector(recording,graph);livePlaying=true;}
  $('message').textContent='';if(mode==='compile')$('map-status').textContent='Compiling…';
  $('run').disabled=mode==='compile';$('run').textContent=mode==='compile'?'Compiling…':'Compile';
  $('state').textContent='Loading WASM';
  factory?.starfield?.setCapturing(true);
  render();
  worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  const runGeneration=generation;
  timer=setTimeout(()=>fail('Runtime loading exceeded 60 seconds.'),60000);
  worker.onerror=e=>{if(generation===runGeneration)fail(e.message);};
  worker.onmessage=({data})=>{
    if(generation!==runGeneration)return;
    if(data.type==='running'){
      clearTimeout(timer);$('state').textContent=mode==='compile'?'Compiling':'running';
      if(mode==='compile')timer=setTimeout(()=>fail('Compilation exceeded 15 seconds.'),15000);
      else {
        factory?.starfield?.setCapturing(false);factory?.starfield?.setPlaying(livePlaying);
        render();
      }
    }else if(data.type==='event'){
      appendLiveEvent(data.event);
    }else if(data.type==='result'){
      if(mode==='run'){
        recording.stdout=data.trace.stdout;recording.status=data.trace.status;
        recording.error=data.trace.error;
        stopPlayback();stopWorker();index=recording.events.length;
        $('state').textContent=recording.status;$('message').textContent=recording.error||'';
        render();return;
      }
      stopWorker(false);recording=data.trace;index=0;runAfterLayout=mode==='run'&&recording.events.length>0;
      $('state').textContent=recording.status;$('message').textContent=recording.error||'';
      $('provenance').textContent=`CPython ${recording.provenance.python.split(' ')[0]} · ${recording.provenance.revision.slice(0,8)}`;
      if(!recording.codes.length)factory?.load(null,null,[],recording.source,recording.parsing,mode!=='compile');
      render();buildMap(false,mode==='run');
    }else if(data.type==='error')fail(data.message);
  };
  worker.postMessage({source,mode});
}
function scheduleLive(){
  clearTimeout(liveTimer);
  if(livePlaying&&liveWaiting)liveTimer=setTimeout(advanceLive,100);
}
function advanceLive(){
  if(!worker||!liveWaiting)return;
  liveWaiting=false;worker.postMessage({type:'advance'});render();
}
function appendLiveEvent(event){
  const follow=livePlaying||index>=recording.events.length-1;
  event.position=event.seq;
  const state=projectLive(event);
  recording.events.push(event);mapStates.push(state);
  if(recording.events.length>HISTORY_LIMIT){recording.events.shift();mapStates.shift();index=Math.max(0,index-1);}
  // UI positions are local to the retained window; runtime sequence stays monotonic.
  for(let i=0;i<recording.events.length;i++)recording.events[i].seq=i;
  recording.stdout=event.stdout;
  if(factory){
    factory.instructionVisits.clear();factory.panelBlock=null;
    for(const e of recording.events)if(e.kind==='opcode'){
      const key=`${e.code}:${e.offset}`;
      factory.instructionVisits.set(key,(factory.instructionVisits.get(key)||0)+1);
    }
  }
  if(follow)index=recording.events.length-1;
  liveWaiting=event.kind==='opcode';
  render();scheduleLive();
}
function seekSourceLine(line){
  if(operation==='compile'||!recording?.events.length)return;
  const target=nextSourceVisit(sourceVisits(recording.events),line,index);
  if(target===undefined)return;
  stopPlayback();selectedBlock=null;move(target);
}
function move(value) { selectedBlock=null; index = Math.max(0, Math.min(recording.events.length, value)); render(); }
function resetProgram(){
  appliedSource=$('source').value;
  stopPlayback();stopWorker();runAfterLayout=false;
  layoutWorker?.terminate();layoutWorker=null;clearTimeout(layoutTimer);clearTimeout(previewTimer);
  parsingReplay?.stop();
  if(parsingReplay){parsingReplay.recording=null;parsingReplay.frames=[];parsingReplay.tokens=[];}
  recording=null;graph=null;lastLayout=null;mapStates=[];selectedBlock=null;index=0;parsingMode=false;
  setParsingUI(false);
  $('map').replaceChildren();$('map-status').textContent='Compile a program to build its map.';
  $('message').textContent='';$('state').textContent='Ready';$('provenance').textContent='';$('skip-animation').hidden=true;
  if(factory){factory.liveCaptureUntil=0;factory.parsingPlaying=false;factory.load(null,null,[],$('source').value);}
  render();
}
function resetRun(){
  hideCompileHint();stopPlayback();stopWorker();
  recording={...recording,events:[],stdout:'',status:'compiled'};delete recording.error;
  mapStates=[];selectedBlock=null;index=0;
  if(factory){factory.instructionVisits.clear();factory.panelBlock=null;factory.opcodeTrail.clear();factory.previousOpcodeTile=null;}
  $('message').textContent='';$('state').textContent='compiled';render();
}
$('reset').onclick=resetRun;
$('back').onclick = () => { stopPlayback(); move(index - 1); };
$('next').onclick = () => {
  stopPlayback();
  if(operation==='run'&&index>=recording.events.length-1)advanceLive();
  else move(index+1);
};
$('seek').oninput = () => { stopPlayback(); move(Number($('seek').value)); };
function startReplay() {
  resetAllowed=false;
  if(!recording?.events.length)return;
  setPlaybackLabel('Pause');factory?.starfield?.setPlaying(true);
  playback=setInterval(()=>{move(index+1);if(index===recording.events.length)stopPlayback();},250);
}
$('play').onclick=()=>{
  if(livePlaying||playback){stopPlayback();resetAllowed=true;render();return;}
  if(operation==='run'){
    resetAllowed=false;livePlaying=true;index=Math.max(0,recording.events.length-1);
    factory?.starfield?.setPlaying(true);scheduleLive();render();return;
  }
  if(recording?.events.length&&index<recording.events.length)return startReplay();
  startOperation('run');
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
  $('reset').disabled=!resetAllowed||livePlaying||Boolean(playback)||operation==='compile';
  renderMapState();
  const count = recording?.events.length || 0;
  for (const id of ['back', 'next', 'play', 'seek']) $(id).disabled = !count;
  $('play').disabled=Boolean(operation==='compile'||layoutWorker)||!recording?.codes.length||recording.source!==$('source').value;
  setPlaybackLabel(livePlaying||playback?'Pause':operation==='run'?'Run':count&&index<count?'Resume':'Run');
  for(const id of ['back','next','seek'])if(operation==='compile')$(id).disabled=true;
  $('back').disabled = operation==='compile' || !count || index === 0; $('next').disabled = operation==='compile' || (operation==='run'?(!liveWaiting&&index>=count-1):!count || index === count);
  $('seek').max = operation==='run'?Math.max(0,count-1):count; $('seek').value = index;
  $('seek').style.setProperty('--seek-progress',`${count?index/count*100:0}%`);
  const latest=count?(recording.events.at(-1).position??recording.events.at(-1).seq)+1:0;
  const current=count?(recording.events[Math.min(index,count-1)].position??recording.events[Math.min(index,count-1)].seq)+1:0;
  const back=latest-current;
  const steps=n=>`${n.toLocaleString()} ${n===1?'step':'steps'}`;
  $('counter').hidden=latest===0;
  $('counter').textContent=back
    ?`Step ${current.toLocaleString()} of ${latest.toLocaleString()}`
    :steps(latest);
  const event = recording?.events[Math.min(index, count - 1)];
  if (!event) {
    for (const id of ['source-view', 'locals', 'stack', 'stdout']) $(id).replaceChildren();
    $('stdout').textContent = recording?.stdout || '';
    $('event').textContent = 'Run a program to inspect its execution.';
    return;
  }
  const code = recording.codes.find(c => c.id === event.code);
  $('event').textContent = index === count ? `Execution ${recording.status}` : `${event.kind} · ${code.name} · ${event.frame} · line ${event.line} · offset ${event.offset}`;
  const visitedLines=sourceVisits(recording.events);
  $('source-view').replaceChildren(...recording.source.split('\n').map((line, i) => {
    const button=document.createElement('button');button.type='button';button.dataset.line=String(i+1);
    button.className='source-line'+(i+1===event.line?' active':'');
    button.disabled=operation==='compile'||!visitedLines.has(i+1);
    button.title=button.disabled?'No recorded execution for this line':'Jump to next recorded visit (wraps to first)';
    button.setAttribute('aria-label',`Line ${i+1}: ${line}`);
    button.onclick=()=>seekSourceLine(i+1);paintPython(button,`${String(i+1).padStart(2)}  ${line}`);return button;
  }));
  rows($('locals'), Object.entries(event.locals).map(([name, value]) => `${name} → ${describe(value)}`));
  rows($('stack'), event.stack ? [...event.stack].reverse().map(v => v.kind === 'object' ? describe(v.value) : v.kind === 'null' ? 'NULL · internal call sentinel' : `tagged integer: ${v.value}`) : ['Stack sampled at opcode events only']);
  $('stdout').textContent = index === count ? recording.stdout : event.stdout;
}

function buildMap(relayout=false,executed=false) {
  layoutWorker?.terminate(); clearTimeout(layoutTimer);
  const targetAspect=windowAspect(); layoutAspect=targetAspect;
  try {
    if(!(relayout&&operation==='run')){
      graph = extractGraph(recording);
      mapStates = projectReplay(recording, graph);
    }
    if (!graph.blocks.length) { factory?.starfield?.setCapturing(false); $('map-status').textContent = 'No compiled program'; return; }
    $('map-status').textContent = 'Laying out program…';$('play').disabled=true;
    const current = graph;
    layoutWorker = new Worker(new URL('./layout-worker.mjs', import.meta.url), { type: 'module' });
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
      factory?.load(data.layout,graph,recording.events,recording.source,recording.parsing,executed&&!relayout);
      if(parsingMode) {factory?.loadParsing();parsingReplay.render();}
      if((relayout||executed)&&!parsingMode) factory?.finishConstruction();
      if(relayout&&parsingMode) factory?.view();
      $('factory').dataset.layoutAspect=String(data.layout.placement.targetAspect);
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
      render();
      factory?.starfield?.setCapturing(false);
      if(runAfterLayout){runAfterLayout=false;startReplay();}
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
$('zoom-fit').onclick = () => { if(viewMode==='3d') return factory?.view(); zoom = 1; setZoom(); };
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
  if (selected) {
    document.getElementById(selected.id)?.classList.add('selected');
  }
}

function selectBlock(id) { if(id){$('inspector-panel').hidden=false;$('toggle-inspector').setAttribute('aria-expanded','true');} selectedBlock=id; renderMapState(); }
function changeView(mode) {
  if(mode==='map'&&parsingMode) showExecution();
  viewMode=mode; $('factory').hidden=mode!=='3d'; $('map').hidden=mode!=='map'; $('scene-hint').hidden=mode!=='3d';
  for(const id of ['camera-iso','camera-top']) $(id).disabled=mode!=='3d';
  if(mode==='3d') factory?.resize();
}
$('camera-iso').onclick=()=>factory?.setCameraMode('3d'); $('camera-top').onclick=()=>factory?.setCameraMode('2d');
function seekInstruction(blockId,offset) {
  const block=graph.blocks.find(b=>b.id===blockId);
  const visits=recording.events.filter(e=>e.kind==='opcode'&&e.code===block.code&&e.offset===offset);
  const visit=visits.find(e=>e.seq>index)??visits[0];
  if(visit) { stopPlayback(); move(visit.seq); }
}
function previewSource() { paintPython($('source-highlight'),$('source').value+'\n'); if(!recording&&!worker) factory?.load(null,null,[],$('source').value,null,true); }
let previewTimer;
$('source').addEventListener('input',()=>{ ++exampleRequest;$('example').value='custom';$('run').disabled=operation==='compile'; paintPython($('source-highlight'),$('source').value+'\n'); if(recording)render(); clearTimeout(previewTimer); previewTimer=setTimeout(previewSource,180); });
function setEditorOpen(open) {
  if(!open&&!$('editor-panel').hidden&&$('source').value!==appliedSource){
    resetProgram();previewSource();
  }
  $('editor-panel').hidden=!open;
  $('toggle-editor').setAttribute('aria-expanded',String(open));
  if(open)$('source').focus();else $('toggle-editor').focus();
}
$('toggle-editor').onclick=()=>setEditorOpen($('editor-panel').hidden);
$('close-editor').onclick=()=>setEditorOpen(false);
$('editor-panel').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();setEditorOpen(false);}
});
$('toggle-inspector').onclick=()=>{
  const panel=$('inspector-panel');panel.hidden=!panel.hidden;
  $('toggle-inspector').setAttribute('aria-expanded',String(!panel.hidden));
};
function updateToolbarBounds(){
  const program=document.querySelector('.program-toolbar').getBoundingClientRect();
  const playback=document.querySelector('.playback-controls').getBoundingClientRect();
  const style=document.documentElement.style;
  style.setProperty('--program-toolbar-bottom',`${program.bottom+10}px`);
  style.setProperty('--playback-bottom',`${playback.bottom+10}px`);
  style.setProperty('--playback-height',`${playback.height}px`);
  style.setProperty('--playback-width',`${playback.width}px`);
}
const toolbarObserver=new ResizeObserver(updateToolbarBounds);
toolbarObserver.observe(document.querySelector('.program-toolbar'));
toolbarObserver.observe(document.querySelector('.playback-controls'));
window.addEventListener('resize',updateToolbarBounds);


try { factory=new Factory($('factory'),selectBlock,seekInstruction,seekSourceLine); parsingReplay=new ParsingReplay(factory); previewSource(); factory.view(); }
catch(error) { $('toggle-minimap').disabled=true;$('toggle-minimap').setAttribute('aria-pressed','false'); $('scene-hint').textContent=`3D unavailable: ${error.message}. The schematic is available.`; changeView('map'); $('message').textContent='3D graphics unavailable; using the schematic.'; }
window.addEventListener('pagehide',event=>{ if(!event.persisted) factory?.dispose(); });

window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    if(recording?.codes.length && Math.abs(windowAspect()-(layoutAspect || 0))>.01) buildMap(true);
    else if(!recording&&!worker) factory?.view();
  },250);
});

function setParsingUI(active) {
  $('parse-panel').hidden=!active;
  $('map-status').hidden=active;
  document.querySelector('.playback-controls').hidden=active;
  factory?.showOpcodes(!active);
}
function showExecution() {
  parsingReplay?.stop();parsingMode=false;setParsingUI(false);
  if(!recording) factory?.load(null,null,[],$('source').value,null,true);
  factory?.finishConstruction();renderMapState();
}


$('source').addEventListener('scroll',()=>{ $('source-highlight').scrollTop=$('source').scrollTop; $('source-highlight').scrollLeft=$('source').scrollLeft; });
paintPython($('source-highlight'),$('source').value+'\n');
