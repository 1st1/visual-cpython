// Decorative depth field independent of the pipeline camera and recording clock.
export class Starfield {
  constructor(host) {
    this.layer=document.createElement('div');this.layer.className='starfield';this.layer.setAttribute('aria-hidden','true');
    this.canvas=document.createElement('canvas');this.layer.append(this.canvas);host.prepend(this.layer);
    this.ctx=this.canvas.getContext('2d');this.last=null;this.time=0;
    let seed=73421;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    this.stars=Array.from({length:680},()=>({x:(random()-.5)*4,y:(random()-.5)*4,z:.3+random()*3.7,r:.45+random()*.75,c:random()}));
  }
  draw(now,width,height,reduced) {
    const dpr=Math.min(devicePixelRatio,2);
    const changed=this.width!==width||this.height!==height||this.dpr!==dpr;
    if(changed){this.width=width;this.height=height;this.dpr=dpr;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
    const dt=this.last===null?0:Math.min(.05,(now-this.last)/1000);this.last=now;
    if(reduced&&!changed&&this.wasReduced)return;
    this.wasReduced=reduced;
    if(!reduced)this.time+=dt;
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const focal=Math.max(width,height)*.55,cx=width*.46,cy=height*.43;
    for(const star of this.stars){
      // A crossing takes about three minutes. Depth changes create gentle radial parallax.
      const z=.3+((star.z-.3-this.time*.021)%3.7+3.7)%3.7;
      const x=cx+star.x*focal/z,y=cy+star.y*focal/z;
      if(x< -10||y< -10||x>width+10||y>height+10)continue;
      const fade=Math.min(1,(z-.3)*2,(4-z)*2),radius=Math.min(1.8,star.r/z);
      ctx.globalAlpha=Math.max(0,fade)*(.35+.4*(1-z/4));
      ctx.fillStyle=star.c<.15?'#d7bdff':star.c>.75?'#a3d9ff':'#e0eaff';
      ctx.beginPath();ctx.arc(x,y,Math.max(.35,radius),0,Math.PI*2);ctx.fill();
      if(radius>1.1){ctx.globalAlpha*=.12;ctx.beginPath();ctx.arc(x,y,radius*3,0,Math.PI*2);ctx.fill();}
    }
    ctx.globalAlpha=1;this.layer.dataset.time=this.time.toFixed(4);
  }
  pause(){this.last=null;}
  dispose(){this.layer.remove();}
}
