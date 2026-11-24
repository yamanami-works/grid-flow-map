// 2026-11-01 公開残件3-C：前回分と比べる検証（scripts/validate-flows.mjs）
import test from 'node:test'; import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compareFlow, staleFlows, validateFlows} from '../scripts/validate-flows.mjs';
import {SPLIT_FLOWS} from '../scripts/flow-split.mjs';

const times = date => Array.from({length: 48}, (_, i) => `${date}T${String(i >> 1).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00`);
const date = i => new Date(Date.UTC(2026, 9, 31 - i)).toISOString().slice(0, 10);
// n 日分（新しい順）、線 ids、値 v（日付・線・コマの関数）
const flow = ({n = 10, ids = ['a', 'b', 'c', 'd', 'e'], v = () => 100} = {}) => ({days: Array.from({length: n}, (_, k) => ({date: date(k), actual: {times: times(date(k)), lines: ids.map(id => ({id, name: '線' + id, values: Array.from({length: 48}, (_, i) => v(k, id, i))}))}, capacities: []}))});
const errs = (prev, cur) => compareFlow('x', prev, cur).errors;

test('正常：同じデータ・取り直しで少し変わったデータは通る', () => {
  assert.deepEqual(errs(flow(), flow()), []);
  assert.deepEqual(errs(flow(), flow({v: (k, id, i) => 100 + i})), []);
});
test('全0は失敗', () => {
  assert.match(errs(flow(), flow({v: () => 0}))[0], /すべて0/);
});
test('全欠測：観測のある日がなければ失敗', () => {
  const cur = flow(); for (const d of cur.days) for (const l of d.actual.lines) l.values = l.values.map(() => null);
  assert.ok(errs(flow(), cur).some(e => /値がない/.test(e)));
});
test('0時台：今日の行が全部欠測でも、観測のある新しい2日で判定して通る', () => {
  const cur = flow({n: 11, v: (k, id, i) => k === 0 ? null : 100});
  cur.days.forEach((d, k) => { d.date = new Date(Date.UTC(2026, 10, 1 - k)).toISOString().slice(0, 10); d.actual.times = times(d.date); });
  assert.deepEqual(errs(flow(), cur), []);
});
test('観測のある最新の日付が前回より古いと失敗', () => {
  const cur = flow(); cur.days.shift();
  assert.ok(errs(flow(), cur).some(e => /前回より古い/.test(e)));
});
test('線 ID：数が同じでもそろって変わると失敗。2割減で失敗、1本減（5本中）は8割で通る', () => {
  assert.ok(errs(flow(), flow({ids: ['p', 'q', 'r', 's', 't']})).some(e => /割合/.test(e)));
  assert.ok(errs(flow(), flow({ids: ['a', 'b', 'c']})).some(e => /割合が60%/.test(e)));
  assert.deepEqual(errs(flow(), flow({ids: ['a', 'b', 'c', 'd']})), []);
  assert.deepEqual(errs(flow(), flow({ids: ['a', 'b', 'c', 'd', 'e', 'f']})), [], '増加は失敗にしない');
});
test('符号：全体の一斉反転と、1本だけの反転を検出。夜間の小さな値の向きの変化は数えない', () => {
  assert.ok(errs(flow(), flow({v: () => -100})).some(e => /一斉に反転/.test(e)));
  const one = errs(flow(), flow({v: (k, id) => id === 'c' ? -100 : 100}));
  assert.deepEqual(one, ['線の符号が反転：線c（480/480組）']);
  assert.deepEqual(errs(flow({v: () => 5}), flow({v: () => -5})), []);
});
test('取り直した新しい2日だけの異常：符号の反転と線の大幅な減少を検出', () => {
  assert.ok(errs(flow(), flow({v: (k, id, i) => k < 2 ? -100 : 100})).some(e => /一斉に反転/.test(e)), '新しい2日だけ反転');
  const cur = flow(); for (const d of cur.days.slice(0, 2)) d.actual.lines = d.actual.lines.slice(0, 2);
  const e = errs(flow(), cur);
  assert.ok(e.some(x => x.includes('8割未満の日：2日（2026-10-31 2/5、2026-10-30 2/5）')) && !e.some(x => /^前回に観測/.test(x)), '30日の和では残るが日付ごとで検出');
});
test('JSON が壊れていても残りのデータを調べ、理由を返す', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grid-vflows-')), cur = join(root, 'cur');
  await mkdir(cur);
  for (const name of SPLIT_FLOWS) await writeFile(join(cur, name + '.json'), name === 'tokyo-flow' ? '{' : JSON.stringify(flow()));
  const r = await validateFlows({prevDir: join(root, 'none'), curDir: cur, initial: true});
  assert.equal(r.errors.length, 1); assert.match(r.errors[0], /^tokyo-flow：/); assert.equal(r.info.length, 9);
});
test('観測のある日数が3日以上減ると失敗（1〜2日は通る）', () => {
  assert.deepEqual(errs(flow({n: 10}), flow({n: 8})), []);
  assert.ok(errs(flow({n: 10}), flow({n: 7})).some(e => /日数/.test(e)));
});
test('前回分のファイルがない：--initial のときだけ比較を飛ばす。今回分がなければ失敗', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grid-vflows-')), cur = join(root, 'cur'), prev = join(root, 'prev');
  await mkdir(cur); await mkdir(prev);
  for (const name of SPLIT_FLOWS) await writeFile(join(cur, name + '.json'), JSON.stringify(flow()));
  assert.equal((await validateFlows({prevDir: prev, curDir: cur})).errors.length, 10);
  assert.deepEqual((await validateFlows({prevDir: prev, curDir: cur, initial: true})).errors, []);
  for (const name of SPLIT_FLOWS) await writeFile(join(prev, name + '.json'), JSON.stringify(flow()));
  assert.deepEqual((await validateFlows({prevDir: prev, curDir: cur})).errors, []);
  await writeFile(join(cur, 'tie-flow.json'), JSON.stringify(flow({v: () => -100})));
  assert.ok((await validateFlows({prevDir: prev, curDir: cur, initial: true})).errors.some(e => /^tie-flow：線の符号が一斉に反転/.test(e)), '前回分があれば --initial でも比べる');
});
// ⑥ 鮮度（2026-11-03 保留53）。データの最新の観測日は 2026-10-31（date(0)）
const at = iso => new Date(iso);
test('鮮度：最新の観測日が日本時間の今日・前日なら古くない。2日前は古い。未来の日付は失敗', () => {
  assert.deepEqual(staleFlows(flow().days, at('2026-10-31T03:00:00Z')), {});
  assert.deepEqual(staleFlows(flow().days, at('2026-11-01T03:00:00Z')), {});
  assert.deepEqual(staleFlows(flow().days, at('2026-11-02T03:00:00Z')), {stale: '2026-10-31'});
  assert.match(staleFlows(flow().days, at('2026-10-30T03:00:00Z')).error, /今日より後（2026-10-31 > 2026-10-30）/);
  const empty = flow(); for (const d of empty.days) for (const l of d.actual.lines) l.values = l.values.map(() => null);
  assert.deepEqual(staleFlows(empty.days, at('2026-10-31T03:00:00Z')), {stale: '観測なし'});
});
test('鮮度：日本時間の0時の前後（UTC 14:59・15:00・15:07）で日付が切り替わる', () => {
  assert.deepEqual(staleFlows(flow().days, at('2026-11-01T14:59:59Z')), {}, '日本時間 11-01 23:59 は前日');
  assert.deepEqual(staleFlows(flow().days, at('2026-11-01T15:00:00Z')), {stale: '2026-10-31'}, '日本時間 11-02 0:00 で2日前');
  assert.deepEqual(staleFlows(flow().days, at('2026-11-01T15:07:00Z')), {stale: '2026-10-31'});
  assert.match(staleFlows(flow().days, at('2026-10-30T14:59:59Z')).error, /今日より後/, '日本時間 10-30 23:59');
  assert.deepEqual(staleFlows(flow().days, at('2026-10-30T15:00:00Z')), {}, '日本時間 10-31 0:00');
});
test('鮮度：validateFlows は古いデータを失敗にせず stale に返す（--initial でも同じ）。未来の日付は失敗', async () => {
  const root = await mkdtemp(join(tmpdir(), 'grid-vflows-')), cur = join(root, 'cur'), prev = join(root, 'prev');
  await mkdir(cur); await mkdir(prev);
  for (const name of SPLIT_FLOWS) { await writeFile(join(cur, name + '.json'), JSON.stringify(flow())); await writeFile(join(prev, name + '.json'), JSON.stringify(flow())); }
  const ok = await validateFlows({prevDir: prev, curDir: cur, now: at('2026-11-01T00:00:00Z')});
  assert.deepEqual([ok.errors, ok.stale], [[], []]);
  for (const initial of [false, true]) {
    const r = await validateFlows({prevDir: prev, curDir: cur, initial, now: at('2026-11-05T00:00:00Z')});
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.stale, SPLIT_FLOWS.map(n => n + '：2026-10-31'));
  }
  const future = await validateFlows({prevDir: prev, curDir: cur, now: at('2026-10-29T00:00:00Z')});
  assert.equal(future.errors.length, 10); assert.match(future.errors[0], /^occto-tohoku：観測のある最新の日付が日本時間の今日より後/);
});
