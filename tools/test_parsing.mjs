import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('web/public/runtime/runtime.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  const assets=[];page.on('request',r=>{const url=new URL(r.url());if(/\/runtime\/(python\.mjs|python\.wasm|python3\.16\.zip|capture\.py)$/.test(url.pathname))assets.push(url);});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.FACTORY_URL || 'http://127.0.0.1:8000');
  async function capture(source) {
    await page.locator('#source').fill(source);await page.locator('#run').click();
    await page.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
    await page.waitForFunction(()=>/Graphviz|No compiled/.test(document.querySelector('#map-status').textContent));
  }
  await capture('def f(x):\n    return x+1\nprint(f(3))');
  assert.equal(new Set(assets.map(u=>u.pathname)).size,4);
  for(const url of assets)assert.equal(url.searchParams.get('build'),manifest.version,'All runtime assets use the current bundle version');
  assert.equal(await page.locator('#view-parsing, #view-execution').count(),0,'Parsing flows automatically without mode switches');
  assert.ok(Number(await page.locator('#factory').getAttribute('data-parse-tokens'))>10);
  assert.ok(Number(await page.locator('#factory').getAttribute('data-ast-nodes'))>10);
  await page.waitForFunction(()=>document.querySelector('#factory').dataset.phase==='replay',null,{timeout:60000});
  assert.equal(await page.locator('#factory').getAttribute('data-ast-visible'),'true');
  assert.equal(await page.locator('#factory').getAttribute('data-ghost-count'),'0');
  await page.screenshot({path:'artifacts/parsing-ast.png'});
  await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#play').textContent==='Pause',null,{timeout:60000});
  await page.locator('#play').click();
  const pipeline=await page.locator('#factory').getAttribute('data-pipeline');
  await page.locator('#seek').focus();await page.locator('#seek').press('End');
  assert.equal(await page.locator('#factory').getAttribute('data-pipeline'),pipeline,'Replay retains compilation geometry');
  assert.equal(await page.locator('#stdout').textContent(),'4\n');
  await capture('x = (');
  assert.equal(await page.locator('#factory').getAttribute('data-ast-nodes'),'0');
  assert.equal(await page.locator('#factory').getAttribute('data-blocks'),'0');
  assert.equal(await page.locator('#state').textContent(),'error');
  assert.deepEqual(errors,[]);
  console.log('PASS versioned runtime assets, automatic tokenizer/AST construction, execution replay, syntax failure');
} finally {await browser.close();}
