import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),runtime=new URL('web/public/runtime/',root);
const manifest=JSON.parse(await readFile(new URL('runtime.json',runtime),'utf8'));
const hash=createHash('sha256');
for(const name of ['python.mjs','python.wasm','python3.16.zip','capture.py']){
  hash.update(name);hash.update(await readFile(new URL(name,runtime)));
}
if(hash.digest('hex')!==manifest.version)throw new Error('Runtime artifacts do not match runtime.json. Repackage with python3 tools/package_web.py.');
const source=await readFile(new URL('runtime/capture.py',root)),packaged=await readFile(new URL('capture.py',runtime));
if(!source.equals(packaged))throw new Error('Packaged capture.py is stale. Run python3 tools/package_web.py.');
if(manifest.revision!==(await readFile(new URL('runtime/revision.txt',root),'utf8')).trim())throw new Error('Packaged CPython revision differs. Rebuild and repackage the runtime.');
console.log('Verified checked-in CPython runtime',manifest.version.slice(0,12));
