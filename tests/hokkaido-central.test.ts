import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const data=read('public/data/hokkaido-hokuto.json'),review=read('docs/research/hokkaido-central-route.json'),raw=read('public/data/hokkaido-flow.json');
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
test('central flows require reviewed ordered endpoints; no capacity or value substitution',()=>{
 const day=raw.days.find((d:any)=>d.actual.lines.some((r:any)=>r.name==='道央東幹線'));const mapped=reviewedHokkaidoDay(day);
 for(const r of review.routes){const original=day.actual.lines.find((l:any)=>l.name===r.name);const line=mapped.actual.lines.find(l=>l.name===r.name)!;assert.ok(line);assert.deepEqual(line.values,original.values);assert.equal(line.id,original.id);
  assert.ok(referenceFlowPath(line,data.lines,false));assert.equal(reviewedHokkaidoDay({...day,actual:{...day.actual,lines:[{...original,to:'未照合設備'}]}}).actual.lines.length,0);
 }
 const east=mapped.actual.lines.find(l=>l.name==='道央東幹線')!;const caps=[{name:east.name,voltageKV:275,from:east.to,to:east.from,capacityMW:1517}];
 assert.equal(capacityReferenceUsage(east,100,caps),null);assert.equal(capacityReferenceUsage(east,-100,caps),100/1517*100);
 assert.equal(new Set(data.facilities.map((f:any)=>f.assetId)).size,data.facilities.length);
 assert.equal(data.facilities.find((f:any)=>f.name==='南早来変電所').assetId,'asset-1559e0b3-1d07-4f40-8155-9f0b70bec326');
});
