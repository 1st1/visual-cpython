import { instance } from '@viz-js/viz';
import { chooseLayout } from './placement.mjs';
const engine = instance();
self.onmessage = async ({ data }) => {
  try {
    const viz = await engine;
    const { dot, layout } = chooseLayout(viz, data.graph, data.targetAspect);
    self.postMessage({ svg: viz.renderString(dot, { format: 'svg', engine: 'dot' }), layout, version: viz.graphvizVersion });
  } catch (error) { self.postMessage({ error: error.message }); }
};
