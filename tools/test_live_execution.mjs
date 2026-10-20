import {chromium} from 'playwright';
import assert from 'node:assert/strict';
// @lat: [[runtime#Capture runtime#Live execution checks]]
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>{if(!errors.length)console.log(e.stack);errors.push(e.message);});
 // Run the normal permit scheduler faster, without changing worker stepping.
 await page.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===100?0:ms,...args);});
 await page.goto(process.env.FACTORY_URL||'http://127.0.0.1:8000');
 async function compile(source){
  if(await page.locator('#editor-panel').isHidden())await page.locator('#toggle-editor').click();
  await page.locator('#source').fill(source);await page.locator('#run').click();
  await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
  await page.locator('#close-editor').click();
 }
 await compile('n=0\nwhile True:\n n=n+1');
 assert.equal(await page.locator('#state').textContent(),'compiled');
 assert.equal(await page.locator('#seek').isDisabled(),true);
 await page.locator('#play').click();
 await page.waitForFunction(()=>Number(document.querySelector('#seek').max)>=1999,null,{timeout:60000});
 await page.waitForTimeout(2000);
 await page.locator('#play').click();await page.waitForTimeout(100);
 const before=await page.locator('#event').textContent();
 const locals=await page.locator('#locals').textContent();
 await page.waitForTimeout(500);
 assert.equal(await page.locator('#event').textContent(),before,'Pause freezes evaluator');
 assert.equal(await page.locator('#locals').textContent(),locals);
 assert.equal(await page.locator('#message').textContent(),'');
 assert.equal(await page.locator('#seek').getAttribute('max'),'1999','bounded history after rollover');
 const steps=Number((await page.locator('#counter').textContent()).replace(/[^0-9]/g,''));
 assert.ok(steps>2000,'Step count continues past history rollover');
 await page.locator('#next').click();await page.waitForTimeout(100);
 assert.notEqual(await page.locator('#event').textContent(),before,'one real opcode advances');
 await page.locator('#back').click();assert.equal(await page.locator('#event').textContent(),before);
 assert.equal(await page.locator('#counter').textContent(),`Step ${steps.toLocaleString()} of ${(steps+1).toLocaleString()}`);
 await page.locator('#play').click();await page.waitForTimeout(100);
 assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause');
 assert.equal(await page.locator('#cancel, #capture-progress').count(),0);
 assert.equal(await page.locator('#toggle-inspector').evaluate(el=>getComputedStyle(el).userSelect),'none');
 await compile('def f(x):\n return x+1\nprint(f(2))');await page.locator('#play').click();
 await page.waitForFunction(()=>document.querySelector('#state').textContent==='completed');
 assert.equal(await page.locator('#stdout').textContent(),'3\n');
 await compile('import asyncio\nasync def f():\n await asyncio.sleep(.05)\n print(9)\nasyncio.run(f())');await page.locator('#play').click();
 await page.waitForFunction(()=>document.querySelector('#state').textContent==='completed');
 assert.equal(await page.locator('#stdout').textContent(),'9\n');
 await compile('x=1/0');await page.locator('#play').click();
 await page.waitForFunction(()=>document.querySelector('#state').textContent==='error');
 assert.match(await page.locator('#message').textContent(),/ZeroDivisionError/);
 await compile('while True:\n pass');await page.locator('#play').click();
 await page.waitForFunction(()=>Number(document.querySelector('#seek').max)>2);
 assert.equal(await page.locator('#reset').isDisabled(),true);
 const tiles=await page.locator('#factory').getAttribute('data-opcode-tiles');
 await page.locator('#play').click();assert.equal(await page.locator('#reset').isEnabled(),true);
 await page.locator('#reset').click();await page.waitForTimeout(200);
 assert.equal(await page.locator('#reset').isDisabled(),true);
 assert.equal(await page.locator('#counter').textContent(),'0 steps');
 assert.equal(await page.locator('#reset').isVisible(),true);
 assert.equal(await page.locator('#factory').getAttribute('data-opcode-tiles'),tiles);
 assert.equal(await page.locator('#play').isEnabled(),true);
 assert.equal(await page.locator('.playback-buttons > button').first().getAttribute('id'),'reset');
 assert.equal(await page.locator('#message').textContent(),'');
 assert.equal(await page.locator('#factory').getAttribute('data-pipeline-columns'),'4');
 assert.equal(await page.locator('#state').textContent(),'compiled');assert.equal(await page.locator('#seek').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS unlimited live loop, bounded history, pause, opcode step, history back, resume, recompile, fresh execution, async, errors, reset');
}finally{await browser.close();}
