import * as THREE from 'three';

// Original implementation inspired by cursor_blaze's retracting cursor trail:
// https://github.com/0xhckr/ghostty-shaders/blob/main/cursor_blaze.glsl
// That shader credits https://gist.github.com/chardskarth/95874c54e29da6b5a36ab7b50ae2d088
export class OpcodeTrail {
  constructor(scene){
    this.material=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{widths:{value:new THREE.Vector2()},age:{value:1},startBox:{value:new THREE.Vector4()},endBox:{value:new THREE.Vector4()}},
      vertexShader:`uniform vec2 widths;varying vec2 trailUv;varying vec2 worldXZ;
        void main(){trailUv=uv;vec3 p=position;p.y*=mix(widths.x,widths.y,uv.x);vec4 world=modelMatrix*vec4(p,1.);worldXZ=world.xz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader:`varying vec2 trailUv;varying vec2 worldXZ;
        uniform float age;uniform vec4 startBox;uniform vec4 endBox;
        bool insideBox(vec4 box){return all(lessThan(abs(worldXZ-box.xy),box.zw));}
        void main(){
          if(insideBox(startBox)||insideBox(endBox))discard;
          float remaining=pow(max(0.,1.-age),3.);
          float behind=1.-trailUv.x;
          float tail=1.-smoothstep(0.,max(.001,remaining),behind);
          float across=abs(trailUv.y-.5)*2.;
          float core=1.-smoothstep(.45,.95,across);
          float halo=exp(-across*across*1.5)*(1.-smoothstep(.7,1.,across));
          float alpha=min(.95,core*.8+halo*.4)*tail*(1.-age);
          if(alpha<.002)discard;
          vec3 color=mix(vec3(.48,.35,.95),vec3(.64,.88,1.),core);
          gl_FragColor=vec4(color,alpha);
          #include <colorspace_fragment>
        }`
    });
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.material);
    this.mesh.frustumCulled=false; // Vertex shader widens the reusable unit plane.
    this.mesh.visible=false;scene.add(this.mesh);
  }
  start(from,to,now){
    const dx=to.position.x-from.position.x,dz=to.position.z-from.position.z;
    const distance=Math.hypot(dx,dz);
    if(distance<.001){this.clear();return;}
    const middle=from.position.clone().lerp(to.position,.5);middle.y=.73;
    this.mesh.position.copy(middle);
    this.mesh.rotation.set(-Math.PI/2,0,-Math.atan2(dz,dx));
    // Project each rectangular tile onto the direction perpendicular to travel.
    const width=tile=>(Math.abs(dz)*tile.width+Math.abs(dx)*tile.height)/distance;
    this.material.uniforms.widths.value.set(width(from),width(to));
    this.mesh.scale.set(distance,1,1);
    for(const [name,tile] of [['startBox',from],['endBox',to]])
      this.material.uniforms[name].value.set(tile.position.x,tile.position.z,tile.width/2,tile.height/2);
    this.started=now;this.mesh.visible=true;this.material.uniforms.age.value=0;
  }
  update(now,reduced=false){
    if(!this.mesh.visible)return;
    const age=Math.max(0,(now-this.started)/500);
    this.material.uniforms.age.value=Math.min(1,age);
    if(reduced||age>=1)this.clear();
  }
  clear(){this.mesh.visible=false;}
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();}
}
