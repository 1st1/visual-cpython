import {chromium} from 'playwright';
import assert from 'node:assert/strict';
// @lat: [[scene#Isometric factory scene#Runtime activity and construction]]
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.FACTORY_URL || 'http://127.0.0.1:8000');
  await page.waitForFunction(()=>document.querySelector('#factory').dataset.rendered==='true');
  await page.locator('#source').fill('import asyncio\nasync def main():\n    print(1)\n    await asyncio.sleep(1)\n    print(2)\n    await asyncio.sleep(1)\nasyncio.run(main())');
  await page.waitForTimeout(300);
  await page.locator('#run').click();
  await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
  await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#run').disabled&&Number(document.querySelector('#factory').dataset.activeSource)>0,{},{timeout:60000});
  assert.equal(await page.locator('#factory').getAttribute('data-active-stage'),'1');
  assert.ok(Number(await page.locator('#factory').getAttribute('data-opcode-tiles'))>0);
  await page.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
  assert.equal(await page.locator('#state').textContent(),'completed');
  assert.deepEqual(errors,[]);
  console.log('PASS live source-line highlighting before capture completion, source lane activity, clean output protocol');
} finally {await browser.close();}
