import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {flowBranches,referenceFlowPath} from '../src/flow-path.ts';import {reviewedChubuDay} from '../src/chubu-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
// 2026-10-09 オーナー指示：分岐をはさむOCCTOの行は全区間を「参考」（灰色・容量比なし）。計測端が不明なので、どちら側かを推測しない
test('flowBranches finds the branch line inside an OCCTO row route and nothing on a plain route',()=>{
 const g=read('public/data/chubu-trunk.json').lines,day=reviewedChubuDay(typicalDay(read('public/data/chubu-flow.json')));
 const etsumi=day.actual.lines.find((l:any)=>l.name==='越美幹線');assert.ok(etsumi);
 assert.ok(flowBranches(etsumi,g).includes('飛騨分岐線'));
 const plain=day.actual.lines.filter((l:any)=>referenceFlowPath(l,g,false)&&!flowBranches(l,g).length);assert.ok(plain.length>20);
 // 同じ配列には結果を再利用する（毎回の描画で経路を計算し直さない）
 assert.equal(flowBranches(etsumi,g),flowBranches(etsumi,g));
});
