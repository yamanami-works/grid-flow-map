// 東京の全線に照合区分（確度）があること（2026-11-04 オーナー承認 保留70）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';

test('東京の線はすべて確度 A〜E のどれか（未判定なし）', () => {
  const d = JSON.parse(readFileSync('public/data/tokyo-trunk.json', 'utf8'));
  const none = d.lines.filter((l: any) => !evidenceOf(l).tier).map((l: any) => l.id);
  assert.deepEqual(none, []);
});

test('保留70で区分を付けた42本：A21・B16・C5、C は要注意（C区分）付き', () => {
  const d = JSON.parse(readFileSync('public/data/tokyo-trunk.json', 'utf8'));
  const ids = new Set(['tokyo-section-1','tokyo-section-2','tokyo-section-6','tokyo-section-7','tokyo-section-8','tokyo-section-11','tokyo-section-4','tokyo-section-5','tokyo-section-10','tokyo-section-58','tokyo-section-59','tokyo-section-60','tokyo-section-74','tokyo-section-37','tokyo-section-62','tokyo-section-63','tokyo-section-81','tokyo-section-84','tokyo-section-85','tokyo-section-86','tokyo-section-17','tokyo-section-25','tokyo-section-38','tokyo-section-46','tokyo-section-72','tokyo-section-18','tokyo-section-70','tokyo-section-16','tokyo-section-47','tokyo-section-99','tokyo-section-48','tokyo-section-75','tokyo-section-87','tokyo-section-52','tokyo-section-73','tokyo-section-80','tokyo-section-67','tokyo-section-68','tokyo-section-79','tokyo-section-21','tokyo-section-19','tokyo-section-83']);
  const added = d.lines.filter((l: any) => ids.has(l.id));
  assert.equal(added.length, 42);
  const count: Record<string, number> = {};
  for (const l of added) { const t = evidenceOf(l).tier!; count[t] = (count[t] ?? 0) + 1; if (t === 'C') assert.ok(l.attributes.some((a: any) => a.label === '要注意（C区分）'), l.id); }
  assert.deepEqual(count, {A: 21, B: 16, C: 5});
});
