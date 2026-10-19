import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { instance } from '@viz-js/viz';
import { extractGraph, projectReplay, toDot } from '../web/graph.mjs';

const python = existsSync('.build/native/python.exe') ? '.build/native/python.exe' : '.build/native/python';
const viz = await instance();
const cases = [
  ['diamond', 'x=2\nif x>1:\n y=3\nelse:\n y=4\nprint(y)', '3\n'],
  ['loops', 's=0\nfor i in range(4):\n for j in range(3):\n  if j==1:\n   continue\n  s=s+i\nprint(s)', '12\n'],
  ['break', 'i=0\nwhile i<10:\n i=i+1\n if i==3:\n  break\nprint(i)', '3\n'],
  ['calls', 'def f(x):\n if x:\n  return f(x-1)+1\n return 0\nprint(f(3),f(2))', '3 2\n'],
  ['boolean', 'x=0\ny=3\nprint(x or y, x and y, 1<x<4)', '3 0 False\n'],
  ['error', 'def f(x):\n return 1/x\nf(0)', ''],
  ['empty', '# nothing', ''],
  ['syntax', 'if', ''],
  ['limit', 'while True:\n pass', ''],
];
for (const [name, source, output] of cases) {
  const result = spawnSync(python, ['-I', 'runtime/capture.py'], { input: source, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const trace = JSON.parse(result.stdout);
  assert.equal(trace.stdout, output, trace.error);
  const graph = extractGraph(trace), states = projectReplay(trace, graph);
  assert.deepEqual(graph.diagnostics, [], name);
  for (const code of trace.codes) for (const ins of code.instructions) assert.ok(graph.locations[`${code.id}:${ins.offset}`]);
  for (const state of states) assert.ok(graph.blocks.some(b => b.id === state.block));
  if (name === 'calls') {
    assert.ok(graph.edges.some(e => e.kind === 'call' && e.source.startsWith('c1')));
    assert.ok(states.some(s => s.frames.length === 5));
  }
  if (name === 'loops') {
    assert.ok(states.some(s => s.edge?.endsWith('_taken')));
    assert.ok(states.some(s => s.edge?.endsWith('_jump')));
  }
  if (name === 'error') assert.equal(states.at(-1).kind, 'unwind');
  const again = extractGraph(trace);
  assert.deepEqual(projectReplay(trace, again), states);
  assert.equal(toDot(again), toDot(graph));
  if (graph.blocks.length) {
    const layout = viz.renderJSON(toDot(graph));
    const boxes = layout.objects.filter(o => o.pos).map(o => {
      const [x, y] = o.pos.split(',').map(Number);
      return { x, y, w: Number(o.width) * 72, h: Number(o.height) * 72 };
    });
    assert.equal(boxes.length, graph.blocks.length);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert.ok(Math.abs(a.x-b.x) >= (a.w+b.w)/2 - .1 || Math.abs(a.y-b.y) >= (a.h+b.h)/2 - .1, `${name}: overlapping blocks`);
    }
  }
  console.log(`PASS ${name}: ${graph.blocks.length} blocks, ${graph.edges.length} edges, ${states.length} replay states`);
}
