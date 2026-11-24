// 各社の空容量一覧の値（変圧器のバンクの電圧・台数・設備容量・運用容量、送電線の設備容量）を、公開データと公開リポジトリに入るファイルに載せない
// （2026-11-09 保留95 ⑤ オーナー承認。OCCTO の運用容量・発電所の出力・公表の系統変更予定は対象外）。判定は scripts/export-public.mjs の valueHits と同じ。
// このファイルにも値を書かない（公開リポジトリに入るため）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {included, valueHits, ALLOW} from '../scripts/export-public.mjs';
import {publicCheckout} from './raw-data.mjs';
import {CIRCUIT_FIELDS} from '../scripts/tohoku-circuits.mjs';

// 東北の空容量一覧は保留95 ⑤-b で公開から外した（network-capacity.json は携帯用ビルドだけ、tohoku-coverage.json は値の2項目を削除）
const PENDING = {};

test('公開リポジトリに入るファイルに、各社の空容量一覧の値が残っていない', () => {
  const files = execFileSync('git', ['ls-files'], {encoding: 'utf8'}).trim().split('\n').filter(included);
  const found = {};
  for (const f of files) {
    let text; try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const hits = valueHits(text).filter(l => !ALLOW.some(a => a.file === f && a.label === '空容量一覧の値' && a.match.test(l)));
    if (hits.length) found[f] = hits.length;
  }
  assert.deepEqual(found, PENDING);
});

test('北海道・東京・関西・九州の配信データ：値の行と値の文がなく、回線数は残る', () => {
  const read = f => fs.readFileSync('public/data/' + f, 'utf8');
  const files = ['hokkaido-hokuto.json', 'tokyo-trunk.json', 'kansai-trunk.json', 'kyushu-trunk.json'];
  for (const f of files) {
    const t = read(f);
    assert.deepEqual(valueHits(t), [], f);
    for (const label of ['線路設備容量 / 運用容量', '公表区間全体の設備容量 / 運用容量', '公表バンク群の容量', '公表バンクと容量', '公表バンク情報', '公表変圧関係'])
      assert.ok(!t.includes('"label": "' + label), f + ' ' + label);
    assert.ok(!t.includes('"value": null'), f + '：値を外した行は落とす');
  }
  const d = JSON.parse(read('kyushu-trunk.json')), names = d.lines.filter(l => ['川薩南九州線', '川内分岐線'].includes(l.name));
  assert.equal(names.length, 2);
  for (const l of names) assert.match(l.attributes.find(a => a.label === '公表の線名').value, /（220kV）、\d回線、/, '回線数は残す');
  const k = JSON.parse(read('kansai-trunk.json')).lines.find(l => l.name === '熊野幹線');
  assert.match(k.attributes.find(a => a.label === '容量の注記').value, /^空容量一覧 No\.\d+（\d回線）の行の/, '回線数は残す');
});

test('東北の回線数だけの公開ファイル：許可した項目（名前・電圧・回線数・作成日・出典 URL）だけで、東北電力NW の表そのものは公開データにない', () => {
  const d = JSON.parse(fs.readFileSync('public/data/tohoku-circuits.json', 'utf8'));
  assert.equal(d.schemaVersion, 1);
  assert.deepEqual(Object.keys(d).sort(), ['lines', 'retrievedAt', 'schemaVersion', 'source']);
  assert.ok(d.lines.length > 0);
  for (const l of d.lines) assert.deepEqual(Object.keys(l), CIRCUIT_FIELDS);
  assert.ok(!fs.existsSync('public/data/network-capacity.json'));
  const cat = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8')).datasets;
  // 公開リポジトリの CI では test が build（prepare-foundation が携帯用の項目を外す）より前に動くので、コミットされたカタログのまま「ない」か「携帯用」のどちらか。
  // 配信物に入らないことは、serve-readonly の配信カタログの検査・publicCatalog の単体テスト・check:publish（dist の検査。CI では build の後に実行）で確かめる
  if (publicCheckout()) assert.ok([undefined, 'private-preview'].includes(cat.find(x => x.id === 'tohoku-capacity')?.distribution));
  else assert.equal(cat.find(x => x.id === 'tohoku-capacity')?.distribution, 'private-preview');
  assert.ok(cat.some(x => x.id === 'tohoku-circuits' && !x.distribution));
});
