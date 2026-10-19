import * as THREE from 'three';

export class Minimap {
  constructor(host,factory) {
    this.factory=factory;
    this.panel=document.createElement('div');this.panel.className='minimap';
    this.panel.innerHTML='<div class="minimap-heading"><button aria-label="Pan left">←</button><span>PIPELINE · drag to pan</span><button aria-label="Pan right">→</button></div><canvas width="560" height="200" tabindex="0" role="img" aria-label="Pipeline minimap. Click or drag to pan. Left and right arrow keys pan the camera."></canvas>';
    host.append(this.panel);this.canvas=this.panel.querySelector('canvas');
    const buttons=this.panel.querySelectorAll('button');buttons[0].onclick=()=>this.pan(-1);buttons[1].onclick=()=>this.pan(1);
    this.canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.pan(e.key==='ArrowLeft'?-1:1);}};
    const move=e=>{
      const r=this.canvas.getBoundingClientRect(),bounds=factory.extent;
      if(!bounds)return;
      const x=THREE.MathUtils.clamp((e.clientX-r.left)/r.width,0,1),z=THREE.MathUtils.clamp((e.clientY-r.top)/r.height,0,1);
      this.center(bounds.minX+x*(bounds.maxX-bounds.minX),bounds.minZ+z*(bounds.maxZ-bounds.minZ));
    };
    this.canvas.onpointerdown=e=>{if(e.button!==0)return;this.drag=true;this.canvas.setPointerCapture(e.pointerId);move(e);};
    this.canvas.onpointermove=e=>{if(this.drag)move(e);};
    this.canvas.onpointerup=this.canvas.onpointercancel=()=>this.drag=false;
  }
  center(x,z) {
    const f=this.factory,delta=new THREE.Vector3(x-f.controls.target.x,0,z-f.controls.target.z);
    f.camera.position.add(delta);f.controls.target.add(delta);f.controls.update();this.draw();
  }
  pan(direction) {
    const f=this.factory;this.center(f.controls.target.x+direction*f.viewSize/f.camera.zoom*.25,f.controls.target.z);
  }
  draw() {
    const f=this.factory,e=f.extent;if(!e)return;
    const ctx=this.canvas.getContext('2d'),w=this.canvas.width,h=this.canvas.height;
    const x=v=>(v-e.minX)/(e.maxX-e.minX)*w,z=v=>(v-e.minZ)/(e.maxZ-e.minZ)*h;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#0c1222';ctx.fillRect(0,0,w,h);
    for(const [cx,width,depth,color,name] of [[e.sourceX,e.sourceWidth,e.sourceDepth,'#4b6679','SRC'],[e.tokenX,14,e.tokenDepth,'#638e91','TOK'],[e.astX,e.astWidth,e.astDepth,'#8c71aa','AST'],[0,e.width,e.depth,'#6898c6','OPS']]) {
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
  dispose(){this.panel.remove();}
}
