// Pack sibling contours at each depth, preserving ordered parent-child structure.
export function astTreeLayout(nodes=[]) {
  if(!nodes.length)return {width:8,depth:4,direction:'TB',nodes:[]};
  const byId=new Map(nodes.map(n=>[n.id,{...n,children:[]}]));
  for(const n of byId.values())if(n.parent!==null)byId.get(n.parent)?.children.push(n);
  const roots=[...byId.values()].filter(n=>n.parent===null);
  function candidate(direction) {
    const across=direction==='TB'?3:1.8,along=direction==='TB'?2.3:3.8;
    function pack(n) {
      const children=n.children.map(pack),merged=[],offsets=[];
      for(const child of children) {
        let shift=0;
        child.contours.forEach(([left],level)=>{
          if(merged[level])shift=Math.max(shift,merged[level][1]+across-left);
        });
        offsets.push(shift);
        child.contours.forEach(([left,right],level)=>{
          merged[level]=merged[level]?[Math.min(merged[level][0],left+shift),Math.max(merged[level][1],right+shift)]:[left+shift,right+shift];
        });
      }
      const center=offsets.length?(offsets[0]+offsets.at(-1))/2:0;
      const placed=[{id:n.id,cross:0,level:0}];
      children.forEach((child,i)=>child.nodes.forEach(p=>placed.push({...p,cross:p.cross+offsets[i]-center,level:p.level+1})));
      return {nodes:placed,contours:[[0,0],...merged.map(([left,right])=>[left-center,right-center])]};
    }
    const packed=pack({id:null,children:roots}).nodes.filter(n=>n.id!==null);
    const placed=packed.map(n=>({id:n.id,depth:n.level-1,
      x:direction==='TB'?n.cross:(n.level-1)*along,
      z:direction==='TB'?(n.level-1)*along:n.cross}));
    const minX=Math.min(...placed.map(n=>n.x)),maxX=Math.max(...placed.map(n=>n.x));
    const minZ=Math.min(...placed.map(n=>n.z)),maxZ=Math.max(...placed.map(n=>n.z));
    const width=Math.max(8,maxX-minX+4),depth=Math.max(4,maxZ-minZ+3);
    return {width,depth,direction,nodes:placed.map(n=>({...n,x:n.x-(minX+maxX)/2,z:n.z-(minZ+maxZ)/2}))};
  }
  const candidates=[candidate('TB'),candidate('LR')];
  // Favor a column footprint; keep small trees top-down when similarly compact.
  const score=t=>Math.max(t.depth,t.width/.8)**2*.8+(t.width*t.depth)*.15;
  return candidates.reduce((a,b)=>score(b)<score(a)*.9?b:a);
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
