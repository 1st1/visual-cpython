import { toDot } from './graph.mjs';
import { normalizeLayout } from './layout.mjs';

export function factoryFootprint(layout) {
  const width=Math.max(layout?.bounds.width || 8,8), depth=Math.max(layout?.bounds.height || 8,8);
  return { width, depth, serviceX:-width/2-2.8, stackX:width/2+5.2, stackZ:0,
    minX:-width/2-5.2, maxX:width/2+1, minZ:-depth/2-3.2, maxZ:depth/2+1 };
}

export function sourceFootprint(layout,lineCount=1,pipeline={}) {
  const f=factoryFootprint(layout),rows=Math.min(24,Math.max(1,lineCount)),columns=Math.ceil(Math.max(1,lineCount)/rows);
  const sourceWidth=columns*8.7+.6,sourceDepth=rows*1.15+1.6;
  const tokenDepth=Math.max(4,Math.ceil((pipeline.tokenCount || 0)/4)*1.2+2);
  const astDepth=pipeline.astDepth || 4,astWidth=pipeline.astWidth || 8;
  const astX=f.minX-2-astWidth/2,tokenX=astX-astWidth/2-9,sourceX=tokenX-9-sourceWidth/2;
  const minZ=Math.min(f.minZ,-Math.max(sourceDepth,tokenDepth,astDepth)/2-3);
  const maxZ=Math.max(f.maxZ,Math.max(sourceDepth,tokenDepth,astDepth)/2+1);
  // Artifact bounds already include nodes and routed opcode connections.
  // Add a consistent margin without consuming the gap between neighboring lanes.
  const lanes=[
    {x:sourceX,width:sourceWidth,title:'Stage 1: Source Code'},
    {x:tokenX,width:14,title:'Stage 2: Tokenize'},
    {x:astX,width:astWidth,title:'Stage 3: Parse & Compile'},
    {x:0,width:f.width,title:'Stage 4: Run Code'},
  ].map((lane,i)=>({...lane,
    x:lane.x+(i===0?-.1:i===3?.1:0),
    width:lane.width+1.6+(i===0||i===3?.2:0),minZ,maxZ}));
  return {...f,rows,columns,sourceWidth,sourceDepth,sourceX,tokenX,astX,tokenDepth,astDepth,astWidth,lanes,
    minX:sourceX-sourceWidth/2-1,minZ,maxZ};
}

export function layoutScore(layout,targetAspect=1.8) {
  // Optimize the opcode neighborhood independently of the earlier pipeline lanes.
  // Account for the default camera's downward tilt when fitting its screen bounds.
  const w=layout.bounds.width+1.6,d=layout.bounds.height+1.6;
  const projectedWidth=w;
  const projectedHeight=d*1.1/Math.hypot(1.1,1)+1.6;
  const routeLength=layout.edges.reduce((sum,e)=>sum+e.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-e.points[i][0],p[1]-e.points[i][1]),0),0);
  targetAspect=Number.isFinite(targetAspect)&&targetAspect>0?targetAspect:1.8;
  const viewportArea=Math.max(projectedHeight,projectedWidth/targetAspect)**2*targetAspect;
  const score=viewportArea + projectedWidth*projectedHeight*.1 + routeLength*.3;
  return { score, area:w*d, routeLength, projectedAspect:projectedWidth/projectedHeight };
}

export function chooseLayout(viz, graph, targetAspect=1.8) {
  targetAspect=Number.isFinite(targetAspect)&&targetAspect>0?targetAspect:1.8;
  const variants=[{direction:'TB',compact:false,tileAspect:1},
    ...['TB','LR'].flatMap(direction=>[.5,1,2,4].map(tileAspect=>({direction,compact:true,tileAspect})))];
  const candidates=variants.map(options=>{
    const dot=toDot(graph,options);
    const layout=normalizeLayout(viz.renderJSON(dot),graph,viz.graphvizVersion);
    return {dot,layout,options,...layoutScore(layout,targetAspect)};
  });
  const winner=candidates.reduce((a,b)=>b.score<a.score?b:a);
  winner.layout.placement={version:4,targetAspect,selected:winner.options,candidates:candidates.map(({options,score,area,routeLength,projectedAspect})=>({options,score,area,routeLength,projectedAspect}))};
  return winner;
}
