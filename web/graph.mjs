import {astTreeLayout} from './ast-tree.mjs';
import { instructionGrid } from './opcodes.mjs';

export function codeObjectTitle(code) {
  if(code?.name==='<module>')return 'Module Code: <module>';
  if(code?.kind==='function')return `Function Code: ${code.name}`;
  if(code?.kind==='class')return `Class Code: ${code.name}`;
  return `Code Object #${String(code?.id ?? '?').replace(/^c(?=\d+$)/,'')}`;
}

// Runtime CFG derived from assembled bytecode, not the compiler's internal CFG.
export function extractGraph(recording) {
  if (recording.schema !== 2) throw new Error('Unsupported capture schema; run a fresh capture.');
  const tree=astTreeLayout(recording.parsing?.ast);
  const graph = { schema: 1, pipeline: {astWidth:tree.width,astDepth:tree.depth,tokenCount:recording.parsing?.events.filter(e=>e.kind===2).length || 0,astCount:recording.parsing?.ast?.length || 0}, sourceLineCount: recording.source.split('\n').length, codes: [], blocks: [], edges: [], locations: {}, diagnostics: [] };
  for (const code of recording.codes) {
    const instructions = code.instructions;
    if (!instructions.length) continue;
    const leaders = new Set([instructions[0].offset]);
    for (let i = 0; i < instructions.length; i++) {
      const ins = instructions[i];
      if (ins.target !== null) leaders.add(ins.target);
      if (ins.flow !== 'next' && instructions[i + 1]) leaders.add(instructions[i + 1].offset);
    }
    const blocks = [];
    for (const ins of instructions) {
      if (leaders.has(ins.offset)) blocks.push({ id: `${code.id}_b${ins.offset}`, code: code.id, instructions: [] });
      const block = blocks.at(-1);
      block.instructions.push(ins);
      graph.locations[`${code.id}:${ins.offset}`] = block.id;
    }
    const definition=(recording.parsing?.ast || []).find(node=>
      ['FunctionDef','AsyncFunctionDef','ClassDef'].includes(node.kind)&&node.line===code.first_line&&node.label===code.name);
    const kind=code.name==='<module>'?'module':definition?.kind==='ClassDef'?'class':definition?'function':'unknown';
    graph.codes.push({ id: code.id, name: code.name, kind, blocks: blocks.map(b => b.id) });
    graph.blocks.push(...blocks);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i], last = block.instructions.at(-1);
      const add = (offset, kind) => {
        const target = graph.locations[`${code.id}:${offset}`];
        if (!target) throw new Error(`Unknown target ${code.id}:${offset}`);
        graph.edges.push({ id: `${block.id}_${kind}`, source: block.id, target, kind });
      };
      if (last.target !== null) add(last.target, last.flow === 'branch' ? 'taken' : 'jump');
      if (['next', 'branch', 'call'].includes(last.flow) && blocks[i + 1]) add(blocks[i + 1].instructions[0].offset, 'next');
    }
  }
  return graph;
}

// Each entry is an immutable selection state; seeking never runs user code.
export function projectReplay(recording, graph) {
  const project=createReplayProjector(recording,graph);
  return recording.events.map(project);
}

export function createReplayProjector(recording, graph) {
  const frames = new Map(), previous = new Map();
  return event => {
    const block = graph.locations[`${event.code}:${event.offset}`] || graph.codes.find(c => c.id === event.code)?.blocks[0];
    let edge = null;
    if (event.kind === 'call' || event.kind === 'resume') {
      frames.set(event.frame, { id: event.frame, parent: event.parent, code: event.code });
      const caller = previous.get(event.parent);
      if (caller && block) {
        const id = `${caller.block}_call_${event.code}`;
        if (!graph.edges.some(e => e.id === id)) graph.edges.push({ id, source: caller.block, target: block, kind: 'call' });
        edge = id;
      }
    }
    if (event.kind === 'opcode') {
      const prior = previous.get(event.frame);
      if (prior && (prior.block !== block || prior.flow === 'jump' || prior.flow === 'branch')) {
        const matches = graph.edges.filter(e => e.kind !== 'call' && e.source === prior.block && e.target === block);
        edge = matches[0]?.id || null;
        if (!edge) graph.diagnostics.push(`Unmapped transition at event ${event.seq}: ${prior.block} → ${block}`);
      }
      const ins = recording.codes.find(c => c.id === event.code).instructions.find(i => i.offset === event.offset);
      if (!ins) graph.diagnostics.push(`Unmapped opcode at event ${event.seq}: ${event.offset}`);
      previous.set(event.frame, { block, flow: ins?.flow });
    }
    const chain = [];
    for (let frame = frames.get(event.frame); frame; frame = frames.get(frame.parent)) chain.unshift({ ...frame });
    if (event.kind === 'return' || event.kind === 'unwind') {
      previous.delete(event.frame);frames.delete(event.frame);
    }
    return { block, edge, frames: chain, kind: event.kind };
  };
}

export function toDot(graph, {direction = 'TB', compact = false, tileAspect = 1} = {}) {
  const q = JSON.stringify;
  const lines = ['digraph program {', `graph [bgcolor="transparent", rankdir=${direction}, splines=ortho, nodesep=${compact ? .45 : .55}, ranksep=${compact ? .55 : .7}, pad=0.25];`,
    `node [shape=box, fixedsize=true, width=${compact ? 3 : 3.5}, height=${compact ? 1 : .9}, style="rounded,filled", fillcolor="#192522", color="#526c61", fontcolor="#dce5e5", fontname="monospace", fontsize=11, margin="0.18,0.13"];`,
    'edge [color="#617f70", arrowsize=0.7];'];
  for (const code of graph.codes) {
    lines.push(`subgraph cluster_${code.id} { label=${q(codeObjectTitle(code))}; fontname="monospace"; fontcolor="#8d9f9a"; color="#35473e"; margin=22;`);
    for (const block of graph.blocks.filter(b => b.code === code.id)) {
      const first = block.instructions[0], last = block.instructions.at(-1);
      const operation = compact && last.opname.length > 25 ? last.opname.match(/.{1,22}/g).join('\n') : last.opname;
      const label = `${block.id} · L${first.line ?? '?'}\n${first.offset}–${last.offset} · ${block.instructions.length} instructions\n${operation}`;
      const grid=instructionGrid(block.instructions,compact,tileAspect);
      lines.push(`${q(block.id)} [id=${q(block.id)}, width=${grid.width*60/72}, height=${grid.height*60/72}, label=${q(label)}];`);
    }
    lines.push('}');
  }
  for (const edge of graph.edges) lines.push(`${q(edge.source)} -> ${q(edge.target)} [id=${q(edge.id)}, tooltip=${q(edge.kind)}, color=${q(edge.kind === 'call' ? '#b39be4' : edge.kind === 'taken' ? '#d1ab66' : '#617f70')}, style=${q(edge.kind === 'call' ? 'dashed' : 'solid')}, constraint=${edge.kind === 'call' || edge.kind === 'jump' ? 'false' : 'true'}];`);
  lines.push('}');
  return lines.join('\n');
}
