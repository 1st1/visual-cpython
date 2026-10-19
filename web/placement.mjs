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
  return {...f,rows,columns,sourceWidth,sourceDepth,sourceX,tokenX,astX,tokenDepth,astDepth,astWidth,
    minX:sourceX-sourceWidth/2-1,minZ:Math.min(f.minZ,-Math.max(sourceDepth,tokenDepth,astDepth)/2-3),maxZ:Math.max(f.maxZ,Math.max(sourceDepth,tokenDepth,astDepth)/2+1)};
}

export function layoutScore(layout,lineCount=1,targetAspect=1.8,pipeline={}) {
  const f=sourceFootprint(layout,lineCount,pipeline), w=f.stackX+2.6-f.minX,d=Math.max(f.maxZ,5.7)-Math.min(f.minZ,-6.8);
  // Match the landscape camera: its ground-plane direction is (.35, 1).
  const projectedWidth=.944*w+.330*d;
  const projectedHeight=.238*w+.680*d+3.8;
  const routeLength=layout.edges.reduce((sum,e)=>sum+e.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-e.points[i][0],p[1]-e.points[i][1]),0),0);
  targetAspect=Number.isFinite(targetAspect)&&targetAspect>0?targetAspect:1.8;
  const viewportArea=Math.max(projectedHeight,projectedWidth/targetAspect)**2*targetAspect;
  const score=viewportArea + projectedWidth*projectedHeight*.1 + routeLength*.3;
  return { score, area:w*d, routeLength, projectedAspect:projectedWidth/projectedHeight };
}

export function chooseLayout(viz, graph, targetAspect=1.8) {
  targetAspect=Number.isFinite(targetAspect)&&targetAspect>0?targetAspect:1.8;
  const variants=[{direction:'TB',compact:false},{direction:'TB',compact:true},{direction:'LR',compact:true}];
  const candidates=variants.map(options=>{
    const dot=toDot(graph,options);
    const layout=normalizeLayout(viz.renderJSON(dot),graph,viz.graphvizVersion);
    return {dot,layout,options,...layoutScore(layout,graph.sourceLineCount,targetAspect,graph.pipeline)};
  });
  const winner=candidates.reduce((a,b)=>b.score<a.score?b:a);
  winner.layout.placement={version:3,targetAspect,selected:winner.options,candidates:candidates.map(({options,score,area,routeLength,projectedAspect})=>({options,score,area,routeLength,projectedAspect}))};
  return winner;
}
