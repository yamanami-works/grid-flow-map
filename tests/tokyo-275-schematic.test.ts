import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const s=read('docs/research/tokyo-275-schematic.json');
test('D-tier schematic lines are straight two-point dotted lines between facility positions and carry the owner decision',()=>{
 assert.equal(s.tier,'D');const d=read('public/data/tokyo-trunk.json');
 for(const l of s.lines){assert.equal(l.schematic,true);assert.equal(l.paths.length,1);assert.equal(l.paths[0].length,2);assert.ok(l.osmIds.length===1&&l.osmIds[0]<0);assert.ok(l.name.endsWith('（ルート不明・直線）'));assert.ok(['underground','overhead','unknown'].includes(l.construction));
  assert.ok(l.attributes[0].label.startsWith('要注意（D区分'));for(const [i,c] of l.connections.entries()){const f=d.facilities.find((f:any)=>f.id===c.facilities[0].id);assert.ok(f);assert.deepEqual(f.position,l.paths[0][i]);}}
});
test('schematic lines only get OCCTO rows whose name and endpoints match',()=>{
 const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));
 for(const p of s.occtoPairs){const a=day.actual.lines.find(a=>a.name===p[1]);assert.ok(a,p[1]);assert.ok(referenceFlowPath(a,s.lines,false),p[1]);}
 assert.ok(!s.lines.some((l:any)=>l.connections.some((c:any)=>c.status!=='facility-area')));
});
test('underground (OSM power=cable) segments are flagged per line and only reference own ways',()=>{
 const cab=new Set(read('data/catalog/cable-ways.json').wayIds),d=read('public/data/tokyo-trunk.json');
 let n=0;for(const l of d.lines){if(l.schematic)continue;const expect=[...new Set(l.osmIds.filter((i:number)=>cab.has(i)))];if(expect.length){n++;assert.deepEqual([...l.cableOsmIds].sort(),expect.sort(),l.name);}else assert.equal(l.cableOsmIds,undefined,l.name);}
 assert.ok(n>=15);
});
test('Tohoku and DC public data flag underground/submarine segments from the shared cable list',()=>{
 const cab=new Set(read('data/catalog/cable-ways.json').wayIds);
 for(const f of ['public/data/tohoku-trunk-osm.json','public/data/tohoku-dc-osm.json']){const d=read(f);let n=0;
  for(const l of d.lines){const expect=[...new Set(l.osmIds.filter((i:number)=>cab.has(i)))];if(expect.length){n++;assert.deepEqual([...l.cableOsmIds].sort(),expect.sort(),l.id);}else assert.equal(l.cableOsmIds,undefined,l.id);}
  assert.ok(n>0,f);}
});
