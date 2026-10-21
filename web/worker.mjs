// A fresh interpreter runs until an opcode waits for one UI-issued permit.
let advance;
let started=false;
self.onmessage = async ({ data }) => {
  if(data.type==='advance'){const release=advance;advance=null;release?.();return;}
  if(started)return;
  started=true;
  try {
    const control=data.control?new Int32Array(data.control):null;
    if(data.mode==='run'&&!control&&!WebAssembly.Suspending)
      throw new Error('Live stepping needs cross-origin isolation on this browser. Reload after the server headers are updated.');
    const manifest = await fetch(`${import.meta.env.BASE_URL}runtime/runtime.json`, { cache: 'no-store' }).then(check).then(r => r.json());
    if (!/^[a-f0-9]{64}$/.test(manifest.version)) throw new Error('Invalid runtime manifest. Run tools/package_web.py again.');
    const asset = name => new URL(`${import.meta.env.BASE_URL}runtime/${name}?build=${manifest.version}`, self.location.origin).href;
    const [{ default: createModule }, stdlib, capture] = await Promise.all([
      import(/* @vite-ignore */ asset("python.mjs")),
      fetch(asset("python3.16.zip")).then(check).then(r => r.arrayBuffer()),
      fetch(asset("capture.py")).then(check).then(r => r.text()),
    ]);
    const lines = [], errors = [];
    let finish;
    const exited = new Promise(resolve => { finish = resolve; });
    const runtime = await createModule({
      noInitialRun: true,
      locateFile: name => asset(name),
      onExit: code => finish(code),
      print: text => lines.push(text),
      printErr: text => {
        if(text.startsWith('@xray-event:')){
          self.postMessage({type:'event',event:JSON.parse(text.slice('@xray-event:'.length))});return;
        }
        errors.push(text);
      },
      stdin: () => null,
      preRun(module) {
        module.FS.mkdirTree("/lib/python3.16/lib-dynload");
        module.FS.writeFile("/lib/python316.zip", new Uint8Array(stdlib));
        module.FS.writeFile("/capture.py", capture);
        module.FS.writeFile("/program.py", data.source);
        if(data.mode==='run'){
          const device=module.FS.makedev(64,0);
          const operations={open(stream){stream.seekable=false;}};
          if(control){
            operations.read=(stream,buffer,offset)=>{
              // A permit is consumed atomically, including one sent before wait.
              while(Atomics.compareExchange(control,0,1,0)!==1)Atomics.wait(control,0,0);
              buffer[offset]=115;return 1;
            };
          }else{
            operations.readAsync=async(stream,buffer,offset)=>{
              await new Promise(resolve=>{advance=resolve;});
              buffer[offset]=115;return 1;
            };
          }
          module.FS.registerDevice(device,operations);
          module.FS.mkdev('/dev/xray-control',0o600,device);
        }
      },
    });
    self.postMessage({ type: "running" });
    // CPython wraps main with WebAssembly.promising on JSPI-capable browsers.
    // callMain then returns undefined; onExit carries the actual completion.
    const args=["-I", "/capture.py", "/program.py"];
    if(data.mode==="compile")args.push("--compile-only");
    else args.push("--live");
    const immediate = runtime.callMain(args);
    const exitCode = Number.isInteger(immediate) ? immediate : await exited;
    if (exitCode !== 0) throw new Error(`CPython exited ${exitCode}: ${errors.join("\n")}`);
    self.postMessage({ type: "result", trace: JSON.parse(lines.join("\n")) });
  } catch (error) {
    self.postMessage({ type: "error", message: String(error.message || error) });
  }
};

function check(response) {
  if (!response.ok) throw new Error(`Runtime asset unavailable (${response.status}). Run tools/package_web.py first.`);
  return response;
}
