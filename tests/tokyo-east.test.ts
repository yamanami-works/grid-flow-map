import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
import {rawSkip} from './raw-data.mjs';
// 原本（data/raw）を使う部分は別のテストに分け、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('eastern/northern Kanto sections follow acquired 500kV nodes; unnamed ways are single-span lead-ins only',{skip:rawSkip('data/raw/tokyo-500/north.json','data/raw/tokyo-500/south.json')},()=>{
 const raw=['north','south'].flatMap(n=>read('data/raw/tokyo-500/'+n+'.json').elements),nodes=new Map(raw.filter(e=>e.type==='node').map(n=>[n.id,[n.lat,n.lon]])),ways=new Map(raw.filter(e=>e.type==='way').map(w=>[w.id,w]));
 const edges=new Set(raw.filter(w=>w.type==='way'&&w.tags?.power==='line'&&w.tags.voltage?.split(';').includes('500000')).flatMap(w=>w.nodes.slice(1).map((n:number,i:number)=>JSON.stringify([nodes.get(w.nodes[i]),nodes.get(n)].sort()))));
 const extra=read('docs/research/tokyo-500-east-adopted.json');
 for(const l of extra.lines){for(const p of l.paths)for(let i=1;i<p.length;i++)assert.ok(edges.has(JSON.stringify([p[i-1],p[i]].sort())),l.name);
  for(const id of l.osmIds){const w=ways.get(id);if(!w.tags.name)assert.equal(w.nodes.length,2,'unnamed '+id);}}
});
test('eastern/northern Kanto sections draw OCCTO flows with directional capacity',()=>{
 const extra=read('docs/research/tokyo-500-east-adopted.json');assert.equal(extra.lines.length,7);
 const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));
 for(const l of extra.lines.filter((l:any)=>!extra.noFlow.includes(Number(l.id.split('-').at(-1))))){
  const a=day.actual.lines.find(a=>a.name===l.name)!;assert.ok(a,l.name);const path=referenceFlowPath(a,extra.lines,false);assert.ok(path,l.name);
  assert.deepEqual(referenceFlowPath({...a,from:a.to,to:a.from},extra.lines,false),[...path!].reverse());
  if(l.name==='新吾妻線'){assert.equal(capacityReferenceUsage(a,100,day.capacities),null);assert.ok(capacityReferenceUsage(a,-100,day.capacities)!>0);}
  else{assert.equal(capacityReferenceUsage(a,-100,day.capacities),null);assert.ok(capacityReferenceUsage(a,100,day.capacities)!>0,l.name);}
 }
});
test('西群馬幹線 OCCTO row spans No.70 and No.80 and is shown only on their combined reference route',()=>{
 const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json'))),d=read('public/data/tokyo-trunk.json');
 const a=day.actual.lines.find(a=>a.name==='西群馬幹線')!;assert.equal(a.from,'西群馬開閉所');assert.equal(a.to,'新富士変電所');
 assert.equal(referenceFlowPath(a,read('docs/research/tokyo-500-east-adopted.json').lines,false),null);
 const path=referenceFlowPath(a,d.lines,false)!;assert.ok(path);const east=d.lines.find((l:any)=>l.id==='tokyo-section-70'),rem=d.lines.find((l:any)=>l.id==='tokyo-section-80');
 const keys=new Set([east,rem].flatMap((l:any)=>l.paths.flat().map((p:number[])=>p.join(','))));assert.ok(path.every(p=>keys.has(p.join(','))));
 for(const l of [east,rem])assert.ok(l.attributes.some((x:any)=>x.label==='潮流の割当'&&x.value.includes('区間別の値ではなく')));
});
