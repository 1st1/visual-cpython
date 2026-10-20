import {nebulaTexture} from './nebula.mjs';
// A sampled Gaussian gives subpixel stars a stable footprint across Canvas backends.
function starSprite(rgb) {
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(32,32);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const r2=((x+.5-16)/5)**2+((y+.5-16)/5)**2,i=(y*32+x)*4;
    pixels.data.set([...rgb,Math.round(255*Math.exp(-r2/2))],i);
  }
  ctx.putImageData(pixels,0,0);return canvas;
}
// Decorative depth field independent of the pipeline camera and recording clock.
export class Starfield {
  constructor(host) {
    this.layer=document.createElement('div');this.layer.className='starfield';this.layer.setAttribute('aria-hidden','true');
    this.canvas=document.createElement('canvas');this.layer.append(this.canvas);host.prepend(this.layer);
    this.ctx=this.canvas.getContext('2d');this.last=null;this.time=0;this.distance=0;this.warp=0;this.capturing=false;this.playing=false;this.constructing=false;
    let seed=73421;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    this.nebula=nebulaTexture();
    this.nearCanvas=document.createElement('canvas');this.nearCtx=this.nearCanvas.getContext('2d');
    this.starSprites=[[215,189,255],[163,217,255],[224,234,255]].map(starSprite);
    this.distant=Array.from({length:32400},()=>({x:random(),y:random(),r:.25+random()*.55,a:.08+random()**3*.6}));
    this.layer.dataset.starCount='36000';
    this.stars=Array.from({length:3600},()=>({x:(random()-.5)*4,y:(random()-.5)*4,z:.3+random()*3.7,r:.45+random()*.75,c:random()}));
  }
  draw(now,width,height,reduced) {
    const dpr=Math.min(devicePixelRatio,1,Math.sqrt(2000000/(width*height)));
    const changed=this.width!==width||this.height!==height||this.dpr!==dpr;
    if(changed){this.width=width;this.height=height;this.dpr=dpr;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);
      this.nearCanvas.width=Math.max(1,Math.round(this.canvas.width/2));this.nearCanvas.height=Math.max(1,Math.round(this.canvas.height/2));
      this.nearPixels=this.nearCtx.createImageData(this.nearCanvas.width,this.nearCanvas.height);
      if(this.distantCanvas){this.distantCanvas.width=1;this.distantCanvas.height=1;}
      this.distantCanvas=document.createElement('canvas');this.distantCanvas.width=Math.round(width*dpr);this.distantCanvas.height=Math.round(height*dpr);
      const far=this.distantCanvas.getContext('2d');far.scale(dpr,dpr);far.fillStyle='#d7ddff';
      // Spread the same energy over a soft footprint rather than a subpixel square.
      const sigma=.65/dpr,size=sigma*6.4;
      for(const star of this.distant){
        far.globalAlpha=star.a*star.r*star.r/(2*Math.PI*sigma*sigma);
        far.drawImage(this.starSprites[2],star.x*width-size/2,star.y*height-size/2,size,size);
      }
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
    if(this.warp>.01){
      // Batch faded streaks by color, width, and exposure instead of allocating
      // and rasterizing a separate gradient stroke for every visible star.
      const paths=Array.from({length:27},()=>new Path2D());
      for(const star of this.stars){
        const z=.3+((star.z-.3-this.distance)%3.7+3.7)%3.7;
        const x=cx+star.x*focal/z,y=cy+star.y*focal/z;
        if(x< -10||y< -10||x>width+10||y>height+10)continue;
        const fade=Math.max(0,Math.min(1,(z-.3)*2,(4-z)*2));
        if(fade<.05)continue;
        const tailZ=z+this.warp*this.warp*.55;
        const dx=star.x*focal/tailZ+cx-x,dy=star.y*focal/tailZ+cy-y;
        const cap=Math.min(1,180/Math.max(1,Math.hypot(dx,dy)))*fade;
        const color=star.c<.15?0:star.c>.75?1:2;
        const widthBucket=Math.min(2,Math.floor(Math.max(.6,Math.min(1.8,star.r/z)*.85)*2)-1);
        for(let band=0;band<3;band++){
          const path=paths[color*9+widthBucket*3+band];
          path.moveTo(x+dx*cap*(1-band/3),y+dy*cap*(1-band/3));
          path.lineTo(x+dx*cap*(1-(band+1)/3),y+dy*cap*(1-(band+1)/3));
        }
      }
      for(let color=0;color<3;color++)for(let width=0;width<3;width++)for(let band=0;band<3;band++){
        ctx.strokeStyle=palette[color];ctx.lineWidth=[.6,1,1.5][width];
        ctx.globalAlpha=[.08,.22,.38][band];ctx.stroke(paths[color*9+width*3+band]);
      }
    }
    const pixels=this.nearPixels.data,pixelWidth=this.nearCanvas.width,pixelHeight=this.nearCanvas.height;
    const pointScale=this.nearCanvas.width/width;
    pixels.fill(0);
    for(const star of this.stars){
      // A crossing takes about three minutes. Depth changes create gentle radial parallax.
      const z=.3+((star.z-.3-this.distance)%3.7+3.7)%3.7;
      const x=cx+star.x*focal/z,y=cy+star.y*focal/z;
      if(x< -10||y< -10||x>width+10||y>height+10)continue;
      const fade=Math.min(1,(z-.3)*2,(4-z)*2),radius=Math.min(1.8,star.r/z);
      // Rasterize a tiny Gaussian footprint explicitly, avoiding browser-specific
      // antialiasing of subpixel arcs and thousands of scaled sprite draws.
      const sigma=Math.max(.7,radius*pointScale*.75),spread=Math.ceil(sigma*3);
      const px=x*pointScale,py=y*pointScale,variance=2*sigma*sigma;
      const energy=Math.max(0,fade)*(.35+.4*(1-z/4))*radius*radius*pointScale*pointScale/variance;
      const rgb=star.c<.15?[215,189,255]:star.c>.75?[163,217,255]:[224,234,255];
      for(let iy=Math.max(0,Math.floor(py)-spread);iy<=Math.min(pixelHeight-1,Math.floor(py)+spread);iy++){
        const alphaY=255*energy*Math.exp(-((iy+.5-py)**2)/variance);
        for(let ix=Math.max(0,Math.floor(px)-spread);ix<=Math.min(pixelWidth-1,Math.floor(px)+spread);ix++){
          const alpha=Math.round(alphaY*Math.exp(-((ix+.5-px)**2)/variance));
          if(!alpha)continue;
          const i=(iy*pixelWidth+ix)*4,previous=pixels[i+3],total=previous+alpha;
          for(let c=0;c<3;c++)pixels[i+c]=(pixels[i+c]*previous+rgb[c]*alpha)/total;
          pixels[i+3]=Math.min(255,total);
        }
      }
    }
    this.nearCtx.putImageData(this.nearPixels,0,0);
    ctx.globalAlpha=1;ctx.drawImage(this.nearCanvas,0,0,width,height);
    this.layer.dataset.time=this.time.toFixed(4);
  }
  setConstructing(active){this.constructing=active;}
  setPlaying(active){this.playing=active;}
  setCapturing(active){
    this.capturing=active;
  }
  pause(){this.last=null;}
  dispose(){for(const canvas of [this.canvas,this.distantCanvas,this.nebula,this.nearCanvas,...this.starSprites])if(canvas){canvas.width=1;canvas.height=1;}this.nearPixels=null;this.layer.remove();}
}
