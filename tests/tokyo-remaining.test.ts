import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
import {rawSkip} from './raw-data.mjs';
const extra=read('docs/research/tokyo-500-remaining-adopted.json');
test('remaining Tokyo sections are all A or B tier',()=>{assert.equal(extra.lines.length,extra.tiers.A.length+extra.tiers.B.length);});
// 原本（data/raw）を使う部分は、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('remaining Tokyo sections follow acquired nodes at their own voltage',{skip:rawSkip('data/raw/tokyo-500/north.json','data/raw/tokyo-500/south.json','data/raw/tokyo-500-support/lines.json')},()=>{
 const raw=[...read('data/raw/tokyo-500/north.json').elements,...read('data/raw/tokyo-500/south.json').elements,...read('data/raw/tokyo-500-support/lines.json').elements],nodes=new Map(raw.filter(e=>e.type==='node').map(n=>[n.id,[n.lat,n.lon]]));
 const edges=new Set(raw.filter(w=>w.type==='way'&&['line','cable'].includes(w.tags?.power)).flatMap(w=>String(w.tags.voltage).split(';').map(Number).flatMap(v=>w.nodes.slice(1).map((n:number,i:number)=>v/1000+'|'+JSON.stringify([nodes.get(w.nodes[i]),nodes.get(n)].sort())))));
 assert.equal(extra.lines.length,extra.tiers.A.length+extra.tiers.B.length);
 for(const l of extra.lines)for(const p of l.paths)for(let i=1;i<p.length;i++)assert.ok(edges.has(l.voltageKV+'|'+JSON.stringify([p[i-1],p[i]].sort())),l.name);
});
test('remaining sections keep OCCTO direction-specific capacity and never borrow reverse values',()=>{
 const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));
 for(const l of extra.lines.filter((l:any)=>!extra.noFlow.includes(Number(l.id.split('-').at(-1))))){
  const a=day.actual.lines.find(a=>a.name===l.name&&a.voltageKV===l.voltageKV&&referenceFlowPath(a,extra.lines,false))!;assert.ok(a,l.name);const path=referenceFlowPath(a,extra.lines,false);assert.ok(path,l.name);
  assert.deepEqual(referenceFlowPath({...a,from:a.to,to:a.from},extra.lines,false),[...path!].reverse());
  if(l.name==='安曇幹線'){assert.equal(capacityReferenceUsage(a,100,day.capacities),null);assert.equal(capacityReferenceUsage(a,-100,day.capacities),null);}
  // 佐久間東幹線の逆向きの容量は「佐久間東幹線（里）（他社）」の行。（他社）の行は分母に使わない（2026-10-10 オーナー指示）
  else if(l.name==='佐久間東幹線'){assert.equal(capacityReferenceUsage(a,100,day.capacities),null);assert.equal(capacityReferenceUsage(a,-100,day.capacities),null);}
  else{assert.equal(capacityReferenceUsage(a,-100,day.capacities),null);assert.ok(capacityReferenceUsage(a,100,day.capacities)!>0,l.name);}
 }
});
test('branch endpoint and frequency converters are not fabricated as connected facilities',()=>{
 const branch=extra.lines.find((l:any)=>l.name==='新飯能線');if(branch){assert.equal(branch.connections[0].status,'shared-node');assert.deepEqual(branch.connections[0].facilities,[]);}
 const fc=extra.facilities.filter((f:any)=>f.kind==='converter').map((f:any)=>f.name).sort();assert.deepEqual(fc,['佐久間周波数変換所','新信濃変電所']);
 const sakuma=extra.facilities.find((f:any)=>f.name==='佐久間周波数変換所');assert.equal(sakuma.scopeConnected,false);
 assert.ok(!extra.lines.some((l:any)=>l.connections.some((c:any)=>c.facilities.some((f:any)=>f.id===sakuma.id))));
});
