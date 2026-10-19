// Cached, deterministic cloud texture: warped fractal noise forms filaments and dust.
export function nebulaTexture() {
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=450;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);
  const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const noise=(x,y)=>{
    const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);
    const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
  };
  const cloud=(x,y)=>{
    let value=0,amplitude=.55;
    for(let octave=0;octave<6;octave++){value+=noise(x,y)*amplitude;x=x*2.07+11;y=y*2.03+7;amplitude*=.48;}
    return value;
  };
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const u=x/canvas.width,v=y/canvas.height;
    const nx=u*5,ny=v*4,warp=cloud(nx+13,ny+7);
    const n=cloud(nx+warp*2.4,ny+warp*1.7);
    const band=Math.exp(-Math.pow((v-.47-.13*Math.sin(u*7))/ .24,2));
    const core=Math.exp(-((u-.47)**2/.055+(v-.43)**2/.09));
    const filament=Math.pow(Math.max(0,n-.22)*1.65,2.4);
    const dust=Math.pow(noise(nx*2.3+warp,ny*2.3),3);
    const glow=(filament*band*.85+core*.38)*(1-dust*.85);
    const blue=cloud(nx+41,ny+23)*band;
    const warm=Math.max(0,Math.min(1,(noise(nx*.55+73,ny*.55+9)-.35)*2.3));
    const rose=core*.12*(1-dust);
    const i=(y*canvas.width+x)*4;
    pixels.data[i]=8+glow*(65+warm*90)+rose*80;
    pixels.data[i+1]=10+glow*(91+warm*19)+blue*8;
    pixels.data[i+2]=20+glow*(128-warm*60)+blue*18+rose*35;
    pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);return canvas;
}
