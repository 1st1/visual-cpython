import { instance } from './vendor/viz.js';
import { toDot } from './graph.mjs';
const engine = instance();
self.onmessage = async ({ data }) => {
  try {
    const viz = await engine;
    const dot = toDot(data.graph);
    self.postMessage({ svg: viz.renderString(dot, { format: 'svg', engine: 'dot' }), version: viz.graphvizVersion });
  } catch (error) { self.postMessage({ error: error.message }); }
};
