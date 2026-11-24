import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const data=read('public/data/hokkaido-hokuto.json'),review=read('docs/research/hokkaido-sapporo-187-route.json'),raw=read('public/data/hokkaido-flow.json');
for(const r of review.routes)test(`${r.name}: 187kV route reaches its own public terminals without 275kV inference`,()=>{
 const line=data.lines.find((l:any)=>l.name===r.name);assert.equal(line.voltageKV,187);assert.equal(line.currentType,'ac');assert.deepEqual(line.paths,r.lines.map((l:any)=>l.coordinatesLatLon));
 const path=referenceFlowPath({id:'test',name:r.name,voltageKV:187,from:r.from,to:r.to,values:[],note:''},data.lines,false);assert.ok(path);
 for(const [name,p] of [[r.from,path[0]],[r.to,path.at(-1)]])assert.ok(line.connections.some((c:any)=>c.facilities.some((f:any)=>f.name===name)&&JSON.stringify(c.position)===JSON.stringify(p)));
 const edges=new Set(line.paths.flatMap((p:number[][])=>p.slice(1).flatMap((x,i)=>[JSON.stringify([p[i],x]),JSON.stringify([x,p[i]])])));for(let i=1;i<path.length;i++)assert.ok(edges.has(JSON.stringify([path[i-1],path[i]])));
 const pending=[...r.lines],nodes=new Set<string>(pending.shift().nodes);let n=-1;while(n!==pending.length){n=pending.length;for(let i=pending.length-1;i>=0;i--)if(pending[i].nodes.some((x:string)=>nodes.has(x))){pending[i].nodes.forEach((x:string)=>nodes.add(x));pending.splice(i,1);}}assert.equal(pending.length,0);
 assert.ok(r.lines.every((l:any)=>l.tags.voltage.split(';').includes('187000')));
});

test('Sapporo public sections have independent directional observations; unsupported underground segment stays held',()=>{
 const day=typicalDay(raw),mapped=reviewedHokkaidoDay(day);
 for(const r of review.routes){const line=mapped.actual.lines.find((l:any)=>l.name===r.name)!;assert.ok(line);assert.ok(referenceFlowPath(line,data.lines,false));assert.deepEqual(line.values,day.actual.lines.find((l:any)=>l.id===line.id).values);const cap=mapped.capacities.find((l:any)=>l.name===r.name)!;assert.ok(cap);assert.equal(cap.from,line.to);assert.equal(cap.to,line.from);assert.equal(capacityReferenceUsage(line,100,mapped.capacities),null);assert.ok(capacityReferenceUsage(line,-100,mapped.capacities));}
 assert.equal(new Set(review.routes.map((r:any)=>mapped.actual.lines.find((l:any)=>l.name===r.name)!.id)).size,3);
 // 2026-10-01 C区分で採用：南九条変電所は南九条線が届く無名区画に名称を当てた（地中引込は未確認）。
 const kujo=data.lines.find((l:any)=>l.name==='南九条線');assert.ok(kujo.attributes.some((a:any)=>a.label==='要注意（C区分）'));assert.ok(referenceFlowPath(mapped.actual.lines.find((l:any)=>l.name==='南九条線')!,data.lines,false));
 for(const name of ['西当別変電所','西野変電所','苗穂変電所','篠路変電所','西小樽変電所'])assert.equal(data.facilities.filter((f:any)=>f.name===name).length,1);
 assert.equal(data.lines.find((l:any)=>l.name==='西小樽線').osmIds.includes(179155300),false);
});
