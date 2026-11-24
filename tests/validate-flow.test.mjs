import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFlowDays} from '../scripts/validate-flow.mjs';
test('flow publication rejects truncated, duplicated and misdated observations',()=>{
 const original=JSON.parse(readFileSync('public/data/occto-tohoku.json','utf8')).days;
 validateFlowDays(original);
 const days=structuredClone(original);days[0].actual.lines[0].values.pop();assert.throws(()=>validateFlowDays(days));
 assert.throws(()=>validateFlowDays([original[0],original[0]]));
 const shifted=structuredClone(original);shifted[0].actual.times[0]='wrong';assert.throws(()=>validateFlowDays(shifted));
});
// 2026-11-02 セキュリティレビュー E：観測値の大きさの上限（全国一律 10,000 MW）
test('flow publication rejects observations over 10,000 MW',()=>{
 const original=JSON.parse(readFileSync('public/data/occto-tohoku.json','utf8')).days;
 const at=v=>{const days=structuredClone(original);days[0].actual.lines[0].values[0]=v;return days;};
 validateFlowDays(at(10000));validateFlowDays(at(-10000));validateFlowDays(at(0));validateFlowDays(at(null));
 assert.throws(()=>validateFlowDays(at(10001)),/out of range/);
 assert.throws(()=>validateFlowDays(at(-10000.5)),/out of range/);
});
