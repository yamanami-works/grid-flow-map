import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const data=read('public/data/hokkaido-hokuto.json'),review=read('docs/research/hokkaido-275-route.json'),raw=read('public/data/hokkaido-flow.json');
for(const r of review.routes)test(`${r.name}: real connected edges, exact terminals, no artificial links`,()=>{
 const line=data.lines.find((l:any)=>l.name===r.name);assert.equal(line.currentType,'ac');assert.equal(line.voltageKV,275);
 assert.deepEqual(line.paths,r.lines.map((l:any)=>l.coordinatesLatLon));
 const path=referenceFlowPath({id:'test',name:r.name,voltageKV:275,from:r.from,to:r.to,values:[],note:''},data.lines,false);assert.ok(path);
 for(const [name,p] of [[r.from,path[0]],[r.to,path.at(-1)]])assert.ok(line.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(p)));
 const edges=new Set(line.paths.flatMap((p:number[][])=>p.slice(1).flatMap((x,i)=>[JSON.stringify([p[i],x]),JSON.stringify([x,p[i]])])));
 for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 // Every selected way must belong to one shared-node component, including terminal leads.
 const pending=[...r.lines];const reached=new Set<string>(pending.shift().nodes);let n=-1;
 while(n!==pending.length){n=pending.length;for(let i=pending.length-1;i>=0;i--)if(pending[i].nodes.some((x:string)=>reached.has(x))){pending[i].nodes.forEach((x:string)=>reached.add(x));pending.splice(i,1);}}
 assert.equal(pending.length,0);assert.ok(r.lines.every((l:any)=>l.tags.voltage.split(';').includes('275000')));
});

test('275kV geographic additions do not invent flow; Karikachi uses exact reverse capacity',()=>{
 const day=typicalDay(raw),mapped=reviewedHokkaidoDay(day);const k=mapped.actual.lines.find(l=>l.name==='狩勝幹線')!;assert.ok(k);assert.ok(referenceFlowPath(k,data.lines,false));assert.equal(k.from,'北新得変電所');assert.equal(k.to,'南早来変電所');assert.deepEqual(k.values,day.actual.lines.find((l:any)=>l.name===k.name).values);
 const caps=mapped.capacities.filter(c=>c.name===k.name);assert.equal(caps.length,1);assert.equal(caps[0].from,k.to);assert.equal(caps[0].to,k.from);assert.equal(capacityReferenceUsage(k,100,caps),null);assert.equal(capacityReferenceUsage(k,-100,caps),100/caps[0].capacityMW*100);
 assert.ok(!mapped.actual.lines.some(l=>['泊幹線','石狩火力幹線'].includes(l.name)));
 assert.ok(!('equipmentMW' in review.routes.find((r:any)=>r.name==='石狩火力幹線')),'容量の値を持たない'); // 調査 JSON の容量のキーは保留95 ⑤-4 で消した
 for(const f of ['西野変電所','西当別変電所','南早来変電所','北新得変電所'])assert.equal(data.facilities.filter((x:any)=>x.name===f).length,1);
 const wrong=reviewedHokkaidoDay({...day,actual:{...day.actual,lines:[{...k,from:'北新得SS',to:'西当別SS'}]}});assert.equal(wrong.actual.lines.length,0);
});
