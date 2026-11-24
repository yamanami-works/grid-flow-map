import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usage, band, direction, isExtraHighVoltage, validThresholds, sampleAt } from '../src/domain.ts';
import type { FlowSample } from '../src/domain.ts';
import { lines, facilities, timestamps } from '../src/data.ts';

const sample = (mw: number | null, capacityMW: number | null): FlowSample => ({
  mw, capacityMW, at: '2026-09-20T12:00:00+09:00',
  source: { kind: 'demo', name: 'test', publishedAt: '2026-09-20' },
});
test('reverse flow uses the absolute value for utilisation, but reverses direction', () => {
  assert.equal(usage(sample(-680, 1500)), 680 / 1500 * 100);
  assert.equal(direction(sample(-680, 1500)), -1);
  assert.equal(direction(sample(680, 1500)), 1);
});
test('zero flow remains a valid zero and does not animate', () => {
  assert.equal(usage(sample(0, 1000)), 0);
  assert.equal(direction(sample(0, 1000)), 0);
  assert.equal(band(0), 'low');
});
test('unknown capacity, invalid capacity, and missing flow must not appear green', () => {
  for (const s of [sample(100, null), sample(100, 0), sample(100, -1), sample(null, 1000), sample(NaN, 100), sample(100, Infinity), undefined]) {
    assert.equal(usage(s), null); assert.equal(band(usage(s)), 'unknown');
  }
  assert.equal(direction(sample(null, 100)), null);
  assert.equal(direction(sample(100, null)), 1);
});
test('colour boundaries are exact; utilisation above 100% is not truncated', () => {
  assert.equal(band(49.99), 'low'); assert.equal(band(50), 'medium');
  assert.equal(band(79.99), 'medium'); assert.equal(band(80), 'high');
  assert.equal(usage(sample(1200, 1000)), 120); assert.equal(band(120), 'over'); // 2026-10-10：100%超は紫（over）。値は切り捨てない
  assert.equal(band(100), 'high'); assert.equal(band(100.01), 'over');
  assert.equal(band(70, { low: 60, high: 90 }), 'medium');
});
test('special high voltage threshold is above 7 kV, including 11/22/33 kV', () => {
  for (const kv of [6.6, 7, 0, NaN]) assert.equal(isExtraHighVoltage(kv), false);
  for (const kv of [11, 22, 33, 66, 154, 275, 500]) assert.equal(isExtraHighVoltage(kv), true);
});
test('display thresholds must be finite, ordered and within 100 percent', () => {
  assert.equal(validThresholds({ low: 50, high: 80 }), true);
  for (const t of [{ low: 80, high: 50 }, { low: 50, high: 50 }, { low: 0, high: 80 }, { low: 50, high: 101 }, { low: NaN, high: 80 }]) assert.equal(validThresholds(t), false);
});
test('each path connects its registered endpoints and IDs are unique', () => {
  assert.equal(new Set(lines.map(l => l.id)).size, lines.length);
  assert.equal(new Set(facilities.map(f => f.id)).size, facilities.length);
  for (const line of lines) {
    assert.deepEqual(line.path[0], facilities.find(f => f.id === line.from)?.position);
    assert.deepEqual(line.path.at(-1), facilities.find(f => f.id === line.to)?.position);
    assert.equal(line.samples.length, 24);
    assert.equal(line.geometryQuality, 'demo');
    assert.equal(line.source.kind, 'demo');
    assert.ok(line.samples.every(s => s.source.kind === 'demo'));
  }
});
test('lookup must not silently substitute a different hour for missing observations', () => {
  assert.equal(sampleAt(lines[3], timestamps[3])?.mw, null);
  assert.equal(sampleAt(lines[3], '2020-01-01T00:00:00+09:00'), undefined);
  assert.equal(sampleAt(lines[3], timestamps[12])?.mw, 2250);
});
