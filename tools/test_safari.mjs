import {webkit} from 'playwright';
import assert from 'node:assert/strict';
// @lat: [[runtime#Capture runtime#Safari live stepping checks]]
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Exercise the fallback even when a future WebKit release provides JSPI.
 await page.addInitScript(()=>{
  Object.defineProperty(WebAssembly,'Suspending',{value:undefined,configurable:true});
  const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===100?0:ms,...args);
 });
 await page.route(/\/(?:assets\/worker-[^/]+\.js|worker\.mjs)(?:\?.*)?$/,async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:'WebAssembly.Suspending=undefined;WebAssembly.promising=undefined;\n'+await response.text()});
 });
 await page.goto(process.env.XRAY_URL||'http://127.0.0.1:8000');
 assert.equal(await page.evaluate(()=>crossOriginIsolated&&typeof SharedArrayBuffer==='function'),true,'Cross-origin isolation headers');
 assert.equal(await page.title(),'CPython X-Ray');
 async function compile(source){
  if(await page.locator('#editor-panel').isHidden())await page.locator('#toggle-editor').click();
  await page.locator('#source').fill(source);await page.locator('#run').click();
  await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
  await page.locator('#close-editor').click();
 }
 await compile('n=0\nwhile True:\n n=n+1');await page.locator('#play').click();
 await page.waitForFunction(()=>Number(document.querySelector('#seek').max)>=1999,null,{timeout:60000});
 await page.waitForTimeout(100);
 await page.locator('#play').click();await page.waitForTimeout(100);
 const event=await page.locator('#event').textContent(),locals=await page.locator('#locals').textContent();
 await page.waitForTimeout(300);assert.equal(await page.locator('#event').textContent(),event);assert.equal(await page.locator('#locals').textContent(),locals);
 await page.locator('#next').click();await page.waitForTimeout(100);assert.notEqual(await page.locator('#event').textContent(),event);
 await page.locator('#back').click();assert.equal(await page.locator('#event').textContent(),event);
 // Pausing before Reset makes it available; Reset must terminate an Atomics.wait.
 await page.locator('#play').click();await page.waitForTimeout(100);await page.locator('#play').click();
 await page.locator('#reset').click();assert.equal(await page.locator('#state').textContent(),'compiled');assert.equal(await page.locator('#message').textContent(),'');
 await compile('print(7)');await page.locator('#play').click();
 await page.waitForFunction(()=>document.querySelector('#state').textContent==='completed');assert.equal(await page.locator('#stdout').textContent(),'7\n');
 await compile('import asyncio\nasync def f():\n await asyncio.sleep(.01)\n print(9)\nasyncio.run(f())');await page.locator('#play').click();
 await page.waitForFunction(()=>document.querySelector('#state').textContent==='completed');assert.equal(await page.locator('#stdout').textContent(),'9\n');
 assert.deepEqual(errors,[]);
 console.log('PASS WebKit shared-memory live stepping, history rollover, pause, step, back, reset, fresh run, asyncio');
}finally{await browser.close();}
