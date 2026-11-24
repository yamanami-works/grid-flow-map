import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const data=read('public/data/hokkaido-hokuto.json'),review=read('docs/research/hokkaido-ebetsu-route.json'),raw=read('public/data/hokkaido-flow.json');
for(const r of review.routes)test(`${r.name}: 187kV route reaches its own public terminals without 275kV inference`,()=>{
 const line=data.lines.find((l:any)=>l.name===r.name);assert.equal(line.voltageKV,187);assert.equal(line.currentType,'ac');assert.deepEqual(line.paths,r.lines.map((l:any)=>l.coordinatesLatLon));
 const path=referenceFlowPath({id:'test',name:r.name,voltageKV:187,from:r.from,to:r.to,values:[],note:''},data.lines,false);assert.ok(path);
 for(const [name,p] of [[r.from,path[0]],[r.to,path.at(-1)]])assert.ok(line.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(p)));
 const edges=new Set(line.paths.flatMap((p:number[][])=>p.slice(1).flatMap((x,i)=>[JSON.stringify([p[i],x]),JSON.stringify([x,p[i]])])));for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 const pending=[...r.lines],nodes=new Set<string>(pending.shift().nodes);let n=-1;while(n!==pending.length){n=pending.length;for(let i=pending.length-1;i>=0;i--)if(pending[i].nodes.some((x:string)=>nodes.has(x))){pending[i].nodes.forEach((x:string)=>nodes.add(x));pending.splice(i,1);}}assert.equal(pending.length,0);
 assert.ok(r.lines.every((l:any)=>l.tags.voltage.split(';').includes('187000')));
});

test('Ebetsu block only maps reviewed Minami-Sapporo flow and preserves capacity direction',()=>{
 const day=typicalDay(raw),mapped=reviewedHokkaidoDay(day),line=mapped.actual.lines.find(l=>l.name==='南札幌幹線')!;
 assert.ok(line);assert.equal(line.from,'北江別変電所');assert.equal(line.to,'南札幌変電所');assert.deepEqual(line.values,day.actual.lines.find((l:any)=>l.name===line.name).values);
 assert.ok(referenceFlowPath(line,data.lines,false));assert.equal(capacityReferenceUsage(line,-100,mapped.capacities),null);
 assert.ok(!mapped.actual.lines.some(l=>['奈井江幹線','滝川幹線'].includes(l.name)));
 for(const f of review.facilities)assert.equal(data.facilities.filter((x:any)=>x.assetId===f.assetId).length,1);
 assert.equal(data.facilities.find((x:any)=>x.name==='西奈井江開閉所').kind,'switchyard');

});

