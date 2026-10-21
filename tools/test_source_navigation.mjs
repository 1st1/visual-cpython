import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {sourceVisits,nextSourceVisit} from '../web/source-navigation.mjs';
const events=[
 {seq:0,kind:'call',line:1,frame:'a'},
 ...[[1,2,'a',0],[2,2,'a',2],[3,3,'a',4],[4,2,'a',0],[5,2,'b',0]].map(([seq,line,frame,offset])=>({seq,line,frame,offset,kind:'opcode'})),
];
const visits=sourceVisits(events);
assert.deepEqual(visits.get(2),[1,4,5]);assert.equal(nextSourceVisit(visits,2,1),4);
assert.equal(nextSourceVisit(visits,2,5),1);assert.equal(nextSourceVisit(visits,4,0),undefined);
const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===100?0:ms,...args);});
 await page.goto(process.env.XRAY_URL||'http://127.0.0.1:8000');
 if(await page.locator('#editor-panel').isHidden()) await page.locator('#toggle-editor').click();
 await page.locator('#source').fill('total=0\nfor i in range(3):\n total+=i\n\nprint(total)');await page.locator('#run').click();
 await page.waitForFunction(()=>!document.querySelector('#play').disabled,null,{timeout:60000});
 await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#state').textContent==='completed',null,{timeout:60000});
 await page.locator('#seek').fill('0');await page.locator('#seek').dispatchEvent('input');
 if(await page.locator('#editor-panel').isVisible())await page.locator('#close-editor').click();
 await page.locator('#toggle-inspector').click();
 assert.equal(await page.locator('#block-select, #focus-block, #visit-block, .opcode-heading button').count(),0);
 const line=page.locator('#source-view [data-line="3"]');
 await line.click();const first=Number(await page.locator('#seek').inputValue());
 assert.equal(await page.locator('#xray').getAttribute('data-active-source'),'3');
 await line.click();assert.ok(Number(await page.locator('#seek').inputValue())>first,'Repeated line click advances to next visit, not next opcode');
 assert.equal(await page.locator('#source-view [data-line="4"]').isDisabled(),true);
 await page.locator('#seek').fill(await page.locator('#seek').getAttribute('max'));await page.locator('#seek').dispatchEvent('input');
 await line.click();assert.equal(Number(await page.locator('#seek').inputValue()),first,'Past the last visit wraps to first');
 await page.locator('#toggle-inspector').click();await page.locator('#camera-top').click();
 await page.waitForTimeout(350);
 const pose=JSON.parse(await page.locator('#xray').getAttribute('data-camera'));
 const pipeline=JSON.parse(await page.locator('#xray').getAttribute('data-pipeline'));
 const camera=new THREE.PerspectiveCamera(38,1.6,.1,2000);camera.position.fromArray(pose);camera.quaternion.fromArray(pose,3);camera.zoom=pose[10];camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const point=new THREE.Vector3(pipeline.source+.05,.31,-(5*1.15+1.6)/2+1.2+2*1.15).project(camera);
 await page.mouse.click((point.x+1)*800,(1-point.y)*500);
 assert.ok(Number(await page.locator('#seek').inputValue())>first,'3D source tile uses the same next-visit navigation');
 assert.equal(await page.locator('#xray').getAttribute('data-active-source'),'3');
 assert.deepEqual(errors,[]);
 console.log('PASS line visit boundaries, wraparound, Inspector line clicks, disabled unexecuted lines, 3D source raycast');
}finally{await browser.close();}
