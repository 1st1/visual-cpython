import {chromium} from 'playwright';
import assert from 'node:assert/strict';
// @lat: [[scene#Isometric X-Ray scene#Custom recompilation continuity]]
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.XRAY_URL||'http://127.0.0.1:8000');
 await page.locator('#toggle-editor').click();await page.locator('.cm-content').fill('x=1\nprint(x)');await page.keyboard.press('Meta+Enter');
 await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
 await page.locator('#close-editor').click();await page.locator('#zoom-in').click();await page.waitForTimeout(200);
 const pose=await page.locator('#xray').getAttribute('data-framing');const tokens=Number(await page.locator('#xray').getAttribute('data-parse-tokens'));
 await page.evaluate(()=>{window.sceneStates=[];window.sceneObserver=new MutationObserver(()=>{const x=document.querySelector('#xray');window.sceneStates.push([x.dataset.pipelineColumns,x.dataset.phase]);});window.sceneObserver.observe(document.querySelector('#xray'),{attributes:true,attributeFilter:['data-pipeline-columns','data-phase']});});
 await page.locator('#toggle-editor').click();await page.locator('.cm-content').fill('x=1\nfor i in range(4):\n x=x+i\nprint(x)');await page.locator('#close-editor').click();await page.waitForTimeout(250);
 assert.equal(await page.locator('#xray').getAttribute('data-pipeline-columns'),'4');assert.equal(await page.locator('#play').isDisabled(),true);
 assert.equal(await page.locator('#xray').getAttribute('data-framing'),pose);
 await page.locator('#run').click();await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});await page.waitForTimeout(100);
 const after=JSON.parse(await page.locator('#xray').getAttribute('data-framing')),before=JSON.parse(pose);
 assert.ok(after.every((n,i)=>Math.abs(n-before[i])<1e-5),'Preserve orientation, pan and relative zoom');
 assert.ok(Number(await page.locator('#xray').getAttribute('data-parse-tokens'))>tokens);
 await page.locator('#toggle-editor').click();await page.locator('.cm-content').fill('if');await page.keyboard.press('Meta+Enter');
 await page.waitForFunction(()=>!document.querySelector('#editor-error').hidden);
 assert.equal(await page.locator('#xray').getAttribute('data-pipeline-columns'),'4');assert.equal(await page.locator('#play').isDisabled(),true);
 await page.locator('.cm-content').fill('print(9)');await page.keyboard.press('Meta+Enter');await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
 const states=await page.evaluate(()=>{window.sceneObserver.disconnect();return window.sceneStates;});
 assert.ok(states.length>0);assert.ok(states.every(([columns,phase])=>columns==='4'&&phase!=='compilation reveal'),JSON.stringify(states));
 await page.locator('#example').selectOption('branch');assert.equal(await page.locator('#xray').getAttribute('data-pipeline-columns'),'1');
 assert.deepEqual(errors,[]);console.log('PASS custom recompile continuity, camera preservation, changed layout, failed compile, recovery, example reset');
}finally{await browser.close()}
