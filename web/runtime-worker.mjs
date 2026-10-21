import workerUrl from './worker.mjs?worker&url';
let workerSequence=0;
// WebKit can reject a cached module-worker response under cross-origin isolation.
// Give each worker entry a fresh URL; the large runtime assets remain cached.
export function createRuntimeWorker(){
  const url=new URL(workerUrl,location.href);
  url.searchParams.set('instance',`${Date.now()}-${++workerSequence}`);
  return new Worker(url,{type:'module'});
}
