import {execFileSync} from 'node:child_process';
import {cpSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync('lat',['check'],{cwd:root,stdio:'inherit'});
execFileSync('lat',['ui','build','static','.build/lat-static','--base','/lat.md/','--force'],{cwd:root,stdio:'inherit'});
// Lat emits the base-path directory inside its output root.
const destination=new URL('../web/public/lat.md/',import.meta.url);
rmSync(destination,{recursive:true,force:true});
cpSync(new URL('../.build/lat-static/lat.md/',import.meta.url),destination,{recursive:true});
