import {TileRouter} from '../web/tile-routing.mjs';
import {astTreeLayout} from '../web/ast-tree.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { instance } from '@viz-js/viz';
import { extractGraph, projectReplay, toDot } from '../web/graph.mjs';
import { normalizeLayout } from '../web/layout.mjs';
import { chooseLayout } from '../web/placement.mjs';
import { instructionGrid } from '../web/opcodes.mjs';

const python = existsSync('.build/native/python.exe') ? '.build/native/python.exe' : '.build/native/python';
const viz = await instance();
const cases = [
  ['shortest path', readFileSync('web/programs/shortest_path.py','utf8'), '[0, 1, 3, 5]\n'],
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
  const tree=astTreeLayout(trace.parsing?.ast);
  assert.deepEqual(tree,astTreeLayout(trace.parsing?.ast),'AST packing is deterministic');
  if(name==='shortest path'){
    const parents=new Set(trace.parsing.ast.map(n=>n.parent));
    const oldWidth=trace.parsing.ast.filter(n=>!parents.has(n.id)).length*3+1;
    assert.ok(tree.width<oldWidth/2,'Broad AST uses the column height instead of spreading across every leaf');
  }
  for(const node of trace.parsing?.ast || []) {
    const placed=tree.nodes.find(n=>n.id===node.id);
    if(node.parent!==null) assert.ok(tree.direction==='LR'?placed.x>tree.nodes.find(n=>n.id===node.parent).x:placed.z>tree.nodes.find(n=>n.id===node.parent).z);
  }
  for(let i=0;i<tree.nodes.length;i++) for(let j=i+1;j<tree.nodes.length;j++) {
    const a=tree.nodes[i],b=tree.nodes[j];assert.ok(Math.abs(a.x-b.x)>=2.5 || Math.abs(a.z-b.z)>=1.2);
  }
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
    const winner = chooseLayout(viz,graph);
    assert.ok(winner.score <= winner.layout.placement.candidates[0].score);
    assert.equal(chooseLayout(viz,graph).dot,winner.dot);
    console.log(`  placement: ${winner.options.direction}, score ${winner.score.toFixed(1)} vs ${winner.layout.placement.candidates[0].score.toFixed(1)} baseline`);
    if(name==='shortest path') {
      const portrait=chooseLayout(viz,graph,.55),wide=chooseLayout(viz,graph,2.4);
      assert.equal(portrait.layout.placement.targetAspect,.55);
      assert.equal(wide.layout.placement.targetAspect,2.4);
      assert.notEqual(portrait.score,wide.score,'Window aspect changes opcode-area fit scoring');
      for(const chosen of [portrait,wide]) assert.ok(chosen.layout.placement.candidates.every(c=>chosen.score<=c.score));
      const selected=winner.layout.placement.candidates.find(c=>c.options.direction===winner.options.direction&&c.options.compact===winner.options.compact&&c.options.tileAspect===winner.options.tileAspect);
      assert.ok(selected.projectedAspect>1,'BFS opcode area favors landscape framing');
      assert.ok(portrait.layout.bounds.width/portrait.layout.bounds.height < wide.layout.bounds.width/wide.layout.bounds.height,'Portrait and wide viewports produce correspondingly shaped opcode areas');
    }
    const layout = viz.renderJSON(winner.dot);
    const geometry = normalizeLayout(layout, graph, viz.graphvizVersion);
    for (const block of graph.blocks) {
      const grid=instructionGrid(block.instructions,winner.options.compact,winner.options.tileAspect);
      const placed=geometry.nodes.find(n=>n.id===block.id);
      assert.equal(grid.tiles.length,block.instructions.length);
      for(const tile of grid.tiles) {
        assert.ok(Math.abs(tile.x)+tile.width/2 <= placed.width/2+.01);
        assert.ok(Math.abs(tile.y)+tile.height/2 <= placed.height/2+.01);
      }
      for(let i=0;i<grid.tiles.length;i++) for(let j=i+1;j<grid.tiles.length;j++) {
        const a=grid.tiles[i],b=grid.tiles[j];
        assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2 || Math.abs(a.y-b.y)>=(a.height+b.height)/2);
      }
    }
    // @lat: [[scene#Isometric factory scene#Obstacle-aware opcode routing]]
    const routedBlocks=new Map(geometry.nodes.map(placed=>{
      const block=graph.blocks.find(b=>b.id===placed.id);
      return [placed.id,instructionGrid(block.instructions,winner.options.compact,winner.options.tileAspect).tiles.map(t=>({x:placed.x+t.x,z:placed.y+t.y,width:t.width,depth:t.height}))];
    }));
    const obstacles=[...routedBlocks.values()].flat(),router=new TileRouter(obstacles);
    for(const tiles of routedBlocks.values())for(let i=1;i<tiles.length;i++){
      const a=tiles[i-1],b=tiles[i],dx=Math.sign(b.x-a.x),dz=Math.sign(b.z-a.z);
      router.reserve([[a.x+dx*a.width/2,a.z+dz*a.depth/2],[b.x-dx*b.width/2,b.z-dz*b.depth/2]]);
    }
    for(const edge of geometry.edges){
      const occupied=[...router.reserved];
      const source=routedBlocks.get(edge.source).at(-1),target=routedBlocks.get(edge.target)[0];
      const points=router.route(source,target);
      assert.ok(points.length>=2);
      for(const [p,t] of [[points[0],source],[points.at(-1),target]]){
        const x=Math.abs(p[0]-t.x),z=Math.abs(p[1]-t.z);
        assert.ok(x<=t.width/2+1e-5&&z<=t.depth/2+1e-5);
        assert.ok(Math.abs(x-t.width/2)<1e-5||Math.abs(z-t.depth/2)<1e-5,'Route touches a tile face');
      }
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];
        assert.ok(Math.abs(a[0]-b[0])<1e-5||Math.abs(a[1]-b[1])<1e-5,'Routes are orthogonal');
        const axis=Math.abs(a[0]-b[0])>1e-5?0:1;
        for(const r of occupied)if(r.axis===axis&&Math.min(Math.max(a[axis],b[axis]),r.max)-Math.max(Math.min(a[axis],b[axis]),r.min)>1e-5)
          assert.ok(Math.abs(a[1-axis]-r.constant)>=.22-1e-5,`${name}: parallel routes keep their separation`);
        for(const tile of obstacles){
          const pad=tile===source&&i===1||tile===target&&i===points.length-1?0:.12;
          const l=tile.x-tile.width/2-pad,r=tile.x+tile.width/2+pad,t=tile.z-tile.depth/2-pad,d=tile.z+tile.depth/2+pad;
          const crosses=Math.abs(a[0]-b[0])<1e-5
            ? a[0]>l+1e-5&&a[0]<r-1e-5&&Math.max(a[1],b[1])>t+1e-5&&Math.min(a[1],b[1])<d-1e-5
            : a[1]>t+1e-5&&a[1]<d-1e-5&&Math.max(a[0],b[0])>l+1e-5&&Math.min(a[0],b[0])<r-1e-5;
          assert.ok(!crosses,`${name}: ${edge.id} clears every opcode box`);
        }
      }
    }
    assert.equal(geometry.nodes.length, graph.blocks.length);
    assert.equal(geometry.edges.length, graph.edges.length);
    assert.equal(geometry.enclosures.length, graph.codes.length);
    assert.deepEqual(normalizeLayout(layout,graph,viz.graphvizVersion),geometry);
    for (const edge of geometry.edges) {
      assert.ok(edge.points.length >= 2);
      assert.ok(edge.points.flat().every(Number.isFinite));
      const target=geometry.nodes.find(n=>n.id===edge.target), p=edge.points.at(-1);
      assert.ok(Math.abs(p[0]-target.x) <= target.width/2+.05 && Math.abs(p[1]-target.y) <= target.height/2+.05, `${name}: route endpoint misses target`);
    }
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
