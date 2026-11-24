import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath} from '../src/flow-path.ts';
import {rawSkip} from './raw-data.mjs';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const g=read('public/data/tohoku-trunk-osm.json'),a=read('docs/research/tohoku-review-adopted.json');
test('Tohoku review sections are C tier and reference existing facilities',()=>{
 const ids=new Set(g.facilities.map((f:any)=>f.id));
 for(const l of a.lines){assert.ok(g.lines.some((x:any)=>x.id===l.id),l.id);assert.ok(l.attributes.some((x:any)=>x.label==='要注意（C区分）'));
  for(const c of l.connections)for(const f of c.facilities)assert.ok(ids.has(f.id),l.name+' '+f.id);
  for(const [k,p] of l.paths.entries())if(l.osmIds[k]<0){assert.equal(p.length,2);assert.ok(l.schematicParts.some((x:any)=>x.osmId===l.osmIds[k]));}}
});
// 原本（data/raw）を使う部分は別のテストに分け、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('Tohoku review sections follow acquired OSM edges',{skip:rawSkip('data/raw/tohoku-review-osm/lines-275.json','data/raw/tohoku-review-osm/lines-500.json')},()=>{
 const raw=['lines-275','lines-500'].flatMap(n=>read('data/raw/tohoku-review-osm/'+n+'.json').elements);const nodes=new Map(raw.filter((e:any)=>e.type==='node').map((e:any)=>[e.id,[e.lat,e.lon]]));
 const edges=new Set(raw.filter((w:any)=>w.type==='way').flatMap((w:any)=>w.nodes.slice(1).map((n:number,i:number)=>JSON.stringify([nodes.get(w.nodes[i]),nodes.get(n)].sort()))));
 for(const l of a.lines)for(const [k,p] of l.paths.entries()){if(l.osmIds[k]<0)continue;for(let i=1;i<p.length;i++)assert.ok(edges.has(JSON.stringify([p[i-1],p[i]].sort())),l.name);}
});
test('every adopted facility is in the map data (a re-run once dropped 福島ガス発電所)',()=>{
 const ids=new Set(g.facilities.map((f:any)=>f.id));for(const f of a.facilities)assert.ok(ids.has(f.id),f.name);
});
test('adopted sections are not drawn twice: trimmed base lines share no edge with them',()=>{
 const key=(p:any,q:any)=>[p.join(),q.join()].sort().join('|');const cov=new Set(a.lines.flatMap((l:any)=>l.paths.flatMap((p:any)=>p.slice(1).map((q:any,i:number)=>l.voltageKV+key(p[i],q)))));
 const adopted=new Set(a.lines.map((l:any)=>l.id));
 for(const l of g.lines)if(!adopted.has(l.id))for(const p of l.paths)for(let i=1;i<p.length;i++)assert.ok(!cov.has(l.voltageKV+key(p[i-1],p[i])),l.id);
});
test('every OCCTO Tohoku row draws on a route (０１２９線 via a straight end to 仙台)',()=>{
 const day=typicalDay(read('public/data/occto-tohoku.json'));const miss=day.actual.lines.filter((r:any)=>!referenceFlowPath(r,g.lines,false)).map((r:any)=>r.name);
 assert.deepEqual(miss,[]);
 for(const n of ['朝日幹線','宮城幹線','飯豊幹線','北青幹線','東上越幹線'])assert.ok(day.actual.lines.some((r:any)=>r.name===n&&referenceFlowPath(r,g.lines,false)),n);
});
