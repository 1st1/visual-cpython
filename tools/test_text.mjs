import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage();
  await page.goto(process.env.FACTORY_URL || 'http://127.0.0.1:8000');
  // @lat: [[scene#Isometric factory scene#Shared distance-field text]]
  const results=await page.evaluate(async()=>{
    const THREE=await import('three'),{surfaceText}=await import('./text-atlas.mjs');
    const renderer=new THREE.WebGLRenderer();renderer.setSize(800,400);
    const target=new THREE.WebGLRenderTarget(800,400);renderer.setRenderTarget(target);
    const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);
    group.position.set(-100,0,30);
    const body=new THREE.Mesh(new THREE.BoxGeometry(8.2,.38,1.1),new THREE.MeshBasicMaterial({color:'#506080'}));
    body.renderOrder=-1;body.position.y=.49;group.add(body);
    const paint=surfaceText(group,0,.69,0,8.1,1.0125,{background:'#293d60'});
    paint([{size:.223,text:'total = total + step',color:'#ffffff'}]);
    const camera=new THREE.PerspectiveCamera(38,2,.1,2000),results=[];
    const surfaces=[];group.traverse(o=>{if(o.material&&o!==body)surfaces.push(o.material);});
    const read=()=>{renderer.render(scene,camera);const data=new Uint8Array(800*400*4);renderer.readRenderTargetPixels(target,0,0,800,400,data);return data;};
    for(const distance of [20,100,400])for(const elevation of [.15,.4,1.3])for(const pan of [-.2,-.1,0,.1,.2]){
      camera.position.copy(group.position).add(new THREE.Vector3(.3,Math.sin(elevation),Math.cos(elevation)).normalize().multiplyScalar(distance));
      camera.lookAt(group.position);camera.position.x+=pan;camera.updateMatrixWorld();camera.zoom=distance/7;camera.updateProjectionMatrix();
      surfaces.forEach(m=>m.depthTest=true);const actual=read();
      surfaces.forEach(m=>m.depthTest=false);const reference=read();
      let missing=0,ink=0;
      for(let i=0;i<actual.length;i+=4){if(reference[i]>150)ink++;if(Math.abs(reference[i]-actual[i])>5)missing++;}
      results.push({distance,elevation,pan,missing,ink});
    }
    target.dispose();renderer.dispose();return results;
  });
  for(const result of results){assert.ok(result.ink>0,'Text is visible '+JSON.stringify(result));assert.equal(result.missing,0,JSON.stringify(result));}
  console.log('PASS tile backing and glyph depth across',results.length,'pan/distance/angle combinations');
} finally {await browser.close();}
