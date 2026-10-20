import * as THREE from 'three';

// A transparent strip of antialiased fixed chevrons with a traveling highlight.
export function pipelineChevrons(from,to) {
  const gap=to-from,length=Math.max(.2,Math.min(2.2,gap-.6)),width=1.55;
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0},length:{value:length},color:{value:new THREE.Color(0xe8bc4e)}},
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform float length;uniform vec3 color;
      void main(){
        float x=vUv.x*length;
        float y=abs(vUv.y-.5)*2.;
        float phase=(vUv.x+y*.22-.31)/.30;
        float index=floor(phase+.5);
        if(index<0.||index>2.)discard;
        float distance=abs(fract(phase+.5)-.5)*length*.30;
        float aa=max(fwidth(phase)*length*.30,.001);
        float thickness=min(.085,length*.04);
        float stroke=1.-smoothstep(thickness-aa,thickness+aa,distance);
        float ends=smoothstep(0.,length*.04,x)*smoothstep(0.,length*.04,length-x);
        float sides=1.-smoothstep(.84,1.,y);
        float highlight=pow(.5+.5*cos(index*1.5-time*3.),3.);
        float alpha=stroke*ends*sides*(.65+.3*highlight);
        if(alpha<.002)discard;
        gl_FragColor=vec4(color*(.4+.6*highlight),alpha);
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(length,width),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.set((from+to)/2,.12,0);
  mesh.visible=false;
  return mesh;
}
