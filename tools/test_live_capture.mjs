import {chromium} from 'playwright';
import assert from 'node:assert/strict';
// @lat: [[scene#Isometric X-Ray scene#Runtime activity and construction]]
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.XRAY_URL || 'http://127.0.0.1:8000');
  await page.waitForFunction(()=>document.querySelector('#xray').dataset.rendered==='true');
  if(await page.locator('#editor-panel').isHidden()) await page.locator('#toggle-editor').click();
  await page.locator('.cm-content').fill('import asyncio\nasync def main():\n    print(1)\n    await asyncio.sleep(1)\n    print(2)\n    await asyncio.sleep(1)\nasyncio.run(main())');
  await page.waitForTimeout(300);
  await page.locator('#run').click();
  await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
  await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#state').textContent==='running'&&Number(document.querySelector('#xray').dataset.activeSource)>0,{},{timeout:60000});

  assert.ok(Number(await page.locator('#xray').getAttribute('data-opcode-tiles'))>0);
  await page.waitForFunction(()=>document.querySelector('#state').textContent==='completed',null,{timeout:60000});
  assert.equal(await page.locator('#state').textContent(),'completed');
  assert.deepEqual(errors,[]);
  console.log('PASS live source/opcode highlighting during execution, clean output protocol');
} finally {await browser.close();}
