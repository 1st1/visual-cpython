import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});
  await page.goto(process.env.FACTORY_URL || 'http://127.0.0.1:8000');
  await page.waitForFunction(()=>document.querySelector('#factory').dataset.rendered==='true');
  const source=await readFile(new URL('../web/programs/shortest_path.py',import.meta.url),'utf8');
  const samples=[];
  for(let run=0;run<3;run++){
    await page.locator('#source').fill(source);
    await page.locator('#run').click();
    await page.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
    await page.waitForFunction(()=>/Graphviz/.test(document.querySelector('#map-status').textContent),null,{timeout:20000});
    await page.locator('#finish-build').click();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    samples.push(await page.evaluate(()=>{
      const f=document.querySelector('#factory'),canvas=f.querySelector(':scope > canvas'),stars=f.querySelector('.starfield canvas');
      return {labels:Number(f.dataset.labelCanvasBytes),textures:Number(f.dataset.gpuTextures),geometries:Number(f.dataset.gpuGeometries),pixels:canvas.width*canvas.height,starPixels:stars.width*stars.height};
    }));
  }
  for(const sample of samples){
    assert.ok(sample.pixels<=3010000);
    assert.ok(sample.starPixels<=2010000);
    assert.ok(sample.labels<100*1024*1024,'BFS canvas labels stay below 100 MiB');
    assert.equal(sample.labels,samples[0].labels);
    assert.ok(sample.textures<=samples[0].textures+2,'Repeated captures release old GPU textures');
    assert.ok(sample.geometries<=samples[0].geometries+2,'Repeated captures release old geometry');
  }
  console.log('PASS high-DPI repeated capture resource bounds',JSON.stringify(samples));
}finally{await browser.close();}
