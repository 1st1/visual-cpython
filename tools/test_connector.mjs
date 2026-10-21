import assert from 'node:assert/strict';
import {connector} from '../web/connector.mjs';
// @lat: [[scene#Isometric X-Ray scene#Shared geometry]]
for(const dashed of [false,true])for(const points of [
  [[0,0],[0,2],[1,2]],
  [[0,0],[0,2],[.01,2]],
  [[0,0],[0,0],[0,1],[0,1]],
  [[0,0],[1,0],[1,1],[0,1],[0,.2]],
]){
  const edge=connector(points,0xc4a068,{dashed});
  const head=edge.arrow.geometry.attributes.position;
  const tip=[head.getX(0),head.getZ(0)];
  assert.ok(Math.hypot(tip[0]-points.at(-1)[0],tip[1]-points.at(-1)[1])<1e-6);
  const base=[(head.getX(1)+head.getX(2))/2,(head.getZ(1)+head.getZ(2))/2];
  const direction=[tip[0]-base[0],tip[1]-base[1]];
  const shaft=edge.line.geometry.attributes.position;
  for(let i=0;i<shaft.count;i++){
    assert.ok(Number.isFinite(shaft.getX(i))&&Number.isFinite(shaft.getZ(i)));
    assert.ok(shaft.getY(i)>.29,'Route clears tray roof');
  }
  // Both corners of the final shaft cap meet the head base (not the tip).
  if(!dashed){
    const segments=shaft.count<=6?1:(shaft.count+6)/12;
    const start=(segments-1)*6+Math.max(0,segments-2)*6;
    const cap=[(shaft.getX(start+2)+shaft.getX(start+4))/2,(shaft.getZ(start+2)+shaft.getZ(start+4))/2];
    assert.ok(Math.hypot(cap[0]-base[0],cap[1]-base[1])<1e-6);
  }
  if(dashed)assert.ok(Math.hypot(shaft.getX(shaft.count-1)-base[0],shaft.getZ(shaft.count-1)-base[1])<1e-6);
  assert.ok(Math.hypot(...direction)>0,'Short final segments still have a valid head');
  edge.line.geometry.dispose();edge.line.material.dispose();edge.arrow.geometry.dispose();edge.arrow.material.dispose();
}
console.log('PASS connector bends, short terminals, duplicates, and tray clearance');
