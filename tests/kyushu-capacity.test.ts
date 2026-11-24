import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedKyushuDay} from '../src/kyushu-domain.ts';
// 2026-10-10：九州の容量の表は端点が全角（「宮崎ｓｓ」）、実績・対応表は半角（「宮崎ss」）。全角・半角を同じに扱わないと容量が全部落ちていた
test('九州の容量は全角・半角の違いがあっても照合される',()=>{
 // 運用容量がOCCTO側で未公表の日（YA000010SW、容量0件）は実績だけ使うので、容量のある最新の日で確かめる（2026-10-25 保留23）
 const raw=JSON.parse(readFileSync('public/data/kyushu-flow.json','utf8')).days.find((d:any)=>d.capacities.length);
 assert.ok(raw,'容量のある日がない');
 assert.ok(raw.capacities.some((c:any)=>/ｓｓ/.test(c.from)),'容量の原本は全角の端点');
 const d=reviewedKyushuDay(raw);
 assert.ok(d.capacities.length>=30,`照合後の容量が少ない：${d.capacities.length}`);
 const hit=d.actual.lines.filter((r:any)=>d.capacities.some((c:any)=>c.name===r.name&&c.voltageKV===r.voltageKV&&((c.from===r.from&&c.to===r.to)||(c.from===r.to&&c.to===r.from))));
 assert.ok(hit.length>=30,`容量が当たる行が少ない：${hit.length}`);
});
