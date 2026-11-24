// 送電線・設備の詳細欄に「運用中」系の状態を出さない（設備は 2026-11-07 保留87）・凡例の文言・変圧器の行にダウンロードのリンクを置かない（2026-11-04 オーナー指示）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const real = readFileSync('src/real.ts', 'utf8');

test('送電線・設備は運用中を出さず、建設中・計画中・要確認（設備は廃止も）だけ状態を出す（設備 2026-11-07 保留87）', () => {
  assert.match(real, /const statusShown=\(x:GeoLine\|GeoFacility\)=>!!x\.statusCheck\|\|x\.status!=='運用中';/);
  assert.match(real, /\.\.\.\(statusShown\(g\)\?\[statusBadge\(g\)\]:\[\]\)/);
  assert.match(real, /:statusShown\(f\)\?statusBadge\(f\):null,/);
  // 注意に既定値の文言を出さない。出典の「運用状態」は状態を出す線・設備（要確認など）だけ（残るのは線と設備の出典の1か所ずつ）
  assert.doesNotMatch(real, /個別に確認していません（既定値：運用中）/);
  assert.equal(real.split('既定値：運用中').length - 1, 2);
  assert.match(real, /:!statusShown\(g\)\?\[\]:\[\{label:'運用状態'/);
  assert.match(real, /:!statusShown\(f\)\?\[\]:\[\{label:'運用状態'/);
});

test('凡例：粒子なし＝公表なし・欠測など、需要家線の項目なし', () => {
  assert.match(real, /<li>粒子なし＝公表なし・欠測など<\/li>/);
  assert.doesNotMatch(real, /潮流公表対象外（需要家線）/);
});

test('変圧器・バンクの行と出典に公表一覧のリンクを置かない', () => {
  assert.doesNotMatch(real, /'公表一覧'/);
  assert.doesNotMatch(real, /TSO_TABLE_LINKS/);
  assert.match(real, /label:'変圧器',name:b\.sourceLabel,date:b\.published\?\?undefined\}/);
});
