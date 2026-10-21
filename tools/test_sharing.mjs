import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {encodeProgram,decodeProgram} from '../web/share-codec.mjs';
// @lat: [[runtime#Capture runtime#Shared program links]]
const source='# Unicode survives: café 🐍\nprint("hello")';
assert.equal(await decodeProgram(await encodeProgram(source)),source);
await assert.rejects(decodeProgram('garbage'),/Invalid/);
await assert.rejects(encodeProgram('x'.repeat(16385)),/16 KiB/);
const bomb=new Uint8Array(await new Response(new Blob(['x'.repeat(20000)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
await assert.rejects(decodeProgram(Buffer.from(bomb).toString('base64url')),/16 KiB/);
const browser=process.env.XRAY_BROWSER==='webkit'?await webkit.launch():await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.XRAY_URL||'http://127.0.0.1:8000';
 await page.goto(base);assert.equal(await page.locator('#share-program').isHidden(),true);
 await page.locator('#toggle-editor').click();await page.locator('.cm-content').fill(source);await page.locator('#close-editor').click();
 await page.locator('#share-program').click();
 await page.waitForFunction(()=>!document.querySelector('#copy-share').disabled,null,{timeout:60000});
 const url=await page.locator('#share-url').inputValue();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedShare=text;}}}));
 await page.locator('#copy-share').click();assert.equal(await page.evaluate(()=>window.copiedShare),url);
 assert.equal(await decodeProgram(new URLSearchParams(new URL(url).hash.slice(1)).get('code')),source);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#share-dialog').isHidden(),true);
 await page.goto(url);await page.reload();
 await page.waitForFunction(()=>document.querySelector('#example').value==='custom',null,{timeout:60000});
 assert.equal(await page.locator('#source').inputValue(),source);
 assert.equal(await page.locator('#state').textContent(),'Ready');
 assert.equal(await page.locator('#stdout').textContent(),'');
 assert.equal(await page.locator('#share-program').isVisible(),true);
 await page.locator('#toggle-editor').click();await page.locator('.cm-content').fill('x=1\n'.repeat(86));await page.locator('#close-editor').click();
 await page.locator('#share-program').click();await page.waitForFunction(()=>document.querySelector('#share-status').textContent!=='Preparing link…',null,{timeout:60000});
 assert.match(await page.locator('#share-status').textContent(),/256 Python tokens/);
 assert.equal(await page.locator('#copy-share').isDisabled(),true);await page.keyboard.press('Escape');
 await page.goto(base+'/#code=invalid');await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Invalid shared'));
 assert.equal(await page.locator('#example').inputValue(),'custom');
 assert.equal(await page.locator('#source').inputValue(),'x=1\n'.repeat(86));
 assert.deepEqual(errors,[]);console.log('PASS sharing: Unicode round trip, source-only reload, token limit, malformed and oversized payloads');
}finally{await browser.close()}
