// Each capture gets a new worker and a new interpreter instance.
self.onmessage = async ({ data }) => {
  try {
    const [{ default: createModule }, stdlib, capture] = await Promise.all([
      import("./vendor/python.mjs"),
      fetch("./vendor/python3.16.zip").then(check).then(r => r.arrayBuffer()),
      fetch("./vendor/capture.py").then(check).then(r => r.text()),
    ]);
    const lines = [], errors = [];
    let finish;
    const exited = new Promise(resolve => { finish = resolve; });
    const runtime = await createModule({
      noInitialRun: true,
      onExit: code => finish(code),
      print: text => lines.push(text),
      printErr: text => errors.push(text),
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
    const immediate = runtime.callMain(["-I", "/capture.py", "/program.py"]);
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
