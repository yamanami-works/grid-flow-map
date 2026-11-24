import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const data=read('public/data/hokkaido-hokuto.json'),review=read('docs/research/hokkaido-187-central-route.json'),raw=read('public/data/hokkaido-flow.json');
for(const r of review.routes)test(`${r.name}: 187kV route reaches its own public terminals without 275kV inference`,()=>{
 const line=data.lines.find((l:any)=>l.name===r.name);assert.equal(line.voltageKV,187);assert.equal(line.currentType,'ac');assert.deepEqual(line.paths,r.lines.map((l:any)=>l.coordinatesLatLon));
 const path=referenceFlowPath({id:'test',name:r.name,voltageKV:187,from:r.from,to:r.to,values:[],note:''},data.lines,false);assert.ok(path);
 for(const [name,p] of [[r.from,path[0]],[r.to,path.at(-1)]])assert.ok(line.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(p)));
 const edges=new Set(line.paths.flatMap((p:number[][])=>p.slice(1).flatMap((x,i)=>[JSON.stringify([p[i],x]),JSON.stringify([x,p[i]])])));for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 const pending=[...r.lines],nodes=new Set<string>(pending.shift().nodes);let n=-1;while(n!==pending.length){n=pending.length;for(let i=pending.length-1;i>=0;i--)if(pending[i].nodes.some((x:string)=>nodes.has(x))){pending[i].nodes.forEach((x:string)=>nodes.add(x));pending.splice(i,1);}}assert.equal(pending.length,0);
 assert.ok(r.lines.every((l:any)=>l.tags.voltage.split(';').includes('187000')));
});
test('187kV public section identity, reverse capacity and withheld sections remain distinct',()=>{
 const day=typicalDay(raw),mapped=reviewedHokkaidoDay(day);
 for(const r of review.routes){const o=day.actual.lines.find((l:any)=>l.name===r.name),m=mapped.actual.lines.find(l=>l.name===r.name)!;assert.ok(m);assert.deepEqual(m.values,o.values);assert.equal(m.id,o.id);assert.ok(referenceFlowPath(m,data.lines,false));}
 const k=mapped.actual.lines.find(l=>l.name==='北江別線')!;const caps=[{name:k.name,voltageKV:187,from:k.to,to:k.from,capacityMW:825}];assert.equal(capacityReferenceUsage(k,100,caps),null);assert.equal(capacityReferenceUsage(k,-100,caps),100/825*100);
 const m=mapped.actual.lines.find(l=>l.name==='室蘭西幹線（西野～双葉）')!;const c=mapped.capacities.filter(c=>c.name===m.name);assert.equal(c.length,1);assert.equal(c[0].from,'双葉開閉所');assert.equal(c[0].to,'西野変電所');assert.equal(c[0].id,day.capacities.find((c:any)=>c.name==='室蘭西幹線'&&c.from==='双葉開閉所').id);
 assert.equal(capacityReferenceUsage(m,-100,c),null);
 // 2026-10-01 C区分で採用（末端は直線補完）。潮流は各公表区間の実績だけで描く。
 for(const n of ['西札幌線','室蘭西幹線（西野～西札幌）']){const a=mapped.actual.lines.find(l=>l.name===n)!;assert.ok(a);assert.ok(referenceFlowPath(a,data.lines,false),n);const l=data.lines.find((x:any)=>x.name===n);assert.ok(l.attributes.some((x:any)=>x.label==='要注意（C区分）'));assert.equal(l.schematicParts.length,1);}
 assert.equal(data.facilities.filter((f:any)=>f.name==='西当別変電所').length,1);assert.equal(data.facilities.filter((f:any)=>f.name==='西野変電所').length,1);
 assert.notEqual(data.facilities.find((f:any)=>f.name==='双葉開閉所').assetId,data.facilities.find((f:any)=>f.name==='西双葉開閉所').assetId);
});
