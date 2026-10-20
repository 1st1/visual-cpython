import * as THREE from 'three';

// One antialiased surface draws the base grid and its lane activity.
export function createGrid(e,lanes) {
    const uniforms={
      time:{value:0},gridStart:{value:e.minZ+1.8},baseColor:{value:new THREE.Color(0x393055)},
      dotColor:{value:new THREE.Color(0x746890)},
      activation:{value:[0,0,0,0]},deckEdges:{value:new THREE.Vector2(e.minX,e.maxX)},
      bounds:{value:Array.from({length:4},(_,i)=>{
        const lane=lanes[i];
        return lane?new THREE.Vector4(lane.x-lane.width/2,lane.minZ,lane.width,lane.maxZ-lane.minZ):new THREE.Vector4(1e6,1e6,1,1);
      })},
    };
    const gridMaterial=new THREE.ShaderMaterial({
      uniforms,transparent:true,depthWrite:false,
      vertexShader:`varying vec2 ground;
        void main(){ground=(modelMatrix*vec4(position,1.)).xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 ground;uniform float time;uniform float gridStart;uniform vec3 baseColor;uniform vec3 dotColor;
        uniform float activation[4];uniform vec4 bounds[4];uniform vec2 deckEdges;
        vec3 gridGlow(vec2 point){
          vec3 color=vec3(0.);
          for(int i=0;i<4;i++){
            vec2 uv=(point-bounds[i].xy)/bounds[i].zw;
            if(uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.){
              float wave=.5+.5*sin(uv.y*4.8-time*.27+sin(uv.x*1.6+time*.06)*1.3);
              float ripple=pow(wave,3.);
              // Feather internal lane boundaries across three grid spacings.
              float left=bounds[i].x<=deckEdges.x+.001?1.:smoothstep(0.,3.,point.x-bounds[i].x);
              float right=bounds[i].x+bounds[i].z>=deckEdges.y-.001?1.:smoothstep(0.,3.,bounds[i].x+bounds[i].z-point.x);
              color+=mix(vec3(.16,.38,.65),vec3(.35,.75,1.),ripple)*activation[i]*left*right*(.15*ripple);
            }
          }
          return color;
        }
        void main(){
          vec2 pixel=max(fwidth(ground),vec2(.00001));
          vec2 intersection=floor(ground+.5);
          // Solid world-space discs with only a one-pixel antialiased edge.
          const float radius=.03;
          float aa=.5*max(pixel.x,pixel.y);
          float dots=1.-smoothstep(radius-aa,radius+aa,length(ground-intersection));
          // Fade unresolved discs instead of enlarging them into bright screen-space dots.
          dots*=min(1.,radius*radius/(aa*aa));
          dots*=smoothstep(2.,6.,1./max(pixel.x,pixel.y));
          dots*=step(gridStart+.0001,intersection.y);
          float border=1.-smoothstep(.35,1.25,abs(ground.y-gridStart)/pixel.y);
          float alpha=max(dots,border);
          if(alpha<.001)discard;
          vec2 header=vec2(floor(ground.x)+.5,gridStart);
          vec3 glow=(gridGlow(intersection)*dots+gridGlow(header)*border)/max(.001,dots+border);
          vec3 color=mix(baseColor,dotColor,dots/max(.001,dots+border))+glow;
          gl_FragColor=vec4(color,max(dots*.55,border*.64));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(e.maxX-e.minX,e.maxZ-e.minZ),gridMaterial);
    mesh.rotation.x=-Math.PI/2;mesh.position.set((e.minX+e.maxX)/2,.04,(e.minZ+e.maxZ)/2);
    mesh.renderOrder=-1;
    return {mesh,uniforms};
}
