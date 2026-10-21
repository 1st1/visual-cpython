import * as THREE from 'three';
import {isMobileNavigationDevice} from './navigation.mjs';

export class Minimap {
  constructor(host,xray) {
    this.xray=xray;
    this.panel=document.createElement('div');this.panel.className='minimap';this.panel.id='pipeline-minimap';
    this.panel.innerHTML='<canvas width="560" height="256" tabindex="0" role="img" aria-label="Pipeline minimap. Click or drag to pan. Left and right arrow keys pan the camera."></canvas>';
    this.toggle=document.getElementById('toggle-minimap');
    let savedVisibility;
    try { savedVisibility=localStorage.getItem('xray-minimap-visible'); } catch {}
    this.panel.hidden=savedVisibility==='false'||(savedVisibility!=='true'&&matchMedia('(max-width: 900px)').matches);
    this.toggle.setAttribute('aria-pressed',String(!this.panel.hidden));
    this.toggle.onclick=()=>{
      this.panel.hidden=!this.panel.hidden;
      this.toggle.setAttribute('aria-pressed',String(!this.panel.hidden));
      try { localStorage.setItem('xray-minimap-visible',String(!this.panel.hidden)); } catch {}
    };
    host.append(this.panel);this.canvas=this.panel.querySelector('canvas');
    this.panel.append(document.getElementById('minimap-tools'));
    const navigation=this.navigation=document.createElement('div');navigation.className='navigation-selector';
    navigation.setAttribute('role','group');navigation.setAttribute('aria-label','Navigation device');
    const mouse='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6M6 10h12"/></svg>';
    const trackpad='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M3 16h18M12 16v3"/></svg>';
    for(const [mode,content,title] of [
      ['auto','Auto','Auto: infer mouse or trackpad from scrolling'],
      ['mouse',mouse,'Mouse: drag to orbit, right/middle-drag to pan, wheel to zoom'],
      ['trackpad',trackpad,'Trackpad: drag to orbit, two-finger scroll to pan, pinch to zoom']
    ]) {
      const button=document.createElement('button');button.type='button';button.innerHTML=content;
      button.setAttribute('aria-label',mode==='auto'?'Auto navigation':mode==='mouse'?'Mouse navigation':'Trackpad navigation');
      button.title=title;button.dataset.mode=mode;
      button.onclick=()=>{xray.setNavigationMode(mode);update();};navigation.append(button);
    }
    const update=()=>navigation.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===xray.navigationMode)));
    const navigationControls=this.navigationControls=document.createElement('div');navigationControls.className='navigation-controls';
    navigationControls.hidden=isMobileNavigationDevice();
    update();navigationControls.append(navigation,document.getElementById('scene-hint'));host.append(navigationControls);

    this.canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.pan(e.key==='ArrowLeft'?-1:1);}};
    const move=e=>{
      const r=this.canvas.getBoundingClientRect(),bounds=xray.extent;
      if(!bounds)return;
      const x=THREE.MathUtils.clamp((e.clientX-r.left)/r.width,0,1),z=THREE.MathUtils.clamp((e.clientY-r.top)/r.height,0,1);
      this.center(bounds.minX+x*(bounds.maxX-bounds.minX),bounds.minZ+z*(bounds.maxZ-bounds.minZ));
    };
    this.canvas.onpointerdown=e=>{if(e.button!==0)return;this.drag=true;this.canvas.setPointerCapture(e.pointerId);move(e);};
    this.canvas.onpointermove=e=>{if(this.drag)move(e);};
    this.canvas.onpointerup=this.canvas.onpointercancel=()=>this.drag=false;
  }
  center(x,z) {
    const f=this.xray,delta=new THREE.Vector3(x-f.controls.target.x,0,z-f.controls.target.z);
    f.camera.position.add(delta);f.controls.target.add(delta);f.controls.update();this.draw();
  }
  pan(direction) {
    const f=this.xray;this.center(f.controls.target.x+direction*f.viewSize/f.camera.zoom*.25,f.controls.target.z);
  }
  draw() {
    const f=this.xray,e=f.extent;if(!e||this.panel.hidden)return;
    const ctx=this.canvas.getContext('2d'),w=this.canvas.width,h=this.canvas.height;
    const x=v=>(v-e.minX)/(e.maxX-e.minX)*w,z=v=>(v-e.minZ)/(e.maxZ-e.minZ)*h;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#0c1222';ctx.fillRect(0,0,w,h);
    const regions=[[e.sourceX,e.sourceWidth,e.sourceDepth,'#4b6679','SRC'],[e.tokenX,14,e.tokenDepth,'#638e91','TOK'],[e.astX,e.astWidth,e.astDepth,'#8c71aa','AST'],[0,e.width,e.depth,'#6898c6','OPS']];
    for(const [cx,width,depth,color,name] of regions.slice(0,e.sourceOnly?1:4)) {
      ctx.fillStyle=color;ctx.globalAlpha=.55;ctx.fillRect(x(cx-width/2),z(-depth/2),width/(e.maxX-e.minX)*w,depth/(e.maxZ-e.minZ)*h);ctx.globalAlpha=1;
      ctx.font='17px monospace';ctx.textAlign='center';ctx.fillStyle='#edf7e7';ctx.fillText(name,x(cx),h/2+6);
    }
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),ray=new THREE.Raycaster(),corners=[];
    for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
      ray.setFromCamera(new THREE.Vector2(sx,sy),f.camera);const p=ray.ray.intersectPlane(plane,new THREE.Vector3());if(p)corners.push(p);
    }
    if(corners.length===4){ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(x(p.x),z(p.z)):ctx.moveTo(x(p.x),z(p.z)));ctx.closePath();ctx.strokeStyle='#a4dfff';ctx.lineWidth=3;ctx.fillStyle='#a4dfff13';ctx.fill();ctx.stroke();}
    ctx.fillStyle='#d6edff';ctx.beginPath();ctx.arc(x(f.controls.target.x),z(f.controls.target.z),4,0,Math.PI*2);ctx.fill();
    this.canvas.dataset.target=JSON.stringify([f.controls.target.x,f.controls.target.z]);
  }
  dispose(){this.toggle.onclick=null;this.panel.remove();this.navigationControls.remove();}
}
