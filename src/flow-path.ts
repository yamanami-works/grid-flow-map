import { candidateGeometry, normalizeName, referenceStatus } from './real-domain.ts';
import type { ActualLine, GeoLine } from './real-domain.ts';
import {endpointName} from './endpoint-aliases.ts';
type Point = [number, number];
// Geometric reference route, not a verified electrical circuit. Never bridge gaps.
export function referenceFlowPath(record: ActualLine, lines: GeoLine[], compareEquipmentIds = true): Point[] | null {
 const matches=candidateGeometry(record,lines);
 if (!matches.length || compareEquipmentIds && referenceStatus(record.id,matches)==='conflicting') return null;
 const ids=new Set(matches.flatMap(l=>l.connectedWayIds ?? l.osmIds));
 const scoped=lines.filter(l=>l.voltageKV===record.voltageKV && l.osmIds.some(id=>ids.has(id)));
 const key=(p:Point)=>p.join(',');
 const graph=new Map<string,Map<string,number>>(), points=new Map<string,Point>();
 for(const l of scoped) for(const [i,path] of l.paths.entries()) {
  if(!ids.has(l.osmIds[i]))continue;
  for(let j=0;j<path.length;j++) {const p=path[j],a=key(p);points.set(a,p);if(!graph.has(a))graph.set(a,new Map());if(j){const q=path[j-1],b=key(q),d=Math.hypot((p[0]-q[0]),(p[1]-q[1])*Math.cos(p[0]*Math.PI/180));graph.get(a)!.set(b,d);graph.get(b)!.set(a,d);}}
 }
 // 同じ名前の区間が同じ設備の中で別の点に着く場合（東京 西南川越線：南狭山変電所で約260m）、その2点だけをつなぐ（OCCTOの1行が設備を通り抜ける）
 const facilityEnds=new Map<string,{k:string;line:number}[]>();matches.forEach((l,line)=>{for(const e of l.connections??[])for(const f of e.facilities){const k=key(e.position as Point);if(f.id&&graph.has(k))facilityEnds.set(f.id,[...(facilityEnds.get(f.id)??[]),{k,line}]);}});
 for(const ks of facilityEnds.values())for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++)if(ks[i].line!==ks[j].line&&ks[i].k!==ks[j].k){graph.get(ks[i].k)!.set(ks[j].k,0);graph.get(ks[j].k)!.set(ks[i].k,0);}
 // 「分岐点」は名称の一致した線の、設備のない端（他線上の分岐。例：中部 東名分岐線）
 const terminals=(name:string)=>(name==='分岐点'?matches.flatMap(l=>l.connections??[]).filter(e=>e.status==='shared-node'&&!e.facilities.length):[...scoped.flatMap(l=>l.connections??[]),...scoped.flatMap(l=>(l.flowTaps??[]).map(t=>({position:t.position,facilities:[{id:'',name:t.name}]})))].filter(e=>e.facilities.some(f=>normalizeName(f.name)===normalizeName(endpointName(record,name))))).map(e=>key(e.position)).filter(k=>graph.has(k));
 const starts=terminals(record.from), ends=new Set(terminals(record.to));
 if(!starts.length||!ends.size)return null;
 const distance=new Map(starts.map(k=>[k,0])),previous=new Map<string,string>(),pending=new Set(starts);
 while(pending.size){let at=[...pending].reduce((a,b)=>distance.get(a)!<distance.get(b)!?a:b);pending.delete(at);
 if(ends.has(at)){const path:Point[]=[];while(at){path.unshift(points.get(at)!);at=previous.get(at)!;}return path.length>1?path:null;}
 for(const [next,w] of graph.get(at)??[]){const d=distance.get(at)!+w;if(d<(distance.get(next)??Infinity)){distance.set(next,d);previous.set(next,at);pending.add(next);}}
 }
 return null;
}
// 分岐をはさむOCCTOの行（2026-10-09）：参照経路の途中の点に、この行の線ではない同じ電圧の線の端がある（＝分岐）。
// 表示は docs/RULES.md 4節（分岐を含む行）による（2026-10-10 から）。返り値は分岐する線の名前（なければ空）
const branchCache=new WeakMap<GeoLine[],Map<string,string[]>>();
export function flowBranches(record: ActualLine, lines: GeoLine[]): string[] {
 let cache=branchCache.get(lines);if(!cache){cache=new Map();branchCache.set(lines,cache);}
 const ck=[record.id,record.name,record.voltageKV,record.from,record.to].join('|');
 const hit=cache.get(ck);if(hit)return hit;
 const path=referenceFlowPath(record,lines,false);let out:string[]=[];
 if(path&&path.length>2){
  const matched=new Set(candidateGeometry(record,lines).map(l=>l.id)),k=(p:Point)=>p.join(',');
  const inner=new Set(path.slice(1,-1).map(k)),names=new Set<string>();
  // 共架の線（coHungWith にこの行の線のIDがある線）は、経路の途中で分かれても分岐ではないので数えない（2026-11-10）
  for(const l of lines){if(l.voltageKV!==record.voltageKV||matched.has(l.id)||l.coHungWith?.some(id=>matched.has(id)))continue;
   for(const p of l.paths)if(p.length&&(inner.has(k(p[0] as Point))||inner.has(k(p[p.length-1] as Point)))){names.add(l.name||l.id);break;}}
  out=[...names];
 }
 cache.set(ck,out);return out;
}

// 行の外の区間（2026-11-08）：途中の変電所で終わるOCCTOの行（flowTaps。鹿島線＝鹿島→筑波南、江東線＝新京葉→葛南）は、線の一部の区間の値。
// 線の線分（paths[i] の j 番目と j+1 番目の点）のうち、両端が行の参照経路の点であるものを "i:j" で返す（1つの path が途中の変電所を通り抜けるため path 単位では分けられない）。
// 前提：経路は同じ線の点を順にたどる（経路が別の線を通って同じ線に戻り、隣り合わない2点が線分の両端になる場合は区別しない。鹿島線・江東線は画面とテストで確認）。
// 経路が作れないときは null（行の外と決めない＝推測で未収録にしない）
const rowSegCache=new WeakMap<GeoLine[],Map<string,Set<string>|null>>();
export function rowSegments(record: ActualLine, lines: GeoLine[], g: GeoLine): Set<string> | null {
 let cache=rowSegCache.get(lines);if(!cache){cache=new Map();rowSegCache.set(lines,cache);}
 const ck=[g.id,record.id,record.name,record.voltageKV,record.from,record.to].join('|');
 if(cache.has(ck))return cache.get(ck)!;
 const route=referenceFlowPath(record,lines,false);let out:Set<string>|null=null;
 if(route){const on=new Set(route.map(p=>p.join(',')));out=new Set();g.paths.forEach((p,i)=>{for(let j=0;j+1<p.length;j++)if(on.has(p[j].join(','))&&on.has(p[j+1].join(',')))out!.add(i+':'+j);});}
 cache.set(ck,out);return out;
}
const segCount=(g:GeoLine)=>g.paths.reduce((n,p)=>n+Math.max(0,p.length-1),0);
const segDistance=(p:Point,a:Point,b:Point)=>{const c=Math.cos(p[0]*Math.PI/180),ax=(a[1]-p[1])*c,ay=a[0]-p[0],bx=(b[1]-p[1])*c,by=b[0]-p[0],dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/l)):0;return Math.hypot(ax+t*dx,ay+t*dy);};
/** 押した位置にいちばん近い線分が行の外なら true。flowTaps のない線・経路が作れない・すべての線分が経路に載る・距離が同じ（行の内と外）のときは false */
export function offRowAt(record: ActualLine, lines: GeoLine[], g: GeoLine, at: Point): boolean {
 if(!g.flowTaps?.length)return false;
 const on=rowSegments(record,lines,g);if(!on||!on.size||on.size===segCount(g))return false;
 let best=Infinity,bestOn=false;
 g.paths.forEach((p,i)=>{for(let j=0;j+1<p.length;j++){const d=segDistance(at,p[j] as Point,p[j+1] as Point),inRow=on.has(i+':'+j);if(d<best-1e-12){best=d;bestOn=inRow;}else if(Math.abs(d-best)<=1e-12&&inRow)bestOn=true;}});
 return best<Infinity&&!bestOn;
}
/** 行の外の区間の両端の名前（線の接続先と flowTaps のうち、行の外の線分の点にあるもの）。ちょうど2つでなければ null（区間名を出さない） */
export function offRowEnds(record: ActualLine, lines: GeoLine[], g: GeoLine): [string,string] | null {
 if(!g.flowTaps?.length)return null;
 const on=rowSegments(record,lines,g);if(!on||!on.size||on.size===segCount(g))return null;
 const off=new Set<string>();g.paths.forEach((p,i)=>{for(let j=0;j+1<p.length;j++)if(!on.has(i+':'+j)){off.add(p[j].join(','));off.add(p[j+1].join(','));}});
 const names=[...new Set([...(g.connections??[]).flatMap(c=>off.has(c.position.join(','))?c.facilities.map(f=>f.name):[]),...(g.flowTaps??[]).filter(t=>off.has(t.position.join(','))).map(t=>t.name)])];
 return names.length===2?[names[0],names[1]]:null;
}
