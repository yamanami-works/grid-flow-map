// 2026-11-02 セキュリティレビュー E：連系線潮流実績の CSV の読み取り（scripts/tie-csv.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTieCsv, tieTime, TIE_ROWS} from '../scripts/tie-csv.mjs';

const HEAD = '連系線,対象日付,対象時刻,運用容量(順方向),運用容量(逆方向),広域調整枠(順方向),広域調整枠(逆方向),マージン(順方向),マージン(逆方向),空容量(順方向),空容量(逆方向),計画潮流(順方向),計画潮流(逆方向),潮流実績,運用容量拡大分(順方向),運用容量拡大分(逆方向)';
const row = (i, mw = '-1039', date = '2026/11/02') => ['本四連系線', date, tieTime(i), '1200', '-1200', 0, 0, 0, 0, 0, 0, 0, 0, mw, 0, 0].join(',');
const csv = (f = row) => [HEAD, ...Array.from({length: TIE_ROWS}, (_, i) => f(i))].join('\r\n') + '\r\n';

test('連系線 CSV：正常な288行を読み、時刻は 00:05〜24:00、値は数値・空欄は欠測', () => {
  const rows = parseTieCsv(csv(i => row(i, i === 5 ? '' : i === 6 ? '12.5' : '-1039')), '2026-11-02');
  assert.equal(rows.length, 288);
  assert.equal(rows[0].time, '00:05'); assert.equal(rows.at(-1).time, '24:00');
  assert.deepEqual(rows[0], {time: '00:05', capF: 1200, capR: -1200, mw: -1039});
  assert.equal(rows[5].mw, null); assert.equal(rows[6].mw, 12.5);
});
test('連系線 CSV：空白だけの欄は 0 にせず欠測、数字以外は失敗', () => {
  assert.equal(parseTieCsv(csv(i => row(i, i === 3 ? '  ' : '1')), '2026-11-02')[3].mw, null);
  for (const bad of ['abc', '1e3', '0x10', '--1', '１２'])
    assert.throws(() => parseTieCsv(csv(i => row(i, i === 3 ? bad : '1')), '2026-11-02'), /not a number|rows|out of order/, bad);
});
test('連系線 CSV：見出しの変化・行の欠けや増え・時刻のずれ・日付違いは失敗', () => {
  assert.throws(() => parseTieCsv(csv().replace('連系線,対象日付', 'X,Y'), '2026-11-02'), /header/);
  const lines = csv().trim().split('\r\n');
  assert.throws(() => parseTieCsv(lines.filter((_, i) => i !== 100).join('\n'), '2026-11-02'), /rows/);
  assert.throws(() => parseTieCsv([...lines, row(0)].join('\n'), '2026-11-02'), /rows/);
  assert.throws(() => parseTieCsv(csv(i => i === 10 ? row(11) : row(i)), '2026-11-02'), /out of order at row 11/);
  assert.throws(() => parseTieCsv(csv(), '2026-11-01'), /out of order at row 1/);
  assert.throws(() => parseTieCsv(csv(i => row(i, '1', i === 200 ? '2026/11/03' : '2026/11/02')), '2026-11-02'), /out of order at row 201/);
});
test('連系線 CSV：列の入れ替え・列の欠けた行・列の多い行は失敗（別の列を潮流実績として読まない）', () => {
  assert.throws(() => parseTieCsv(csv().replace('計画潮流(逆方向),潮流実績', '潮流実績,計画潮流(逆方向)'), '2026-11-02'), /header/);
  assert.throws(() => parseTieCsv(csv(i => i === 7 ? row(i).split(',').slice(0, 13).join(',') : row(i)), '2026-11-02'), /13 columns at row 8/);
  assert.throws(() => parseTieCsv(csv(i => i === 7 ? row(i) + ',0' : row(i)), '2026-11-02'), /17 columns at row 8/);
});
