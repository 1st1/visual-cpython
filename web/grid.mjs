import * as THREE from 'three';

// One antialiased surface draws the base grid and its lane activity.
export function createGrid(e,lanes) {
    const uniforms={
      time:{value:0},gridStart:{value:e.minZ+1.8},baseColor:{value:new THREE.Color(0x293d60)},
      activation:{value:[0,0,0,0]},deckEdges:{value:new THREE.Vector2(e.minX,e.maxX)},
      bounds:{value:lanes.map(lane=>new THREE.Vector4(lane.x-lane.width/2,lane.minZ,lane.width,lane.maxZ-lane.minZ))},
    };
    const gridMaterial=new THREE.ShaderMaterial({
      uniforms,transparent:true,depthWrite:false,
      vertexShader:`varying vec2 ground;
        void main(){ground=(modelMatrix*vec4(position,1.)).xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 ground;uniform float time;uniform float gridStart;uniform vec3 baseColor;
        uniform float activation[4];uniform vec4 bounds[4];uniform vec2 deckEdges;
        vec3 edgeGlow(vec2 point){
          vec3 color=vec3(0.);
          for(int i=0;i<4;i++){
            vec2 uv=(point-bounds[i].xy)/bounds[i].zw;
            if(uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.){
              float wave=.5+.5*sin(uv.y*4.8-time*.27+sin(uv.x*1.6+time*.06)*1.3);
              float ripple=pow(wave,3.);
              // Feather internal lane boundaries across three complete grid edges.
              float left=bounds[i].x<=deckEdges.x+.001?1.:smoothstep(0.,3.,point.x-bounds[i].x);
              float right=bounds[i].x+bounds[i].z>=deckEdges.y-.001?1.:smoothstep(0.,3.,bounds[i].x+bounds[i].z-point.x);
              color+=mix(vec3(.16,.38,.65),vec3(.35,.75,1.),ripple)*activation[i]*left*right*(.30*ripple);
            }
          }
          return color;
        }
        void main(){
          if(ground.y<gridStart)discard;
          vec2 pixel=max(fwidth(ground),vec2(.00001));
          vec2 distanceToLine=abs(fract(ground+.5)-.5)/pixel;
          vec2 coverage=1.-smoothstep(vec2(.35),vec2(1.25),distanceToLine);
          float border=1.-smoothstep(.35,1.25,abs(ground.y-gridStart)/pixel.y);
          float alpha=max(max(coverage.x,coverage.y),border);
          if(alpha<.001)discard;
          // Each grid edge samples the wave once, at its midpoint.
          vec2 vertical=vec2(floor(ground.x+.5),floor(ground.y)+.5);
          vec2 horizontal=vec2(floor(ground.x)+.5,floor(ground.y+.5));
          vec2 header=vec2(floor(ground.x)+.5,gridStart);
          vec3 glow=(edgeGlow(vertical)*coverage.x+edgeGlow(horizontal)*coverage.y+edgeGlow(header)*border)
                    /max(.001,coverage.x+coverage.y+border);
          vec3 color=baseColor+glow;
          gl_FragColor=vec4(color,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(e.maxX-e.minX,e.maxZ-e.minZ),gridMaterial);
    mesh.rotation.x=-Math.PI/2;mesh.position.set((e.minX+e.maxX)/2,.04,(e.minZ+e.maxZ)/2);
    mesh.renderOrder=-1;
    return {mesh,uniforms};
}
