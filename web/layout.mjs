// Graphviz points become a renderer-independent, centered ground plane.
export function normalizeLayout(raw, graph, version) {
  const [left, bottom, right, top] = raw.bb.split(',').map(Number);
  const scale = 60;
  const point = ([x, y]) => [(x - (left + right) / 2) / scale, ((bottom + top) / 2 - y) / scale];
  const rectangle = bb => {
    const [x0, y0, x1, y1] = bb.split(',').map(Number);
    const [x, y] = point([(x0+x1)/2, (y0+y1)/2]);
    return { x, y, width: (x1-x0)/scale, height: (y1-y0)/scale };
  };
  const objects = new Map(raw.objects.map(o => [o.name, o]));
  const nodes = graph.blocks.map(block => {
    const node = objects.get(block.id);
    if (!node?.pos) throw new Error(`Missing layout block ${block.id}`);
    const [x, y] = point(node.pos.split(',').map(Number));
    return { id: block.id, code: block.code, x, y, width: Number(node.width)*72/scale, height: Number(node.height)*72/scale };
  });
  const enclosures = graph.codes.map(code => ({ id: code.id, name: code.name, ...rectangle(objects.get(`cluster_${code.id}`).bb) }));
  const rawEdges = new Map((raw.edges || []).map(e => [e.id, e]));
  const edges = graph.edges.map(edge => {
    const route = rawEdges.get(edge.id);
    const points = [];
    for (const draw of route?._draw_ || []) {
      if (draw.op === 'L') points.push(...draw.points.map(point));
      if (draw.op === 'b' || draw.op === 'B') {
        const p = draw.points;
        points.push(point(p[0]));
        for (let i = 1; i + 2 < p.length; i += 3) {
          for (let j = 1; j <= 8; j++) {
            const t = j/8, u = 1-t;
            points.push(point([0,1].map(k => u*u*u*p[i-1][k] + 3*u*u*t*p[i][k] + 3*u*t*t*p[i+1][k] + t*t*t*p[i+2][k])));
          }
        }
      }
    }
    const tip = route?.pos?.match(/^e,([^, ]+),([^ ]+)/);
    if (tip) points.push(point([Number(tip[1]), Number(tip[2])]));
    const clean = [];
    for (const p of points) {
      if (clean.length && Math.hypot(p[0]-clean.at(-1)[0],p[1]-clean.at(-1)[1]) < .0001) continue;
      while (clean.length >= 2) {
        const a = clean.at(-2), b = clean.at(-1);
        const cross = (b[0]-a[0])*(p[1]-b[1]) - (b[1]-a[1])*(p[0]-b[0]);
        const dot = (b[0]-a[0])*(p[0]-b[0]) + (b[1]-a[1])*(p[1]-b[1]);
        if (Math.abs(cross) > .00001 || dot < 0) break;
        clean.pop();
      }
      clean.push(p);
    }
    if (clean.length < 2) throw new Error(`Missing route ${edge.id}`);
    return { ...edge, points: clean };
  });
  return { schema: 1, engine: `Graphviz ${version}`, units: '60 Graphviz points', bounds: rectangle(raw.bb), nodes, enclosures, edges, routing: 'unvalidated-graphviz-baseline' };
}
