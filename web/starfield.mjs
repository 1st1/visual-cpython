import {nebulaTexture} from './nebula.mjs';
// Decorative depth field independent of the pipeline camera and recording clock.
export class Starfield {
  constructor(host) {
    this.layer=document.createElement('div');this.layer.className='starfield';this.layer.setAttribute('aria-hidden','true');
    this.canvas=document.createElement('canvas');this.layer.append(this.canvas);host.prepend(this.layer);
    this.ctx=this.canvas.getContext('2d');this.last=null;this.time=0;this.distance=0;this.warp=0;this.capturing=false;this.playing=false;this.constructing=false;
    let seed=73421;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    this.nebula=nebulaTexture();
    this.distant=Array.from({length:32400},()=>({x:random(),y:random(),r:.25+random()*.55,a:.08+random()**3*.6}));
    this.layer.dataset.starCount='36000';
    this.stars=Array.from({length:3600},()=>({x:(random()-.5)*4,y:(random()-.5)*4,z:.3+random()*3.7,r:.45+random()*.75,c:random()}));
  }
  draw(now,width,height,reduced) {
    const dpr=Math.min(devicePixelRatio,1,Math.sqrt(2000000/(width*height)));
    const changed=this.width!==width||this.height!==height||this.dpr!==dpr;
    if(changed){this.width=width;this.height=height;this.dpr=dpr;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);
      if(this.distantCanvas){this.distantCanvas.width=1;this.distantCanvas.height=1;}
      this.distantCanvas=document.createElement('canvas');this.distantCanvas.width=Math.round(width*dpr);this.distantCanvas.height=Math.round(height*dpr);
      const far=this.distantCanvas.getContext('2d');far.scale(dpr,dpr);far.fillStyle='#d7ddff';
      for(const star of this.distant){far.globalAlpha=star.a;far.fillRect(star.x*width,star.y*height,star.r,star.r);}
    }
    const dt=this.last===null?0:Math.min(.05,(now-this.last)/1000);this.last=now;
    if(reduced){this.warp=0;this.layer.dataset.warp='0';}
    if(reduced&&!changed&&this.wasReduced)return;
    this.wasReduced=reduced;
    if(!reduced){
      this.time+=dt;
      const target=(this.capturing||this.playing||this.constructing) ? .22 : 0;
      this.warp+=(target-this.warp)*(1-Math.exp(-dt*(target?5:2.8)));
      this.distance+=dt*(.021+this.warp*this.warp*2.8);
    }
    this.layer.dataset.warp=this.warp.toFixed(4);
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    ctx.drawImage(this.nebula,0,0,width,height);
    // The dense far field is cached; only the nearer 3,600 stars need per-star animation.
    const farScale=1.04+this.warp*.05;
    const dx=Math.sin(this.time*.015)*width*.008,dy=Math.cos(this.time*.012)*height*.008;
    ctx.drawImage(this.distantCanvas,(1-farScale)*width/2+dx,(1-farScale)*height/2+dy,width*farScale,height*farScale);
    const focal=Math.max(width,height)*.55,cx=width*.46,cy=height*.43;
    // Artistic forward blueshift, coupled to speed rather than a physical spectrum.
    const shift=Math.min(1,this.warp/.22)*.65;
    const palette=[[215,189,255],[163,217,255],[224,234,255]].map(rgb=>
      'rgb('+rgb.map((v,i)=>Math.round(v+([135,215,255][i]-v)*shift)).join(',')+')');
    if(this.warp>.01){
      const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,focal*.8);
      glow.addColorStop(0,'rgba(100,155,255,'+(this.warp*.1)+')');glow.addColorStop(1,'rgba(100,155,255,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    }
    for(const star of this.stars){
      // A crossing takes about three minutes. Depth changes create gentle radial parallax.
      const z=.3+((star.z-.3-this.distance)%3.7+3.7)%3.7;
      const x=cx+star.x*focal/z,y=cy+star.y*focal/z;
      if(x< -10||y< -10||x>width+10||y>height+10)continue;
      const fade=Math.min(1,(z-.3)*2,(4-z)*2),radius=Math.min(1.8,star.r/z);
      ctx.globalAlpha=Math.max(0,fade)*(.35+.4*(1-z/4));
      ctx.fillStyle=palette[star.c<.15?0:star.c>.75?1:2];
      if(this.warp>.01){
        // Project an exposure behind each star without moving the map camera.
        const tailZ=z+this.warp*this.warp*.55;
        const tx=cx+star.x*focal/tailZ,ty=cy+star.y*focal/tailZ;
        const length=Math.hypot(x-tx,y-ty),cap=Math.min(1,180/Math.max(1,length));
        const sx=x+(tx-x)*cap,sy=y+(ty-y)*cap;
        const glow=ctx.createLinearGradient(sx,sy,x,y);
        glow.addColorStop(0,'#a3cfff00');glow.addColorStop(1,ctx.fillStyle);
        ctx.strokeStyle=glow;ctx.lineWidth=Math.max(.6,radius*.85);
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(x,y);ctx.stroke();
      }
      ctx.beginPath();ctx.arc(x,y,Math.max(.35,radius),0,Math.PI*2);ctx.fill();
      if(radius>1.1){ctx.globalAlpha*=.12;ctx.beginPath();ctx.arc(x,y,radius*3,0,Math.PI*2);ctx.fill();}
    }
    ctx.globalAlpha=1;this.layer.dataset.time=this.time.toFixed(4);
  }
  setConstructing(active){this.constructing=active;}
  setPlaying(active){this.playing=active;}
  setCapturing(active){
    this.capturing=active;
  }
  pause(){this.last=null;}
  dispose(){for(const canvas of [this.canvas,this.distantCanvas,this.nebula])if(canvas){canvas.width=1;canvas.height=1;}this.layer.remove();}
}
