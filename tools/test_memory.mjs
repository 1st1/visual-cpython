import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2,reducedMotion:'reduce'});
  await page.goto(process.env.XRAY_URL || 'http://127.0.0.1:8000');
  await page.waitForFunction(()=>document.querySelector('#xray').dataset.rendered==='true');
  const source=await readFile(new URL('../web/programs/shortest_path.py',import.meta.url),'utf8');
  const samples=[];
  for(let run=0;run<3;run++){
    if(await page.locator('#editor-panel').isHidden()) await page.locator('#toggle-editor').click();
    await page.locator('#source').fill(source);
    await page.locator('#run').click();
    await page.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
    await page.waitForFunction(()=>/Graphviz/.test(document.querySelector('#map-status').textContent),null,{timeout:20000});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    samples.push(await page.evaluate(()=>{
      const f=document.querySelector('#xray'),canvas=f.querySelector(':scope > canvas'),stars=f.querySelectorAll('.starfield canvas');
      return {blur:JSON.parse(f.dataset.backgroundBlur),atlas:JSON.parse(f.dataset.textAtlas),labels:Number(f.dataset.labelCanvasBytes),textures:Number(f.dataset.gpuTextures),geometries:Number(f.dataset.gpuGeometries),pixels:canvas.width*canvas.height,starCanvases:stars.length};
    }));
  }
  for(const sample of samples){
    assert.ok(sample.blur.width<=512&&sample.blur.height<=512,'Shared background blur remains capped');
    assert.ok(sample.blur.updates>0,'Shared background blur rendered');
    assert.equal(sample.blur.updates,samples[0].blur.updates,'Static nebula blur is reused across captures');
    assert.ok(sample.pixels<=8010000);
    assert.equal(sample.starCanvases,0,'Stars share the scene WebGL canvas');
    assert.ok(sample.pixels>3000000,'Retina scene gets more pixels than the old blurry cap');
    assert.equal(sample.labels,0,'No per-label bitmap backing stores');
    assert.ok(sample.atlas.bytes<=4*1024*1024,'Shared glyph pages remain bounded');
    assert.equal(sample.atlas.bytes,samples[0].atlas.bytes);
    assert.ok(sample.textures<10,'Labels share atlas textures instead of one texture per block');
    assert.equal(sample.labels,samples[0].labels);
    assert.ok(sample.textures<=samples[0].textures+2,'Repeated captures release old GPU textures');
    assert.ok(sample.geometries<=samples[0].geometries+2,'Repeated captures release old geometry');
  }
  console.log('PASS high-DPI repeated capture resource bounds',JSON.stringify(samples));
}finally{await browser.close();}
