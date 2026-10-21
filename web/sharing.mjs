import {createRuntimeWorker} from './runtime-worker.mjs';
export {encodeProgram,decodeProgram} from './share-codec.mjs';

// Use CPython's tokenizer for exactly the same limit as Compile, without executing code.
export async function validateProgram(source,signal,attempt=0){
  return new Promise((resolve,reject)=>{
    const worker=createRuntimeWorker();
    const finish=(error,result)=>{clearTimeout(timer);worker.terminate();signal?.removeEventListener('abort',abort);error?reject(error):resolve(result);};
    const abort=()=>finish(new DOMException('Cancelled','AbortError'));
    const timer=setTimeout(()=>finish(new Error('Program validation timed out. Please try again.')),60000);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted){abort();return;}
    worker.onerror=e=>{const error=new Error(e.message||'Could not validate the program.');error.name='WorkerStartupError';finish(error);};
    worker.onmessage=({data})=>{
      if(data.type==='result')finish(data.trace.status==='validated'?null:new Error(data.trace.error||'Invalid program.'),data.trace);
      else if(data.type==='error')finish(new Error(data.message));
    };
    worker.postMessage({source,mode:'validate'});
  }).catch(error=>{
    if(error.name==='WorkerStartupError'&&attempt===0&&!signal?.aborted)return validateProgram(source,signal,1);
    throw error;
  });
}
