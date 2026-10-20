// iPadOS can report a desktop Mac identity, distinguished by multitouch support.
export function isMobileNavigationDevice(device=navigator) {
  return /Android|iPhone|iPad|iPod/i.test(device.userAgent || '')
    || (/Mac/i.test(device.platform || '') && device.maxTouchPoints>1);
}

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

// Cancel browser magnification without stopping scene gesture handlers.
export function preventPageZoom() {
  const options={capture:true,passive:false};
  document.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey)event.preventDefault();
  },options);
  for(const name of ['gesturestart','gesturechange','gestureend'])
    document.addEventListener(name,event=>event.preventDefault(),options);
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&['+','=','-','0'].includes(event.key))event.preventDefault();
  },true);
}
