// 2026-11-01 公開残件3-B：連系線の前回分の残し方（scripts/tie-merge.mjs）
import test from 'node:test'; import assert from 'node:assert/strict';
import {mergeTieDay, tieDates} from '../scripts/tie-merge.mjs';

const line = (id, v) => ({id, values: Array(48).fill(v)});
const day = (lines, caps = [], retrievedAt = 'old') => ({date: '2026-10-30', retrievedAt, actual: {times: [], lines}, capacities: caps});
const prev = day([line('tie-10-関門連系線', 1), line('tie-09-本四連系線', 2), line('tie-04-三重東近江線', 3)], [{id: 'tie-cap-10-関門連系線-f'}, {id: 'tie-cap-09-本四連系線-f'}]);

test('作り直せない日（線0本・原本なし）は前回のその日をそのまま使い、前回もなければ入れない', () => {
  assert.equal(mergeTieDay(prev, null, () => false), prev);
  assert.equal(mergeTieDay(prev, day([]), () => true), prev);
  assert.equal(mergeTieDay(undefined, null, () => false), null);
});
test('原本の CSV がない線・運用容量は前回の値を残し、原本のある線は作り直した値にする', () => {
  const built = day([line('tie-09-本四連系線', 9)], [{id: 'tie-cap-09-本四連系線-f', capacityMW: 9}], 'new');
  const m = mergeTieDay(prev, built, code => code === '09');
  assert.equal(m.retrievedAt, 'new');
  assert.deepEqual(m.actual.lines.map(l => [l.id, l.values[0]]), [['tie-09-本四連系線', 9], ['tie-10-関門連系線', 1], ['tie-04-三重東近江線', 3]]);
  assert.deepEqual(m.capacities.map(c => c.id), ['tie-cap-09-本四連系線-f', 'tie-cap-10-関門連系線-f']);
});
test('前回の値を残した日の取得時刻は古い方。全部作り直した日は今回の時刻', () => {
  const p = {...prev, retrievedAt: '2026-10-30T10:00:00Z'};
  assert.equal(mergeTieDay(p, day([line('tie-09-本四連系線', 9)], [], '2026-11-01T00:00:00Z'), code => code === '09').retrievedAt, '2026-10-30T10:00:00Z');
  const all = day([line('tie-10-関門連系線', 1), line('tie-09-本四連系線', 2), line('tie-04-三重東近江線', 3)], [{id: 'tie-cap-10-関門連系線-f'}, {id: 'tie-cap-09-本四連系線-f'}], '2026-11-01T00:00:00Z');
  assert.equal(mergeTieDay(p, all, () => true).retrievedAt, '2026-11-01T00:00:00Z');
});
test('三重東近江線・越前嶺南線（推定）は同じ回の値にそろえる', () => {
  const p = day([line('tie-04-三重東近江線', 3), line('tie-06-越前嶺南線', 6)]);
  const m = mergeTieDay(p, day([line('tie-06-越前嶺南線', 60), line('tie-10-関門連系線', 1)], [], 'new'), code => code === '10');
  assert.deepEqual(m.actual.lines.map(l => [l.id, l.values[0]]), [['tie-06-越前嶺南線', 6], ['tie-10-関門連系線', 1], ['tie-04-三重東近江線', 3]]);
});
test('原本があるのに作り直した中にない線は残さない（原本から作れる線は原本に従う）', () => {
  const m = mergeTieDay(prev, day([line('tie-09-本四連系線', 9)]), code => code === '09' || code === '10');
  assert.deepEqual(m.actual.lines.map(l => l.id), ['tie-09-本四連系線', 'tie-04-三重東近江線']);
});
test('作り直す日の候補：原本の日と前回の日を合わせた新しい順の30日', () => {
  const prevDays = Array.from({length: 30}, (_, i) => ({date: new Date(Date.UTC(2026, 9, 31 - i)).toISOString().slice(0, 10)}));
  const dates = tieDates(['2026-11-01', '2026-10-31'], prevDays);
  assert.equal(dates.length, 30); assert.equal(dates[0], '2026-11-01'); assert.equal(dates.at(-1), '2026-10-03');
});
