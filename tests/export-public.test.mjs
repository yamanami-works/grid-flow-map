// 公開リポジトリの書き出し（scripts/export-public.mjs、保留95）。作業用リポジトリの状態に頼らず、一時フォルダーに作った git リポジトリで確かめる
// （公開リポジトリの Actions でも動く）。試験用の値は、書き出しの検査がこのファイル自身に当たらないよう分けて組み立てる。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {included, exportTree, scanTree, EXCLUDE_FILES, HISTORY_ALLOWED_DIRS} from '../scripts/export-public.mjs';
import {FORBIDDEN_TEXT} from '../scripts/check-publish.mjs';

const AUX = ['試験需要家甲変電所', '試験需要家甲'];
function repoWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-export-src-'));
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), {recursive: true}); fs.writeFileSync(path.join(dir, f), text); }
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=', '-c', 'core.autocrlf=false', ...a], {cwd: dir});
  git('init', '-q'); git('add', '-A'); git('commit', '-q', '-m', 'x');
  return dir;
}
const tmpDest = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'grid-export-dst-')), 'out');

test('除外一覧：運用の文書・データ準備の道具・iOS・宮城の検証ファイル・docs の調査記録を入れず、docs/research 直下の JSON だけ入れる', () => {
  for (const f of ['CLAUDE.md', 'PROJECT.md', '.claude/settings.json', 'tools/prep/a.mjs', 'ios/App/x', 'data/validation/miyagi-ishinomaki.json',
    'tests/miyagi-pilot.test.ts', 'tests/display-settings.test.ts', 'docs/RULES.md', 'docs/PUBLIC_REPO.md', 'docs/mockups/detail-panel/README.md',
    'docs/research/customer-aux-names.json', 'docs/research/hokkaido-inventory.json', 'docs/research/hokkaido-remaining-review.json',
    'docs/research/line-capacity-current.json', 'docs/research/line-capacity-other.json', 'docs/research/a.png', 'docs/research/sub/a.json', 'docs/research/occto-input-validation/run.mjs'])
    assert.equal(included(f), false, f);
  for (const f of ['src/real.ts', 'scripts/build-tohoku.mjs', 'tools/audit-lines.mjs', 'tests/ties.test.ts', 'public/data/catalog.json', 'docs/research/tokyo-275-adopted.json', 'README.md', 'LICENSE', 'NOTICE', '.github/workflows/publish.yml'])
    assert.equal(included(f), true, f);
  assert.ok(EXCLUDE_FILES.has('data/validation/miyagi-ishinomaki.json'));
});

test('書き出し：改行を変えず、除外の対象を消し、空でない書き出し先と作業用リポジトリの中は拒否する', () => {
  const src = repoWith({'a.json': '{"x":1}\n', 'CLAUDE.md': '#\n', 'docs/RULES.md': '#\n', 'docs/research/ok.json': '{}\n', 'docs/research/customer-aux-names.json': '{}\n'});
  const dest = tmpDest();
  const files = exportTree({repo: src, commit: 'HEAD', dest});
  assert.deepEqual(files, ['a.json', 'docs/research/ok.json']);
  assert.equal(fs.readFileSync(path.join(dest, 'a.json'), 'utf8'), '{"x":1}\n', 'LF のまま');
  assert.throws(() => exportTree({repo: src, commit: 'HEAD', dest}), /空ではありません/);
  assert.throws(() => exportTree({repo: src, commit: 'HEAD', dest: path.join(src, 'out')}), /作業用リポジトリの中/);
  const withGit = tmpDest(); fs.mkdirSync(path.join(withGit, '.git'), {recursive: true});
  assert.deepEqual(exportTree({repo: src, commit: 'HEAD', dest: withGit}), ['a.json', 'docs/research/ok.json'], '.git だけのフォルダーには書き出せる');
});

test('検査：需要家の名称・メールアドレス・Git の名前・手元のパス・空容量の表の列名・認証情報を見つけ、当たった文字列は返さない', () => {
  const at = '@', mail = 'someone' + at + 'mail.example.net';
  const src = repoWith({
    'ok.txt': 'ok 612' + at + 'chubu-gridmap.geojson.gz\n',
    'names.json': JSON.stringify({name: AUX[0]}),
    'mail.md': 'contact: ' + mail,
    'who.md': 'by tester-zq',
    'path.md': 'see ' + 'C:' + '\\Users\\x\\a.txt',
    'row.json': '{"' + '運用容量' + '値(MW)":"1"}',
    'key.js': 'const a={"pass' + 'word":"x"}',
  });
  const dest = tmpDest(); exportTree({repo: src, commit: 'HEAD', dest});
  const hits = scanTree(dest, {auxMarks: AUX, identity: {gitName: 'tester-zq'}});
  const by = Object.fromEntries(hits.map(h => [h.file, h.label]));
  assert.equal(by['names.json'], '需要家の名称');
  assert.equal(by['mail.md'], 'メールアドレス');
  assert.equal(by['who.md'], 'Git の名前・メール');
  assert.ok(hits.some(h => h.file === 'path.md'));
  assert.equal(by['row.json'], '空容量一覧の表の列名');
  assert.equal(by['key.js'], '認証情報（password）');
  assert.equal(by['ok.txt'], undefined, '数字だけの前置きはメールアドレスとみなさない');
  assert.ok(!JSON.stringify(hits).includes(AUX[0]) && !JSON.stringify(hits).includes(mail), '当たった文字列は返さない');
});

test('検査：許可したファイルの中でも、実行者のユーザー名・ホームは当たる', () => {
  const src = repoWith({'scripts/private-preview.mjs': 'const p="App' + 'Data"; // by testuserq\n', 'tools/perf-measure.mjs': 'x="/ho' + 'me/testuserq/a"\n'});
  const dest = tmpDest(); exportTree({repo: src, commit: 'HEAD', dest});
  const hits = scanTree(dest, {auxMarks: AUX, identity: {user: 'testuserq', home: '/ho' + 'me/testuserq'}});
  for (const f of ['scripts/private-preview.mjs', 'tools/perf-measure.mjs']) assert.ok(hits.some(h => h.file === f && h.label === '実行者のユーザー名・ホーム'), f);
  assert.ok(!hits.some(h => h.file === 'scripts/private-preview.mjs' && h.label === '手元の絶対パス・ユーザー名'), '決まった形は許可どおり');
});

test('検査：作業の経緯（「オーナー」・保留番号）は tests・scripts・tools・docs の下だけ数えず、ほかの場所では当たる。ほかの項目はその下でも当たる', () => {
  const memo = '// 2026-11-24 オーナー指示 保留1\n';
  const allowedFiles = ['tests/a.test.mjs', 'scripts/a.mjs', 'tools/a.mjs', 'docs/research/a.json'];
  const flagged = ['src/a.ts', '.github/workflows/a.yml', 'vite.config.ts', 'public/data/a.json', 'config/a.json', 'data/a.json', 'testsx/a.mjs'];
  const src = repoWith({...Object.fromEntries([...allowedFiles, ...flagged].map(f => [f, memo])), 'tests/key.test.mjs': memo + 'const a={"pass' + 'word":"x"}\n'});
  const dest = tmpDest(); exportTree({repo: src, commit: 'HEAD', dest});
  const hits = scanTree(dest, {auxMarks: AUX});
  const history = f => hits.some(h => h.file === f && h.label === '作業の経緯（「オーナー」・保留番号）');
  for (const f of allowedFiles) assert.equal(history(f), false, f);
  for (const f of flagged) assert.equal(history(f), true, f);
  assert.equal(history('tests/key.test.mjs'), false);
  assert.ok(hits.some(h => h.file === 'tests/key.test.mjs' && h.label === '認証情報（password）'), 'tests の下でも認証情報は当たる');
});

test('src・直下のファイル・.github など（公開リポジトリに入り、作業の経緯を許さない場所）に「オーナー」・保留番号がない', () => {
  const [re] = FORBIDDEN_TEXT.find(([r]) => r.test('保留1'));
  const files = execFileSync('git', ['ls-files'], {encoding: 'utf8'}).trim().split('\n')
    .filter(f => included(f) && !HISTORY_ALLOWED_DIRS.some(d => f.startsWith(d)));
  assert.ok(files.includes('src/real.ts') && files.includes('NOTICE'));
  const found = files.filter(f => { try { return re.test(fs.readFileSync(f, 'utf8')); } catch { return false; } });
  assert.deepEqual(found, []);
});

test('検査：需要家の名称の目印が空なら失敗する（作業用リポジトリの外で素通りしない）', () => {
  const dest = tmpDest(); fs.mkdirSync(dest, {recursive: true});
  assert.throws(() => scanTree(dest, {auxMarks: []}), /目印が空/);
});

test('道具に手元の識別子・メールアドレスを書いていない（実行時に取る）', () => {
  const text = fs.readFileSync('scripts/export-public.mjs', 'utf8');
  assert.doesNotMatch(text, /[A-Za-z][A-Za-z0-9._%+-]*@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
  const user = (() => { try { return os.userInfo().username; } catch { return ''; } })();
  if (user.length >= 3 && !process.env.GITHUB_ACTIONS) assert.ok(!text.toLowerCase().includes(user.toLowerCase()));
  assert.match(text, /git', \['config', key\]/, 'Git の名前・メールは実行時に git config から取る');
});
