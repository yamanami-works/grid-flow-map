import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTohokuDay} from '../src/tohoku-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
// 2026-10-04：作り直し後に常磐北・南幹線（500kV）、東上越幹線、勿来幹線が古い端点照合で弾かれて流れていなかった
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
test('all 34 OCCTO Tohoku rows map to a drawn route on the rebuilt Tohoku data, including the 500kV 常磐北・南幹線',()=>{
 const g=read('public/data/tohoku-trunk.json'),day=reviewedTohokuDay(typicalDay(read('public/data/occto-tohoku.json')));
 assert.equal(day.actual.lines.length,34);
 for(const r of day.actual.lines)assert.ok(referenceFlowPath(r,g.lines,false),r.name);
 for(const n of ['常磐北幹線','常磐南幹線','十和田幹線','青葉幹線','北上幹線'])assert.ok(day.actual.lines.some((r:any)=>r.name===n&&r.voltageKV===500),n);
 assert.doesNotMatch(readFileSync('src/real.ts','utf8'),/endpointConflict\(/);
});
