const MAX_BYTES=16384;
const MAX_ENCODED=32768;

async function readLimited(stream,limit){
  const reader=stream.getReader(),chunks=[];let length=0;
  try{
    while(true){
      const {value,done}=await reader.read();if(done)break;
      length+=value.length;
      if(length>limit)throw new Error('Shared program exceeds 16 KiB.');
      chunks.push(value);
    }
  }finally{await reader.cancel();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}

export async function encodeProgram(source){
  const bytes=new TextEncoder().encode(source);
  if(bytes.length>MAX_BYTES)throw new Error('Program exceeds 16 KiB.');
  const compressed=await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),MAX_ENCODED);
  return btoa(String.fromCharCode(...compressed)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

export async function decodeProgram(encoded){
  if(!encoded||encoded.length>MAX_ENCODED||!/^[A-Za-z0-9_-]+$/.test(encoded))throw new Error('Invalid shared program link.');
  try{
    const bytes=Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
    const decoded=await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),MAX_BYTES);
    return new TextDecoder('utf-8',{fatal:true}).decode(decoded);
  }catch(error){
    if(error.message==='Shared program exceeds 16 KiB.')throw error;
    throw new Error('Invalid shared program link.');
  }
}

