import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.FACTORY_URL || 'http://127.0.0.1:8000';
await mkdir('artifacts', { recursive: true });

async function capture(source, status = 'completed') {
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await page.waitForFunction(() => !document.querySelector('#run').disabled, null, { timeout: 60000 });
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
  await page.goto(base);
  await capture('a=2\nb=3\nc=a+b\nprint(c)');
  let foundAddition = false;
  for (let i = 0; i < 30; i++) {
    if ((await page.locator('#instructions .active').textContent())?.includes('BINARY_OP')) {
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
  await page.locator('#map .node').first().click();
  assert.match(await page.locator('#block-detail').textContent(), /RESUME/);
  await page.locator('#visit-block').click();
  assert.equal(await page.locator('#map .selected').getAttribute('id'), await page.locator('#map .executing').getAttribute('id'));
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

  await capture('while True:\n    pass', 'limited');
  assert.match(await page.locator('#message').textContent(), /event budget/);
  await capture('print(min(range(1000000000)))', 'Stopped');
  assert.match(await page.locator('#message').textContent(), /5 seconds/);
  await capture('print(7)');
  await end();
  assert.equal(await page.locator('#stdout').textContent(), '7\n');
  console.log('PASS event budget, hard worker timeout, fresh interpreter recovery');

  await page.locator('#run').click();
  await page.locator('#cancel').click();
  assert.match(await page.locator('#message').textContent(), /cancelled/);
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
