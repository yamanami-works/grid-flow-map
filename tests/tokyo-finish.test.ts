import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const d=read('public/data/tokyo-trunk.json');
test('gap completions add one straight synthetic part from the OSM line end to the evidenced endpoint facility',()=>{
 for(const g of read('docs/research/tokyo-gap-completions.json').completions){
  const l=d.lines.find((x:any)=>x.id===g.lineId);assert.ok(l,g.lineId);
  // 2026-10-16：線の末端が設備の区画の内側に届くもの（mode 'inside'）は直線を足さず、末端のまま設備につなぐ（広野火力線）
  // 2026-11-07（保留86）：mode 'osmEnd' は直線を足さず、区画に届かない OSM の末端のまま線名から設備につなぐ（新豊根佐久間線）
  if(g.mode==='osmEnd'){const c=l.connections[g.end==='start'?0:l.connections.length-1];assert.equal(c.status,'facility-area');assert.equal(c.facilities[0].id,g.facilityId);assert.equal(c.node,g.node);assert.ok(!l.osmIds.some((x:number)=>x<0),g.lineId);assert.ok(!l.schematicParts?.length,g.lineId);assert.ok(!l.attributes.some((a:any)=>a.label==='末端の直線'));assert.match(l.attributes.find((a:any)=>a.label==='末端').value,/直線は表示しない/);continue;}
  if(g.mode==='inside'){const c=l.connections[g.end==='start'?0:l.connections.length-1];assert.equal(c.status,'facility-area');assert.equal(c.facilities[0].id,g.facilityId);assert.equal(c.node,g.node);assert.ok(!l.osmIds.some((x:number)=>x<0),g.lineId);assert.ok(!l.attributes.some((a:any)=>a.label==='末端の直線'));continue;}
  const parts=l.schematicParts.filter((p:any)=>p.osmId<0);assert.equal(parts.length,1,g.lineId);assert.equal(parts[0].construction,g.construction);
  const i=l.osmIds.indexOf(parts[0].osmId);assert.equal(l.paths[i].length,2);assert.ok(i===0||i===l.osmIds.length-1);
  const c=l.connections[g.end==='start'?0:l.connections.length-1];assert.equal(c.status,'facility-area');assert.equal(c.facilities[0].id,g.facilityId);
  const f=d.facilities.find((x:any)=>x.id===g.facilityId);assert.deepEqual(c.position,f.position);assert.ok(!l.name.includes('地理部分収録'));
  assert.ok(l.attributes.some((a:any)=>a.label==='末端の直線'));
 }
});
test('branch points split lines at the OSM shared node and never become facilities',()=>{
 for(const b of read('docs/research/tokyo-branch-points.json').branches){
  for(const id of [...b.cuts.map((c:any)=>c.lineId),...b.ends.map((e:any)=>e.lineId)]){const l=d.lines.find((x:any)=>x.id===id);const c=l.connections.find((x:any)=>x.status==='shared-node');
   assert.ok(c,id);assert.deepEqual(c.position,b.position);assert.deepEqual(c.facilities,[]);assert.ok(c.neighborWays.length>0);assert.equal(l.referenceReview.status,'section');
   const last=c===l.connections[0]?l.paths[0][0]:l.paths.at(-1).at(-1);assert.deepEqual(last,b.position,id);}
 }
 const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));const a=day.actual.lines.find(a=>a.name==='青梅線')!;
 assert.ok(referenceFlowPath(a,d.lines,false));
});
