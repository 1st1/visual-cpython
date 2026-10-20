import * as THREE from 'three';
import {nebulaTexture} from './nebula.mjs';

const vertexShader=`
attribute vec4 star;
attribute vec2 appearance;
uniform vec2 viewport;
uniform float time, distance, warp;
uniform bool distant;
varying vec2 local;
varying float sigma, energy, tailLength, tailWidth, visibility;
varying vec3 tint;
void main(){
  vec2 center;
  vec2 direction=vec2(1.,0.);
  tailLength=0.;tailWidth=.6;visibility=1.;
  if(distant){
    float scale=1.04+warp*.05;
    center=(star.xy-.5)*viewport*scale+viewport*.5;
    center+=vec2(sin(time*.015),cos(time*.012))*viewport*.008;
    sigma=.65;
    energy=appearance.x*star.w*star.w/(6.2831853*sigma*sigma);
    tint=vec3(224.,234.,255.)/255.;
  }else{
    float z=.3+mod(star.z-.3-distance,3.7);
    float focal=max(viewport.x,viewport.y)*.55;
    center=viewport*vec2(.46,.43)+star.xy*focal/z;
    visibility=clamp(min((z-.3)*2.,(4.-z)*2.),0.,1.);
    float radius=min(1.8,star.w/z);
    sigma=max(1.4,radius*.75);
    energy=visibility*(.35+.4*(1.-z/4.))*radius*radius/(2.*sigma*sigma);
    vec2 delta=star.xy*focal/(z+warp*warp*.55)+viewport*vec2(.46,.43)-center;
    float length=length(delta);
    direction=length>.00001?delta/length:vec2(1.,0.);
    tailLength=min(180.,length)*visibility;
    tailWidth=max(.6,radius*.85);
    tint=appearance.y<.15?vec3(215.,189.,255.)/255.:
      appearance.y>.75?vec3(163.,217.,255.)/255.:vec3(224.,234.,255.)/255.;
  }
  local=vec2(mix(-sigma*3.,tailLength+sigma*3.,uv.x),(uv.y-.5)*sigma*6.);
  vec2 pixel=center+direction*local.x+vec2(-direction.y,direction.x)*local.y;
  gl_Position=vec4(pixel/viewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);
}`;
const fragmentShader=`
uniform float warp;
varying vec2 local;
varying float sigma, energy, tailLength, tailWidth, visibility;
varying vec3 tint;
void main(){
  float core=energy*exp(-dot(local,local)/(2.*sigma*sigma));
  float aa=max(fwidth(local.y),.5);
  float crossFade=1.-smoothstep(max(0.,tailWidth*.5-aa*.5),tailWidth*.5+aa*.5,abs(local.y));
  float along=clamp(1.-local.x/max(tailLength,.001),0.,1.);
  float tail=.38*visibility*along*crossFade*smoothstep(0.,1.,tailLength)*step(0.,local.x);
  float alpha=core+tail*(1.-core);
  if(alpha<.001)discard;
  vec3 trailTint=mix(tint,vec3(135.,215.,255.)/255.,min(1.,warp/.22)*.65);
  // Colors are display-referred, matching the original Canvas background.
  gl_FragColor=vec4(mix(tint,trailTint,tail/max(alpha,.001)),alpha);
}`;

function starMesh(stars,appearance,uniforms,distant){
  const geometry=new THREE.InstancedBufferGeometry();
  // Screen coordinates flip Y, so reverse winding to keep the quads front-facing.
  geometry.setIndex([0,2,1,0,3,2]);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
  geometry.setAttribute('star',new THREE.InstancedBufferAttribute(new Float32Array(stars),4));
  geometry.setAttribute('appearance',new THREE.InstancedBufferAttribute(new Float32Array(appearance),2));
  geometry.instanceCount=stars.length/4;
  const material=new THREE.ShaderMaterial({uniforms:{...uniforms,distant:{value:distant}},vertexShader,fragmentShader,
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=distant?1:2;return mesh;
}

// The existing renderer draws this camera-independent background before the factory.
export class Starfield {
  constructor(host){
    this.layer=document.createElement('div');this.layer.className='starfield';this.layer.setAttribute('aria-hidden','true');host.prepend(this.layer);
    this.layer.dataset.starCount='36000';this.layer.dataset.renderer='webgl';
    this.last=null;this.time=0;this.distance=0;this.warp=0;this.capturing=false;this.playing=false;this.constructing=false;
    this.viewport={width:1,height:1};this.nebula=nebulaTexture();
    this.texture=new THREE.CanvasTexture(this.nebula);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.camera=new THREE.Camera();
    this.uniforms={viewport:{value:new THREE.Vector2(1,1)},time:{value:0},distance:{value:0},warp:{value:0}};
    const material=new THREE.ShaderMaterial({uniforms:{nebula:{value:this.texture},warp:this.uniforms.warp,viewport:this.uniforms.viewport},
      depthTest:false,depthWrite:false,toneMapped:false,
      vertexShader:'varying vec2 texUv;void main(){texUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 texUv;uniform sampler2D nebula;uniform float warp;uniform vec2 viewport;
        void main(){
          vec3 color=texture2D(nebula,texUv).rgb;
          gl_FragColor=vec4(color,1.);
          #include <colorspace_fragment>
          float r=length((vec2(texUv.x,1.-texUv.y)-vec2(.46,.43))*viewport)/(max(viewport.x,viewport.y)*.44);
          gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(100.,155.,255.)/255.,max(0.,1.-r)*warp*.1);
        }`});
    this.backdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);this.backdrop.frustumCulled=false;this.scene.add(this.backdrop);
    let seed=73421;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const far=[],farAppearance=[],near=[],nearAppearance=[];
    for(let i=0;i<32400;i++){far.push(random(),random(),0,.25+random()*.55);farAppearance.push(.08+random()**3*.6,0);}
    for(let i=0;i<3600;i++){near.push((random()-.5)*4,(random()-.5)*4,.3+random()*3.7,.45+random()*.75);nearAppearance.push(1,random());}
    this.far=starMesh(far,farAppearance,this.uniforms,true);this.near=starMesh(near,nearAppearance,this.uniforms,false);
    this.scene.add(this.far,this.near);
  }
  draw(now,width,height,reduced){
    // Preserve the existing blur resolution budget without a second display canvas.
    const scale=Math.min(1,Math.sqrt(2000000/(width*height)));
    this.viewport.width=Math.round(width*scale);this.viewport.height=Math.round(height*scale);
    this.uniforms.viewport.value.set(width,height);
    const dt=this.last===null?0:Math.min(.05,(now-this.last)/1000);this.last=now;
    if(reduced)this.warp=0;
    else{
      this.time+=dt;
      const target=(this.capturing||this.playing||this.constructing)?.22:0;
      this.warp+=(target-this.warp)*(1-Math.exp(-dt*(target?5:2.8)));
      this.distance+=dt*(.021+this.warp*this.warp*2.8);
    }
    this.uniforms.time.value=this.time;this.uniforms.distance.value=this.distance;this.uniforms.warp.value=this.warp;
    this.layer.dataset.time=this.time.toFixed(4);this.layer.dataset.warp=this.warp.toFixed(4);
  }
  render(renderer){renderer.render(this.scene,this.camera);}
  setConstructing(active){this.constructing=active;}
  setPlaying(active){this.playing=active;}
  setCapturing(active){this.capturing=active;}
  pause(){this.last=null;}
  dispose(){
    for(const mesh of [this.backdrop,this.far,this.near]){mesh.geometry.dispose();mesh.material.dispose();}
    this.texture.dispose();this.nebula.width=this.nebula.height=1;this.layer.remove();
  }
}
