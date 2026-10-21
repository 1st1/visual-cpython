import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try{
 const page=await browser.newPage();
 await page.goto(process.env.XRAY_URL||'http://127.0.0.1:8000');
 await page.locator('#toggle-editor').click();
 await page.locator('#source').fill('print(7)\nwhile True:\n pass');await page.locator('#run').click();
 await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
 assert.equal(await page.locator('#state').textContent(),'compiled');
 assert.equal(await page.locator('#stdout').textContent(),'');
 assert.equal(await page.locator('#seek').isDisabled(),true);
 await page.locator('#play').click();
 await page.waitForFunction(()=>Number(document.querySelector('#seek').max)>2);
 await page.locator('#example').selectOption('accumulate');await page.waitForTimeout(300);
 assert.equal(await page.locator('#state').textContent(),'Ready');
 assert.equal(await page.locator('#play').isDisabled(),true);
 assert.equal(await page.locator('#xray').getAttribute('data-pipeline-columns'),'1');
 await page.locator('#source').fill('if');await page.locator('#run').click();
 await page.waitForFunction(()=>!document.querySelector('#run').disabled);
 assert.equal(await page.locator('#state').textContent(),'error');assert.equal(await page.locator('#play').isDisabled(),true);
 console.log('PASS compile-only infinite loop, explicit Run, reset during execution, stale source, syntax error');
}finally{await browser.close();}
