import * as THREE from 'three';

// All plates sample the same low-resolution blurred background.
export function frostSurface(mesh,width,depth,background,replaceBackground=false) {
  mesh.material.dithering=true;
  mesh.material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,background.uniforms);
    shader.uniforms.frostSize={value:new THREE.Vector2(width,depth)};
    shader.vertexShader=`varying vec3 frostPosition;varying vec3 frostNormal;varying vec3 frostView;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        frostPosition=position;
        frostNormal=normalize(normalMatrix*normal);
        frostView=-(modelViewMatrix*vec4(position,1.)).xyz;`);
    shader.fragmentShader=`uniform sampler2D frostBackground;uniform vec2 frostViewport;uniform vec2 frostSize;
      varying vec3 frostPosition;varying vec3 frostNormal;varying vec3 frostView;
      ${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
        float grazing=pow(1.-abs(dot(normalize(frostNormal),normalize(frostView))),3.);
        vec2 edgeDistance=frostSize*.5-abs(frostPosition.xz);
        float edge=1.-smoothstep(0.,.14,min(edgeDistance.x,edgeDistance.y));
        vec2 grainPoint=frostPosition.xz*60.;
        float grain=fract(sin(dot(floor(grainPoint),vec2(12.9898,78.233)))*43758.5453)-.5;
        float grainVisibility=1.-smoothstep(.35,1.2,max(fwidth(grainPoint.x),fwidth(grainPoint.y)));
        diffuseColor.rgb+=vec3(.002+grazing*.015+edge*.015+grain*.004*grainVisibility);
        diffuseColor.a=min(1.,diffuseColor.a+grazing*.06+edge*.04);
      `).replace('#include <opaque_fragment>',`
        vec3 backdrop=texture2D(frostBackground,gl_FragCoord.xy/frostViewport).rgb*.612;
        outgoingLight=mix(backdrop,outgoingLight,diffuseColor.a);
        ${replaceBackground?'diffuseColor.a=1.;':''}
        #include <opaque_fragment>`);
  };
  mesh.material.customProgramCacheKey=()=> 'shared-background-frost-v1-'+replaceBackground;
  return mesh;
}
