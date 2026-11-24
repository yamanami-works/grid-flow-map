// 公開データの文言（2026-11-22 指示）：「オーナー」・保留番号を公開データに出さない（scripts/public-wording.mjs、docs/research/public-wording.json）
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import {publicWording, rewrite, leftovers} from '../scripts/public-wording.mjs';

test('完全一致の文字列だけを置き換え、キーの順と他の値はそのまま', () => {
  const map = new Map([['線名はオーナー指示', '線名は本アプリの判断']]);
  const used = new Set();
  const out = rewrite({b: 1, a: ['線名はオーナー指示', '線名はオーナー指示。追記'], c: null}, map, used);
  assert.deepEqual(Object.keys(out), ['b', 'a', 'c']);
  assert.equal(out.a[0], '線名は本アプリの判断');
  assert.equal(out.a[1], '線名はオーナー指示。追記'); // 一部一致は置き換えない
  assert.deepEqual([...used], ['線名はオーナー指示']);
});
test('置き換えたあとに「オーナー」・保留番号が残れば止める', () => {
  assert.throws(() => publicWording({x: 'オーナー回答'}, 't.json', new Map()), /オーナー/);
  assert.throws(() => publicWording({x: '（保留12）'}, 't.json', new Map()), /保留番号/);
  assert.deepEqual(publicWording({x: '保留中の作業はない'}, 't.json', new Map()), {x: '保留中の作業はない'});
  assert.deepEqual(leftovers({ok: 'a', ng: ['b', 'オーナー']}), ['$.ng[1]: オーナー']);
});
test('配信データ10ファイルに「オーナー」・保留番号がなく、対応表の後の文が推定・推測の語を落としていない', () => {
  const files = ['kansai', 'tokyo', 'chugoku', 'kyushu', 'chubu', 'shikoku', 'tohoku', 'hokuriku'].map(r => r + '-trunk.json').concat(['hokkaido-hokuto.json', 'undrawn-sections.json']);
  for (const f of files) assert.ok(!/オーナー|保留\d/.test(fs.readFileSync('public/data/' + f, 'utf8')), f);
  const {entries} = JSON.parse(fs.readFileSync('docs/research/public-wording.json', 'utf8'));
  for (const e of entries) {
    assert.ok(!/オーナー|保留\d/.test(e.after), e.after);
    // 推定・推測は引用の中だけにあった分（2件）を除いて減らさない。未確認・一次資料未確認・みなしたは減らさない
    for (const w of ['推定', '推測']) assert.ok(e.after.split(w).length >= Math.min(e.before.split(w).length, 2), w + '：' + e.after.slice(0, 40));
    for (const w of ['未確認', '一次資料未確認', 'みなした']) assert.ok(e.after.split(w).length >= e.before.split(w).length, w + '：' + e.after.slice(0, 40));
    assert.ok(files.includes(e.file), e.file);
  }
});
