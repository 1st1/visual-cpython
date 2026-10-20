// A line visit begins when opcode execution enters it, changes frame, or loops back.
export function sourceVisits(events) {
  const visits=new Map();let previous;
  for(const event of events){
    if(event.kind!=='opcode')continue;
    if(event.line>0&&(!previous||event.line!==previous.line||event.frame!==previous.frame||event.offset<=previous.offset)){
      if(!visits.has(event.line))visits.set(event.line,[]);
      visits.get(event.line).push(event.seq);
    }
    previous=event;
  }
  return visits;
}
export function nextSourceVisit(visits,line,index){
  const entries=visits.get(line)||[];
  return entries.find(seq=>seq>index)??entries[0];
}
