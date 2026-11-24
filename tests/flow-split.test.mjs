// 2026-10-10 潮流の分割読み込み：最新日・日付とハッシュの一覧・1日分のファイル、窓の外の日の削除、遡及修正でハッシュが変わること
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {writeFlowSplit, hashOf} from '../scripts/flow-split.mjs';
import {mergeLatest} from '../src/occto-refresh.ts';
const times = date => Array.from({length: 48}, (_, i) => `${date}T${String(i >> 1).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00`);
const day = (date, v = 1) => ({date, retrievedAt: date, actual: {times: times(date), lines: [{id: 'a', name: 'A線', values: Array(48).fill(v)}]}, capacities: []});
const dates = n => Array.from({length: n}, (_, i) => new Date(Date.UTC(2026, 9, 10) - i * 864e5).toISOString().slice(0, 10));
function setup(days, extra = {}) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-split-')), file = path.join(dir, 'x-flow.json'); fs.writeFileSync(file, JSON.stringify({schemaVersion: 2, days, updatedAt: 't', ...extra})); return {dir, file}; }
test('最新日・一覧・1日分のファイルを書く（観測値のない日は入れない、付帯情報は latest に残す）', () => {
  const ds = dates(3), empty = {...day('2026-10-07'), actual: {times: times('2026-10-07'), lines: [{id: 'a', name: 'A線', values: Array(48).fill(null)}]}};
  const {dir, file} = setup([day(ds[1]), day(ds[0]), day(ds[2]), empty], {lineAliases: {x: ['A線']}});
  const r = writeFlowSplit(file), latest = JSON.parse(fs.readFileSync(path.join(dir, 'x-flow-latest.json'), 'utf8'));
  assert.deepEqual(latest.index.map(e => e.date), ds); assert.equal(latest.days.length, 1); assert.equal(latest.days[0].date, ds[0]); assert.deepEqual(latest.lineAliases, {x: ['A線']});
  for (const e of r.index) assert.equal(hashOf(fs.readFileSync(path.join(dir, 'x-flow-days', e.date + '.json'), 'utf8')), e.hash);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'x-flow-days')).sort(), ds.map(d => d + '.json').sort());
});
test('30日の窓から外れた日のファイルは削除する（削除漏れなし）', () => {
  const all = dates(32), {dir, file} = setup(all.map(d => day(d)));
  fs.mkdirSync(path.join(dir, 'x-flow-days'), {recursive: true}); fs.writeFileSync(path.join(dir, 'x-flow-days', '2026-08-01.json'), '{}');
  const r = writeFlowSplit(file), left = fs.readdirSync(path.join(dir, 'x-flow-days')).sort();
  assert.equal(r.index.length, 30); assert.deepEqual(left, all.slice(0, 30).map(d => d + '.json').sort());
  assert.ok(r.removed.includes('2026-08-01.json'));
  // 次の日に進むと、窓から外れた日のファイルが消える
  fs.writeFileSync(file, JSON.stringify({schemaVersion: 2, days: [day('2026-10-11'), ...all.map(d => day(d))], updatedAt: 't'}));
  const r2 = writeFlowSplit(file); assert.deepEqual(r2.removed, [all[29] + '.json']); assert.equal(fs.readdirSync(path.join(dir, 'x-flow-days')).length, 30);
});
test('遡及修正：中身が変わった日はハッシュ（?v=）が変わり、画面は読み込み済みの古い中身を捨てる', () => {
  const ds = dates(3), {dir, file} = setup(ds.map(d => day(d)));
  const before = writeFlowSplit(file).index;
  fs.writeFileSync(file, JSON.stringify({schemaVersion: 2, days: [day(ds[0]), day(ds[1], 2), day(ds[2])], updatedAt: 't2'}));
  const after = writeFlowSplit(file).index;
  assert.notEqual(after[1].hash, before[1].hash); assert.equal(after[2].hash, before[2].hash);
  // 画面：前の一覧で ds[1]・ds[2] を読み込み済み → 新しい最新日のファイルを重ねると ds[1] は外れ、ds[2] は残る
  const loaded = new Map([[ds[0], before[0].hash], [ds[1], before[1].hash], [ds[2], before[2].hash]]);
  const latest = JSON.parse(fs.readFileSync(path.join(dir, 'x-flow-latest.json'), 'utf8'));
  const m = mergeLatest(latest, [day(ds[0]), day(ds[1]), day(ds[2])], loaded, d => d);
  assert.deepEqual(m.days.map(d => d.date), [ds[0], ds[2]]); assert.equal(m.hashes.has(ds[1]), false);
});
