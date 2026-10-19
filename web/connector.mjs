import * as THREE from 'three';

// Preserve every route bend; uniform TubeGeometry sampling cuts across corners.
export function connector(points,color,{dashed=false,height=.36}={}) {
  const vectors=[];
  for(const [x,z] of points){
    const p=new THREE.Vector3(x,height,z);
    if(!vectors.length||p.distanceTo(vectors.at(-1))>1e-5)vectors.push(p);
  }
  if(vectors.length<2)throw new Error('Connector needs two distinct points');
  const path=new THREE.CurvePath();
  for(let i=1;i<vectors.length;i++)path.add(new THREE.LineCurve3(vectors[i-1],vectors[i]));
  const tip=vectors.at(-1),previous=vectors.at(-2),length=tip.distanceTo(previous);
  const direction=tip.clone().sub(previous).normalize();
  const headLength=Math.min(.24,length*.8),headWidth=Math.min(.2,headLength*1.1);
  const base=tip.clone().addScaledVector(direction,-headLength);
  const normal=new THREE.Vector3(-direction.z,0,direction.x);
  const shaft=[...vectors.slice(0,-1),base],positions=[];
  const triangle=(a,b,c)=>positions.push(...a.toArray(),...b.toArray(),...c.toArray());
  let line;
  if(dashed){
    line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(shaft),new THREE.LineDashedMaterial({color,dashSize:.15,gapSize:.12}));
    line.computeLineDistances();
  }else{
    const radius=Math.min(.035,headWidth/4);
    let lastLeft,lastRight;
    for(let i=1;i<shaft.length;i++){
      const a=shaft[i-1],b=shaft[i],d=b.clone().sub(a).normalize();
      const side=new THREE.Vector3(-d.z,0,d.x).multiplyScalar(radius);
      const al=a.clone().add(side),ar=a.clone().sub(side),bl=b.clone().add(side),br=b.clone().sub(side);
      triangle(al,ar,bl);triangle(ar,br,bl);
      if(lastLeft){triangle(a,lastLeft,al);triangle(a,ar,lastRight);}
      lastLeft=bl;lastRight=br;
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    line=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
  }
  const head=new THREE.BufferGeometry().setFromPoints([tip,base.clone().addScaledVector(normal,headWidth/2),base.clone().addScaledVector(normal,-headWidth/2)]);
  const arrow=new THREE.Mesh(head,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
  return {line,arrow,path,color};
}
