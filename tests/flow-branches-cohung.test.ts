// 共架の線を OCCTO の行の「分岐」に数えない（2026-11-10 オーナー承認 保留108、GeoLine.coHungWith）
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {flowBranches} from '../src/flow-path.ts';import {reviewedShikokuDay} from '../src/shikoku-domain.ts';import {reviewedChubuDay} from '../src/chubu-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';
const read=(p:string)=>JSON.parse(readFileSync('public/data/'+p,'utf8'));
test('讃岐鳴門線の分岐は大川支線だけ（香川線・鳴門淡路線は共架で数えない）',()=>{
 const g=read('shikoku-trunk.json').lines,day=reviewedShikokuDay(typicalDay(read('shikoku-flow.json')));
 const r=day.actual.lines.find((l:any)=>l.name==='讃岐鳴門線');assert.ok(r);
 assert.deepEqual(flowBranches(r,g),['大川支線']);
 assert.equal(flowBranches(r,g),flowBranches(r,g),'同じ配列には結果を再利用する');
 for(const n of ['香川線','鳴門淡路線']){const l=g.find((x:any)=>x.name===n);assert.deepEqual(l.coHungWith,['shikoku-187-讃岐鳴門線']);assert.match(l.attributes.find((a:any)=>a.label==='共架').value,/一次資料では未確認/);}
 // 印を外すと以前と同じく分岐に数える（判定そのものは変えていない）
 const plain=g.map((l:any)=>{const {coHungWith,...x}=l;return x;});assert.deepEqual(flowBranches(r,plain),['香川線','大川支線','鳴門淡路線']);
});
test('印のない線の判定は変わらない（中部の分岐線）',()=>{
 const g=read('chubu-trunk.json').lines,day=reviewedChubuDay(typicalDay(read('chubu-flow.json')));
 const by=(n:string)=>flowBranches(day.actual.lines.find((l:any)=>l.name===n),g);
 assert.deepEqual(by('越美幹線'),['飛騨分岐線']);
 assert.deepEqual(by('遠江駿遠線'),['三河遠江線','静岡西分岐線']);
 // 2026-11-16 オーナー指示：分岐線は分岐点から先だけを描く。分岐線の行に分岐はなく、分岐元の行に分岐線が出る
 assert.deepEqual(by('愛知分岐線'),[]);
 assert.deepEqual(by('佐久間西幹里線'),['愛知分岐線']);
 assert.deepEqual(by('駿遠駿河線'),['静岡東分岐線','安倍分岐線']);
 assert.deepEqual(by('静岡東分岐線'),[]);
 assert.ok(!g.some((l:any)=>l.coHungWith),'中部には共架の印がない');
});
// 2026-11-18 保留130-8：大黒部幹線は北大阪変電所の手前の鉄塔（OSM node 1264455696）を新生駒線と共有する（共架とみなした推測）。新生駒線の行の分岐に数えない
test('新生駒線の分岐に大黒部幹線を数えない（共架）',async()=>{
 const {reviewedKansaiDay}=await import('../src/kansai-domain.ts');
 const g=read('kansai-trunk.json').lines,day=reviewedKansaiDay(typicalDay(read('kansai-flow.json')));
 const r=day.actual.lines.find((l:any)=>l.name==='新生駒線');assert.ok(r);
 const o=g.find((x:any)=>x.name==='大黒部幹線');assert.deepEqual(o.coHungWith,['kansai-275-新生駒線']);assert.match(o.attributes.find((a:any)=>a.label==='共架').value,/一次資料では未確認/);
 assert.ok(!flowBranches(r,g).includes('大黒部幹線'));
 const plain=g.map((l:any)=>{const {coHungWith,...x}=l;return x;});assert.ok(flowBranches(r,plain).includes('大黒部幹線'));
});
