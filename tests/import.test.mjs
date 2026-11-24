import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseActualCsv, parseCapacityCsv, sourceTimestamp, numberOrNull } from '../scripts/csv.mjs';
const fixture = `\uFEFF'［単位：MW］,'※１,\r\n'送電線No.,'0002,\r\n'電圧(kV),'500,\r\n'送電線名,'試験幹線,\r\n'潮流正方向,'A変電所→B変電所,\r\n2024/4/1 23:00,-12,\r\n2024/4/2 0:00,0,\r\n2024/4/2 1:00,-,\r\n,,,\r\n`;
test('CSV respects quoted comma, escaped quote, embedded newline and trailing cell', () => {
  assert.deepEqual(parseCsv('a,"1,250","say ""yes""",\r\nx,"a\nb",z,\r\n'), [['a','1,250','say "yes"',''],['x','a\nb','z','']]);
  assert.throws(() => parseCsv('"unclosed'));
});
test('official import retains leading-zero IDs, signed MW and missing versus zero', () => {
  const data = parseActualCsv(fixture);
  assert.equal(data.lines[0].id, '0002');
  assert.deepEqual(data.lines[0].values, [-12, 0, null]);
  assert.equal(data.lines[0].from, 'A変電所');
  assert.equal(data.lines[0].note, '※１');
  assert.equal(data.times[1], '2024-04-02T00:00:00+09:00');
  assert.equal(data.originalTimes[0], '2024/4/1 23:00');
});
test('unexpected missing hour or invalid row is rejected rather than shifted', () => {
  assert.throws(() => parseActualCsv(fixture.replace('2024/4/2 0:00','2024/4/2 2:00')), /timestamp/);
  assert.throws(() => parseActualCsv(fixture.replace('2024/4/2 1:00,-,','2024/4/2 1:00')), /Truncated/);
  assert.throws(() => parseActualCsv(fixture.replace('A変電所→B変電所','A変電所')), /direction/);
});
test('numeric and date parsing does not coerce missing values to zero', () => {
  assert.equal(numberOrNull('-'), null);
  assert.equal(numberOrNull('0'), 0);
  assert.equal(numberOrNull('1,250 '), 1250);
  assert.throws(() => numberOrNull('NaN'));
  assert.throws(() => sourceTimestamp('2024/2/30 1:00'));
  assert.throws(() => sourceTimestamp('2024/4/1 24:00'));
});
test('capacity CSV parses quoted thousands and leaves fenced notes attached to the line', () => {
  const csv = '2026年7月31日作成\n送電線 No,送電線名\n\'0002,試験幹線,500,2,"9,872","4,936",熱容量,A→B,4285,-,-,不可,-,-,-,-,フェンス№1（安）';
  const parsed = parseCapacityCsv(csv);
  assert.equal(parsed.records[0].id, '0002');
  assert.equal(parsed.records[0].capacityMW, 4936);
  assert.equal(parsed.records[0].note, 'フェンス№1（安）');
});
