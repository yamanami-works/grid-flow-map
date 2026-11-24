import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
import {rawSkip} from './raw-data.mjs';
const t=read('docs/research/tokyo-275-adopted.json');
test('275kV adopted lines are 275kV',()=>{for(const l of t.lines)assert.equal(l.voltageKV,275);});
// 原本（data/raw）を使う部分は、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('275kV lines follow acquired 275kV ways only',{skip:rawSkip(...['lines-north1','lines-north2','lines-south','held-cables','held-lines-west-north'].map(n=>'data/raw/tokyo-275/'+n+'.json'),'data/raw/tokyo-500-support/fc-lines.json','data/raw/tokyo-500-support/lines.json')},()=>{
 const raw=['lines-north1','lines-north2','lines-south','held-cables','held-lines-west-north'].flatMap(n=>read('data/raw/tokyo-275/'+n+'.json').elements).concat(read('data/raw/tokyo-500-support/fc-lines.json').elements,read('data/raw/tokyo-500-support/lines.json').elements);
 const nodes=new Map(raw.filter(e=>e.type==='node').map(n=>[n.id,[n.lat,n.lon]]));
 const edges=new Set(raw.filter(w=>w.type==='way'&&w.tags?.frequency!=='0'&&String(w.tags?.voltage??'').split(';').includes('275000')).flatMap(w=>w.nodes.slice(1).map((n:number,i:number)=>JSON.stringify([nodes.get(w.nodes[i]),nodes.get(n)].sort()))));
 for(const l of t.lines){assert.equal(l.voltageKV,275);for(const p of l.paths)for(let i=1;i<p.length;i++)assert.ok(edges.has(JSON.stringify([p[i-1],p[i]].sort())),l.name);}
});
test('C-tier and partial 275kV lines are labelled; partial ends are unresolved',()=>{
 for(const l of t.lines){assert.ok(['A','B','C'].includes(l.tier));if(l.tier==='C')assert.equal(l.attributes[0].label,'要注意（C区分）');
  if(l.referenceReview.status==='partial'){assert.ok(l.name.endsWith('（地理部分収録）'));assert.equal(l.connections[1].status,'unresolved');}}
});
test('275kV OCCTO rows map only when name and endpoints match; each mapped row has a reference route',()=>{
 const pairs=read('docs/research/tokyo-275-occto-pairs.json');const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));const d=read('public/data/tokyo-trunk.json');
 const mapped=day.actual.lines.filter(a=>a.voltageKV===275&&pairs.pairs.some((p:any)=>p[1]===a.name));
 assert.ok(mapped.length>=25);for(const a of mapped)assert.ok(referenceFlowPath(a,d.lines,false),a.name);
 for(const s of pairs.skipped)assert.ok(!pairs.pairs.some((p:any)=>s.occto.startsWith(p[0]+' ')&&s.occto.endsWith(p[3]+'→'+p[4])),s.occto);
});
test('高瀬川線 No.76 follows OSM way 315662818 from inside 新信濃 to the terminal tower standing in for 新高瀬川発電所',()=>{
 const t=read('docs/research/tokyo-275-takase.json'),d=read('public/data/tokyo-trunk.json'),l=d.lines.find((x:any)=>x.id==='tokyo-section-76');
 assert.ok(l);assert.deepEqual(l.osmIds,[315662818]);assert.deepEqual(l.paths,t.lines[0].paths);
 assert.equal(l.connections[0].facilities[0].name,'新信濃変電所');const f=d.facilities.find((x:any)=>x.id==='tokyo-plant-shintakasegawa');
 assert.equal(f.kind,'plant');assert.deepEqual(f.position,l.paths[0].at(-1));assert.equal(l.connections[1].facilities[0].id,f.id);
 const s=read('docs/research/tokyo-275-progress.json').sections.find((x:any)=>x.section===76);assert.equal(s.research,'reviewed');assert.equal(s.tier,'C');
});
