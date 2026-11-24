// 2026-11-09 保留93：表の形（実績・運用容量の行の組）でテストに使う日を選ぶ・形の変化を警告する（scripts/flow-shape.mjs）
import test from 'node:test'; import assert from 'node:assert/strict';
import {typicalDay, shapeChange, shapeMessage, logSafe} from '../scripts/flow-shape.mjs';
import {validateFlows} from '../scripts/validate-flows.mjs';
const date = k => new Date(Date.UTC(2026, 10, 9 - k)).toISOString().slice(0, 10);
// shapes：新しい順に [実績の ID, 運用容量の ID]
const flow = shapes => ({days: shapes.map(([a, c], k) => ({date: date(k), actual: {times: [], lines: a.map(id => ({id, name: '線' + id, values: [1]}))}, capacities: c.map(id => ({id, name: '容量' + id}))}))});
const usual = [['a', 'b'], ['x', 'y']];

test('いつもの形の最新の日を選ぶ。最新日だけ形が違えば前の日', () => {
  assert.equal(typicalDay(flow([usual, usual, usual])).date, date(0));
  assert.equal(typicalDay(flow([[['a', 'b'], ['x']], usual, usual])).date, date(1));
});
test('運用容量が0行（未公表）の日は数に入れない。実績がいつもの形なら選ばれない（運用容量がそろわない）', () => {
  assert.equal(typicalDay(flow([[['a', 'b'], []], [['a', 'b'], []], usual])).date, date(2));
});
test('日数が同じなら新しい日の形。3日で3種類なら最新の日', () => {
  assert.equal(typicalDay(flow([[['a'], ['x']], usual])).date, date(0));
  assert.equal(typicalDay(flow([[['a'], ['x']], [['b'], ['x']], [['c'], ['x']]])).date, date(0));
});
test('実績と運用容量のいつもの形が同じ日にそろわなければ失敗。観測のない日は使わない', () => {
  // 実績は a と b が2日ずつ（新しい a）、運用容量は y が3日。a と y がそろう日はない
  assert.throws(() => typicalDay(flow([[['a'], ['x']], [['a'], ['x']], [['b'], ['y']], [['b'], ['y']], [['c'], ['y']]])), /そろう日がない/);
  const f = flow([usual, [['a', 'b', 'c'], ['x', 'y']], [['a', 'b', 'c'], ['x', 'y']]]); for (const l of f.days[1].actual.lines) l.values = [null]; for (const l of f.days[2].actual.lines) l.values = [null];
  assert.equal(typicalDay(f).date, date(0));
  assert.throws(() => typicalDay({days: []}));
});
test('形の変化：増えた・減った行の数と名前（最大3本）。変わらなければ null', () => {
  assert.equal(shapeChange(flow([usual, usual]).days), null);
  const c = shapeChange(flow([[['a', 'b', 'c'], ['x']], usual, usual]).days);
  assert.deepEqual(c.actual.added, {count: 1, names: ['線c']}); assert.deepEqual(c.capacity.removed, {count: 1, names: ['容量y']});
  assert.equal(shapeMessage('x-flow', c), `表の形の変化：x-flow ${date(0)} 実績 +1行（線c）・−0行・運用容量 +0行・−1行（容量y）`);
});
test('運用容量が0行の日は「未公表」として別の文言', () => {
  const c = shapeChange(flow([[['a', 'b'], []], usual, usual]).days);
  assert.equal(c.capacity, '未公表'); assert.equal(shapeMessage('x-flow', c), `運用容量が未公表：x-flow ${date(0)}`);
});
test('線名は Actions の命令にならない形にする（改行・%・::・制御文字）', () => {
  assert.equal(logSafe('A線\n::error::x%\r\u0007'), 'A線%0A：：error：：x%25%0D');
  const f = flow([[['a', 'b', 'z'], ['x', 'y']], usual, usual]); f.days[0].actual.lines[2].name = '悪い\n::set-output name=x::1';
  assert.ok(!/\n|::/.test(shapeMessage('x-flow', shapeChange(f.days))));
});
test('validateFlows は形の変化を shapes に返し、失敗にはしない', async () => {
  const {mkdtemp, writeFile} = await import('node:fs/promises'), {tmpdir} = await import('node:os'), {join} = await import('node:path'), {SPLIT_FLOWS} = await import('../scripts/flow-split.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'shape-'));
  const times = d => Array.from({length: 48}, (_, i) => `${d}T${String(i >> 1).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00`);
  const days = n => Array.from({length: n}, (_, k) => ({date: date(k), actual: {times: times(date(k)), lines: ['a', 'b', 'c', 'd', 'e'].map(id => ({id, name: '線' + id, values: Array(48).fill(100)}))}, capacities: (k ? ['x', 'y'] : ['x']).map(id => ({id, name: '容量' + id}))}));
  for (const n of SPLIT_FLOWS) await writeFile(join(dir, n + '.json'), JSON.stringify({days: days(5)}));
  const r = await validateFlows({prevDir: dir, curDir: dir, now: new Date(date(0) + 'T03:00:00Z')});
  assert.deepEqual(r.errors, []); assert.equal(r.shapes.length, SPLIT_FLOWS.length); assert.match(r.shapes[0], /運用容量 \+0行・−1行（容量y）/);
});
