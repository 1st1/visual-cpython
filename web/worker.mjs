// Each capture gets a new worker and a new interpreter instance.
self.onmessage = async ({ data }) => {
  try {
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
        const match=/^@factory-line:(\d+)$/.exec(text);
        if(match) self.postMessage({type:"line",line:Number(match[1])});
        else errors.push(text);
      },
      stdin: () => null,
      preRun(module) {
        module.FS.mkdirTree("/lib/python3.16/lib-dynload");
        module.FS.writeFile("/lib/python316.zip", new Uint8Array(stdlib));
        module.FS.writeFile("/capture.py", capture);
        module.FS.writeFile("/program.py", data.source);
      },
    });
    self.postMessage({ type: "running" });
    // CPython wraps main with WebAssembly.promising on JSPI-capable browsers.
    // callMain then returns undefined; onExit carries the actual completion.
    const immediate = runtime.callMain(["-I", "/capture.py", "/program.py", "--progress"]);
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
