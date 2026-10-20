// Keep one interpretation for an entire scroll gesture, including momentum.
export class NavigationGesture {
  reset() { this.lastTime=-Infinity;this.detected='trackpad'; }
  constructor() { this.reset(); }
  device(event,mode,now) {
    if(mode!=='auto')return mode;
    if(now-this.lastTime>250) {
      const magnitude=Math.abs(event.deltaY);
      this.detected=event.ctrlKey?'trackpad'
        :event.deltaMode!==0?'mouse'
        :event.deltaX!==0?'trackpad'
        :Number.isInteger(event.deltaY)&&magnitude>=40?'mouse':'trackpad';
    }
    this.lastTime=now;
    return this.detected;
  }
}
