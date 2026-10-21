import assert from 'node:assert/strict';
import * as THREE from 'three';
import {OpcodeTrail} from '../web/opcode-trail.mjs';
// @lat: [[scene#Isometric X-Ray scene#Opcode transition trail]]
const scene=new THREE.Scene(),trail=new OpcodeTrail(scene);
const tile=(x,z)=>({position:new THREE.Vector3(x,.8,z),width:2,height:1});
for(const [x,z] of [[3,0],[-3,0],[0,3],[0,-3],[3,4]]){
  trail.start(tile(0,0),tile(x,z),100);trail.mesh.updateMatrixWorld(true);
  const expectedWidth=(Math.abs(z)*2+Math.abs(x))/Math.hypot(x,z);
  assert.ok(Math.abs(trail.material.uniforms.widths.value.x-expectedWidth)<1e-6,'Trail spans tile cross-section');
  const tip=new THREE.Vector3(.5,0,0).applyMatrix4(trail.mesh.matrixWorld);
  assert.ok(Math.hypot(tip.x-x,tip.z-z)<1e-6,'Trail points toward new opcode');
  trail.update(350);assert.equal(trail.mesh.visible,true);
  trail.update(600);assert.equal(trail.mesh.visible,false);
}
trail.start(tile(0,0),tile(3,0),100);trail.update(110,true);assert.equal(trail.mesh.visible,false);
trail.start(tile(0,0),tile(0,0),100);assert.equal(trail.mesh.visible,false);
trail.dispose();assert.equal(scene.children.length,0);
console.log('PASS opcode trail orientation, expiry, reduced motion, and teardown');
