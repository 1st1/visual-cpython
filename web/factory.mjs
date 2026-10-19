import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { factoryFootprint, sourceFootprint } from './placement.mjs';
import { stackView } from './stack.mjs';
import { instructionText, instructionGrid } from './opcodes.mjs';

const colors = { base: 0x151e1d, block: 0x263633, rim: 0x546c63, active: 0xb9e878, selected: 0xe7cf89, error: 0xff926b };
function release(group) {
  group.traverse(o => {
    o.geometry?.dispose();
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materials) { m.map?.dispose(); m.dispose(); }
  });
  group.clear();
}
function box(parent, x, y, z, w, h, d, color = colors.block) {
  const geometry = new THREE.BoxGeometry(w,h,d);
  const material = new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: .12 });
  const mesh = new THREE.Mesh(geometry,material); mesh.position.set(x,y,z); parent.add(mesh);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: colors.rim, transparent: true, opacity: .7 }));
  mesh.add(outline);
  return mesh;
}
function label(parent, x, y, z, width, depth, lines, accent = '#c8d9d0', front = false) {
  const canvas = document.createElement('canvas'); canvas.width=768; canvas.height=192;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width,depth),material);
  plane.rotation.x=front?0:-Math.PI/2; plane.position.set(x,y,z); parent.add(plane);
  let previous;
  const paint = values => {
    const signature=JSON.stringify(values); if(signature===previous) return; previous=signature;
    const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,768,192); ctx.textAlign='center'; ctx.textBaseline='middle';
    values.slice(0,3).forEach((line,i) => { ctx.fillStyle=i===0?accent:'#a2b9ad'; ctx.font=`${i===0?'600':'400'} ${values.length===1?80:64}px monospace`; ctx.fillText(String(line),384,(i+.5)*192/values.length,730); });
    texture.needsUpdate=true;
  };
  paint(lines);
  return paint;
}

function opcodeTile(parent, width, depth, y, instruction, anisotropy) {
  const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=Math.round(1024*depth/width);
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=anisotropy;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({map:texture,polygonOffset:true,polygonOffsetFactor:-1}));
  mesh.rotation.x=-Math.PI/2; mesh.position.y=y; parent.add(mesh);
  let last;
  return active=>{
    if(last===active) return; last=active;
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    const argument=instruction.argrepr || (instruction.arg===null?'':String(instruction.arg));
    const lines=[`@${instruction.offset}`, ...instruction.opname.match(/.{1,22}/g), ...(argument?[argument]:[])];
    const row=h/lines.length,font=Math.floor(row*.69);
    ctx.fillStyle=active?'#b7e77f':'#102018';ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';
    lines.forEach((line,i)=>{
      ctx.fillStyle=active?'#0a160c':i===0?'#9bb6a6':'#f0f7f1';
      ctx.font=`500 ${i===0?Math.floor(font*.8):font}px monospace`;
      let text=line;
      while(ctx.measureText(text).width>w-40&&text.length) text=text.slice(0,-1);
      if(text!==line) text=text.slice(0,-1)+'…';
      ctx.fillText(text,20,row*(i+.5));
    });
    texture.needsUpdate=true;
  };
}

function sourceTile(parent,width,depth,line,text,anisotropy) {
  const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=128;
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=anisotropy;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({map:texture}));
  mesh.rotation.x=-Math.PI/2; mesh.position.y=.32; parent.add(mesh);
  let previous;
  return active=>{
    if(previous===active) return; previous=active;
    const ctx=canvas.getContext('2d'); ctx.fillStyle=active?'#b7e77f':'#16232c';ctx.fillRect(0,0,1024,128);
    ctx.fillStyle=active?'#102018':'#dae9f4';ctx.font='28px monospace';ctx.textBaseline='middle';
    let value=`${String(line).padStart(3)}  ${text || '·'}`;
    while(ctx.measureText(value).width>984) value=value.slice(0,-2)+'…';
    ctx.fillText(value,20,64);texture.needsUpdate=true;
  };
}

export class Factory {
  constructor(host, onSelect, onInstruction) {
    this.host=host; this.onSelect=onSelect; this.nodes=new Map(); this.edges=new Map(); this.pickables=[];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x0d1413);
    this.renderer=new THREE.WebGLRenderer({ antialias:true, alpha:false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label','Interactive CPython factory. Drag to orbit, right-drag to pan, scroll to zoom. Select blocks with the block menu.');
    this.renderer.domElement.setAttribute('role','img');
    this.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); host.dataset.error='Graphics context lost; use Schematic or reload.'; });
    host.append(this.renderer.domElement);
    this.labels=document.createElement('div'); this.labels.className='scene-labels'; host.append(this.labels);
    this.annotations=[];
    this.onInstruction=onInstruction;
    this.opcodePanel=document.createElement('section'); this.opcodePanel.className='opcode-panel';
    this.opcodePanel.innerHTML='<div class="opcode-heading"><strong>Opcodes</strong><button type="button">Follow execution</button></div><div class="opcode-caption"></div><div class="opcode-list"></div>';
    host.append(this.opcodePanel);
    this.opcodePanel.querySelector('button').onclick=()=>this.onSelect('');
    this.camera=new THREE.OrthographicCamera(-15,15,12,-12,.1,500);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true; this.controls.dampingFactor=.12;
    this.controls.maxPolarAngle=Math.PI*.48; this.controls.minZoom=.3; this.controls.maxZoom=12;
    this.scene.add(new THREE.HemisphereLight(0xc9e2d7,0x19201d,2.2));
    const sun=new THREE.DirectionalLight(0xe4efdf,3); sun.position.set(-12,25,15); this.scene.add(sun);
    this.world=new THREE.Group(); this.scene.add(this.world);
    this.raycaster=new THREE.Raycaster(); this.pointer=new THREE.Vector2();
    let down;
    this.renderer.domElement.addEventListener('pointerdown',e=>{ down=[e.clientX,e.clientY]; });
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if (!down || Math.hypot(e.clientX-down[0],e.clientY-down[1])>5 || e.button!==0) return;
      const r=host.getBoundingClientRect(); this.pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
      this.raycaster.setFromCamera(this.pointer,this.camera);
      const hit=this.raycaster.intersectObjects(this.pickables,false)[0];
      if(hit) { this.onSelect(hit.object.userData.block); if(hit.object.userData.offset!==undefined) this.onInstruction(hit.object.userData.block,hit.object.userData.offset); }
    });
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(host);
    this.load(null,null);
    this.renderer.setAnimationLoop(now=>{
      if (document.hidden || !host.clientWidth || host.hidden) return;
      this.controls.update();
      if (this.revealStart) {
        let complete=true, latest=null;
        const delay=Math.min(100,3500/Math.max(1,this.revealTiles.length));
        this.revealTiles.forEach((tile,i)=>{
          const t=this.reduced.matches?1:Math.min(1,Math.max(0,(now-this.revealStart-i*delay)/240));
          tile.group.visible=t>0; tile.group.scale.y=Math.max(.001,t);
          if(t>0) latest=tile; if(t<1) complete=false;
        });
        this.host.dataset.revealedOpcodes=String(this.revealTiles.filter(t=>t.group.visible).length);
        if(latest) this.highlightSource(latest.instruction.line,latest.position);
        if(complete) this.finishConstruction();
      }
      if(this.pulse && this.pulsePath) {
        const t=Math.min(1,(now-this.pulseStart)/450);
        this.pulse.visible=!this.reduced.matches && t<1;
        this.pulse.position.copy(this.pulsePath.getPointAt(t));
      }
      this.renderer.render(this.scene,this.camera);
      this.placeLabels();
      host.dataset.rendered='true';
    });
  }
  load(layout, graph, events = [], source = '') {
    release(this.world); this.nodes.clear(); this.edges.clear(); this.pickables=[]; this.lastSeq=null; this.pulsePath=null;
    this.labels.replaceChildren(); this.annotations=[];
    this.graph=graph; this.panelBlock=null; this.replaySource=null;this.replayTile=null;
    this.instructionVisits=new Map();
    for(const event of events) if(event.kind==='opcode') {
      const key=`${event.code}:${event.offset}`; this.instructionVisits.set(key,(this.instructionVisits.get(key)||0)+1);
    }
    this.opcodePanel.querySelector('.opcode-list').replaceChildren();
    this.opcodePanel.querySelector('.opcode-caption').textContent='Run a program to inspect its bytecode.';
    const footprint=factoryFootprint(layout), w=footprint.width, d=footprint.depth;
    this.sourceLines=source.split('\n');
    const sourceBounds=sourceFootprint(layout,this.sourceLines.length);
    const {rows,sourceWidth,sourceDepth}=sourceBounds;
    this.sourceOrigin=new THREE.Vector3(sourceBounds.sourceX,0,0);
    this.extent=sourceBounds;
    const e=this.extent, width=e.maxX-e.minX, depth=e.maxZ-e.minZ;
    box(this.world,(e.minX+e.maxX)/2,-.22,(e.minZ+e.maxZ)/2,width,.42,depth,0x131d1a);
    const gridPoints=[];
    for(let x=Math.ceil(e.minX);x<=e.maxX;x++) gridPoints.push(x,.005,e.minZ,x,.005,e.maxZ);
    for(let z=Math.ceil(e.minZ);z<=e.maxZ;z++) gridPoints.push(e.minX,.005,z,e.maxX,.005,z);
    this.world.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3)),new THREE.LineBasicMaterial({color:0x25372f})));
    this.serviceX=footprint.serviceX;
    const machine=(name,sub,z,x=this.serviceX) => {
      const group=new THREE.Group(); this.world.add(group);
      const body=box(group,x,.56,z,3.5,1.05,1.65,0x26312e);
      box(group,x,.12,z,3.8,.22,1.95,0x1b2521);
      for(let i=0;i<7;i++) box(group,x-1.35+i*.21,.4,z+.84,.06,.45,.025,0x3d5247);
      const paint=label(group,x,1.095,z,3.15,1.15,[name,sub]);
      this.annotate(name,new THREE.Vector3(x,1.2,z),'machine');
      return {body,paint};
    };
    machine('PARSER','source → syntax',-d/2-1.75,-2);
    machine('COMPILER','syntax → bytecode',-d/2-1.75,2);
    this.evaluator=machine('EVALUATOR','waiting',-d/2+1);
    this.frameDisplay=machine('FRAMES','0 activations',-d/2+3.5);
    this.stackOrigin=new THREE.Vector3(this.serviceX,0,footprint.stackZ);
    this.stackGroup=new THREE.Group(); this.stackGroup.position.copy(this.stackOrigin); this.world.add(this.stackGroup);
    box(this.stackGroup,0,.12,0,3.8,.24,2.3,0x1e2e28);
    // An open rack keeps every visible slot's front face readable.
    for(const x of [-1.65,1.65]) box(this.stackGroup,x,1.95,-.83,.09,3.6,.09,0x547263);
    this.stackPaint=label(this.stackGroup,0,.26,.86,3.5,.48,['OPERAND STACK'],'#bdd5c5');
    this.stackSlots=Array.from({length:8},(_,i)=>{
      const group=new THREE.Group(); group.position.y=.48+i*.43; this.stackGroup.add(group);
      const tile=box(group,0,0,0,3.05,.32,1.6,0x304735);
      const paint=label(group,0,0,.807,2.9,.27,[''],'#e1eddf',true);
      group.visible=false; return {group,tile,paint};
    });
    this.stackLabel=this.annotate('OPERAND STACK · not sampled',this.stackOrigin.clone().add(new THREE.Vector3(0,4.1,0)),'stack');
    this.stackTop=this.annotate('',this.stackOrigin.clone(),'stack');
    this.sourceTiles=[];this.sourceHighlight=null;
    box(this.world,this.sourceOrigin.x,.08,0,sourceWidth,.15,sourceDepth,0x1a2630);
    this.annotate('01 / SOURCE · parsing quadrant',this.sourceOrigin.clone().add(new THREE.Vector3(0,.5,-sourceDepth/2)),'enclosure');
    this.annotate('02 / BYTECODE · opcode quadrant',new THREE.Vector3(0,.5,-d/2-.5),'enclosure');
    this.sourceLines.forEach((text,i)=>{
      const group=new THREE.Group(); group.position.set(this.sourceOrigin.x-sourceWidth/2+.6+4.1+Math.floor(i/rows)*8.7,0,-sourceDepth/2+1.2+(i%rows)*1.15);this.world.add(group);
      const body=box(group,0,.18,0,8.2,.26,1.025,0x293947);
      const paint=sourceTile(group,8.1,1.0125,i+1,text,this.renderer.capabilities.getMaxAnisotropy());paint(false);
      this.sourceTiles.push({group,body,paint,line:i+1});
    });
    this.host.dataset.sourceTiles=String(this.sourceTiles.length);
    this.host.dataset.activeSource='';
    if(!layout) label(this.world,0,.03,0,9,2,['PROGRAM PLOT','Run a program to construct its blocks']);
    for(const enclosure of layout?.enclosures || []) {
      box(this.world,enclosure.x,.085,enclosure.y,enclosure.width,.15,enclosure.height,0x1b2922);
      label(this.world,enclosure.x,.17,enclosure.y-enclosure.height/2+.25,Math.min(enclosure.width-.3,4),.42,[`${enclosure.name} / ${enclosure.id}`],'#acbeac');
      this.annotate(`${enclosure.name} / ${enclosure.id}`,new THREE.Vector3(enclosure.x,.5,enclosure.y-enclosure.height/2),'enclosure');
    }
    for(const route of layout?.edges || []) {
      const vectors=route.points.map(([x,z])=>new THREE.Vector3(x,.24,z));
      const geometry=new THREE.BufferGeometry().setFromPoints(vectors);
      const color=route.kind==='call'?0xa895cf:route.kind==='taken'?0xc4a068:0x658775;
      const material=route.kind==='call'?new THREE.LineDashedMaterial({color,dashSize:.15,gapSize:.12}):new THREE.LineBasicMaterial({color});
      const line=new THREE.Line(geometry,material); line.computeLineDistances(); this.world.add(line);
      const path=new THREE.CurvePath();
      for(let i=1;i<vectors.length;i++) path.add(new THREE.LineCurve3(vectors[i-1],vectors[i]));
      if(route.kind!=='call') {
        const belt=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(4,vectors.length*3),.035,4,false),new THREE.MeshBasicMaterial({color}));
        line.add(belt);
      }
      const end=vectors.at(-1), prev=vectors.at(-2), direction=end.clone().sub(prev).normalize();
      const arrow=new THREE.ArrowHelper(direction,end.clone().addScaledVector(direction,-.18),.18,color,.16,.13); this.world.add(arrow);
      this.edges.set(route.id,{line,arrow,path,color});
    }
    this.instructionTiles=new Map();
    for(const placed of layout?.nodes || []) {
      const block=graph.blocks.find(b=>b.id===placed.id);
      const group=new THREE.Group(); group.position.set(placed.x,0,placed.y); this.world.add(group);
      const tray=box(group,0,.19,0,placed.width,.20,placed.height,0x1b2b22);
      tray.userData.block=block.id; this.pickables.push(tray);
      label(group,0,.3,-placed.height/2+.24,Math.min(placed.width-.2,4),.35,[block.id]);
      const grid=instructionGrid(block.instructions,layout.placement?.selected.compact ?? true);
      const tiles=[];
      for(const entry of grid.tiles) {
        const tileGroup=new THREE.Group(); tileGroup.position.set(entry.x,0,entry.y);group.add(tileGroup);
        const body=box(tileGroup,0,.49,0,entry.width,.38,entry.height);
        body.userData={block:block.id,offset:entry.instruction.offset};this.pickables.push(body);
        const paint=opcodeTile(tileGroup,entry.width-.08,entry.height-.08,.69,entry.instruction,this.renderer.capabilities.getMaxAnisotropy());paint(false);
        const tile={...entry,group:tileGroup,body,paint,position:new THREE.Vector3(placed.x+entry.x,.8,placed.y+entry.y)};tiles.push(tile);
        this.instructionTiles.set(`${block.code}:${entry.instruction.offset}`,tile);
      }
      for(let i=1;i<tiles.length;i++) {
        const a=tiles[i-1],b=tiles[i],direction=new THREE.Vector3(b.x-a.x,0,b.y-a.y).normalize();
        const length=Math.hypot(b.x-a.x,b.y-a.y),edge=Math.abs(direction.x)>.5?a.width/2:a.height/2;
        const start=new THREE.Vector3(a.x,.32,a.y).addScaledVector(direction,edge);
        const arrow=new THREE.ArrowHelper(direction,start,Math.max(.01,length-2*edge),0x88a895,.12,.1);group.add(arrow);
      }
      this.nodes.set(block.id,{group,body:tray,roof:tray,height:.3,tiles});
    }
    this.pulse=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),new THREE.MeshBasicMaterial({color:colors.active})); this.world.add(this.pulse); this.pulse.visible=false;
    this.activeLabel=this.annotate('',new THREE.Vector3(),'active');
    this.host.dataset.opcodeTiles=String(this.instructionTiles.size);
    this.host.dataset.blocks=String(this.nodes.size); this.host.dataset.edges=String(this.edges.size);
    this.revealTiles=[...this.instructionTiles.values()].sort((a,b)=>(a.instruction.line??0)-(b.instruction.line??0)||a.instruction.offset-b.instruction.offset);
    this.revealStart=layout&&!this.reduced.matches?performance.now():0;
    if(this.revealStart) for(const tile of this.revealTiles) tile.group.visible=false;
    this.host.dataset.revealedOpcodes=String(this.revealStart?0:this.revealTiles.length);
    this.host.dataset.phase=this.revealStart?'compilation reveal':layout?'replay':'source';
    this.link=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0xa6cef3,dashSize:.18,gapSize:.13}));
    this.world.add(this.link);this.link.visible=false;
    this.view('iso');
  }
  setState(state,event,selected,terminal=false) {
    this.replaySource=event?.kind==='opcode'&&!terminal?event.line:null;
    this.replayTile=event?.kind==='opcode'&&!terminal?this.instructionTiles.get(`${event.code}:${event.offset}`):null;
    if(!this.revealStart) this.highlightSource(this.replaySource,this.replayTile?.position);
    for(const [id,node] of this.nodes) {
      const active=id===state?.block, chosen=id===selected;
      const color=active?(state.kind==='exception'||state.kind==='unwind'?colors.error:colors.active):chosen?colors.selected:colors.rim;
      node.body.material.color.setHex(chosen?0x3c3825:active?0x2c402b:0x1b2b22);
      node.body.children[0].material.color.setHex(color);
      for(const tile of node.tiles) {
        const executing=active&&event?.kind==='opcode'&&!terminal&&tile.instruction.offset===event.offset;
        tile.paint(executing); tile.body.material.color.setHex(executing?0x58743b:colors.block);
        tile.body.children[0].material.color.setHex(executing?colors.active:colors.rim);
      }
    }
    for(const [id,edge] of this.edges) {
      const color=id===state?.edge?colors.active:edge.color;
      edge.line.material.color.setHex(color); edge.arrow.setColor(color);
      for(const child of edge.line.children) child.material.color.setHex(color);
    }
    this.host.dataset.activeBlock=state?.block || ''; this.host.dataset.selectedBlock=selected || '';
    this.evaluator.body.material.color.setHex(event?.kind==='opcode'&&!terminal?0x3c5030:0x26312e);
    this.evaluator.paint(['EVALUATOR',terminal?'recording ended':event?`${event.kind} · @${event.offset}`:'waiting']);
    this.frameDisplay.paint(['FRAMES',state?`${state.frames.length} active · ${event.frame}`:'0 activations']);
    const stack=stackView(event);
    this.host.dataset.stack=JSON.stringify(stack);
    this.stackSlots.forEach((slot,i)=>{
      const value=stack.slots[i]; slot.group.visible=Boolean(value);
      if(!value) return;
      const top=i===stack.slots.length-1;
      slot.tile.material.color.setHex(value.kind==='null'?0x514364:top?0x526f37:0x304735);
      slot.tile.children[0].material.color.setHex(top?colors.active:colors.rim);
      slot.paint([`${top?'TOP':'#'+value.index}  ${value.text}`]);
    });
    this.stackPaint([stack.hidden?`+${stack.hidden} lower slots hidden`:'OPERAND STACK']);
    this.stackLabel.element.textContent=`STACK${stack.frame?' / '+stack.frame:''} · ${stack.sampled?stack.total+' slots':'not sampled'}`;
    this.stackTop.element.textContent=stack.sampled?(stack.total?`TOP · ${stack.slots.at(-1).text}`:'EMPTY'):'';
    this.stackTop.position.copy(this.stackOrigin).add(new THREE.Vector3(0,stack.slots.length? .48+(stack.slots.length-1)*.43+.2:.4,.9));
    const active=this.nodes.get(state?.block);
    const instruction=this.graph?.blocks.find(b=>b.id===state?.block)?.instructions.find(i=>i.offset===event?.offset);
    this.activeLabel.element.textContent=state?`${state.block} · ${event?.kind==='opcode'&&!terminal?instruction?.opname:event?.kind || ''}${terminal?' · end':''}`:'';
    this.currentOpcode=event?.kind==='opcode'?`${event.code}:${event.offset}`:null;
    this.host.dataset.activeOpcode=event?.kind==='opcode'&&!terminal?`${event.code}:${event.offset}`:'';
    this.updateOpcodePanel(selected || state?.block,event,terminal,Boolean(selected));
    if(active) {
      const tile=this.instructionTiles.get(`${event?.code}:${event?.offset}`);
      this.activeLabel.position.copy(active.group.position).add(new THREE.Vector3(tile?.x || 0,.8,tile?.y || 0));
    }
    if(event?.seq!==this.lastSeq) {
      if(this.lastSeq!==null) this.finishConstruction();
      this.lastSeq=event?.seq;
      this.pulsePath=this.edges.get(state?.edge)?.path || null;
      this.pulseStart=performance.now(); this.pulse.visible=false;
    }
  }
  updateOpcodePanel(blockId,event,terminal,pinned) {
    const block=this.graph?.blocks.find(b=>b.id===blockId); if(!block) return;
    const list=this.opcodePanel.querySelector('.opcode-list');
    if(this.panelBlock!==block.id) {
      this.panelBlock=block.id;
      list.replaceChildren(...block.instructions.map(ins=>{
        const button=document.createElement('button'); button.type='button'; button.dataset.offset=ins.offset;
        const visits=this.instructionVisits.get(`${block.code}:${ins.offset}`)||0;
        button.textContent=instructionText(ins); button.disabled=!visits;
        button.title=visits?`${visits} recorded visits. Jump to next visit.`:'Not executed in this recording.';
        button.onclick=()=>this.onInstruction(block.id,ins.offset);
        return button;
      }));
    }
    const code=this.graph.codes.find(c=>c.id===block.code);
    this.opcodePanel.querySelector('.opcode-caption').textContent=`${pinned?'Pinned':'Following'} · ${code.name} / ${block.id} · ${block.instructions.length} instructions`;
    for(const button of list.children) button.classList.toggle('current',event?.kind==='opcode'&&!terminal&&event.code===block.code&&Number(button.dataset.offset)===event.offset);
    const current=list.querySelector('.current');
    if(current) {
      const y=current.offsetTop-list.offsetTop;
      if(y<list.scrollTop||y+current.offsetHeight>list.scrollTop+list.clientHeight) list.scrollTop=y-list.clientHeight/2;
    }
  }
  showOpcodes(show) { this.opcodePanel.hidden=!show; }
  annotate(text,position,kind) {
    const element=document.createElement('div'); element.className=`scene-label ${kind}`; element.textContent=text; this.labels.append(element);
    const annotation={element,position,kind}; this.annotations.push(annotation); return annotation;
  }
  placeLabels() {
    const width=this.host.clientWidth,height=this.host.clientHeight,placed=[];
    const priority={active:0,stack:1,enclosure:2,machine:3};
    const ordered=[...this.annotations].sort((a,b)=>priority[a.kind]-priority[b.kind]);
    for(const {element,position} of ordered) {
      const p=position.clone().project(this.camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2-12;
      element.style.left=`${x}px`; element.style.top=`${y}px`; element.hidden=false;
      const w=element.offsetWidth,h=element.offsetHeight;
      const r={x:x-w/2,y:y-h,w,h};
      const collision=placed.some(a=>r.x<a.x+a.w+4&&r.x+r.w+4>a.x&&r.y<a.y+a.h+3&&r.y+r.h+3>a.y);
      element.hidden=!element.textContent||Math.abs(p.z)>1||r.x<0||r.y<0||r.x+w>width||r.y+h>height||collision;
      if(!element.hidden) placed.push(r);
    }
  }
  highlightSource(line,target) {
    const signature=`${line}:${target?.x}:${target?.z}`;
    if(signature===this.sourceHighlight) return;
    this.sourceHighlight=signature;
    for(const tile of this.sourceTiles) {
      const active=tile.line===line; tile.paint(active);
      tile.body.material.color.setHex(active?0x58743b:0x293947);
    }
    const source=this.sourceTiles.find(t=>t.line===line);
    this.host.dataset.activeSource=source?String(line):'';
    if(this.link) {
      this.link.visible=Boolean(source&&target);
      if(this.link.visible) {
        const start=source.group.position.clone().add(new THREE.Vector3(4.1,.5,0));
        const mid=start.clone().lerp(target,.5);mid.y=3;
        const curve=new THREE.QuadraticBezierCurve3(start,mid,target);
        this.link.geometry.dispose();this.link.geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));this.link.computeLineDistances();
      }
    }
  }
  finishConstruction() {
    this.revealStart=0;
    for(const tile of this.revealTiles || []) { tile.group.visible=true;tile.group.scale.y=1; }
    this.host.dataset.revealedOpcodes=String(this.revealTiles?.length || 0);
    this.host.dataset.phase=this.graph?'replay':'source';
    this.highlightSource(this.replaySource,this.replayTile?.position);
  }
  focusSource() {
    const target=this.sourceOrigin.clone();
    this.camera.position.copy(target).add(new THREE.Vector3(0,30,.001));this.controls.target.copy(target);
    const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
    const rows=Math.min(24,this.sourceLines.length),columns=Math.ceil(this.sourceLines.length/rows);
    this.camera.zoom=THREE.MathUtils.clamp(this.viewSize/Math.max(rows*1.15+3,(columns*8.7+3)/aspect),.3,12);
    this.camera.updateProjectionMatrix();this.controls.update();
  }
  resize() {
    const width=this.host.clientWidth,height=this.host.clientHeight;
    if(!width||!height) return;
    this.renderer.setSize(width,height,false); this.updateProjection();
  }
  updateProjection() {
    const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
    const size=this.viewSize || 24;
    this.camera.left=-size*aspect/2; this.camera.right=size*aspect/2; this.camera.top=size/2; this.camera.bottom=-size/2;
    this.camera.updateProjectionMatrix();
  }
  view(mode) {
    const e=this.extent, center=new THREE.Vector3((e.minX+e.maxX)/2,0,(e.minZ+e.maxZ)/2);
    const span=Math.max(e.maxX-e.minX,e.maxZ-e.minZ);
    this.camera.position.copy(center).add(mode==='top'?new THREE.Vector3(0,span*2,.001):new THREE.Vector3(span*.35,span*1.1,span));
    this.controls.target.copy(center); this.camera.zoom=1;
    this.camera.lookAt(center); this.controls.update();
    // Fit projected world corners, including building height, with margin.
    this.camera.updateMatrixWorld();
    const points=[];
    for(const x of [e.minX,e.maxX]) for(const z of [e.minZ,e.maxZ]) for(const y of [0,1.6]) points.push(new THREE.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse));
    points.push(this.stackOrigin.clone().add(new THREE.Vector3(0,4.6,0)).applyMatrix4(this.camera.matrixWorldInverse));
    const width=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
    const height=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
    const aspect=(this.host.clientWidth||900)/(this.host.clientHeight||600);
    this.viewSize=Math.max(height,width/aspect)*1.12;
    this.resize();
  }
  zoom(factor) { this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*factor,.3,12); this.camera.updateProjectionMatrix(); }
  focusStack() {
    const target=this.stackOrigin.clone().add(new THREE.Vector3(0,1.8,0));
    this.camera.position.copy(target).add(new THREE.Vector3(4,4.8,8)); this.controls.target.copy(target);
    this.camera.zoom=THREE.MathUtils.clamp(this.viewSize/7,.3,6); this.camera.updateProjectionMatrix(); this.controls.update();
  }
  focus(id) {
    const node=this.nodes.get(id); if(!node) return;
    const tile=node.tiles.find(t=>`${this.graph.blocks.find(b=>b.id===id).code}:${t.instruction.offset}`===this.currentOpcode) || node.tiles[0];
    const target=node.group.position.clone().add(new THREE.Vector3(tile.x,.7,tile.y));
    this.camera.position.copy(target).add(new THREE.Vector3(0,12,.001)); this.controls.target.copy(target);
    const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
    const size={width:tile.width,depth:tile.height};
    const span=Math.max(size.depth+1.2,(size.width+1.4)/aspect);
    this.camera.zoom=THREE.MathUtils.clamp(this.viewSize/span,1,12); this.camera.updateProjectionMatrix(); this.controls.update();
  }
  dispose() { this.resizeObserver.disconnect(); this.renderer.setAnimationLoop(null); this.controls.dispose(); release(this.world); this.renderer.dispose(); this.renderer.domElement.remove(); this.labels.remove(); this.opcodePanel.remove(); }
}
