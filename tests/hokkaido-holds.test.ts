import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {rawSkip} from './raw-data.mjs';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const d=read('public/data/hokkaido-hokuto.json'),h=read('docs/research/hokkaido-holds-adopted.json');
test('adopted Hokkaido holds are C tier and reference existing facilities',()=>{
 for(const l of h.lines){const got=d.lines.find((x:any)=>x.id===l.id);assert.ok(got,l.id);assert.ok(l.attributes.some((a:any)=>a.label==='要注意（C区分）'),l.name);
  for(const c of l.connections)for(const f of c.facilities)assert.ok(d.facilities.some((x:any)=>x.id===f.id),f.id);
  for(const [k,p] of l.paths.entries())if(l.osmIds[k]<0){assert.equal(p.length,2);assert.ok(['unknown','underground'].includes(l.schematicParts.find((x:any)=>x.osmId===l.osmIds[k]).construction));}}
 assert.equal(new Set(d.lines.map((l:any)=>l.assetId)).size,d.lines.length);assert.equal(new Set(d.facilities.map((f:any)=>f.assetId)).size,d.facilities.length);
 for(const f of h.facilities)assert.ok(!/太陽光|ソーラー|風力/.test(f.name),f.name);
});
// 原本（data/raw）を使う部分は別のテストに分け、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('adopted Hokkaido holds follow only acquired OSM edges',{skip:rawSkip('data/raw/hokkaido-holds-osm/lines-187.json','data/raw/hokkaido-holds-osm/lines-275.json')},()=>{
 const raw=['lines-187','lines-275'].flatMap(n=>read('data/raw/hokkaido-holds-osm/'+n+'.json').elements);const nodes=new Map(raw.filter((e:any)=>e.type==='node').map((e:any)=>[e.id,[e.lat,e.lon]]));
 const edges=new Set(raw.filter((w:any)=>w.type==='way').flatMap((w:any)=>w.nodes.slice(1).map((n:number,i:number)=>JSON.stringify([nodes.get(w.nodes[i]),nodes.get(n)].sort()))));
 for(const l of h.lines)for(const [k,p] of l.paths.entries()){if(l.osmIds[k]<0)continue;
  for(let i=1;i<p.length;i++)assert.ok(edges.has(JSON.stringify([p[i-1],p[i]].sort()))||(l.name==='西音更線'&&p[i-1].join()===p[i].join()),l.name);}
});
test('every OCCTO Hokkaido row now has a reference path; new rows use directional capacity only',()=>{
 const day=reviewedHokkaidoDay(typicalDay(read('public/data/hokkaido-flow.json')));assert.equal(day.actual.lines.length,40);
 for(const r of day.actual.lines)assert.ok(referenceFlowPath(r,d.lines,false),r.name);
 const hk=day.actual.lines.find(r=>r.name==='函館幹線')!;assert.equal(day.capacities.filter(c=>c.name==='函館幹線').length,0);assert.equal(capacityReferenceUsage(hk,100,day.capacities),null);
 const oi=day.actual.lines.find(r=>r.name==='追分線')!;const c=day.capacities.find(c=>c.name==='追分線')!;const sign=c.from===oi.from?1:-1;assert.ok(capacityReferenceUsage(oi,sign*100,day.capacities));assert.equal(capacityReferenceUsage(oi,-sign*100,day.capacities),null);
});
test('追分開閉所 is one facility reached by three lines; 函館幹線 is drawn once for the whole OCCTO section',()=>{
 const oi=d.facilities.filter((f:any)=>f.name==='追分開閉所');assert.equal(oi.length,1);
 assert.equal(d.lines.filter((l:any)=>l.connections.some((c:any)=>c.facilities.some((f:any)=>f.id===oi[0].id))).length,3);
 const hk=d.lines.filter((l:any)=>l.name==='函館幹線');assert.equal(hk.length,1);assert.deepEqual(hk[0].connections.map((c:any)=>c.facilities[0].name),['北七飯変電所','双葉開閉所']);
});
