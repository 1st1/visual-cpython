import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage();const errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('http://grid.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>'});
    const files={'/three.module.js':'node_modules/three/build/three.module.js','/three.core.js':'node_modules/three/build/three.core.js','/grid.mjs':'web/grid.mjs'};
    if(!files[path])return route.abort();
    await route.fulfill({contentType:'text/javascript',body:await readFile(files[path])});
  });
  await page.goto('http://grid.test/');
  // @lat: [[scene#Isometric factory scene#Grid continuity checks]]
  const results=await page.evaluate(async()=>{
    const THREE=await import('three'),{createGrid}=await import('./grid.mjs');
    const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(800,500);
    document.body.append(renderer.domElement);
    const target=new THREE.WebGLRenderTarget(800,500);renderer.setRenderTarget(target);
    const scene=new THREE.Scene();
    const deck=new THREE.Mesh(new THREE.BoxGeometry(40,.42,40),new THREE.MeshBasicMaterial({color:0x11182d,transparent:true,opacity:.7,depthWrite:false}));
    deck.position.y=-.22;deck.renderOrder=-2;scene.add(deck);
    const {mesh,uniforms}=createGrid({minX:-20,maxX:20,minZ:-20,maxZ:20},Array.from({length:4},(_,i)=>({x:-15+i*10,width:10,minZ:-20,maxZ:20})));
    scene.add(mesh);
    const camera=new THREE.PerspectiveCamera(38,1.6,.1,2000),results=[];
    const read=()=>{renderer.render(scene,camera);const data=new Uint8Array(800*500*4);renderer.readRenderTargetPixels(target,0,0,800,500,data);return data;};
    for(const header of [false,true])for(const distance of [20,100,400])for(const elevation of [.15,.4,1.3])for(const pan of [-.2,0,.2]){
      camera.position.set(.3,Math.sin(elevation),Math.cos(elevation)).normalize().multiplyScalar(distance);
      camera.lookAt(0,0,0);camera.position.x+=pan;camera.zoom=distance/12;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      for(const active of [0,1]){
        uniforms.gridStart.value=header?-.2:-18.2;
        uniforms.activation.value.fill(active);uniforms.time.value=9;
        mesh.visible=false;const background=read();mesh.visible=true;const actual=read();
        let samples=0,missing=0;
        for(let z=-3;z<=3;z+=.05){
          const point=(header?new THREE.Vector3(z,.04,-.2):new THREE.Vector3(0,.04,z)).project(camera);
          const x=Math.round((point.x+1)*400),y=Math.round((point.y+1)*250);
          if(x<3||x>796||y<3||y>496)continue;
          samples++;let contrast=0;
          for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
            const i=((y+dy)*800+x+dx)*4;
            contrast=Math.max(contrast,actual[i+2]-background[i+2]);
          }
          if(contrast<5)missing++;
        }
        results.push({header,distance,elevation,pan,active,samples,missing});
      }
    }
    renderer.setRenderTarget(null);renderer.render(scene,camera);
    return results;
  });
  assert.deepEqual(errors,[]);
  for(const result of results){assert.ok(result.samples>50);assert.equal(result.missing,0,JSON.stringify(result));}
  await page.screenshot({path:'artifacts/grid-continuity.png'});
  console.log('PASS grid continuity: 108 grid/header distance/elevation/pan/activity combinations');
} finally {await browser.close();}
