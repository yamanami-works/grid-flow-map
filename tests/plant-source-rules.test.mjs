import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RULES, pick} from '../scripts/plant-source-rules.mjs';
// 2026-10-10 オーナー指示：方式語の誤判定の総点検（地図の全発電所名で意図しない部分一致がないか）
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const FILES = ['tohoku-trunk', 'hokkaido-hokuto', 'tokyo-trunk', 'chubu-trunk', 'hokuriku-trunk', 'kansai-trunk', 'chugoku-trunk', 'shikoku-trunk', 'kyushu-trunk'];
const plants = new Map();
for (const f of FILES) for (const x of read(`public/data/${f}.json`).facilities) if (x.kind === 'plant' || (x.alsoKinds ?? []).includes('plant')) plants.set(x.id, x);
const HJKS = read('public/data/plant-units.json').plants;
const MAJOR = {'火力': 'thermal', '水力': 'hydro', '原子力': 'nuclear'};

test('「〜原」＋「発電所」は原子力にしない（玉原・塩原・沼原・池原・市原）', () => {
  for (const n of ['玉原発電所', '塩原発電所', '沼原発電所', '池原発電所', '市原パワー市原発電所']) assert.notEqual(pick(n), 'nuclear', n);
  assert.equal(pick('泊原発'), 'nuclear');
  assert.equal(pick('柏崎刈羽原子力発電所'), 'nuclear');
});

test('地図の全発電所名：判定語は意図した語だけに当たる', () => {
  assert.ok(plants.size >= 160);
  const all = new RegExp(RULES.map(([, re]) => re.source).join('|'), 'gi');
  const words = new Set();
  for (const x of plants.values()) for (const m of x.name.matchAll(all)) words.add(m[0]);
  // 名前で当たってよい語（2026-10-10 に全163か所で確認）。新しい語が当たったら、意図した一致か確かめてから足す
  const ok = new Set(['原子力', '火力', '水力', 'バイオマス', 'パワーステーション', '共同発電', '瓦斯', 'Gas', 'ソーラー', 'ウインド', '風力']); // ソーラー：2026-11-10 アマテラス白石ソーラーパーク（保留115）。ウインド・風力：2026-11-21 せたな大里ウインドファーム・上ノ国第二風力発電所（保留138）
  for (const w of words) assert.ok(ok.has(w), `想定外の語に当たった：${w}`);
  // 原子力と判定される名前は「原子力」を含むものだけ
  for (const x of plants.values()) if (pick(x.name) === 'nuclear') assert.match(x.name, /原子力/, x.name);
});

test('名前から決めた種類は、HJKSのユニットの発電形式と食い違わない', () => {
  for (const [id, x] of plants) {
    const k = pick(x.name), hj = HJKS[id];
    if (!k || !hj) continue;
    const majors = new Set(hj.units.map(u => MAJOR[String(u.format ?? '').replace(/（.*/, '')]).filter(Boolean));
    if (majors.size) assert.ok(majors.has(k), `${x.name}：名前は ${k}、HJKSは ${[...majors].join('・')}`);
  }
});

test('一般的な語（共同発電・パワーステーション）で火力にした発電所は個別に確認済みのものだけ', () => {
  const generic = [...plants.values()].filter(x => /共同発電|パワーステーション/.test(x.name)).map(x => x.name).sort();
  // 大分共同発電所・戸畑共同発電所は HJKS の発電形式で火力（2026-10-26 追加）
  assert.deepEqual(generic, ['大分共同発電所', '戸畑共同発電所', '扇島パワーステーション', '鹿島北共同発電所', '鹿島南共同発電所'].sort());
});
