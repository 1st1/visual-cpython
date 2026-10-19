import {defineConfig} from 'vite';

export default defineConfig({
  root:'web',
  build:{outDir:'../dist',emptyOutDir:true,assetsInlineLimit:0},
  worker:{format:'es'},
  server:{host:'127.0.0.1',port:8000,strictPort:true},
  preview:{host:'127.0.0.1',port:8000,strictPort:true},
});
