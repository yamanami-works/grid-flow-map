import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {reviewedHokurikuDay,needsSignFlip,SIGN_CHECKS} from '../src/hokuriku-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const d=read('public/data/hokuriku-trunk.json'),flow=read('public/data/hokuriku-flow.json');
const latest=typicalDay(flow);
test('all 11 OCCTO Hokuriku rows (500kV 4, 275kV 7) map to a drawn route between their two facilities',()=>{
 const day=reviewedHokurikuDay(latest);const rows=day.actual.lines;assert.equal(rows.length,11);
 assert.equal(rows.filter((r:any)=>r.voltageKV===500).length,4);
 for(const r of rows)assert.ok(referenceFlowPath(r,d.lines,false),r.name);
 const ids=new Set(d.facilities.map((f:any)=>f.id));for(const l of d.lines){assert.ok(l.attributes.some((a:any)=>a.label==='照合区分'),l.name);for(const c of l.connections)for(const f of c.facilities)assert.ok(ids.has(f.id),l.name);}
});
test('approval pins the dataset bytes, IDs and voltages',()=>{
 const a=read('config/hokuriku-approval.json');assert.equal(createHash('sha256').update(readFileSync('public/data/hokuriku-trunk.json')).digest('hex'),a.sha256);
 assert.deepEqual(a.lineIds,d.lines.map((l:any)=>l.assetId));for(const l of d.lines)assert.equal(a.lineVoltages[l.assetId],l.voltageKV);
});
test('南福光 is the Chubu dataset facility (same ID), so 加賀福光線 and 能越幹線 join 越美幹線 in the national view',()=>{
 const chubu=read('public/data/chubu-trunk.json');const f=d.facilities.find((x:any)=>x.name==='南福光連系所');
 assert.ok(f&&chubu.facilities.some((x:any)=>x.id===f.id&&x.assetId===f.assetId));
 for(const n of ['加賀福光線','能越幹線'])assert.ok(d.lines.find((l:any)=>l.name===n).connections.some((c:any)=>c.facilities.some((x:any)=>x.id===f.id)),n);
});
test('unnamed OSM areas named by location carry their evidence (新福井・東金津・南条)',()=>{
 for(const n of ['新福井変電所','東金津変電所','南条変電所']){const f=d.facilities.find((x:any)=>x.name===n);assert.ok(f,n);assert.ok(f.attributes.some((a:any)=>a.label==='名称・位置の根拠'),n);}
});
test('Hokuriku plants on the trunk grid (志賀原子力・七尾大田火力・富山新港火力) with feeder lines and no OCCTO flow',()=>{
 for(const n of ['志賀原子力発電所','七尾大田火力発電所','富山新港火力発電所'])assert.ok(d.facilities.some((f:any)=>f.name===n&&f.kind==='plant'),n);
 const day=reviewedHokurikuDay(latest);for(const l of d.lines.filter((l:any)=>l.id.includes('-plant-')))assert.ok(!day.actual.lines.some((r:any)=>r.name===l.name&&r.voltageKV===l.voltageKV),l.name);
 assert.equal(d.lines.filter((l:any)=>!l.id.includes('-plant-')&&!l.id.startsWith('plant-')&&!l.id.startsWith('tie-')).length,11);
});
test('敦賀火力線: OCCTO actual sign is flipped to match the TSO definition, so 南条 balances as a load and 敦賀火力 sends out',()=>{
 const day=reviewedHokurikuDay(latest);const t=day.actual.lines.find((l:any)=>l.name==='敦賀火力線')!;const n=day.actual.lines.find((l:any)=>l.name==='南条越前線')!;
 const i=t.values.findLastIndex((v:any)=>v!=null);assert.ok(t.values[i]<0,'敦賀火力→南条（負）');assert.match(t.note,/符号を反転/);
 const nanjo=t.values[i]*-1+n.values[i];assert.ok(Math.abs(nanjo)<600,'南条の収支 '+nanjo);
});
test('敦賀火力線 sign check is decided per day: if OCCTO publishes the corrected sign, it is not flipped again',()=>{
 const raw=latest;const corrected={...raw,actual:{...raw.actual,lines:raw.actual.lines.map((l:any)=>l.name==='敦賀火力線'?{...l,values:l.values.map((v:any)=>v==null?v:-v)}:l)}};
 const t=reviewedHokurikuDay(corrected).actual.lines.find((l:any)=>l.name==='敦賀火力線')!;
 const i=t.values.findLastIndex((v:any)=>v!=null);assert.ok(t.values[i]<0,'訂正済みの値はそのまま（敦賀火力→南条）');assert.doesNotMatch(t.note??'',/符号を反転/);
 const asPublished=reviewedHokurikuDay(raw).actual.lines.find((l:any)=>l.name==='敦賀火力線')!;assert.equal(asPublished.values[i],t.values[i]);
 assert.equal(SIGN_CHECKS.length,1);
});
