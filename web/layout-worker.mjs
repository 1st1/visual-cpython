self.onmessage = async ({ data }) => {
  try {
    const [{instance},{chooseLayout}]=await Promise.all([import('@viz-js/viz'),import('./placement.mjs')]);
    const viz = await instance();
    const { dot, layout } = chooseLayout(viz, data.graph, data.targetAspect);
    self.postMessage({ svg: viz.renderString(dot, { format: 'svg', engine: 'dot' }), layout, version: viz.graphvizVersion });
  } catch (error) { self.postMessage({ error: error?.message || String(error ?? 'Graphviz initialization failed') }); }
};
