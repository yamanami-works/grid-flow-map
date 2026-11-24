// 保留133（2026-11-19 オーナー回答「いずれも推奨で承認」）：長野発電所と関開閉所への電源線（推定）、小坂川発電所（scripts/chubu-133.mjs）
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';import {flowBranches} from '../src/flow-path.ts';import {reviewedChubuDay} from '../src/chubu-domain.ts';import {typicalDay} from '../scripts/flow-shape.mjs';
const read=(f:string)=>JSON.parse(readFileSync('public/data/'+f,'utf8'));
test('長野発電所の電源線は長野発電所と関開閉所の区画の中の点で終わり、C・推定',()=>{
 const k=read('chubu-trunk.json'),l=k.lines.find((x:any)=>x.id==='chubu-plant-275-way-1075743690');
 assert.deepEqual(l.connections.map((c:any)=>[c.node,c.status,c.facilities[0]?.name]),[[9865740262,'facility-area','長野発電所'],[12175933748,'facility-area','関開閉所']]);
 assert.equal(evidenceOf(l).tier,'C');assert.ok(evidenceOf(l).inferred.length>0);
 assert.match(l.attributes.find((a:any)=>a.label==='電圧の根拠').value,/電圧推定/);
 assert.match(l.attributes.find((a:any)=>a.label==='持ち主').value,/^未確認（J-POWER と推定）/);
 assert.ok(!read('kansai-trunk.json').lines.some((x:any)=>x.osmIds.includes(1075743690)));
});
test('長野・小坂川発電所の種別と出力、小坂川は接続未確認',()=>{
 const k=read('chubu-trunk.json'),F=(id:string)=>k.facilities.find((x:any)=>x.id===id);
 const n=F('osm-way-1136534571');assert.equal(n.name,'長野発電所');assert.equal(n.plantType.label,'水力（揚水）');assert.match(n.attributes.find((a:any)=>a.label==='別名').value,/長野水力発電所/);assert.match(n.attributes.find((a:any)=>a.label==='電圧').value,/^275kV は推定/);
 const o=F('chubu-place-小坂川発電所');assert.equal(o.plantType.label,'水力（水路式）');assert.deepEqual(o.voltages,[275]);assert.match(o.attributes.find((a:any)=>a.label==='電圧').value,/^275kV は推定/);
 assert.ok(!o.attributes.some((a:any)=>a.label==='系統との接続'));assert.ok(o.attributes.some((a:any)=>a.label==='要注意（位置推定）'));
 const prof=JSON.parse(readFileSync('public/data/plant-profiles.json','utf8')).records;
 assert.equal(prof.find((p:any)=>p.id==='osm-way-1136534571').capacityMW,220);assert.equal(prof.find((p:any)=>p.id==='chubu-place-小坂川発電所').capacityMW,21.3);
});
// 保留134（2026-11-19 回答「134はaで。」）：小坂川発電所の電源線を高根馬瀬線の点へ
test('小坂川発電所の電源線は高根馬瀬線の途中の点で分かれ、高根馬瀬線の行に分岐として出る',()=>{
 const k=read('chubu-trunk.json'),l=k.lines.find((x:any)=>x.id==='chubu-plant-275-gsi-小坂川'),tm=k.lines.find((x:any)=>x.id==='chubu-275-高根馬瀬線');
 assert.equal(l.connections[0].facilities[0].name,'小坂川発電所');assert.deepEqual([l.connections[1].status,l.connections[1].node],['shared-node',2207396758]);
 const B=l.paths.at(-1).at(-1);assert.ok(tm.paths.some((p:any)=>p.slice(1,-1).some((q:any)=>q[0]===B[0]&&q[1]===B[1])));
 assert.deepEqual(tm.connections.map((c:any)=>c.facilities[0]?.name),['馬瀬川第一発電所','高根変電所']);assert.deepEqual(tm.paths.map((p:any)=>p.length),[7,4,111]);
 assert.equal(evidenceOf(l).tier,'C');assert.ok(evidenceOf(l).inferred.length>0);assert.match(l.attributes.find((a:any)=>a.label==='電圧の根拠').value,/^電圧推定/);
 const day=reviewedChubuDay(typicalDay(read('chubu-flow.json')));const r=day.actual.lines.find((x:any)=>x.name==='高根馬瀬線');assert.ok(r);
 assert.ok(flowBranches(r,k.lines).includes('小坂川発電所の電源線（推定）'));
});
