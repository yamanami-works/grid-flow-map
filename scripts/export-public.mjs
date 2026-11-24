// 公開リポジトリの書き出し（docs/PUBLIC_REPO.md の手順、2026-11-09 保留95 オーナー承認）。
// 使い方：node scripts/export-public.mjs <コミット> <書き出し先> <記録の出力先>
// - 書き出し先は、ないか空（または .git だけ）のフォルダーに限る。作業用リポジトリの中・記録の出力先と同じ場所は拒否。
// - `git -c core.autocrlf=false archive` で書き出す（Windows の改行の変換で承認ハッシュが崩れないように）。
// - 除外一覧の正本はこのファイル（下の EXCLUDE_*・DOCS_RESEARCH_EXCLUDE）。ほかの文書に書き写さない。
// - 書き出したすべてのファイルに禁止の検査をかけ、1件でも当たれば失敗（終了コード1）。記録にはファイル名・種類・件数だけを書き、
//   当たった文字列そのもの（需要家の名称・識別子・メールアドレスなど）は書かない。
// - git init・コミット・push はしない（オーナーの手順。docs/PUBLIC_REPO.md）。
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {FORBIDDEN_TEXT, localMarks, localIdentity, auxNameMarks, LOCAL_LABEL} from './check-publish.mjs';

const APP = path.resolve(import.meta.dirname, '..');

// 公開リポジトリに入れないもの（docs/RULES.md 5節「リポジトリに入れないもの」と、保留49・95 のオーナー回答）
export const EXCLUDE_PREFIXES = ['.claude/', 'tools/prep/', 'ios/'];
export const EXCLUDE_FILES = new Set([
  'CLAUDE.md', 'PROJECT.md',                                   // 運用の文書（保留95 ⑥・②）
  'data/validation/miyagi-ishinomaki.json',                    // 宮城の変圧器の行・空容量（保留49）
  'tests/miyagi-pilot.test.ts', 'tests/display-settings.test.ts', // 宮城のバンクの値が直書き（保留95 ⑦）
]);
// docs/ は許可リスト方式：docs/research 直下の *.json だけを入れ、次を除く（保留95 ①）
export const DOCS_RESEARCH_EXCLUDE = new Set([
  'customer-aux-names.json',                                   // 需要家の補助資料上の名称（docs/RULES.md 5節）
  'hokkaido-inventory.json', 'hokkaido-remaining-review.json', 'line-capacity-current.json', 'line-capacity-other.json', // 各社の空容量一覧の行
  'miyagi-lower-survey.json',                                  // 宮城の154/66kV の調査（設備容量・運用容量・予想潮流。保留95 ⑤-6）
]);
/** 公開リポジトリに入れるパスか（パスは / 区切りの相対パス） */
export function included(rel) {
  if (EXCLUDE_FILES.has(rel) || EXCLUDE_PREFIXES.some(p => rel.startsWith(p))) return false;
  if (rel.startsWith('docs/')) { const m = /^docs\/research\/([^/]+\.json)$/.exec(rel); return !!m && !DOCS_RESEARCH_EXCLUDE.has(m[1]); }
  return true;
}

// 入っていてはいけないファイル名（included の取りこぼしへの二重確認）
const FORBIDDEN_NAME = /(^|\/)(\.git|\.claude|\.env[^/]*|tmp|node_modules|dist|reports|backups)(\/|$)|\.map$|\.previous$|(^|\/)data\/(raw|processed|private)(\/|$)|(^|\/)substation-voltages\.json$|(^|\/)line-capacity\.json$|(^|\/)network-capacity\.json$|private-preview-access|(^|\/)access\.json$|customer-aux-names/i;
// メールアドレス（公開しない。保留95 ④）。数字だけの前置き（「612@ファイル名」など）は対象外
const EMAIL = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*[A-Za-z][A-Za-z0-9._%+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// 各社の空容量一覧の表の列名（この行の形が出てきたら表の写しとみなす）。このファイル自身に当たらないよう分けて組み立てる
const ROW_MARKS = [['運用容量', '値'], ['設備容量', '('], ['N-1電制', '適用'], ['"変電所', 'No"']].map(([a, b]) => a + b);
// 各社の空容量一覧の値（変圧器のバンク・線の設備容量。保留95 ⑤）。OCCTO の運用容量を書いた行は対象外。0 MW（表示の文言）は対象外
export const VALUE_MARKS = [
  new RegExp('(設備容量|運用容量|設備|運用) ?[1-9][0-9,.]* ?MW'),
  new RegExp('kV[・、] ?[0-9]+' + '台'),
  new RegExp('"(equipment|operation)' + 'MW"\\s*:\\s*[0-9]'),
];
export function valueHits(text) {
  return text.split('\n').filter(l => !l.includes('OCCTO') && VALUE_MARKS.some(re => re.test(l)));
}
// わざと残す試験用の値（ファイル・種類・当たった文字列の形の組で個別に許す）
export const ALLOW = [
  {file: 'tests/check-publish.test.mjs', label: '認証情報（password）'},
  {file: 'tests/check-publish.test.mjs', label: '一時トンネルの URL'},
  {file: 'tests/check-publish.test.mjs', label: LOCAL_LABEL},
  {file: 'scripts/check-publish.mjs', label: LOCAL_LABEL},       // 目印の定義そのもの
  {file: 'scripts/private-preview.mjs', label: LOCAL_LABEL},     // 携帯用プレビューの認証情報の置き場所（ユーザーのフォルダー）を組み立てる
  {file: 'tools/perf-measure.mjs', label: LOCAL_LABEL},          // Chrome の標準のインストール先
  {file: 'tests/check-publish.test.mjs', label: '空容量一覧の値', match: new RegExp('"equipment' + 'MW":1,"n1":"-","note":"banks"')}, // 公開前チェックの試験の偽物
  {file: 'tests/safe-html.test.ts', label: 'メールアドレス', match: /@example\.com$/},
  {file: 'tests/restore-flows.test.mjs', label: 'メールアドレス', match: /@example\.github\.io$/},
  {file: 'tests/restore-flows.test.mjs', label: LOCAL_LABEL, match: /^file:\/\/$/i}, // 拒否する URL の例（ファイルの URL）
];

function walk(dir, base = dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '.git' && dir === base ? [] : walk(p, base);
    return [path.relative(base, p).split(path.sep).join('/')];
  });
}
// 作業の経緯（check-publish.mjs の FORBIDDEN_TEXT の1項目。公開物＝dist では従来どおり不合格）は、公開リポジトリでは
// 試験・処理・道具・調査記録の下だけ許す（2026-11-24 保留148 (c)：量が多く、書き換えると試験の期待値やデータに波及するため）。
// src・直下のファイル・.github・public など、ほかの場所では従来どおり当たる。ほかの項目（認証情報など）はこの下でも当たる
const HISTORY_LABEL = FORBIDDEN_TEXT.find(([re]) => re.test('保留1'))?.[1];
if (!HISTORY_LABEL) throw new Error('check-publish.mjs の FORBIDDEN_TEXT に作業の経緯の項目がない');
export const HISTORY_ALLOWED_DIRS = ['tests/', 'scripts/', 'tools/', 'docs/'];
const allowed = (file, label, value) =>
  (label === HISTORY_LABEL && HISTORY_ALLOWED_DIRS.some(d => file.startsWith(d))) ||
  ALLOW.some(a => a.file === file && a.label === label && (!a.match || a.match.test(value)));

/**
 * 書き出したフォルダーを検査する。返すのは {file, label, count} の一覧（当たった文字列は返さない）。
 * auxMarks：需要家の名称の目印（空なら失敗）。identity：{user, home, gitName, gitEmail}（手元の識別子）
 */
export function scanTree(root, {auxMarks, identity = {}}) {
  if (!auxMarks?.length) throw new Error('需要家の名称の目印が空です（作業用リポジトリの docs/research/customer-aux-names.json が要る）');
  const ids = [identity.gitName, identity.gitEmail].filter(x => x && x.length >= 3);
  // 決まった形（ドライブ名・ユーザーのフォルダーの名前など）と、実行者のユーザー名・ホームは別の種類にする。後者は ALLOW で許さない
  const local = localMarks({}), self = localMarks({user: identity.user, home: identity.home}).slice(local.length);
  const hits = [];
  for (const file of walk(root)) {
    const add = (label, values) => { const n = values.filter(v => !allowed(file, label, v)).length; if (n) hits.push({file, label, count: n}); };
    if (!included(file)) add('除外の対象が残っている', [file]);
    if (FORBIDDEN_NAME.test(file)) add('禁止のファイル名', [file]);
    let text; try { text = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
    for (const [re, label] of FORBIDDEN_TEXT) { const m = text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')); if (m) add(label, m); }
    const lm = local.flatMap(re => text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) ?? []); if (lm.length) add(LOCAL_LABEL, lm);
    if (self.some(re => re.test(text))) hits.push({file, label: '実行者のユーザー名・ホーム', count: self.filter(re => re.test(text)).length});
    const im = ids.filter(x => text.toLowerCase().includes(x.toLowerCase())); if (im.length) add('Git の名前・メール', im);
    const em = text.match(EMAIL); if (em) add('メールアドレス', em);
    const am = auxMarks.filter(x => text.includes(x)); if (am.length) add('需要家の名称', am);
    const rm = ROW_MARKS.filter(x => text.includes(x)); if (rm.length) add('空容量一覧の表の列名', rm);
    const vm = valueHits(text); if (vm.length) add('空容量一覧の値', vm);
  }
  return hits;
}

const inside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

/** repo の commit を dest に書き出し、除外一覧のファイルを消す。返すのは書き出したファイルの一覧 */
export function exportTree({repo = APP, commit, dest}) {
  dest = path.resolve(dest);
  if (inside(dest, repo)) throw new Error('書き出し先が作業用リポジトリの中です');
  if (fs.existsSync(dest) && fs.readdirSync(dest).some(n => n !== '.git')) throw new Error('書き出し先が空ではありません');
  fs.mkdirSync(dest, {recursive: true});
  const tar = execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'archive', '--format=tar', commit], {cwd: repo, maxBuffer: 1 << 30});
  execFileSync('tar', ['-x', '-f', '-'], {cwd: dest, input: tar, maxBuffer: 1 << 30});
  for (const f of walk(dest)) if (!included(f)) fs.rmSync(path.join(dest, f));
  const prune = d => { for (const e of fs.readdirSync(d, {withFileTypes: true})) if (e.isDirectory() && e.name !== '.git') { prune(path.join(d, e.name)); if (!fs.readdirSync(path.join(d, e.name)).length) fs.rmdirSync(path.join(d, e.name)); } };
  prune(dest);
  return walk(dest).sort();
}

function gitConfig(repo, key) { try { return execFileSync('git', ['config', key], {cwd: repo, encoding: 'utf8'}).trim(); } catch { return ''; } }

if (process.argv[1]?.endsWith('export-public.mjs')) {
  const [commit, dest, recordDir] = process.argv.slice(2);
  if (!commit || !dest || !recordDir) { console.error('使い方：node scripts/export-public.mjs <コミット> <書き出し先> <記録の出力先>'); process.exit(2); }
  const out = path.resolve(recordDir);
  if (inside(out, APP) || inside(out, path.resolve(dest)) || inside(path.resolve(dest), out)) { console.error('記録の出力先は、作業用リポジトリ・書き出し先の外にしてください'); process.exit(2); }
  const identity = {...localIdentity(), gitName: gitConfig(APP, 'user.name'), gitEmail: gitConfig(APP, 'user.email')};
  if (!process.env.GITHUB_ACTIONS && !identity.user && !identity.gitName) { console.error('手元の識別子が取れません（検査できないので中止）'); process.exit(2); }
  const sha = execFileSync('git', ['rev-parse', commit], {cwd: APP, encoding: 'utf8'}).trim();
  const files = exportTree({commit: sha, dest});
  const hits = scanTree(dest, {auxMarks: auxNameMarks(), identity});
  fs.mkdirSync(out, {recursive: true});
  fs.writeFileSync(path.join(out, 'files.txt'), files.join('\n') + '\n');
  fs.writeFileSync(path.join(out, 'scan.json'), JSON.stringify({commit: sha, exportedAt: new Date().toISOString(), files: files.length, hits}, null, 1) + '\n');
  console.log(`書き出し：${files.length}件（コミット ${sha.slice(0, 7)}）。検査：${hits.length ? '不合格 ' + hits.length + '件' : '合格'}`);
  for (const h of hits) console.log(`  ${h.label}：${h.file}（${h.count}件）`);
  process.exit(hits.length ? 1 : 0);
}
