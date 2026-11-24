import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
import {rawSkip} from './raw-data.mjs';
// 原本（data/raw）を使う部分は別のテストに分け、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('seven western/Boso sections follow acquired nodes at 500kV',{skip:rawSkip('data/raw/tokyo-500/north.json','data/raw/tokyo-500/south.json')},()=>{
 const raw=['north','south'].flatMap(n=>read('data/raw/tokyo-500/'+n+'.json').elements),nodes=new Map(raw.filter(e=>e.type==='node').map(n=>[n.id,[n.lat,n.lon]]));
 const edges=new Set(raw.filter(w=>w.type==='way'&&w.tags?.power==='line'&&w.tags.voltage?.split(';').includes('500000')).flatMap(w=>w.nodes.slice(1).map((n:number,i:number)=>JSON.stringify([nodes.get(w.nodes[i]),nodes.get(n)].sort()))));
 const extra=read('docs/research/tokyo-500-west-adopted.json');
 for(const l of extra.lines)for(const p of l.paths)for(let i=1;i<p.length;i++)assert.ok(edges.has(JSON.stringify([p[i-1],p[i]].sort())),l.name);
});
test('seven western/Boso sections preserve directional capacity',()=>{
 const extra=read('docs/research/tokyo-500-west-adopted.json');assert.equal(extra.lines.length,7);
 const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));
 for(const l of extra.lines){
 const a=day.actual.lines.find(a=>a.name===l.name)!;assert.ok(a);const path=referenceFlowPath(a,extra.lines,false);assert.ok(path,l.name);assert.deepEqual(referenceFlowPath({...a,from:a.to,to:a.from},extra.lines,false),[...path!].reverse());
 assert.equal(capacityReferenceUsage(a,-100,day.capacities),null);// 新坂戸線の容量は「新坂戸線（他社）」の行だけ。（他社）の行は意味が確認できるまで分母に使わない（2026-10-10 オーナー指示）
 if(l.name==='新坂戸線')assert.equal(capacityReferenceUsage(a,100,day.capacities),null);else assert.ok(capacityReferenceUsage(a,100,day.capacities)!>0);
 }
});
