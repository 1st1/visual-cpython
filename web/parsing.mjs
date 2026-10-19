// Replay checkpoints from the actual C tokenizer and generated PEG parser.
export function parsingFrames(parsing) {
  const frames=[], tokens=[], attempts=[]; let cursor=0,indent=0;
  for(const event of parsing.events) {
    if(event.kind===2) {tokens.push(event);if(event.token==='INDENT')indent++;if(event.token==='DEDENT')indent=Math.max(0,indent-1);}
    if(event.kind!==3) cursor=event.kind===1?event.end:event.cursor;
    if(event.kind===0) {
      attempts.length=Math.min(attempts.length,event.depth);
      attempts[event.depth-1]=event.text.trim();
    } else if(event.kind===1) attempts.length=Math.min(attempts.length,event.depth);
    frames.push({seq:frames.length,event,cursor,indent,tokenCount:tokens.length,attempts:attempts.filter(Boolean).slice(-8)});
  }
  return {frames,tokens};
}

export class ParsingReplay {
  constructor(factory,onMode) {
    this.factory=factory;this.onMode=onMode;
    this.panel=document.getElementById('parse-panel');
    this.range=document.getElementById('parse-seek');
    this.range.oninput=()=>{this.stop();this.index=Number(this.range.value);this.render();};
    document.getElementById('parse-back').onclick=()=>this.move(-1);
    document.getElementById('parse-next').onclick=()=>this.move(1);
    document.getElementById('parse-end').onclick=()=>{this.stop();this.index=this.frames.length;this.render();};
    document.getElementById('parse-play').onclick=()=>{
      if(this.timer) return this.stop();
      if(this.index===this.frames.length) this.index=0;
      document.getElementById('parse-play').textContent='Pause parsing';
      this.timer=setInterval(()=>{this.index=this.nextIndex(1);this.render();if(this.index===this.frames.length)this.stop();},40);
    };
  }
  stop() {clearInterval(this.timer);this.timer=null;document.getElementById('parse-play').textContent='Play parsing';}
  nextIndex(delta) {
    let next=this.index+delta;
    if(!document.getElementById('parse-detail').checked) {
      while(next>0&&next<this.frames.length) {
        const event=this.frames[next].event;
        if(event.kind!==0||event.depth<=5) break;
        next+=delta;
      }
    }
    return Math.max(0,Math.min(this.frames.length,next));
  }
  move(delta) {this.stop();this.index=this.nextIndex(delta);this.render();}
  load(recording) {
    this.stop();this.recording=recording;
    const {frames,tokens}=parsingFrames(recording.parsing);this.frames=frames;this.tokens=tokens;this.index=0;
    this.factory.loadParsing(recording,tokens);this.range.max=frames.length;this.render();
  }
  render() {
    const final=this.index===this.frames.length,frame=this.frames[Math.min(this.index,this.frames.length-1)];
    this.range.value=this.index;
    this.factory.setParsingState(frame,final);
    const event=frame?.event;
    const status=final?(this.recording.parsing.ast?'Parse result · AST available':'Parse failed · no AST'):event?.kind===3?`Construct ${event.text} · ${event.retained?"retained in AST":"not retained in final AST"}`:event?.kind===2?`Tokenizer emitted ${event.token} · line ${event.line}`:event?.kind===1?`Backtrack · token ${event.cursor} → ${event.end}`:event?.text.trim();
    document.getElementById('parse-status').textContent=`${this.index} / ${this.frames.length} · ${status || 'No checkpoints'}`;
    document.getElementById('parse-attempts').textContent=final?'Final AST. Nodes appeared at captured C constructor checkpoints; enum operators and contexts are not separate allocated nodes.':(frame?.attempts || []).join('\n');
    document.getElementById('parse-budget').textContent=this.recording.parsing.dropped?`Trace truncated: ${this.recording.parsing.dropped} later checkpoints omitted. AST is shown separately at the end.`:'Observed AST constructors, token acquisition, and PEG checkpoints. Token flights follow recorded source spans; tokens remain buffered for backtracking. Rule stack shows recent alternative checkpoints.';
    document.getElementById('parse-back').disabled=this.index===0;
    document.getElementById('parse-next').disabled=final;
  }
}
