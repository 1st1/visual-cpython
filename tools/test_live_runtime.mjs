import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import createModule from '../web/public/runtime/python.mjs';
const stdlib=new Uint8Array(await readFile(new URL('../web/public/runtime/python3.16.zip',import.meta.url)));
const script=await readFile(new URL('../runtime/capture.py',import.meta.url),'utf8');
let finish,events=0,opcodes=0,lastSequence=-1;
const exited=new Promise(resolve=>{finish=resolve;}),lines=[],errors=[];
const runtime=await createModule({
 noInitialRun:true,onExit:finish,print:line=>lines.push(line),
 printErr:line=>{
  if(!line.startsWith('@factory-event:')){errors.push(line);return;}
  const event=JSON.parse(line.slice(15));assert.equal(event.seq,lastSequence+1);lastSequence=event.seq;
  events++;if(event.kind==='opcode')opcodes++;
 },
 preRun(m){
  m.FS.mkdirTree('/lib/python3.16/lib-dynload');m.FS.writeFile('/lib/python316.zip',stdlib);
  m.FS.writeFile('/capture.py',script);
  m.FS.writeFile('/program.py','def f(x):\n return x+1\nfor i in range(4500):\n n=f(i)\n print(n)');
  const device=m.FS.makedev(64,0);
  m.FS.registerDevice(device,{open(s){s.seekable=false;},async readAsync(s,b,p){b[p]=115;return 1;}});
  m.FS.mkdev('/dev/factory-control',0o600,device);
 },
});
const immediate=runtime.callMain(['-I','/capture.py','/program.py','--live']);
assert.equal(Number.isInteger(immediate)?immediate:await exited,0,errors.join('\n'));
const result=JSON.parse(lines.join('\n'));
assert.equal(result.status,'completed',result.error);
assert.ok(opcodes>2000);assert.equal(result.events.length,0,'Runtime does not retain a trace');
assert.equal(result.stdout.length,4096);assert.ok(result.stdout.endsWith('4500\n'));
console.log(`PASS ${events} streamed events, 4,500 calls, identity eviction, rolling output, no runtime trace retention`);
