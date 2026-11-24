// 未判定は置かない：地図に出すすべての線に照合区分（確度 A〜E）があること（2026-11-04 オーナー指示 保留72。規則は docs/RULES.md 3節）。
// 対象は回帰テストの基準と同じ全国表示のデータ（scripts/write-baseline.mjs の BASELINE_FILES）。データが増えても漏れない
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';
import {BASELINE_FILES} from '../scripts/write-baseline.mjs';

const read = (f: string) => JSON.parse(readFileSync('public/data/' + f, 'utf8'));

test('地図に出すすべての線に確度がある（未判定0本）', () => {
  assert.ok(BASELINE_FILES.length >= 10);
  // catalog の線のデータ（地図に出すもの）が BASELINE_FILES から漏れていないこと
  const catalog = JSON.parse(readFileSync('public/data/catalog.json', 'utf8'));
  const geo = (catalog.datasets ?? []).filter((d: any) => d.purpose === 'geometry' && d.access === 'public').map((d: any) => String(d.url).replace('./data/', ''));
  assert.deepEqual(geo.filter((f: string) => !BASELINE_FILES.includes(f)), []);
  const none = BASELINE_FILES.flatMap((f: string) => read(f).lines.filter((l: any) => !evidenceOf(l).tier).map((l: any) => f + ' ' + l.id));
  assert.deepEqual(none, []);
});

test('直流の追加範囲の6本は C（要注意付き、推測なし）', () => {
  const lines = read('tohoku-dc-osm.json').lines;
  assert.equal(lines.length, 6);
  for (const l of lines) {
    const e = evidenceOf(l);
    assert.equal(e.tier, 'C', l.id);
    assert.equal(e.inferred.length, 0, l.id);
    assert.ok(l.attributes.some((a: any) => a.label === '要注意（C区分）'), l.id);
  }
});

// 地図に出す全データの線・設備のすべての属性で「約0.0km」と書かない（0.1km未満・名称なしの線分なしと書く。保留74・75、scripts/km-text.mjs）。
// 凍結ファイル tohoku-trunk-osm.json（地図・公開物に出ない）の勿来支線は対象外（2026-11-04 オーナー承認 保留75-1）
test('属性に「約0.0km」がない（保留74・75）', () => {
  const hits = BASELINE_FILES.flatMap((f: string) => { const d = read(f); return [...d.lines, ...d.facilities].filter((x: any) => (x.attributes ?? []).some((a: any) => /約0\.0+ ?km/.test(a.value))).map((x: any) => f + ' ' + x.id); });
  assert.deepEqual(hits, []);
});
