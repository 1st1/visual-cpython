import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
// @lat: [[runtime#Capture runtime#Editor diagnostics and standard-library checks]]
const browser=process.env.XRAY_BROWSER==='webkit'?await webkit.launch():await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const timeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===100?0:ms,...args);});
 await page.goto(process.env.XRAY_URL||'http://127.0.0.1:8000');await page.locator('#toggle-editor').click();
 await page.locator('.cm-content').fill('pass');await page.keyboard.press('Home');await page.keyboard.press('Tab');
 assert.equal(await page.locator('#source').inputValue(),'    pass');await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#source').inputValue(),'pass');
 await page.locator('.cm-content').fill('#'.repeat(16385));
 assert.equal(await page.locator('#source').inputValue(),'pass');
 assert.match(await page.locator('#editor-error').textContent(),/16 KiB/);
 for(const source of ['if','import third_party_module']){
  await page.locator('.cm-content').fill(source);await page.locator('#close-editor').click();await page.locator('#run').click();
  await page.waitForFunction(()=>!document.querySelector('#editor-error').hidden,null,{timeout:60000});
  assert.equal(await page.locator('#editor-panel').isVisible(),true);assert.match(await page.locator('#editor-error').textContent(),/Line 1:/);
  const editorBox=await page.locator('#code-editor').boundingBox(),errorBox=await page.locator('#editor-error').boundingBox();assert.ok(errorBox.y>=editorBox.y+editorBox.height);
  assert.equal(await page.locator('.cm-content').getAttribute('aria-invalid'),'true');assert.equal(await page.locator('#message').textContent(),'');
 }
 await page.locator('.cm-content').fill('import time, math, json, sys\nfrom collections import Counter\ntime.sleep(.05)\nprint(math.sqrt(9), json.dumps([1]), Counter("aba")["a"])\nprint("stderr works", file=sys.stderr)');
 assert.equal(await page.locator('#editor-error').isHidden(),true);await page.keyboard.press('Meta+Enter');
 await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
 assert.equal(await page.locator('#xray').getAttribute('data-phase'),'replay','Editor compilation skips the reveal');
 assert.equal(await page.locator('#skip-animation').isHidden(),true);
 await page.locator('#close-editor').click();await page.locator('#play').click();
 await page.waitForFunction(()=>['completed','error'].includes(document.querySelector('#state').textContent),null,{timeout:60000});
 assert.equal(await page.locator('#state').textContent(),'completed',await page.locator('#stdout').textContent());
 assert.equal(await page.locator('#stdout').textContent(),'3.0 [1] 2\nstderr works\n');assert.deepEqual(errors,[]);
 console.log('PASS CodeMirror indentation, compilation diagnostics, stdlib imports, time.sleep, stdout/stderr');
}finally{await browser.close()}
