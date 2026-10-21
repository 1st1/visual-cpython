import {defineConfig} from 'vite';

const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin'};

export default defineConfig({
  root:'web',
  build:{outDir:'../dist',emptyOutDir:true,assetsInlineLimit:0},
  worker:{format:'es'},
  server:{host:'127.0.0.1',port:8000,strictPort:true,headers},
  preview:{host:'127.0.0.1',port:8000,strictPort:true,headers},
});
