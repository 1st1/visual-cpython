// Ordered rooted tree: depth runs top-to-bottom; disjoint leaf intervals separate branches.
export function astTreeLayout(nodes=[]) {
  if(!nodes.length)return {width:8,depth:4,nodes:[]};
  const byId=new Map(nodes.map(n=>[n.id,{...n,children:[]}]));
  for(const n of byId.values()) if(n.parent!==null) byId.get(n.parent)?.children.push(n);
  let leaf=0,maxDepth=0;const placed=[];
  function visit(n,depth) {
    maxDepth=Math.max(maxDepth,depth);
    const children=n.children.map(c=>visit(c,depth+1));
    const z=children.length?(children[0]+children.at(-1))/2:leaf++*3;
    placed.push({id:n.id,x:z,z:depth*2.3,depth});return z;
  }
  for(const n of byId.values())if(n.parent===null)visit(n,0);
  const width=Math.max(8,leaf*3+1),depth=maxDepth*2.3+3;
  return {width,depth,nodes:placed.map(n=>({...n,x:n.x-(leaf-1)*3/2,z:n.z-maxDepth*2.3/2}))};
}

export function tokensForConstruction(event,tokens) {
  if(event?.kind!==3||event.line<=0)return [];
  return tokens.filter(t=>t.column>=0 && (t.line>event.line || t.line===event.line&&t.column>=event.column)
    && (t.line<event.end_line || t.line===event.end_line&&t.column<event.end_column));
}

export function instructionAst(instruction,nodes,events) {
  if(instruction.line==null||instruction.column==null)return null;
  const endLine=instruction.end_line ?? instruction.line,endColumn=instruction.end_column ?? instruction.column;
  const candidates=nodes.filter(node=>{
    const span=events[node.created];
    return span?.kind===3&&span.line>0&&
      (instruction.line>span.line||instruction.line===span.line&&instruction.column>=span.column)&&
      (endLine<span.end_line||endLine===span.end_line&&endColumn<=span.end_column);
  });
  const size=node=>{const s=events[node.created];return (s.end_line-s.line)*16384+s.end_column-s.column;};
  candidates.sort((a,b)=>size(a)-size(b)||b.id-a.id);
  return candidates[0] || null;
}
