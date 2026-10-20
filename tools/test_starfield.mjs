import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const origin=process.env.FACTORY_URL || 'http://127.0.0.1:8000';
  await page.route(origin+'/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
  await page.goto(origin);
  // @lat: [[scene#Isometric factory scene#Space presentation]]
  const result=await page.evaluate(async()=>{
    const {Starfield}=await import('/starfield.mjs');
    let gradients=0,strokes=0;
    const stroke=CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke=function(...args){strokes++;return stroke.apply(this,args);};
    const original=CanvasRenderingContext2D.prototype.createLinearGradient;
    CanvasRenderingContext2D.prototype.createLinearGradient=function(...args){gradients++;return original.apply(this,args);};
    const stars=new Starfield(document.body),initial=gradients;
    stars.setPlaying(true);stars.warp=.22;
    stars.draw(0,1600,1000,false);stars.draw(16,1600,1000,false);
    const distance=stars.distance;
    stars.draw(32,1600,1000,true);stars.draw(48,1600,1000,true);
    const reducedStill=stars.distance===distance&&stars.warp===0;
    stars.dispose();
    CanvasRenderingContext2D.prototype.stroke=stroke;
    CanvasRenderingContext2D.prototype.createLinearGradient=original;
    return {initial,gradients,strokes,distance,reducedStill,released:stars.canvas.width===1};
  });
  assert.equal(result.initial,0);
  assert.equal(result.gradients,result.initial,'Flight must reuse streak gradients across frames');
  assert.equal(result.strokes,54,'Two running frames use 27 batched strokes each');
  assert.ok(result.distance>0);assert.ok(result.reducedStill);assert.ok(result.released);
  console.log('Starfield batched streaks, motion, reduced motion, and disposal passed');
} finally {await browser.close();}
