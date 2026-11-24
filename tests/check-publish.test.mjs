// 2026-10-11 公開前チェック（scripts/check-publish.mjs、docs/RULES.md 5節）と、公開用ビルドの潮流の日別ファイル
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {checkPublish, LOCAL_LABEL, localIdentity, DISPLAY_MARKS} from '../scripts/check-publish.mjs';
import {CSP, cspProblems} from '../scripts/csp.mjs';
import {hashOf} from '../scripts/flow-split.mjs';
const FLOWS = ['tohoku-flow-latest:occto-tohoku', 'hokkaido-flow-latest:hokkaido-flow', 'tokyo-flow-latest:tokyo-flow', 'chubu-flow-latest:chubu-flow', 'hokuriku-flow-latest:hokuriku-flow', 'kansai-flow-latest:kansai-flow', 'chugoku-flow-latest:chugoku-flow', 'shikoku-flow-latest:shikoku-flow', 'kyushu-flow-latest:kyushu-flow', 'tie-flow-latest:tie-flow'].map(s => s.split(':'));

test('dist/ に全10データの潮流の日別ファイルが一覧（index）の件数どおり入り、公開前チェックに合格する', {skip: !fs.existsSync('dist/index.html') && 'dist/ なし（npm run build の後に実行）'}, () => {
  let total = 0;
  for (const [, name] of FLOWS) {
    const index = JSON.parse(fs.readFileSync(`dist/data/${name}-latest.json`, 'utf8')).index;
    const files = fs.readdirSync(`dist/data/${name}-days`);
    assert.ok(index.length >= 25, name + ' の日数 ' + index.length);
    assert.deepEqual(files.sort(), index.map(e => e.date + '.json').sort(), name);
    total += files.length;
  }
  assert.ok(total >= 280, '日別ファイル ' + total);
  assert.deepEqual(checkPublish('dist'), []);
});

// 小さな dist を作って、失敗を見つけられることを確かめる
// 出典の画面の文字列（検査8）
const FAKE_SHOWN = DISPLAY_MARKS.map(([m]) => m).join(' ');
function fakeDist({extra = {}, privateMark = false, dropDay = false, badHash = false, privateData = false, csp = CSP, shown = FAKE_SHOWN} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-publish-'));
  const w = (f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), {recursive: true}); fs.writeFileSync(path.join(dir, f), s); };
  w('index.html', `<html><head>${privateMark ? '<meta name="grid-build" content="private-preview">' : ''}${csp == null ? '' : `<meta http-equiv="Content-Security-Policy" content="${csp}">`}</head></html>`);
  w('assets/real-abc.js', 'console.log(' + JSON.stringify(shown) + ')');
  const datasets = FLOWS.map(([id, name]) => ({id, url: `./data/${name}-latest.json`, access: 'public'}));
  if (privateData) datasets.push({id: 'line-capacity', url: './data/line-capacity.json', access: 'public', distribution: 'private-preview'});
  w('data/catalog.json', JSON.stringify({schemaVersion: 1, datasets}));
  FLOWS.forEach(([, name], i) => { w(`data/${name}-latest.json`, JSON.stringify({days: [], index: [{date: '2026-10-10', hash: hashOf('{}')}]})); if (!(dropDay && i === 3)) w(`data/${name}-days/2026-10-10.json`, badHash && i === 2 ? '{"x":1}' : '{}'); });
  for (const [f, s] of Object.entries(extra)) w(f, s);
  return dir;
}
test('公開前チェック：正常な dist は合格', () => { assert.deepEqual(checkPublish(fakeDist()), []); });
test('公開前チェック：許可リストにないファイル・禁止リストのファイルで失敗', () => {
  const e = checkPublish(fakeDist({extra: {'notes.txt': 'x', 'assets/real-abc.js.map': '{}', 'docs/RULES.md': '#', '.claude/settings.json': '{}', 'data/raw/a.json': '{}'}}));
  assert.ok(e.some(x => x.includes('許可リストにないファイル：notes.txt')));
  for (const f of ['assets/real-abc.js.map', 'docs/RULES.md', '.claude/settings.json', 'data/raw/a.json']) assert.ok(e.some(x => x.includes('禁止リストのファイル：' + f)), f);
});
test('公開前チェック：中身の目印（認証情報・一時トンネルの URL）で失敗', () => {
  const e = checkPublish(fakeDist({extra: {'assets/a.js': 'const x={"password":"abc"}', 'assets/b.js': 'fetch("https://abc-def.trycloudflare.com")'}}));
  assert.ok(e.some(x => x.includes('認証情報（password）')) && e.some(x => x.includes('一時トンネルの URL')));
});
test('公開前チェック：作業の経緯（「オーナー」・保留番号）が中身にあれば失敗', () => {
  for (const text of ['const n="オーナー指示"', 'const n="（保留12）"']) {
    const e = checkPublish(fakeDist({extra: {'assets/c.js': text}}));
    assert.ok(e.some(x => x.includes('作業の経緯（「オーナー」・保留番号）')), text);
  }
  assert.ok(!checkPublish(fakeDist()).some(x => x.includes('作業の経緯')));
});
test('公開前チェック：携帯用ビルドの目印・携帯用だけのデータ・日別ファイルの欠けで失敗', () => {
  assert.ok(checkPublish(fakeDist({privateMark: true})).some(x => x.includes('携帯用ビルドの目印')));
  assert.ok(checkPublish(fakeDist({privateData: true})).some(x => x.includes('携帯用だけのデータ')));
  assert.ok(checkPublish(fakeDist({dropDay: true})).some(x => x.includes('日別ファイルがない')));
  // 2026-11-24：一覧のハッシュと中身が合わない日別ファイル（古い版・新しい版の取り違え）も、build の最後（listOnly）を含めて失敗
  for (const listOnly of [false, true]) assert.deepEqual(checkPublish(fakeDist({badHash: true}), {listOnly}).filter(x => x.includes('一覧のハッシュと合わない')).length, 1, String(listOnly));
  assert.ok(!checkPublish(fakeDist()).some(x => x.includes('一覧のハッシュと合わない')));
});
test('公開前チェック：CSP がない・許可先が多いと失敗（2026-10-12）', () => {
  assert.deepEqual(cspProblems(CSP), []);
  assert.ok(checkPublish(fakeDist({csp: null})).some(x => x.includes('CSP がない')));
  const bad = [
    [CSP.replace("font-src 'self'", "font-src 'self' https://fonts.gstatic.com"), 'https://fonts.gstatic.com'],
    [CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"), "'unsafe-eval'"],
    [CSP.replace("connect-src 'self'", 'connect-src *'), 'connect-src *'],
    [CSP.replace("connect-src 'self'", "connect-src 'self' https://cyberjapandata.gsi.go.jp"), 'img-src 以外'],
    [CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"), 'style-src 以外'],
    [CSP.replace("default-src 'none'; ", ''), 'default-src'],
    [CSP.replace("object-src 'none'", "object-src 'self'"), 'object-src'],
  ];
  for (const [csp, word] of bad) assert.ok(checkPublish(fakeDist({csp})).some(x => x.includes(word)), word);
});
test('本番ビルドの index.html に CSP が入り、開発サーバー用の設定には入れない', {skip: !fs.existsSync('dist/index.html') && 'dist/ なし'}, () => {
  const html = fs.readFileSync('dist/index.html', 'utf8');
  assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`));
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'), 'CSP はスクリプトより前');
  assert.match(fs.readFileSync('vite.config.ts', 'utf8'), /name: 'csp-meta',\s*apply: 'build'/);
});
// 2026-10-13 需要家の補助資料上の名称（docs/RULES.md 3節「需要家」）：配信データの auxName の項目と、内部ファイルの名称を見つける
test('公開前チェック：需要家の補助資料上の名称（auxName の項目・名称そのもの）を見つける', () => {
  const withKey = checkPublish(fakeDist({extra: {'data/catalog-extra.json': '{"customer":{"displayName":"需要家","auxName":"X"}}'}}), {auxNames: []});
  assert.ok(withKey.some(x => x.includes('auxName')), JSON.stringify(withKey));
  const withName = checkPublish(fakeDist({extra: {'assets/real-xyz.js': 'const a="テスト用の名称変電所"'}}), {auxNames: ['テスト用の名称変電所', 'テスト用の名称']});
  assert.ok(withName.some(x => x.includes('需要家の補助資料上の名称：assets/real-xyz.js')), JSON.stringify(withName));
  assert.deepEqual(checkPublish(fakeDist(), {auxNames: ['テスト用の名称']}), []);
});
test('公開前チェック：配信データに変圧器の一覧（banks）・空容量の項目があると失敗（2026-11-02 保留49）', () => {
  for (const key of ['banks', 'availableMW', 'upstreamAvailableMW', 'upstreamAvailableOriginal', 'availableOriginal'])
    assert.ok(checkPublish(fakeDist({extra: {'data/x-capacity.json': `{"lines":[],"${key}":[]}`}})).some(x => x.includes('変圧器の一覧・空容量の項目（' + key + '）')), key);
  assert.ok(!checkPublish(fakeDist({extra: {'data/x-capacity.json': '{"lines":[{"equipmentMW":1,"n1":"-","note":"banks"}]}'}})).some(x => x.includes('変圧器の一覧')));
  // 東北電力NW の空容量一覧（network-capacity.json）は携帯用ビルドだけ（2026-11-09 保留95 ⑤-b）。公開ビルドにあればファイル名で失敗
  assert.ok(checkPublish(fakeDist({extra: {'data/network-capacity.json': '{}'}})).some(x => x.includes('禁止リストのファイル：data/network-capacity.json')));
});
// 2026-10-14 手元の絶対パス・ユーザー名（scripts/check-publish.mjs の7）。ユーザー名とホームは架空の値を渡す
test('公開前チェック：手元の絶対パス・ユーザー名で失敗し、エラー文にはファイル名だけを出す', () => {
  const identity = {user: 'testuserx', home: 'C:\\Users\\testuserx'};
  const hit = text => checkPublish(fakeDist({extra: {'assets/z.js': text}}), {identity}).filter(x => x.includes(LOCAL_LABEL));
  const bad = ['const p="C:\\Users\\someone\\a.txt"', 'const p="C:\\\\Users\\\\someone\\\\a.txt"', 'x="D:/Documents/a"', 'x="E:\\work\\a"',
    'x="/home/someone/a"', 'x="/c/Users/someone/a"', 'x="/Users/someone/a"', 'x="file:///tmp/a"', 'x="OneDrive"', 'x="AppData"',
    'x="\\\\fileserver\\share"', 'x="\\\\\\\\fileserver\\\\share"', 'x="by testuserx"', 'x="TESTUSERX"'];
  for (const t of bad) { const e = hit(t); assert.equal(e.length, 1, t); assert.equal(e[0], `中身に${LOCAL_LABEL}：assets/z.js`, t); }
  const good = ['fetch("https://cyberjapandata.gsi.go.jp/xyz")', 'const r=/\\d+\\.\\d+/', 'x="a\\r\\nb\\n\\tc"', 'x="a\\\\r\\\\nb\\\\n\\\\tc"',
    'x="./data/a.json"', 'x="testuserxyz"', 'x={a:1,b:2}',
    // 次の3つは直前が引用符で、UNC の段数をそろえる処理だけで外れることを確かめる（3つ目は JSON 用の4段の側）。最後の1つは念のための例
    'x="\\\\r\\\\n"', 'x="\\\\d\\\\s"', 'x="\\\\\\\\r\\\\\\\\n"', 'x="\\r\\n"'];
  for (const t of good) assert.deepEqual(hit(t), [], t);
});
test('公開前チェック：GitHub Actions では実行時に取得したユーザー名・ホームを照合しない', () => {
  assert.deepEqual(localIdentity({GITHUB_ACTIONS: 'true'}), {});
  const id = localIdentity({});
  assert.ok(typeof id.user === 'string' && typeof id.home === 'string');
});
// 2026-10-31 出典・免責（scripts/check-publish.mjs の8、docs/RULES.md 5節）。誤りの報告窓口の検査は 2026-11-03 オーナー指示で外した
test('公開前チェック：免責文・出典の表示（OSM の加工データの提供の案内を含む）が欠けると失敗。報告窓口の URL は求めない', () => {
  for (const [mark, label] of DISPLAY_MARKS) assert.ok(checkPublish(fakeDist({shown: FAKE_SHOWN.replace(mark, '')})).some(x => x.includes(label)), label);
  assert.ok(DISPLAY_MARKS.some(([, label]) => label === 'OSM の加工データの提供の案内'));
  assert.deepEqual(checkPublish(fakeDist()).filter(x => /報告窓口/.test(x)), []);
});
