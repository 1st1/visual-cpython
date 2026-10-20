// Orthogonal routing on the free-space grid formed by padded tile boundaries.
// Geometry is built once per layout; replay only changes colors and visibility.
const CLEARANCE=.13;
const LANE_GAP=.22;
const PORT_OFFSET=.24;
const unique=values=>[...new Set(values.map(v=>Number(v.toFixed(6))))].sort((a,b)=>a-b);
class Queue {
  items=[];
  push(item){let i=this.items.length;this.items.push(item);while(i){const p=(i-1)>>1;if(this.items[p].score<=item.score)break;this.items[i]=this.items[p];i=p;}this.items[i]=item;}
  pop(){const first=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].score<this.items[c].score)c++;if(last.score<=this.items[c].score)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first;}
}
export class TileRouter {
  constructor(tiles){
    this.rects=tiles.map(t=>({left:t.x-t.width/2-CLEARANCE,right:t.x+t.width/2+CLEARANCE,top:t.z-t.depth/2-CLEARANCE,bottom:t.z+t.depth/2+CLEARANCE}));
    this.reserved=[];
    const xs=this.rects.flatMap((r,i)=>[r.left-LANE_GAP,r.left,tiles[i].x-PORT_OFFSET,tiles[i].x,tiles[i].x+PORT_OFFSET,r.right,r.right+LANE_GAP]);
    const zs=this.rects.flatMap((r,i)=>[r.top-LANE_GAP,r.top,tiles[i].z-PORT_OFFSET,tiles[i].z,tiles[i].z+PORT_OFFSET,r.bottom,r.bottom+LANE_GAP]);
    this.xs=unique([...xs,Math.min(...xs)-.5,Math.max(...xs)+.5]);
    this.zs=unique([...zs,Math.min(...zs)-.5,Math.max(...zs)+.5]);
    this.width=this.xs.length;this.size=this.width*this.zs.length;
    this.blocked=new Uint8Array(this.size);
    for(const r of this.rects){
      const columns=this.xs.map((x,i)=>x>r.left+1e-5&&x<r.right-1e-5?i:-1).filter(i=>i>=0);
      this.zs.forEach((z,row)=>{if(z>r.top+1e-5&&z<r.bottom-1e-5)for(const col of columns)this.blocked[row*this.width+col]=1;});
    }
    this.xIndex=new Map(this.xs.map((x,i)=>[x.toFixed(6),i]));this.zIndex=new Map(this.zs.map((z,i)=>[z.toFixed(6),i]));
  }
  reserve(points){
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],axis=Math.abs(a[0]-b[0])>1e-5?0:1;
      this.reserved.push({axis,constant:a[1-axis],min:Math.min(a[axis],b[axis]),max:Math.max(a[axis],b[axis])});
    }
  }
  routeCost(a,b){
    const axis=Math.abs(a[0]-b[0])>1e-5?0:1,constant=a[1-axis],min=Math.min(a[axis],b[axis]),max=Math.max(a[axis],b[axis]);
    let cost=0;
    for(const r of this.reserved){
      if(r.axis===axis){
        if(Math.abs(constant-r.constant)<LANE_GAP-1e-5&&Math.min(max,r.max)-Math.max(min,r.min)>1e-5)return Infinity;
      }else if(r.constant>min+1e-5&&r.constant<max-1e-5&&constant>r.min&&constant<r.max)cost+=2;
    }
    return cost;
  }
  ports(tile){
    return [[-1,0],[1,0],[0,-1],[0,1]].flatMap(([dx,dz])=>[-PORT_OFFSET,0,PORT_OFFSET].map(offset=>{
      const face=[tile.x+dx*tile.width/2+(dz?offset:0),tile.z+dz*tile.depth/2+(dx?offset:0)];
      const point=[face[0]+dx*CLEARANCE,face[1]+dz*CLEARANCE];
      const node=this.zIndex.get(point[1].toFixed(6))*this.width+this.xIndex.get(point[0].toFixed(6));
      return {face,point,node,axis:dx?0:1};
    })).filter(p=>Number.isFinite(p.node)&&!this.blocked[p.node]&&Number.isFinite(this.routeCost(p.face,p.point)));
  }
  route(source,target){
    let starts=this.ports(source),goals=this.ports(target);
    // A self edge must travel around its tile instead of collapsing to one port.
    if(source===target){starts=starts.filter(p=>p.axis===0&&p.point[0]>source.x);goals=goals.filter(p=>p.axis===0&&p.point[0]<target.x);}
    const distance=new Float64Array(this.size*2).fill(Infinity),previous=new Int32Array(this.size*2).fill(-1);
    const roots=new Map(),queue=new Queue();
    const point=node=>[this.xs[node%this.width],this.zs[Math.floor(node/this.width)]];
    const heuristic=node=>{const [x,z]=point(node);return Math.min(...goals.map(g=>Math.abs(x-g.point[0])+Math.abs(z-g.point[1])));};
    for(const p of starts){const state=p.node*2+p.axis;distance[state]=CLEARANCE;roots.set(state,p);queue.push({state,cost:CLEARANCE,score:CLEARANCE+heuristic(p.node)});}
    let finish=-1,goal,best=Infinity;
    while(queue.items.length){
      const item=queue.pop(),state=item.state,node=state>>1,axis=state%2;
      if(item.cost!==distance[state])continue;
      if(item.score>=best)break;
      for(const p of goals)if(p.node===node){const cost=item.cost+CLEARANCE+(axis===p.axis?0:.25);if(cost<best){best=cost;finish=state;goal=p;}}
      const col=node%this.width,row=Math.floor(node/this.width);
      const neighbors=[];
      if(col>0)neighbors.push([node-1,0]);if(col+1<this.width)neighbors.push([node+1,0]);
      if(row>0)neighbors.push([node-this.width,1]);if(row+1<this.zs.length)neighbors.push([node+this.width,1]);
      for(const [next,nextAxis] of neighbors){
        if(this.blocked[next])continue;
        const a=point(node),b=point(next),cost=item.cost+Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+(axis===nextAxis?0:.25)+this.routeCost(a,b),nextState=next*2+nextAxis;
        if(cost>=distance[nextState])continue;
        distance[nextState]=cost;previous[nextState]=state;queue.push({state:nextState,cost,score:cost+heuristic(next)});
      }
    }
    if(finish<0)throw new Error('No clear opcode route');
    const route=[goal.face];let state=finish;
    while(state>=0){route.push(point(state>>1));if(previous[state]<0){route.push(roots.get(state).face);break;}state=previous[state];}
    route.reverse();
    const clean=[];
    for(const p of route){
      if(clean.length&&Math.hypot(p[0]-clean.at(-1)[0],p[1]-clean.at(-1)[1])<1e-5)continue;
      while(clean.length>=2){const a=clean.at(-2),b=clean.at(-1);if(Math.abs((b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0]))>1e-5)break;clean.pop();}
      clean.push(p);
    }
    this.reserve(clean);
    return clean;
  }
}
