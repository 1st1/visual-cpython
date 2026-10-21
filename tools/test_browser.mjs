import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true, args: ['--disable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.XRAY_URL || 'http://127.0.0.1:8000';
await mkdir('artifacts', { recursive: true });

async function capture(source, status = 'completed') {
  if(await page.locator('#editor-panel').isHidden()) await page.locator('#toggle-editor').click();
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await page.waitForFunction(() => !document.querySelector('#run').disabled, null, { timeout: 60000 });
  if(await page.locator('#state').textContent()==='compiled'){
    await page.waitForFunction(()=>!document.querySelector('#play').disabled);
    await page.locator('#play').click();
    await page.waitForFunction(()=>['completed','error'].includes(document.querySelector('#state').textContent),null,{timeout:60000});
    await page.locator('#seek').fill('0');await page.locator('#seek').dispatchEvent('input');
  }
  assert.equal(await page.locator('#state').textContent(), status, await page.locator('#message').textContent());
  if (status !== 'Stopped') {
    await page.waitForFunction(() => /Graphviz|No compiled program|failed|unavailable/.test(document.querySelector('#map-status').textContent), null, { timeout: 20000 });
    assert.doesNotMatch(await page.locator('#map-status').textContent(), /failed|unavailable|warnings/);
  }
}
async function end() {
  await page.locator('#seek').focus();
  await page.locator('#seek').press('End');
}

try {
  await page.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===100?0:ms,...args);});
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#xray').hidden);
  await capture('a=2\nb=3\nc=a+b\nprint(c)');
  let foundAddition = false;
  for (let i = 0; i < 30; i++) {
    const stack = await page.locator('#stack').textContent();
    if (stack.includes('int: "2"') && stack.includes('int: "3"')) {
      foundAddition = true;
      break;
    }
    await page.locator('#next').click();
  }
  assert.ok(foundAddition, 'Observed addition instruction not found');
  assert.equal(await page.locator('#map .executing').count(), 1);
  const geometry = await page.locator('#map svg').getAttribute('viewBox');
  const activeBlock = await page.locator('#map .executing').getAttribute('id');
  assert.match(await page.locator('#stack').textContent(), /int: "2"/);
  assert.match(await page.locator('#stack').textContent(), /int: "3"/);
  const before = await page.locator('#event').textContent();
  await page.locator('#next').click();
  assert.match(await page.locator('#stack').textContent(), /int: "5"/);
  await page.locator('#back').click();
  assert.equal(await page.locator('#event').textContent(), before);
  assert.equal(await page.locator('#map .executing').getAttribute('id'), activeBlock);
  assert.equal(await page.locator('#map svg').getAttribute('viewBox'), geometry);
  await page.locator('#toggle-editor').click();
  await page.locator('#map .node').first().click();
  await page.locator('#toggle-editor').click();
  assert.equal(await page.locator('#block-detail').count(),0);
  assert.equal(await page.locator('#map .selected').count(),1);
  assert.equal(await page.locator('#inspector-panel').isVisible(),true);
  await page.locator('#next').click();
  await page.locator('#toggle-inspector').click();
  assert.equal(await page.locator('#map .selected').count(),0,'Stepping restores execution following');
  await page.screenshot({ path: 'artifacts/workbench-desktop.png', fullPage: true });
  await end();
  assert.equal(await page.locator('#stdout').textContent(), '5\n');
  console.log('PASS actual WASM operand stacks, forward/back, output');

  await capture('def f(x):\n    if x > 3:\n        return x * 2\n    return x + 1\nprint(f(2), f(7))');
  assert.equal(await page.locator('#map .cluster').count(), 2);
  assert.ok(await page.locator('#map .edge').count() > 2);
  await page.screenshot({ path: 'artifacts/program-map.png', fullPage: true });
  await end();
  assert.equal(await page.locator('#stdout').textContent(), '3 14\n');
  await capture('a=[1,2]\nb=a\na[0]=9\nprint(b[0])');
  await end();
  assert.equal(await page.locator('#stdout').textContent(), '9\n');
  await capture('x=1/0', 'error');
  assert.match(await page.locator('#message').textContent(), /ZeroDivisionError/);
  await capture('if', 'error');
  assert.equal(await page.locator('#next').isDisabled(), true);
  console.log('PASS functions, branches, aliases, runtime and syntax errors');

  await capture('print(7)');await end();
  await page.locator('#play').click();
  await page.locator('#run').click();
  await page.waitForFunction(()=>!document.querySelector('#play').disabled);
  assert.equal(await page.locator('#message').textContent(),'');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('print(42)');
  await end();
  assert.equal(await page.locator('#stdout').textContent(), '42\n');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'artifacts/workbench-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS cancellation, mobile layout, no browser script errors');
} finally {
  await browser.close();
}
