import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
const page=await browser.newPage({viewport:{width:1600,height:1100}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await mkdir('artifacts',{recursive:true});
async function capture(source) {
  if(await page.locator('#editor-panel').isHidden()) await page.locator('#toggle-editor').click();
  if(await page.locator('#inspector-panel').isVisible()) await page.locator('#toggle-inspector').click();
  await page.locator('#source').fill(source);
  await page.waitForTimeout(250);
  await page.evaluate(()=>new Promise(resolve=>{
    let previous=null;
    function settled(){
      const pose=JSON.parse(document.querySelector('#factory').dataset.camera);
      if(previous&&pose.every((v,i)=>Math.abs(v-previous[i])<1e-7))return resolve();
      previous=pose;requestAnimationFrame(settled);
    }
    requestAnimationFrame(settled);
  }));
  const camera=JSON.parse(await page.locator('#factory').getAttribute('data-framing'));
  await page.locator('#run').click();
  if(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)){
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.equal(Number(await page.locator('.starfield').getAttribute('data-warp')),0);
  }else{
    await page.waitForFunction(()=>Number(document.querySelector('.starfield').dataset.warp)>.03);
  }
  await page.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
  await page.waitForFunction(()=>/Graphviz|No compiled/.test(document.querySelector('#map-status').textContent),null,{timeout:20000});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const after=JSON.parse(await page.locator('#factory').getAttribute('data-framing'));
  assert.ok(camera.every((value,i)=>Math.abs(value-after[i])<.01),'Capture preserves orientation, relative pan, and map framing, including failure results '+JSON.stringify({camera,after}));
}
try {
  await page.goto(process.env.FACTORY_URL || 'http://127.0.0.1:8000');
  await page.waitForFunction(()=>document.querySelector('#factory').dataset.rendered==='true');
  assert.equal(await page.locator('#factory > canvas').count(),1);
  assert.equal(await page.locator('#factory').getAttribute('data-blocks'),'0');
  const viewport=await page.locator('#factory').boundingBox();
  assert.equal(viewport.width,1600);assert.equal(viewport.height,1100);
  assert.equal(await page.locator('#factory').getAttribute('data-source-tiles'),'7');
  assert.equal(await page.locator('#source-highlight').textContent(),await page.locator('#source').inputValue()+'\n');
  assert.ok(await page.locator('#source-highlight .syntax-keyword').count()>0);
  assert.ok(await page.locator('#source-highlight .syntax-number').count()>0);
  assert.equal(await page.locator('.starfield canvas').count(),1);
  assert.equal(await page.locator('.starfield').getAttribute('data-star-count'),'36000');
  const starTime=Number(await page.locator('.starfield').getAttribute('data-time'));
  await page.waitForFunction(t=>Number(document.querySelector('.starfield').dataset.time)>t,starTime);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const still=await page.locator('.starfield').getAttribute('data-time');
  await page.evaluate(()=>new Promise(r=>setTimeout(r,150)));
  assert.equal(await page.locator('.starfield').getAttribute('data-time'),still);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#source').fill('# comment\n\nx=1');
  await page.waitForFunction(()=>document.querySelector('#factory').dataset.sourceTiles==='3');
  await page.locator('#toggle-editor').click();
  assert.equal(await page.locator('#editor-panel').isHidden(),true);
  const minimap=page.locator('.minimap canvas');
  const sceneCanvas=page.locator('#factory > canvas');
  const originalZoom=await page.locator('#factory').getAttribute('data-zoom');
  const beforeScroll=await minimap.getAttribute('data-target');
  await sceneCanvas.dispatchEvent('wheel',{deltaX:80,deltaY:50,deltaMode:0,bubbles:true,cancelable:true});
  await page.waitForFunction(value=>document.querySelector('.minimap canvas').dataset.target!==value,beforeScroll);
  assert.equal(await page.locator('#factory').getAttribute('data-zoom'),originalZoom,'Ordinary trackpad scrolling pans without zooming');
  await sceneCanvas.dispatchEvent('wheel',{deltaY:-10,deltaMode:0,ctrlKey:true,bubbles:true,cancelable:true});
  await page.waitForFunction(value=>Number(document.querySelector('#factory').dataset.zoom)>Number(value),originalZoom);
  await page.locator('#camera-iso').click();
  await page.locator('#toggle-editor').click();
  const panelBefore=await page.locator('#editor-panel').boundingBox();
  const gestureZoom=Number(await page.locator('#factory').getAttribute('data-zoom'));
  const prevented=await sceneCanvas.evaluate(canvas=>{
    return [['gesturestart',1],['gesturechange',1.3],['gestureend',1.3]].map(([type,scale])=>{
      const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'scale',{value:scale});canvas.dispatchEvent(event);return event.defaultPrevented;
    });
  });
  assert.deepEqual(prevented,[true,true,true],'Safari gesture defaults are cancelled on the scene');
  await page.waitForFunction(z=>Math.abs(Number(document.querySelector('#factory').dataset.zoom)-z*1.3)<.001,gestureZoom);
  assert.deepEqual(await page.locator('#editor-panel').boundingBox(),panelBefore,'Pinch leaves overlay geometry unchanged');
  assert.equal(await page.evaluate(()=>scrollX===0&&scrollY===0&&document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#camera-iso').click();
  await page.locator('#toggle-editor').click();
  const beforePan=JSON.parse(await minimap.getAttribute('data-target'));
  await page.getByRole('button',{name:'Pan right',exact:true}).click();
  const afterPan=JSON.parse(await minimap.getAttribute('data-target'));
  assert.ok(afterPan[0]>beforePan[0]);
  await minimap.focus();await minimap.press('ArrowLeft');
  assert.ok(JSON.parse(await minimap.getAttribute('data-target'))[0]<afterPan[0]);
  await minimap.click({position:{x:20,y:30}});
  assert.notDeepEqual(JSON.parse(await minimap.getAttribute('data-target')),beforePan);
  await page.locator('#camera-iso').click();
  await page.screenshot({path:'artifacts/factory-empty.png',fullPage:true});
  await capture('a=2\nb=3\nc=a+b\nprint(c)');
  assert.equal(await page.locator('#map-status').isVisible(),false);
  await page.screenshot({path:'artifacts/factory-hyperspace.png'});
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('#factory').getAttribute('data-phase'),'compilation reveal');
  const captureCruise=Number(await page.locator('.starfield').getAttribute('data-warp'));
  assert.ok(captureCruise>.21&&captureCruise<.23,'Cruise continues after worker completion throughout construction');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#factory').dataset.pipelineLinks||'{}').astOpcode>0,{},{timeout:30000});
  const compilationLinks=JSON.parse(await page.locator('#factory').getAttribute('data-pipeline-links'));
  assert.equal(compilationLinks.sourceToken,0);assert.equal(compilationLinks.tokenAst,0);
  await page.locator('#finish-build').click();
  await page.waitForFunction(()=>Number(document.querySelector('.starfield').dataset.warp)<.01);
  await page.locator('#play').click();
  await page.waitForFunction(()=>{
    const warp=Number(document.querySelector('.starfield').dataset.warp);
    return warp>.18&&warp<.23;
  });
  await page.locator('#play').click();
  await page.waitForFunction(()=>Number(document.querySelector('.starfield').dataset.warp)<.01);
  await page.locator('#first').click();

  for(let i=0;i<30;i++) {
    if((await page.locator('#instructions .active').textContent()).includes('BINARY_OP')) break;
    await page.locator('#next').click();
  }
  assert.equal(Number(await page.locator('#factory').getAttribute('data-opcode-tiles')),await page.locator('#instructions .instruction').count());
  assert.equal(await page.locator('#factory').getAttribute('data-active-source'),'3');
  const pipeline=JSON.parse(await page.locator('#factory').getAttribute('data-pipeline'));
  assert.ok(pipeline.source<pipeline.tokens&&pipeline.tokens<pipeline.ast&&pipeline.ast<pipeline.opcodes);
  assert.ok(Number(await page.locator('#factory').getAttribute('data-active-tokens'))>0);
  assert.ok(Number(await page.locator('#factory').getAttribute('data-active-ast'))>0);
  const links=JSON.parse(await page.locator('#factory').getAttribute('data-pipeline-links'));
  assert.deepEqual(links,{sourceToken:0,tokenAst:0,astOpcode:0},'Execution highlights artifacts without compilation correspondence links');
  const beforeStack=JSON.parse(await page.locator('#factory').getAttribute('data-stack'));
  assert.match(await page.locator('.opcode-list .current').textContent(),/BINARY_OP\s+\+/);
  const opcode=await page.locator('.opcode-list .current').getAttribute('data-offset');
  assert.equal(await page.locator('#factory').getAttribute('data-active-opcode'),`c0:${opcode}`);
  assert.deepEqual(beforeStack.slots.map(s=>s.text.split(' · ')[0]),['int 2','int 3']);
  await page.locator('#focus-stack').click();
  await page.screenshot({path:'artifacts/factory-stack.png',fullPage:true});
  await page.locator('#next').click();
  assert.match(await page.locator('.opcode-list .current').textContent(),/STORE_NAME\s+c/);
  await page.waitForFunction(()=>document.querySelector('#factory').dataset.opcodeTrail==='true');
  await page.waitForFunction(()=>document.querySelector('#factory').dataset.opcodeTrail==='false');
  const afterStack=JSON.parse(await page.locator('#factory').getAttribute('data-stack'));
  assert.equal(afterStack.slots.length,1); assert.match(afterStack.slots[0].text,/int 5/);
  await page.locator('#back').click();
  assert.deepEqual(JSON.parse(await page.locator('#factory').getAttribute('data-stack')),beforeStack);
  await page.locator('#first').click();
  assert.equal(JSON.parse(await page.locator('#factory').getAttribute('data-stack')).sampled,false);
  await page.locator('#example').selectOption('asyncio');
  await page.waitForFunction(()=>document.querySelector('#source').value.includes('async def odds()'));
  await capture(await page.locator('#source').inputValue());
  assert.equal(await page.locator('#state').textContent(),'completed');
  await capture('print(None)');
  let sentinels=false;
  for(let i=0;i<15;i++) {
    const s=JSON.parse(await page.locator('#factory').getAttribute('data-stack'));
    if(s.slots.some(v=>v.kind==='null')&&s.slots.some(v=>v.text.includes('NoneType None'))) {sentinels=true;break;}
    if(await page.locator('#next').isDisabled()) break;
    await page.locator('#next').click();
  }
  assert.ok(sentinels,'3D stack distinguishes internal NULL from Python None');
  await capture('print(0,1,2,3,4,5,6,7,8,9)');
  let overflow;
  for(let i=0;i<30;i++) {
    const s=JSON.parse(await page.locator('#factory').getAttribute('data-stack'));
    if(s.total>8) {overflow=s;break;}
    await page.locator('#next').click();
  }
  assert.ok(overflow); assert.equal(overflow.slots.length,8);
  assert.equal(overflow.hidden+overflow.slots.length,overflow.total);
  assert.equal(overflow.slots[0].index,overflow.hidden);
  assert.equal(overflow.slots.at(-1).index,overflow.total-1);
  await capture('def accumulate(n):\n total=0\n for i in range(n):\n  total=total+i\n return total\nprint(accumulate(4))');
  assert.ok(Number(await page.locator('#factory').getAttribute('data-blocks'))>5);
  await page.locator('#finish-build').click();
  assert.equal(await page.locator('#factory').getAttribute('data-revealed-opcodes'),await page.locator('#factory').getAttribute('data-opcode-tiles'));
  const blocks=await page.locator('#factory').getAttribute('data-blocks');
  const initial=await page.locator('#factory').getAttribute('data-active-block');
  await page.locator('#next').click(); await page.locator('#back').click();
  assert.equal(await page.locator('#factory').getAttribute('data-active-block'),initial);
  await page.locator('#toggle-inspector').click();
  const option=await page.locator('#block-select option').nth(2).getAttribute('value');
  await page.locator('#block-select').selectOption(option);
  assert.equal(await page.locator('#factory').getAttribute('data-selected-block'),option);
  await page.locator('#visit-block').click();
  assert.equal(await page.locator('#factory').getAttribute('data-active-block'),option);
  await page.screenshot({path:'artifacts/factory-iso.png',fullPage:true});
  await page.locator('#camera-top').click();
  await page.screenshot({path:'artifacts/factory-top.png',fullPage:true});
  await page.locator('#block-select').selectOption('');
  await page.locator('#toggle-inspector').click();
  await page.locator('#toggle-editor').click();
  const activeLabel=await page.locator('.scene-label.active').boundingBox();
  await page.mouse.click(activeLabel.x+activeLabel.width/2,activeLabel.y+activeLabel.height+12);
  assert.equal(await page.locator('#factory').getAttribute('data-selected-block'),option,'Raycast selects the building beneath its screen label');
  await page.locator('#zoom-in').click(); await page.locator('#toggle-inspector').click(); await page.locator('#focus-block').click(); await page.locator('#toggle-inspector').click();
  await page.locator('#camera-iso').click();
  const canvas=await page.locator('#factory > canvas').boundingBox();
  await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.5);
  await page.mouse.down(); await page.mouse.move(canvas.x+canvas.width*.65,canvas.y+canvas.height*.55,{steps:8}); await page.mouse.up();
  await page.locator('#view-map').click();
  assert.equal(await page.locator('#map .node').count(),Number(blocks));
  await page.locator('#view-3d').click();
  assert.equal(await page.locator('#factory').getAttribute('data-blocks'),blocks);
  await page.locator('#seek').focus(); await page.locator('#seek').press('End');
  assert.equal(await page.locator('#stdout').textContent(),'6\n');
  await capture('if');
  assert.equal(await page.locator('#factory').getAttribute('data-blocks'),'0');
  await page.locator('#example').selectOption('shortest');
  await page.waitForFunction(()=>document.querySelector('#source').value.includes('def shortest_path'));
  await page.locator('#run').click();
  await page.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
  await page.waitForFunction(()=>/Graphviz/.test(document.querySelector('#map-status').textContent),null,{timeout:20000});
  assert.equal(await page.locator('#state').textContent(),'completed');
  assert.doesNotMatch(await page.locator('#map-status').textContent(),/warnings/);
  const instruction=page.locator('.opcode-list button:not(:disabled)').first();
  const targetOffset=await instruction.getAttribute('data-offset');
  await instruction.click();
  assert.equal(await page.locator('.opcode-list .current').getAttribute('data-offset'),targetOffset);
  await page.locator('#toggle-inspector').click(); await page.locator('#focus-block').click(); await page.locator('#toggle-inspector').click();
  await page.screenshot({path:'artifacts/factory-opcodes.png',fullPage:true});
  await page.locator('#camera-iso').click();
  await page.locator('#toggle-editor').click();
  await page.screenshot({path:'artifacts/factory-landscape.png',fullPage:true});
  await page.locator('#seek').focus(); await page.locator('#seek').press('End');
  assert.equal(await page.locator('#factory').getAttribute('data-active-source'),'');
  assert.equal(await page.locator('#stdout').textContent(),'[0, 1, 3, 5]\n');
  assert.equal(await page.locator('.opcode-list .current').count(),0);
  const savedSeek=await page.locator('#seek').inputValue();
  const savedOutput=await page.locator('#stdout').textContent();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#factory').dataset.layoutAspect)-390/844)<.001);
  assert.equal(await page.locator('#seek').inputValue(),savedSeek);
  assert.equal(await page.locator('#stdout').textContent(),savedOutput);
  assert.equal(await page.locator('#factory').getAttribute('data-phase'),'replay');
  await capture('x=2\ny=3\nprint(x+y)');
  await page.locator('#factory').scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/factory-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS WebGL scene, idle infrastructure, graph geometry, replay, selection, camera, view switching, reset, reduced motion, mobile');
} finally { await browser.close(); }

const fallback=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true,args:['--disable-webgl']});
try {
  const page=await fallback.newPage();
  await page.goto(process.env.FACTORY_URL || 'http://127.0.0.1:8000');
  await page.waitForFunction(()=>document.querySelector('#view-3d').disabled);
  assert.equal(await page.locator('#view-map').getAttribute('aria-pressed'),'true');
  await page.locator('#source').fill('print(7)'); await page.locator('#run').click();
  await page.waitForFunction(()=>/Graphviz/.test(document.querySelector('#map-status').textContent),null,{timeout:60000});
  assert.ok(await page.locator('#map .node').count()>0);
  console.log('PASS WebGL unavailable: schematic and capture remain usable');
} finally { await fallback.close(); }
