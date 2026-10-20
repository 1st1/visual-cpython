import * as THREE from 'three';

// One cached, star-free nebula blur shared by all plates.
export class BackgroundBlur {
  constructor() {
    this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=1;
    this.context=this.canvas.getContext('2d');
    this.source=new THREE.CanvasTexture(this.canvas);this.source.colorSpace=THREE.SRGBColorSpace;
    this.source.generateMipmaps=false;this.source.minFilter=THREE.LinearFilter;
    // Dark linear-light gradients lose most of their levels in 8-bit targets.
    const options={type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false};
    this.horizontal=new THREE.WebGLRenderTarget(1,1,options);
    this.blurred=new THREE.WebGLRenderTarget(1,1,options);
    this.uniforms={frostBackground:{value:this.blurred.texture},frostViewport:{value:new THREE.Vector2()}};
    this.material=new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,
      uniforms:{source:{value:this.source},stepSize:{value:new THREE.Vector2()}},
      vertexShader:'varying vec2 uvBlur;void main(){uvBlur=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 uvBlur;uniform sampler2D source;uniform vec2 stepSize;
        void main(){
          vec3 c=texture2D(source,uvBlur).rgb*.227027;
          c+=(texture2D(source,uvBlur+stepSize*1.384615).rgb+texture2D(source,uvBlur-stepSize*1.384615).rgb)*.316216;
          c+=(texture2D(source,uvBlur+stepSize*3.230769).rgb+texture2D(source,uvBlur-stepSize*3.230769).rgb)*.070270;
          gl_FragColor=vec4(c,1.);
        }`,
    });
    this.scene=new THREE.Scene();this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.scene.add(this.quad);
    this.camera=new THREE.Camera();this.lastSource=null;this.updates=0;
  }
  update(renderer,starfield) {
    renderer.getDrawingBufferSize(this.uniforms.frostViewport.value);
    const source=starfield.nebula,viewport=starfield.canvas;
    const scale=Math.min(.25,512/Math.max(viewport.width,viewport.height));
    const width=Math.max(1,Math.round(viewport.width*scale)),height=Math.max(1,Math.round(viewport.height*scale));
    const resized=this.canvas.width!==width||this.canvas.height!==height;
    if(!resized&&this.lastSource===source)return;
    if(resized){this.source.dispose();this.canvas.width=width;this.canvas.height=height;this.horizontal.setSize(width,height);this.blurred.setSize(width,height);}
    this.context.drawImage(source,0,0,width,height);this.source.needsUpdate=true;
    const previous=renderer.getRenderTarget();
    this.material.uniforms.source.value=this.source;this.material.uniforms.stepSize.value.set(1.8/width,0);
    renderer.setRenderTarget(this.horizontal);renderer.render(this.scene,this.camera);
    this.material.uniforms.source.value=this.horizontal.texture;this.material.uniforms.stepSize.value.set(0,1.8/height);
    renderer.setRenderTarget(this.blurred);renderer.render(this.scene,this.camera);
    renderer.setRenderTarget(previous);this.lastSource=source;this.updates++;
  }
  dispose(){this.source.dispose();this.horizontal.dispose();this.blurred.dispose();this.quad.geometry.dispose();this.material.dispose();this.canvas.width=this.canvas.height=1;}
}
