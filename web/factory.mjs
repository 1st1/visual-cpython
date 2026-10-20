import {codeObjectTitle} from './graph.mjs';
import {BackgroundBlur} from './background-blur.mjs';
import {frostSurface} from './frosted-surface.mjs';
import {pipelineChevrons} from './pipeline-chevrons.mjs';
import {createGrid} from './grid.mjs';
import {OpcodeTrail} from './opcode-trail.mjs';
import {connector} from './connector.mjs';
import {TileRouter} from './tile-routing.mjs';
import {surfaceText,measureSurfaceText,textAtlasStats,disposeTextAtlas} from './text-atlas.mjs';
import {Starfield} from './starfield.mjs';
import {syntaxLines,syntaxColors} from './python-syntax.mjs';
import {Minimap} from './minimap.mjs';
import {parsingFrames} from './parsing.mjs';
import {astTreeLayout,tokensForConstruction,instructionAst} from './ast-tree.mjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { factoryFootprint, sourceFootprint } from './placement.mjs';
import { instructionText, instructionGrid } from './opcodes.mjs';

const SOURCE_FONT_SIZE=1.0125*.28;
const colors = { base: 0x141124, block: 0x24203c, rim: 0x649cae, active: 0xc92359, selected: 0xe7cf89, error: 0xff926b };
function release(group) {
  group.traverse(o => {
    o.geometry?.dispose();
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materials) {
      if(m.map){const canvas=m.map.image;m.map.dispose();if(canvas instanceof HTMLCanvasElement){canvas.width=1;canvas.height=1;}}
      m.dispose();
    }
  });
  group.clear();
}
function box(parent, x, y, z, w, h, d, color = colors.block) {
  let geometry;
  if(w>1&&d>.7&&h>.2){
    const r=Math.min(.055,h*.15),shape=new THREE.Shape();
    shape.moveTo(r,r);shape.lineTo(w-r,r);shape.lineTo(w-r,d-r);shape.lineTo(r,d-r);shape.closePath();
    geometry=new THREE.ExtrudeGeometry(shape,{depth:h-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:1,steps:1,curveSegments:1});
    geometry.rotateX(-Math.PI/2);geometry.translate(-w/2,-h/2+r,d/2);
  }else geometry=new THREE.BoxGeometry(w,h,d);
  // Thin every plate from below, preserving top surfaces and label clearances.
  geometry.scale(1,.7,1);geometry.translate(0,h*.15,0);
  const material = new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: .12 });
  const mesh = new THREE.Mesh(geometry,material); mesh.position.set(x,y,z); mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: colors.rim, transparent: true, opacity: .18 }));
  mesh.add(outline);
  return mesh;
}
function label(parent,x,y,z,width,depth,lines,accent='#65d4df',front=false) {
  const update=surfaceText(parent,x,y,z,width,depth,{front});let previous;
  const paint=values=>{
    const signature=JSON.stringify(values);if(signature===previous)return;previous=signature;
    update(values.slice(0,3).map((text,i)=>({text:String(text),color:i===0?accent:'#9c8fc5',align:'center'})));
  };
  paint(lines);return paint;
}
function opcodeTile(parent,width,depth,y,instruction,background='#30206a') {
  const update=surfaceText(parent,0,y,0,width,depth,{background});let previous;
  return active=>{
    if(previous===active)return;previous=active;
    const argument=instruction.argrepr || (instruction.arg===null?'':String(instruction.arg));
    const lines=[`@${instruction.offset}`,...instruction.opname.match(/.{1,22}/g),...(argument?[argument]:[])];
    update(lines.map((text,i)=>({text,color:active?'#fff0f6':i===0?'#9c8fc5':'#65d4df'})),active?'#c92359':background);
  };
}
function sourceTile(parent,width,depth,line,tokens) {
  const update=surfaceText(parent,0,.32,0,width,depth,{background:'#30206a'});let previous;
  return active=>{
    if(previous===active)return;previous=active;
    update([{size:SOURCE_FONT_SIZE,runs:[{text:String(line).padStart(3)+'  ',color:'#8296b9'},...(tokens || []).map(t=>({text:t.text,color:syntaxColors[t.kind]}))]}],active?'#572042':'#30206a');
  };
}

export class Factory {
  constructor(host, onSelect, onInstruction) {
    this.host=host; this.onSelect=onSelect; this.nodes=new Map(); this.edges=new Map(); this.pickables=[];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.scene=new THREE.Scene(); this.scene.background=null;
    this.renderer=new THREE.WebGLRenderer({ antialias:true, alpha:true });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label','Interactive CPython factory. Drag to orbit, right-drag or scroll to pan, pinch to zoom. Select blocks with the block menu.');
    this.renderer.domElement.setAttribute('role','img');
    this.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); host.dataset.error='Graphics context lost; use Schematic or reload.'; });
    host.append(this.renderer.domElement);
    this.onInstruction=onInstruction;
    this.opcodePanel=document.createElement('section'); this.opcodePanel.className='opcode-panel';
    this.opcodePanel.innerHTML='<div class="opcode-heading"><strong>Opcodes</strong><button type="button">Follow execution</button></div><div class="opcode-caption"></div><div class="opcode-list"></div>';
    document.getElementById('opcode-inspector').append(this.opcodePanel);
    this.opcodePanel.querySelector('button').onclick=()=>this.onSelect('');
    this.camera=new THREE.PerspectiveCamera(38,1,.1,2000);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.mouseButtons.MIDDLE=THREE.MOUSE.PAN;
    this.wheelPan=event=>{
      event.preventDefault();event.stopImmediatePropagation();
      if(!this.controls.enabled) return;
      if(event.ctrlKey) {
        if(!this.safariGesture) this.zoom(Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.01));
        return;
      }
      const unit=event.deltaMode===1?16:event.deltaMode===2?this.host.clientHeight:1;
      const dx=event.shiftKey&&!event.deltaX?event.deltaY:event.deltaX;
      const dy=event.shiftKey&&!event.deltaX?0:event.deltaY;
      this.controls.pan(-dx*unit,-dy*unit);
    };
    this.renderer.domElement.addEventListener('wheel',this.wheelPan,{capture:true,passive:false});
    this.gestureStart=event=>{
      event.preventDefault();event.stopImmediatePropagation();
      this.safariGesture=true;this.gestureScale=Number.isFinite(event.scale)&&event.scale>0?event.scale:1;
    };
    this.gestureChange=event=>{
      event.preventDefault();event.stopImmediatePropagation();
      if(!this.safariGesture||!this.controls.enabled||!Number.isFinite(event.scale)||event.scale<=0)return;
      this.zoom(event.scale/this.gestureScale);this.gestureScale=event.scale;
    };
    this.gestureEnd=event=>{event.preventDefault();event.stopImmediatePropagation();this.safariGesture=false;};
    for(const [name,handler] of [['gesturestart',this.gestureStart],['gesturechange',this.gestureChange],['gestureend',this.gestureEnd]])
      this.renderer.domElement.addEventListener(name,handler,{capture:true,passive:false});
    this.controls.enableDamping=true; this.controls.dampingFactor=.12;
    this.controls.maxPolarAngle=Math.PI*.48; this.controls.minZoom=.3; this.controls.maxZoom=12;
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x28282c,1.25));
    const sun=this.sun=new THREE.DirectionalLight(0xffffff,2.5);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=1.5;sun.shadow.intensity=.45;sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;
    this.scene.add(sun,sun.target);
    this.world=new THREE.Group(); this.scene.add(this.world);
    this.opcodeTrail=new OpcodeTrail(this.scene);
    this.raycaster=new THREE.Raycaster(); this.pointer=new THREE.Vector2();
    let down;
    this.renderer.domElement.addEventListener('pointerdown',e=>{ down=[e.clientX,e.clientY]; });
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if (!down || Math.hypot(e.clientX-down[0],e.clientY-down[1])>5 || e.button!==0) return;
      const r=host.getBoundingClientRect(); this.pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
      this.raycaster.setFromCamera(this.pointer,this.camera);
      const hit=this.raycaster.intersectObjects(this.pickables.filter(object=>{
        for(let parent=object;parent;parent=parent.parent)if(!parent.visible)return false;
        return true;
      }),false)[0];
      if(hit) { this.onSelect(hit.object.userData.block); if(hit.object.userData.offset!==undefined) this.onInstruction(hit.object.userData.block,hit.object.userData.offset); }
    });
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(host);
    this.load(null,null);
    this.minimap=new Minimap(host,this);
    this.starfield=new Starfield(host);
    this.backgroundBlur=new BackgroundBlur();
    this.renderer.setAnimationLoop(now=>{
      if (document.hidden || !host.clientWidth || host.hidden) {this.starfield.pause();return;}
      this.starfield.setConstructing(Boolean(this.revealStart));
      this.starfield.draw(now,host.clientWidth,host.clientHeight,this.reduced.matches);
      this.backgroundBlur.update(this.renderer,this.starfield);
      host.dataset.backgroundBlur=JSON.stringify({width:this.backgroundBlur.canvas.width,height:this.backgroundBlur.canvas.height,updates:this.backgroundBlur.updates});
      this.controls.update();
      this.updateLighting();
      if(!this.revealStart&&this.host.dataset.phase!=='parsing')this.setActiveStage(this.starfield.capturing?1:this.replayStage);
      this.gridUniforms.time.value=this.reduced.matches?0:now*.001;
      this.viewSize=this.camera.position.distanceTo(this.controls.target)*2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
      const skip=document.getElementById('skip-animation');if(skip)skip.hidden=!this.revealStart;
      if (this.revealStart) {
        let complete=true, latest=null;
        const elapsed=now-this.revealStart;
        const frontDelay=this.artifactFrames.length*60+300;
        if(this.artifactFrames.length&&elapsed<frontDelay) {
          const frame=this.artifactFrames[Math.min(this.artifactFrames.length-1,Math.max(0,Math.floor(elapsed/60)))];
          if(this.autoFrame!==frame.seq) {this.autoFrame=frame.seq;this.setParsingState(frame,false);}
        }
        const delay=Math.min(100,3500/Math.max(1,this.revealTiles.length));
        this.revealTiles.forEach((tile,i)=>{
          const t=this.reduced.matches?1:Math.min(1,Math.max(0,(elapsed-frontDelay-i*delay)/240));
          tile.group.visible=t>0; tile.group.scale.y=Math.max(.001,t);
          if(t>0) latest=tile; if(t<1) complete=false;
        });
        this.updateOpcodeVisibility();
        this.host.dataset.revealedOpcodes=String(this.revealTiles.filter(t=>t.group.visible).length);
        if(latest) {this.setActiveStage(23);this.highlightSource(latest.instruction.line,latest.position,'opcodes');}
        if(complete) this.finishConstruction();
      }
      if(this.pulse && this.pulsePath) {
        const t=Math.min(1,(now-this.pulseStart)/450);
        this.pulse.visible=!this.reduced.matches && t<1;
        this.pulse.position.copy(this.pulsePath.getPointAt(t));
      }
      if(this.constructionFlights?.children.length) {
        for(const particle of [...this.constructionFlights.children]) {
          const t=Math.min(1,(now-particle.userData.start)/650);
          particle.position.copy(particle.userData.path.getPoint(t));particle.visible=!this.reduced.matches&&t<1;
          if(t===1) {particle.geometry.dispose();particle.material.dispose();this.constructionFlights.remove(particle);}
        }
      }
      for(const ghost of [...(this.ghosts?.children || [])]) {
        const age=now-ghost.userData.born;
        const fade=this.reduced.matches?1:Math.min(1,Math.max(0,(1600-age)/500));
        ghost.traverse(o=>{if(o.material)o.material.opacity=o.userData.ghostOpacity*fade;});
        if(age>1600) {release(ghost);this.ghosts.remove(ghost);}
      }
      if(this.ghosts)this.host.dataset.ghostCount=String(this.ghosts.children.length);
      this.opcodeTrail.update(now,this.reduced.matches);
      host.dataset.opcodeTrail=String(this.opcodeTrail.mesh.visible);
      this.updateLaneActivity(now);
      this.updatePipelineArrows(now);
      this.starfield.render(this.renderer);
      this.renderer.clearDepth();
      this.renderer.autoClear=false;
      try {this.renderer.render(this.scene,this.camera);} finally {this.renderer.autoClear=true;}
      this.minimap?.draw();
      host.dataset.textAtlas=JSON.stringify(textAtlasStats());
      host.dataset.gpuTextures=String(this.renderer.info.memory.textures);
      host.dataset.gpuGeometries=String(this.renderer.info.memory.geometries);
      host.dataset.rendered='true';host.dataset.zoom=String(this.camera.zoom);
      const fit=this.projectedSize(),pan=this.controls.target.clone().sub(this.mapCenter()).divideScalar(fit);
      host.dataset.framing=JSON.stringify([...this.camera.quaternion.toArray(),...pan.toArray(),this.camera.zoom,this.viewSize/fit]);
      host.dataset.camera=JSON.stringify([...this.camera.position.toArray(),...this.camera.quaternion.toArray(),...this.controls.target.toArray(),this.camera.zoom,this.viewSize]);
    });
  }
  load(layout, graph, events = [], source = '', parsing = null, preserveCamera = false) {
    const previous=preserveCamera&&this.extent?{center:this.mapCenter(),size:this.projectedSize()}:null;
    this.opcodeTrail.clear();this.previousOpcodeTile=null;
    release(this.world); this.nodes.clear(); this.edges.clear(); this.pickables=[]; this.lastSeq=null; this.pulsePath=null;
    this.graph=graph; this.panelBlock=null; this.replaySource=null;this.replayTile=null;
    this.instructionVisits=new Map();
    for(const event of events) if(event.kind==='opcode') {
      const key=`${event.code}:${event.offset}`; this.instructionVisits.set(key,(this.instructionVisits.get(key)||0)+1);
    }
    this.opcodePanel.querySelector('.opcode-list').replaceChildren();
    this.opcodePanel.querySelector('.opcode-caption').textContent='Run a program to inspect its bytecode.';
    const footprint=factoryFootprint(layout), w=footprint.width, d=footprint.depth;
    this.sourceLines=source.split('\n');this.sourceSyntax=syntaxLines(source);
    this.parsing=parsing;this.autoFrame=null;
    this.artifactFrames=parsing?parsingFrames(parsing).frames.filter(f=>f.event.kind===2||f.event.kind===3):[];
    const tokens=parsing?.events.filter(e=>e.kind===2) || [],ast=parsing?.ast || [];
    this.astLayout=astTreeLayout(ast);
    this.sourceTileWidth=Math.max(...this.sourceLines.map((line,i)=>measureSurfaceText(String(i+1).padStart(3)+'  '+line+'     ',SOURCE_FONT_SIZE)))+.26;
    this.sourceColumnPitch=this.sourceTileWidth+.5;
    const sourceBounds=sourceFootprint(layout,this.sourceLines.length,{sourceOnly:!layout&&!tokens.length&&!ast.length,sourceTileWidth:this.sourceTileWidth,tokenCount:tokens.length,astWidth:this.astLayout.width,astDepth:this.astLayout.depth});
    this.host.dataset.pipelineColumns=String(sourceBounds.lanes.length);
    const {rows,sourceWidth,sourceDepth}=sourceBounds;
    this.sourceOrigin=new THREE.Vector3(sourceBounds.sourceX,0,0);
    this.extent=sourceBounds;
    const e=this.extent, width=e.maxX-e.minX, depth=e.maxZ-e.minZ;
    const deck=box(this.world,(e.minX+e.maxX)/2,-.22,(e.minZ+e.maxZ)/2,width,.42,depth,0x141124);
    deck.castShadow=false;deck.receiveShadow=false;deck.material.dispose();
    deck.material=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.2,depthWrite:false});
    frostSurface(deck,width,depth,this.backgroundBlur,true);
    deck.renderOrder=-2;
    const span=Math.max(width,depth),center=new THREE.Vector3((e.minX+e.maxX)/2,0,(e.minZ+e.maxZ)/2);
    this.lightSpan=span;this.sun.target.position.copy(center);
    Object.assign(this.sun.shadow.camera,{left:-span*.8,right:span*.8,top:span*.8,bottom:-span*.8,near:.1,far:span*3});
    this.sun.shadow.camera.updateProjectionMatrix();
    const grid=createGrid(e,sourceBounds.lanes);
    this.gridUniforms=grid.uniforms;this.world.add(grid.mesh);
    this.serviceX=footprint.serviceX;
    this.lanes=sourceBounds.lanes.map(({x,width:laneWidth,title})=>{
      const paint=surfaceText(this.world,x,.08,e.minZ+1,Math.max(10,laneWidth),.9);
      return {paint,title,fade:0};
    });
    this.activeStage=null;this.displayStage=null;this.replayStage=layout?0:1;this.setActiveStage(this.replayStage);

    this.sourceTiles=[];this.sourceHighlight=null;
    this.sourceLines.forEach((text,i)=>{
      const group=new THREE.Group(); group.position.set(this.sourceOrigin.x-sourceWidth/2+.6+this.sourceTileWidth/2+Math.floor(i/rows)*this.sourceColumnPitch,0,-sourceDepth/2+1.2+(i%rows)*1.15);this.world.add(group);
      const body=box(group,0,.18,0,this.sourceTileWidth,.26,1.025,0x24203c);
      const paint=sourceTile(group,this.sourceTileWidth-.1,1.0125,i+1,this.sourceSyntax[i]);paint(false);
      this.sourceTiles.push({group,body,paint,line:i+1});
    });
    this.host.dataset.sourceTiles=String(this.sourceTiles.length);
    this.host.dataset.activeSource='';
    this.codeEnclosures=[];
    for(const enclosure of layout?.enclosures || []) {
      const group=new THREE.Group();group.position.set(enclosure.x,0,enclosure.y);this.world.add(group);
      const body=box(group,0,.085,0,enclosure.width,.15,enclosure.height,0x141124);
      body.material.transparent=true;body.material.opacity=.35;body.material.depthWrite=false;
      body.castShadow=false;body.renderOrder=-.8;
      frostSurface(body,enclosure.width,enclosure.height,this.backgroundBlur);
      const code=graph.codes.find(c=>c.id===enclosure.id);
      label(group,0,.17,-enclosure.height/2+.35,enclosure.width-.4,.5,[codeObjectTitle(code)]);
      this.codeEnclosures.push({code:enclosure.id,body,group});
    }
    this.instructionTiles=new Map();
    for(const placed of layout?.nodes || []) {
      const block=graph.blocks.find(b=>b.id===placed.id);
      const group=new THREE.Group(); group.position.set(placed.x,0,placed.y); this.world.add(group);
      const grid=instructionGrid(block.instructions,layout.placement?.selected.compact ?? true,layout.placement?.selected.tileAspect ?? 1);
      const tiles=[],arrows=[];
      for(const entry of grid.tiles) {
        const tileGroup=new THREE.Group(); tileGroup.position.set(entry.x,0,entry.y);group.add(tileGroup);
        const body=box(tileGroup,0,.49,0,entry.width,.38,entry.height);
        body.userData={block:block.id,offset:entry.instruction.offset};this.pickables.push(body);
        const paint=opcodeTile(tileGroup,entry.width-.08,entry.height-.08,.69,entry.instruction);paint(false);
        const tile={...entry,code:block.code,group:tileGroup,body,paint,position:new THREE.Vector3(placed.x+entry.x,.8,placed.y+entry.y)};tiles.push(tile);
        this.instructionTiles.set(`${block.code}:${entry.instruction.offset}`,tile);
      }
      for(let i=1;i<tiles.length;i++) {
        const a=tiles[i-1],b=tiles[i],direction=new THREE.Vector3(b.x-a.x,0,b.y-a.y).normalize();
        const length=Math.hypot(b.x-a.x,b.y-a.y),edge=Math.abs(direction.x)>.5?a.width/2:a.height/2;
        const start=new THREE.Vector3(a.x,.54,a.y).addScaledVector(direction,edge);
        const arrow=new THREE.ArrowHelper(direction,start,Math.max(.01,length-2*edge),0x649cae,.12,.1);group.add(arrow);arrows.push({arrow,from:a,to:b});
      }
      this.nodes.set(block.id,{group,height:.3,tiles,arrows});
    }
    const footprints=new Map([...this.instructionTiles.values()].map(tile=>[tile,{x:tile.position.x,z:tile.position.z,width:tile.width,depth:tile.height}]));
    const router=footprints.size?new TileRouter([...footprints.values()]):null;
    for(const node of this.nodes.values())for(const {from,to} of node.arrows){
      const dx=Math.sign(to.position.x-from.position.x),dz=Math.sign(to.position.z-from.position.z);
      router.reserve([[from.position.x+dx*from.width/2,from.position.z+dz*from.height/2],
        [to.position.x-dx*to.width/2,to.position.z-dz*to.height/2]]);
    }
    for(const route of layout?.edges || []) {
      const source=this.nodes.get(route.source).tiles.at(-1),target=this.nodes.get(route.target).tiles[0];
      const points=router.route(footprints.get(source),footprints.get(target));
      const color=route.kind==='call'?0x9b77c9:route.kind==='taken'?0xc276a3:0x649cae;
      const edge=connector(points,color,{dashed:route.kind==='call',height:.54});
      this.world.add(edge.line,edge.arrow);
      this.edges.set(route.id,{...edge,source:route.source,target:route.target});
    }
    this.pulse=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),new THREE.MeshBasicMaterial({color:colors.active})); this.world.add(this.pulse); this.pulse.visible=false;
    this.host.dataset.opcodeTiles=String(this.instructionTiles.size);
    this.host.dataset.blocks=String(this.nodes.size); this.host.dataset.edges=String(this.edges.size);
    this.revealTiles=[...this.instructionTiles.values()].sort((a,b)=>(a.instruction.line??0)-(b.instruction.line??0)||a.instruction.offset-b.instruction.offset);
    this.revealStart=layout&&!this.reduced.matches?performance.now():0;
    if(this.revealStart) for(const tile of this.revealTiles) tile.group.visible=false;
    this.updateOpcodeVisibility();
    this.host.dataset.revealedOpcodes=String(this.revealStart?0:this.revealTiles.length);
    this.host.dataset.phase=this.revealStart?'compilation reveal':layout?'replay':'source';
    this.link=new THREE.Group();this.world.add(this.link);
    this.buildFrontEnd(tokens,ast);
    let labelBytes=0;
    this.world.traverse(o=>{const canvas=o.material?.map?.image;if(canvas instanceof HTMLCanvasElement)labelBytes+=canvas.width*canvas.height*4;});
    this.host.dataset.labelCanvasBytes=String(labelBytes);
    if(!preserveCamera) this.view('iso');
    else if(previous){
      const ratio=this.projectedSize()/previous.size;
      const center=this.mapCenter();
      const target=center.add(this.controls.target.clone().sub(previous.center).multiplyScalar(ratio));
      const delta=target.clone().sub(this.controls.target);
      this.camera.position.add(delta);this.controls.target.copy(target);
      this.viewSize*=ratio;this.updateProjection();this.controls.update();
    }
  }
  setActiveStage(stage) {this.activeStage=stage;}
  updateLaneActivity(now) {
    const dt=Math.min(.1,Math.max(0,(now-(this.laneTick ?? now))/1000));this.laneTick=now;
    const animating=Boolean(this.revealStart||this.parsingPlaying||this.starfield?.playing||now<(this.liveCaptureUntil || 0));
    const stage=animating?this.activeStage:0;
    const changed=this.displayStage!==stage;
    this.displayStage=stage;this.host.dataset.activeStage=String(stage);
    this.lanes.forEach((lane,i)=>{
      const active=stage===23?(i===1||i===2):i+1===stage;
      const target=active?1:0;
      lane.fade=this.reduced.matches?target:lane.fade+(target-lane.fade)*(1-Math.exp(-dt/(active?.18:.3)));
      if(Math.abs(lane.fade-target)<.001)lane.fade=target;
      this.gridUniforms.activation.value[i]=lane.fade;
      if(changed)lane.paint([{text:lane.title,color:active?'#bdeaff':'#7f93af',align:'center'}]);
    });
  }
  setState(state,event,selected,terminal=false) {
    this.replayStage=event&&!terminal?4:0;
    if(!this.revealStart)this.host.dataset.phase=this.graph?'replay':'source';
    this.updateOpcodeVisibility();
    this.astGroup.visible=Boolean(this.astTiles.length);
    for(const tile of this.astTiles) tile.group.visible=true;
    for(const {edge} of this.astEdges) edge.visible=true;
    this.clearGhosts();this.constructionFlights.visible=false;
    for(const tile of this.parseTokens) tile.group.visible=true;
    const executionLine=event?.kind==='opcode'&&!terminal?event.line:null;
    this.highlightArtifacts(executionLine);
    this.replaySource=event?.kind==='opcode'&&!terminal?event.line:null;
    this.replayTile=event?.kind==='opcode'&&!terminal?this.instructionTiles.get(`${event.code}:${event.offset}`):null;
    if(!this.revealStart) this.highlightSource(this.replaySource,this.replayTile?.position);
    for(const [id,node] of this.nodes) {
      const active=id===state?.block, chosen=id===selected;
      for(const tile of node.tiles) {
        const executing=active&&event?.kind==='opcode'&&!terminal&&tile.instruction.offset===event.offset;
        tile.paint(executing); tile.body.material.color.setHex(executing?0x8a204d:colors.block);
        tile.body.children[0].material.color.setHex(executing?colors.active:chosen?colors.selected:colors.rim);
      }
    }
    for(const [id,edge] of this.edges) {
      const color=id===state?.edge?colors.active:edge.color;
      edge.line.material.color.setHex(color); edge.arrow.material.color.setHex(color);
      for(const child of edge.line.children) child.material.color.setHex(color);
    }
    this.host.dataset.activeBlock=state?.block || ''; this.host.dataset.selectedBlock=selected || '';
    this.currentOpcode=event?.kind==='opcode'?`${event.code}:${event.offset}`:null;
    this.host.dataset.activeOpcode=event?.kind==='opcode'&&!terminal?`${event.code}:${event.offset}`:'';
    this.updateOpcodePanel(selected || state?.block || this.graph?.blocks[0]?.id,event,terminal,Boolean(selected));
    if(terminal||!event||event.seq<this.lastSeq){this.opcodeTrail.clear();this.previousOpcodeTile=null;}
    if(event?.seq!==this.lastSeq) {
      const nextTile=!terminal&&event?.kind==='opcode'?this.instructionTiles.get(`${event.code}:${event.offset}`):null;
      if(nextTile){
        if(this.previousOpcodeTile&&this.previousOpcodeTile!==nextTile&&!this.reduced.matches)
          this.opcodeTrail.start(this.previousOpcodeTile,nextTile,performance.now());
        this.previousOpcodeTile=nextTile;
      }
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
    this.opcodePanel.querySelector('.opcode-caption').textContent=`${pinned?'Pinned':'Following'} · ${codeObjectTitle(code)} / Block @${block.instructions[0].offset} · ${block.instructions.length} instructions`;
    for(const button of list.children) button.classList.toggle('current',event?.kind==='opcode'&&!terminal&&event.code===block.code&&Number(button.dataset.offset)===event.offset);
    const current=list.querySelector('.current');
    if(current) {
      const y=current.offsetTop-list.offsetTop;
      if(y<list.scrollTop||y+current.offsetHeight>list.scrollTop+list.clientHeight) list.scrollTop=y-list.clientHeight/2;
    }
  }
  showOpcodes(show) { this.opcodePanel.hidden=!show; }
  buildFrontEnd(tokens,ast) {
    const e=this.extent;
    this.parseTokens=[];this.astTiles=[];this.astGroup=new THREE.Group();this.world.add(this.astGroup);
    this.pipelineArrows=[];
    tokens.forEach((event,i)=>{
      const group=new THREE.Group();group.position.set(e.tokenX+(i%4-1.5)*3.4,0,-e.tokenDepth/2+1+Math.floor(i/4)*1.2);this.world.add(group);
      const body=box(group,0,.3,0,3.15,.45,1,0x18152c);
      const paint=opcodeTile(group,3.05,.9,.54,{offset:event.cursor,opname:event.token,argrepr:event.text,arg:null},'#24203f');paint(false);
      this.parseTokens.push({group,body,paint,event});
    });
    const positions=new Map();this.astEdges=[];
    const treePositions=new Map(this.astLayout.nodes.map(n=>[n.id,n]));
    ast.forEach((node,i)=>{
      const tree=treePositions.get(node.id);
      const pos=new THREE.Vector3(e.astX+tree.x,.4,tree.z);positions.set(node.id,pos);
      const group=new THREE.Group();group.position.copy(pos);this.astGroup.add(group);
      const body=box(group,0,0,0,2.5,.4,1.2,0x18152c);
      const paint=opcodeTile(group,2.4,1.1,.22,{offset:node.id,opname:node.kind,argrepr:[node.label,node.operator].filter(Boolean).join(' · '),arg:null},'#24203f');paint(false);
      this.astTiles.push({node,group,body,paint});
      if(node.parent!==null) {
        const parent=positions.get(node.parent).clone(),end=pos.clone();parent.y=end.y=.22;
        let points;
        if(this.astLayout.direction==='LR'){
          parent.x+=1.25;end.x-=1.25;
          const middle=(parent.x+end.x)/2;
          points=[parent,new THREE.Vector3(middle,.22,parent.z),new THREE.Vector3(middle,.22,end.z),end];
        }else{
          parent.z+=.6;end.z-=.6;
          const middle=(parent.z+end.z)/2;
          points=[parent,new THREE.Vector3(parent.x,.22,middle),new THREE.Vector3(end.x,.22,middle),end];
        }
        const edge=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8874b5}));
        this.astGroup.add(edge);this.astEdges.push({edge,parent:node.parent,child:node.id});
      }
    });
    // Use complete artifact extents so reveal does not move the connectors.
    const bounds=(items,x,halfWidth,fallback)=>items.length
      ? [Math.min(...items.map(t=>x(t)-halfWidth(t))),Math.max(...items.map(t=>x(t)+halfWidth(t)))] : fallback;
    const sourceBounds=bounds(this.sourceTiles,t=>t.group.position.x,()=>this.sourceTileWidth/2,[e.sourceX-e.sourceWidth/2,e.sourceX+e.sourceWidth/2]);
    const tokenBounds=bounds(this.parseTokens,t=>t.group.position.x,()=>3.15/2,[e.tokenX-7,e.tokenX+7]);
    const astBounds=bounds(this.astTiles,t=>t.group.position.x,()=>1.25,[e.astX-e.astWidth/2,e.astX+e.astWidth/2]);
    // Enclosure geometry bounds are lazy in Three.js.
    for(const enclosure of this.codeEnclosures)enclosure.body.geometry.computeBoundingBox();
    const opcodeLeft=this.codeEnclosures.length?Math.min(...this.codeEnclosures.map(t=>t.group.position.x+t.body.geometry.boundingBox.min.x)):-e.width/2;
    for(const [from,to] of [[sourceBounds[1],tokenBounds[0]],[tokenBounds[1],astBounds[0]],[astBounds[1],opcodeLeft]]){
      const arrow=pipelineChevrons(from,to);this.world.add(arrow);this.pipelineArrows.push(arrow);
    }
    this.constructionFlights=new THREE.Group();this.world.add(this.constructionFlights);this.lastConstruction=null;
    this.ghosts=new THREE.Group();this.world.add(this.ghosts);this.host.dataset.ghostCount='0';
    this.host.dataset.parseTokens=String(tokens.length);this.host.dataset.astNodes=String(ast.length);
    this.host.dataset.pipeline=JSON.stringify({source:e.sourceX,tokens:e.tokenX,ast:e.astX,opcodes:0});
    this.host.dataset.astVisible=String(ast.length>0);
  }
  clearGhosts() {
    if(this.ghosts) release(this.ghosts);
    this.host.dataset.ghostCount='0';this.host.dataset.ghostEvent='';
  }
  createGhost(event,seq) {
    if(this.ghosts.children.length>=12) {const first=this.ghosts.children[0];release(first);this.ghosts.remove(first);}
    const counterpart=this.astTiles.find(t=>{
      const span=this.parsing?.events[t.node.created];
      return t.node.kind===event.text&&span?.line===event.line&&span?.column===event.column;
    });
    const group=new THREE.Group();
    if(counterpart) group.position.copy(counterpart.group.position).add(new THREE.Vector3(0,.45,0));
    else group.position.set(this.extent.astX-this.extent.astWidth/2+1.6+(seq%2)*3,.7,-this.extent.astDepth/2+1+(seq%3)*1.6);
    this.ghosts.add(group);
    box(group,0,0,0,2.5,.4,1.2,0x18152c);
    opcodeTile(group,2.4,1.1,.22,{offset:seq,opname:event.text,argrepr:'temporary',arg:null},'#24203f')(false);
    group.traverse(o=>{if(o.material){o.material.transparent=true;o.material.depthWrite=false;o.userData.ghostOpacity=o.isLineSegments ? .55 : o.material.isShaderMaterial ? .6 : .25;o.material.opacity=o.userData.ghostOpacity;}});
    group.userData.born=performance.now();group.userData.event=seq;
    this.host.dataset.ghostCount=String(this.ghosts.children.length);this.host.dataset.ghostEvent=String(seq);
    return group.position.clone();
  }
  updatePipelineArrows(now) {
    const visible=[
      this.sourceTiles?.some(tile=>tile.group.visible),
      this.parseTokens?.some(tile=>tile.group.visible),
      this.astGroup?.visible&&this.astTiles?.some(tile=>tile.group.visible),
      [...this.nodes.values()].some(node=>node.group.visible&&node.tiles.some(tile=>tile.group.visible)),
    ];
    for(const [i,arrow] of (this.pipelineArrows || []).entries()) {
      arrow.visible=Boolean(visible[i]&&visible[i+1]);
      arrow.material.uniforms.time.value=this.reduced.matches?0:now*.001;
    }
    this.host.dataset.pipelineArrows=String((this.pipelineArrows || []).filter(arrow=>arrow.visible).length);
  }
  highlightArtifacts(line) {
    let tokenCount=0,astCount=0;
    for(const tile of this.parseTokens) {const active=Boolean(line)&&tile.event.line===line;tile.paint(active);if(active)tokenCount++;}
    for(const tile of this.astTiles) {const active=Boolean(line)&&tile.node.line===line;tile.paint(active);if(active)astCount++;}
    this.host.dataset.activeTokens=String(tokenCount);this.host.dataset.activeAst=String(astCount);
  }
  loadParsing() {
    this.opcodeTrail.clear();this.previousOpcodeTile=null;
    this.finishConstruction();this.highlightArtifacts(null);
    for(const node of this.nodes.values()) node.group.visible=false;
    for(const edge of this.edges.values()) {edge.line.visible=false;edge.arrow.visible=false;}
    for(const enclosure of this.codeEnclosures)enclosure.group.visible=false;
    this.host.dataset.revealedEnclosures='0';
    this.host.dataset.phase='parsing';
    this.setActiveStage(23);
  }
  setParsingState(frame,final) {
    this.opcodeTrail.clear();this.previousOpcodeTile=null;
    if(!this.parseTokens) return;
    this.setActiveStage(final?0:23);
    const spanTokens=new Set(tokensForConstruction(final?null:frame?.event,this.parseTokens.map(t=>t.event)));
    for(const [i,tile] of this.parseTokens.entries()) {
      tile.group.visible=final||i<(frame?.tokenCount || 0);
      const active=!final&&(spanTokens.size?spanTokens.has(tile.event):tile.event.cursor===frame?.cursor)&&tile.group.visible;
      tile.paint(active);tile.body.material.color.setHex(active?0x8a204d:0x18152c);
    }
    const visible=new Set();
    for(const tile of this.astTiles) {
      tile.group.visible=final || tile.node.created!==null&&tile.node.created!==undefined&&tile.node.created<=(frame?.seq ?? -1);
      if(tile.group.visible) visible.add(tile.node.id);
      tile.paint(!final&&tile.node.created===frame?.seq);
    }
    for(const {edge,parent,child} of this.astEdges) edge.visible=visible.has(parent)&&visible.has(child);
    this.astGroup.visible=visible.size>0;
    this.host.dataset.visibleAst=String(visible.size);
    if(final) this.clearGhosts();
    const construction=!final&&frame?.event.kind===3?frame.event:null;
    const target=this.astTiles.find(t=>t.node.id===construction?.node);

    this.constructionFlights.visible=true;
    if(this.lastConstruction!==frame?.seq) {
      if(final||frame?.seq<this.lastConstruction) {release(this.constructionFlights);this.clearGhosts();}
      this.lastConstruction=frame?.seq;
      const matched=tokensForConstruction(construction,this.parseTokens.slice(0,frame?.tokenCount || 0).map(t=>t.event));
      this.host.dataset.constructionTokens=String(matched.length);
      this.host.dataset.constructionNode=target?String(target.node.id):'';
      if(construction) {
        const end=target?target.group.position:this.createGhost(construction,frame.seq);
        for(const token of matched) {
          if(this.constructionFlights.children.length>=512) break;
          const from=this.parseTokens.find(t=>t.event===token).group.position.clone().add(new THREE.Vector3(0,.6,0));
          const mid=from.clone().lerp(end,.5);mid.y=3;
          const particle=new THREE.Mesh(new THREE.SphereGeometry(.13,6,4),new THREE.MeshBasicMaterial({color:0xf06c9c}));
          particle.userData.start=performance.now();
          particle.userData.path=new THREE.QuadraticBezierCurve3(from,mid,end.clone());
          particle.visible=!this.reduced.matches;this.constructionFlights.add(particle);
        }
        this.flightStart=performance.now();
      }
    }
    this.host.dataset.astVisible=String(this.astGroup.visible);
    this.host.dataset.parseCursor=String(frame?.cursor ?? 0);
    this.host.dataset.visibleTokens=String(final?this.parseTokens.length:frame?.tokenCount || 0);
    const token=this.parseTokens.find(t=>t.event.cursor===frame?.cursor);
    this.highlightSource(final?null:token?.event.line,final?null:token?.group.position,'parsing');
  }
  highlightSource(line,target,linkPhase=null) {
    const signature=`${line}:${target?.x}:${target?.z}:${linkPhase}`;
    if(signature===this.sourceHighlight) return;
    this.sourceHighlight=signature;
    for(const tile of this.sourceTiles) {
      const active=tile.line===line; tile.paint(active);
      tile.body.material.color.setHex(active?0x8a204d:0x24203c);
    }
    const source=this.sourceTiles.find(t=>t.line===line);
    this.host.dataset.activeSource=source?String(line):'';
    if(!this.link) return;
    release(this.link);
    const counts={sourceToken:0,tokenAst:0,astOpcode:0};
    if(!linkPhase){this.host.dataset.pipelineLinks=JSON.stringify(counts);return;}
    const connect=(from,to,color,stage,active=false)=>{
      const mid=from.clone().lerp(to,.5);mid.y=active?2:1.3;
      const path=new THREE.QuadraticBezierCurve3(from,mid,to);
      const link=new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(20)),new THREE.LineDashedMaterial({color,dashSize:.2,gapSize:.13,transparent:true,opacity:active?1:.55}));
      link.computeLineDistances();this.link.add(link);counts[stage]++;
    };
    const selected=[...this.instructionTiles.values()].find(t=>t.position===target);
    const tokens=this.parseTokens.filter(t=>t.event.line===line&&t.group.visible);
    if(linkPhase==='parsing'&&source&&target) for(const token of tokens) connect(source.group.position.clone().add(new THREE.Vector3(this.sourceTileWidth/2,.5,0)),token.group.position.clone().add(new THREE.Vector3(0,.7,0)),0x56c6d5,'sourceToken');
    if(linkPhase==='opcodes'&&selected) {
      const assignments=[];
      for(const tile of this.instructionTiles.values()) if(tile.group.visible&&tile.code===selected.code&&tile.instruction.line===line) {
        const node=instructionAst(tile.instruction,this.parsing?.ast || [],this.parsing?.events || []);
        if(node) assignments.push({tile,node});
      }
      for(const {tile,node} of assignments) {
        const ast=this.astTiles.find(t=>t.node.id===node.id);
        connect(ast.group.position.clone().add(new THREE.Vector3(0,.4,0)),tile.position, tile===selected?0xf06c9c:0x9b77c9,'astOpcode',tile===selected);
      }
    }
    this.host.dataset.pipelineLinks=JSON.stringify(counts);
  }

  updateOpcodeVisibility() {
    let blocks=0,connections=0,internal=0;
    for(const node of this.nodes.values()) {
      node.group.visible=node.tiles.some(tile=>tile.group.visible);
      if(node.group.visible)blocks++;
      for(const {arrow,from,to} of node.arrows){
        arrow.visible=from.group.visible&&to.group.visible;
        if(arrow.visible)internal++;
      }
    }
    for(const edge of this.edges.values()) {
      const source=this.nodes.get(edge.source),target=this.nodes.get(edge.target);
      const visible=Boolean(source?.tiles.at(-1)?.group.visible&&target?.tiles[0]?.group.visible);
      edge.line.visible=edge.arrow.visible=visible;
      if(visible)connections++;
    }
    const visibleCodes=new Set([...this.instructionTiles.values()].filter(tile=>tile.group.visible).map(tile=>tile.code));
    for(const enclosure of this.codeEnclosures)enclosure.group.visible=visibleCodes.has(enclosure.code);
    this.host.dataset.revealedEnclosures=String(this.codeEnclosures.filter(e=>e.group.visible).length);
    this.host.dataset.enclosures=String(this.codeEnclosures.length);
    this.host.dataset.revealedBlocks=String(blocks);
    this.host.dataset.revealedEdges=String(connections);
    this.host.dataset.revealedInternalArrows=String(internal);
  }
  finishConstruction() {
    this.revealStart=0;
    for(const tile of this.revealTiles || []) { tile.group.visible=true;tile.group.scale.y=1; }
    this.updateOpcodeVisibility();
    this.host.dataset.revealedOpcodes=String(this.revealTiles?.length || 0);
    this.host.dataset.phase=this.graph?'replay':'source';
    for(const tile of this.parseTokens || []) tile.group.visible=true;
    if(this.astGroup) this.astGroup.visible=Boolean(this.astTiles.length);
    for(const tile of this.astTiles || []) tile.group.visible=true;
    for(const {edge} of this.astEdges || []) edge.visible=true;
    this.clearGhosts();
    this.highlightArtifacts(this.replaySource);
    this.highlightSource(this.replaySource,this.replayTile?.position);
  }
  focusSource() {
    const target=this.sourceOrigin.clone();
    this.camera.position.copy(target).add(new THREE.Vector3(0,30,.001));this.controls.target.copy(target);
    const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
    const rows=Math.min(24,this.sourceLines.length),columns=Math.ceil(this.sourceLines.length/rows);
    this.viewSize=Math.max(rows*1.15+3,(columns*this.sourceColumnPitch+3)/aspect);this.camera.zoom=1;
    this.updateProjection();
    this.camera.updateProjectionMatrix();this.controls.update();
  }
  resize() {
    const width=this.host.clientWidth,height=this.host.clientHeight;
    if(!width||!height) return;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2,Math.sqrt(8000000/(width*height))));
    this.renderer.setSize(width,height,false); this.updateProjection();
  }
  updateProjection() {
    const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
    const size=this.viewSize || 24;
    this.camera.aspect=aspect;
    const direction=this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(direction,size/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))));
    this.camera.far=Math.max(2000,size*12);
    this.camera.updateProjectionMatrix();
  }
  view(mode) {
    const e=this.extent, center=new THREE.Vector3((e.minX+e.maxX)/2,0,(e.minZ+e.maxZ)/2);
    const span=Math.max(e.maxX-e.minX,e.maxZ-e.minZ);
    this.camera.position.copy(center).add(mode==='top'?new THREE.Vector3(0,span*2,.001):new THREE.Vector3(0,span*1.1,span));
    this.controls.target.copy(center); this.camera.zoom=1;
    this.camera.lookAt(center); this.controls.update();
    this.viewSize=this.projectedSize();
    if(mode!=='top') {
      this.camera.zoom=1.25;
      const pan=new THREE.Vector3(0,0,-this.viewSize*.07);
      this.camera.position.add(pan);
      this.controls.target.add(pan);
    }
    this.resize();
  }
  updateLighting() {
    // Broad softbox impression: a blurred key above the viewer plus sky fill.
    const direction=this.camera.position.clone().sub(this.controls.target).normalize();
    direction.y+=.55;direction.normalize();
    this.sun.position.copy(this.sun.target.position).addScaledVector(direction,this.lightSpan*1.2);
  }
  mapCenter() {
    const e=this.extent;
    return new THREE.Vector3((e.minX+e.maxX)/2,0,(e.minZ+e.maxZ)/2);
  }
  projectedSize() {
    const e=this.extent,center=this.mapCenter(),rotation=this.camera.quaternion.clone().invert();
    const points=[];
    for(const x of [e.minX,e.maxX]) for(const z of [e.minZ,e.maxZ]) for(const y of [0,1.6]) points.push(new THREE.Vector3(x,y,z));
    const tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
    const aspect=(this.host.clientWidth||900)/(this.host.clientHeight||600);
    let distance=1;
    for(const point of points){
      point.sub(center).applyQuaternion(rotation);
      distance=Math.max(distance,Math.abs(point.x)/(tan*aspect)+point.z,Math.abs(point.y)/tan+point.z);
    }
    return distance*2*tan*1.12;
  }
  zoom(factor) { this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*factor,.3,12); this.camera.updateProjectionMatrix(); }
  focus(id) {
    const node=this.nodes.get(id); if(!node) return;
    const tile=node.tiles.find(t=>`${this.graph.blocks.find(b=>b.id===id).code}:${t.instruction.offset}`===this.currentOpcode) || node.tiles[0];
    const target=node.group.position.clone().add(new THREE.Vector3(tile.x,.7,tile.y));
    this.camera.position.copy(target).add(new THREE.Vector3(0,12,.001)); this.controls.target.copy(target);
    const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
    const size={width:tile.width,depth:tile.height};
    const span=Math.max(size.depth+1.2,(size.width+1.4)/aspect);
    this.viewSize=span;this.camera.zoom=1;this.updateProjection(); this.controls.update();
  }
  dispose() { this.backgroundBlur.dispose();this.opcodeTrail.dispose(); this.starfield?.dispose(); for(const [name,handler] of [['gesturestart',this.gestureStart],['gesturechange',this.gestureChange],['gestureend',this.gestureEnd]]) this.renderer.domElement.removeEventListener(name,handler,true); this.renderer.domElement.removeEventListener('wheel',this.wheelPan,true); this.minimap?.dispose(); this.resizeObserver.disconnect(); this.renderer.setAnimationLoop(null); this.controls.dispose(); release(this.world); disposeTextAtlas();this.sun.shadow.dispose();this.renderer.dispose(); this.renderer.domElement.remove(); this.opcodePanel.remove(); }
}
