import * as THREE from 'three';

// One byte per texel; pages are shared by all labels. Rasterization is temporary.
const CELL=64, SIZE=1024, FONT=40, PAD=10, BASELINE=48, RANGE=8, MAX_PAGES=4;
const pages=[],glyphs=new Map();
let raster;
function page() {
  const data=new Uint8Array(SIZE*SIZE);
  const texture=new THREE.DataTexture(data,SIZE,SIZE,THREE.RedFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;texture.unpackAlignment=1;
  const result={data,texture,count:0};pages.push(result);return result;
}
function distances(mask,inside) {
  const d=new Float32Array(CELL*CELL);
  for(let i=0;i<d.length;i++)d[i]=(mask[i]>=128)===inside?0:1000;
  const relax=(x,y,dx,dy,cost)=>{
    const nx=x+dx,ny=y+dy;
    if(nx>=0&&ny>=0&&nx<CELL&&ny<CELL)d[y*CELL+x]=Math.min(d[y*CELL+x],d[ny*CELL+nx]+cost);
  };
  for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){
    relax(x,y,-1,0,1);relax(x,y,0,-1,1);relax(x,y,-1,-1,Math.SQRT2);relax(x,y,1,-1,Math.SQRT2);
  }
  for(let y=CELL-1;y>=0;y--)for(let x=CELL-1;x>=0;x--){
    relax(x,y,1,0,1);relax(x,y,0,1,1);relax(x,y,1,1,Math.SQRT2);relax(x,y,-1,1,Math.SQRT2);
  }
  return d;
}
function glyph(char) {
  if(glyphs.has(char))return glyphs.get(char);
  if(glyphs.size>=MAX_PAGES*256)return glyph('□');
  if(!raster){raster=document.createElement('canvas');raster.width=raster.height=CELL;if(char!=='□')glyph('□');}
  const ctx=raster.getContext('2d',{willReadFrequently:true});
  ctx.clearRect(0,0,CELL,CELL);ctx.font=FONT+'px monospace';ctx.textBaseline='alphabetic';ctx.fillStyle='#fff';
  ctx.fillText(char,PAD,BASELINE,CELL-PAD*2);
  const rgba=ctx.getImageData(0,0,CELL,CELL).data,mask=new Uint8Array(CELL*CELL);
  for(let i=0;i<mask.length;i++)mask[i]=rgba[i*4+3];
  const inner=distances(mask,true),outer=distances(mask,false);
  const atlas=pages.at(-1)?.count<256?pages.at(-1):page();
  const slot=atlas.count++,gx=slot%16*CELL,gy=Math.floor(slot/16)*CELL;
  for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){
    const i=y*CELL+x,alpha=mask[i]/255;
    const signed=alpha>0&&alpha<1?alpha-.5:outer[i]-inner[i];
    atlas.data[(gy+y)*SIZE+gx+x]=Math.round(Math.max(0,Math.min(1,.5+signed/(RANGE*2)))*255);
  }
  atlas.texture.needsUpdate=true;
  const result={atlas,gx,gy,advance:Math.min(CELL-PAD*2,ctx.measureText(char).width)/FONT};
  glyphs.set(char,result);return result;
}
function material(texture) {
  return new THREE.ShaderMaterial({
    uniforms:{atlas:{value:texture},opacity:{value:1}},
    // Constant bias also protects near-flat views where slope bias vanishes.
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-8,
    vertexShader:`
      attribute vec3 color;
      varying vec2 vUv;varying vec3 vColor;
      void main(){vUv=uv;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:`
      uniform sampler2D atlas;uniform float opacity;
      varying vec2 vUv;varying vec3 vColor;
      void main(){
        float distance=texture2D(atlas,vUv).r;
        float edge=max(fwidth(distance)*.65,1./255.);
        float coverage=smoothstep(.5-edge,.5+edge,distance);
        if(coverage<.01)discard;
        gl_FragColor=vec4(vColor,coverage*opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

export function measureSurfaceText(text,size) {
  return Array.from(text).reduce((width,char)=>width+glyph(char).advance*size,0);
}

// Rows share a baseline grid; each row can supply syntax-colored runs.
export function surfaceText(parent,x,y,z,width,height,{front=false,background=null}={}) {
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.x=front?0:-Math.PI/2;parent.add(group);
  let backing;
  if(background){
    backing=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color:background,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-4}));
    group.add(backing);
  }
  const text=new THREE.Group();text.position.z=.01;group.add(text);
  return (rows,bg=background)=>{
    if(backing&&bg)backing.material.color.set(bg);
    for(const mesh of text.children){mesh.geometry.dispose();mesh.material.dispose();}
    text.clear();
    const batches=new Map(),rowHeight=height/Math.max(1,rows.length);
    rows.forEach((row,index)=>{
      const size=row.size || rowHeight*.65;
      const runs=row.runs || [{text:String(row.text),color:row.color || '#edf3ff'}];
      const chars=runs.flatMap(run=>Array.from(run.text,char=>({char,color:run.color})));
      const maxWidth=width-.16,rendered=[];let length=0;
      for(const entry of chars){
        const g=glyph(entry.char),advance=g.advance*size;
        if(length+advance>maxWidth){
          while(rendered.length&&length+size*.6>maxWidth){const removed=rendered.pop();length-=removed.g.advance*size;}
          rendered.push({char:'…',color:entry.color,g:glyph('…')});length+=size*.6;break;
        }
        rendered.push({...entry,g});length+=advance;
      }
      let cursor=row.align==='center'?-length/2:-width/2+.08;
      const baseline=height/2-index*rowHeight-(rowHeight-size)/2-size*.8;
      for(const {char,color,g} of rendered){
        if(char!==' '){
          let batch=batches.get(g.atlas);
          if(!batch){batch={positions:[],uvs:[],colors:[]};batches.set(g.atlas,batch);}
          const left=cursor-PAD/FONT*size,top=baseline+BASELINE/FONT*size,side=CELL/FONT*size;
          const u=g.gx/SIZE,v=g.gy/SIZE,uvSize=CELL/SIZE,c=new THREE.Color(color || '#edf3ff');
          for(const [dx,dy] of [[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]){
            batch.positions.push(left+dx*side,top-dy*side,0);
            batch.uvs.push(u+dx*uvSize,v+dy*uvSize);
            batch.colors.push(c.r,c.g,c.b);
          }
        }
        cursor+=g.advance*size;
      }
    });
    for(const [atlas,batch] of batches){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));
      const mesh=new THREE.Mesh(geometry,material(atlas.texture));
      mesh.onBeforeRender=()=>{mesh.material.uniforms.opacity.value=mesh.material.opacity;};
      text.add(mesh);
    }
  };
}
export function textAtlasStats(){return {pages:pages.length,glyphs:glyphs.size,bytes:pages.length*SIZE*SIZE};}
export function disposeTextAtlas(){
  for(const p of pages)p.texture.dispose();
  pages.length=0;glyphs.clear();if(raster){raster.width=raster.height=1;raster=null;}
}
