// Run the same interpreter artifact used by the browser, without browser APIs.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import createModule from '../web/vendor/python.mjs';

const base = new URL('../', import.meta.url);
const stdlib = new Uint8Array(await readFile(new URL('web/vendor/python3.16.zip', base)));
const script = await readFile(new URL('runtime/capture.py', base), 'utf8');
const cases = [
  ['addition', 'a=2\nb=3\nc=a+b\nprint(c)', 'completed', '5\n'],
  ['calls', 'def f(x):\n    return x+1\nprint(f(1), f(2))', 'completed', '2 3\n'],
  ['error', 'x=1/0', 'error', ''],
  ['loop limit', 'while True:\n    pass', 'limited', ''],
];
for (const [name, source, status, output] of cases) {
  const lines = [], errors = [];
  let finish;
  const exited = new Promise(resolve => { finish = resolve; });
  const module = await createModule({
    noInitialRun: true, print: text => lines.push(text), printErr: text => errors.push(text),
    onExit: code => finish(code),
    preRun(m) {
      m.FS.mkdirTree('/lib/python3.16/lib-dynload');
      m.FS.writeFile('/lib/python316.zip', stdlib);
      m.FS.writeFile('/capture.py', script);
      m.FS.writeFile('/program.py', source);
    },
  });
  const immediate = module.callMain(['-I', '/capture.py', '/program.py']);
  const exitCode = Number.isInteger(immediate) ? immediate : await exited;
  assert.equal(exitCode, 0, errors.join('\n'));
  const trace = JSON.parse(lines.join('\n'));
  assert.equal(trace.status, status, trace.error);
  assert.equal(trace.stdout, output);
  if (name === 'addition') {
    const operation = trace.codes[0].instructions.find(i => i.opname === 'BINARY_OP');
    const event = trace.events.find(e => e.kind === 'opcode' && e.offset === operation.offset);
    assert.deepEqual(event.stack.map(v => v.value.value), ['2', '3']);
    assert.equal(trace.events[event.seq + 1].stack.at(-1).value.value, '5');
  }
  console.log(`PASS ${name}: ${trace.events.length} events`);
}
