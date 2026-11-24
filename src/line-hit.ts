// All coordinates and widths are CSS pixels, never geographical distance.
export type XY={x:number;y:number};
export type HitLine={id:string;label:string;width:number;voltageKV?:number;paths:XY[][]};
export const hitWidth=(normalWidth:number,voltageKV?:number)=>normalWidth*(voltageKV===66?5:3);
export function segmentDistance(p:XY,a:XY,b:XY){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function lineHits(point:XY,lines:HitLine[]){
 const hits=lines.flatMap(line=>{
  let distance=Infinity;
  // Separate paths are never joined. Shared vertices have round, continuous coverage.
  for(const path of line.paths)for(let i=1;i<path.length;i++)distance=Math.min(distance,segmentDistance(point,path[i-1],path[i]));
  return distance<=hitWidth(line.width,line.voltageKV)/2?[{id:line.id,label:line.label,distance}]:[];
 }).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
 // A one-CSS-pixel tie is too close to reliably distinguish by touch.
 return hits.filter(h=>h.distance<=hits[0].distance+1);
}
export class TapGesture {
 private pointers=new Map<number,XY>();
 blocked=false;
 down(id:number,p:XY){if(!this.pointers.size)this.blocked=false;this.pointers.set(id,p);if(this.pointers.size>1)this.blocked=true;}
 move(id:number,p:XY){const start=this.pointers.get(id);if(start&&Math.hypot(start.x-p.x,start.y-p.y)>3)this.blocked=true;}
 up(id:number){this.pointers.delete(id);}
 cancel(id:number){this.blocked=true;this.up(id);}
}
