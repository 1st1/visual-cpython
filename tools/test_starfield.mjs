import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try{
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
  const origin=process.env.XRAY_URL || 'http://127.0.0.1:8000';
  await page.route(origin+'/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0"></body>'}));
  await page.goto(origin);
  // @lat: [[scene#Isometric X-Ray scene#Space presentation]]
  const result=await page.evaluate(async threePath=>{
    const THREE=await import(threePath),{Starfield}=await import('/starfield.mjs');
    const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(800,600);document.body.append(renderer.domElement);
    const stars=new Starfield(document.body);
    const counts=[stars.far.geometry.instanceCount,stars.near.geometry.instanceCount];
    const attributes=[stars.far,stars.near].flatMap(m=>Object.values(m.geometry.attributes));
    const versions=attributes.map(a=>a.version);
    const gl=renderer.getContext();
    const read=()=>{const p=new Uint8Array(800*600*4);gl.readPixels(0,0,800,600,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
    stars.draw(0,800,600,false);stars.render(renderer);const idle=read();
    const calls=renderer.info.render.calls;
    stars.setPlaying(true);
    for(let i=1;i<60;i++){stars.draw(i*16,800,600,false);stars.render(renderer);}
    const running=read(),distance=stars.distance;
    stars.draw(1000,800,600,true);stars.render(renderer);const still=read();
    stars.draw(1100,800,600,true);stars.render(renderer);const stillAgain=read();
    const frozen=stars.distance===distance&&stars.warp===0&&still.every((v,i)=>v===stillAgain[i]);
    const motion=idle.some((v,i)=>v!==running[i]);
    const noUploads=attributes.every((a,i)=>a.version===versions[i]);
    // Isolate one near star and translate it across a CSS pixel. Its total light
    // should remain stable rather than flashing with rasterizer pixel coverage.
    stars.backdrop.visible=false;stars.far.visible=false;stars.near.geometry.instanceCount=1;
    stars.uniforms.distance.value=0;stars.uniforms.warp.value=0;
    const star=stars.near.geometry.getAttribute('star');const energies=[];
    for(let step=0;step<=10;step++){
      star.setXYZW(0,(step/10)*2/(800*.55),0,2,1);star.needsUpdate=true;
      stars.render(renderer);const p=read();let sum=0;
      for(let i=0;i<p.length;i+=4)sum+=p[i]+p[i+1]+p[i+2];energies.push(sum);
    }
    const energyRatio=Math.max(...energies)/Math.min(...energies);
    stars.draw(1200,3840,2160,true);
    const blurPixels=stars.viewport.width*stars.viewport.height;
    stars.dispose();renderer.render(new THREE.Scene(),new THREE.Camera());
    const released=renderer.info.memory.geometries===0&&renderer.info.memory.textures===0;
    renderer.dispose();return {calls,frozen,motion,noUploads,energyRatio,counts,blurPixels,released};
  },'/@fs'+fileURLToPath(import.meta.resolve('three')));
  assert.deepEqual(errors,[]);assert.equal(result.calls,3);assert.deepEqual(result.counts,[32400,3600]);
  assert.ok(result.noUploads,'Ordinary animation does not upload star attributes');
  assert.ok(result.motion);assert.ok(result.frozen);assert.ok(result.released);
  assert.ok(result.blurPixels<=2010000);
  assert.ok(result.energyRatio<1.2,`Subpixel brightness remains stable: ${result.energyRatio}`);
  console.log('PASS WebGL stars: three calls, static buffers, motion, reduced motion, brightness, disposal',result);
}finally{await browser.close();}
