// 公開前チェック（docs/RULES.md 5節「公開前チェック」、2026-10-11 オーナー承認）。`npm run check:publish` で実行し、失敗したら配置しない。
// 配置するディレクトリは dist/ に固定。npm run build の後に実行する（build の最後の verify-build は線・設備の件数を確かめる）。
// 1. 許可リスト：dist/ の中身が、index.html・assets/ のビルド成果物・カタログ登録のデータ・潮流の日別ファイル（<名前>-latest.json の一覧にあるもの）・
//    manifest／service worker／ライセンス表示だけであること。リストにないファイルが1つでもあれば失敗。
// 2. 禁止リスト（二重確認）：ファイル名（.map・*.previous・tmp・.env・.git・.claude・docs・scripts・tools・tests・reports・data/raw・data/processed・
//    data/validation・data/private・各社の表・認証情報ファイル）と、中身の目印（認証情報の形式・一時トンネルの URL）。
// 3. 携帯用ビルドの目印がないこと：index.html の <meta name="grid-build" content="private-preview">（vite.config.ts が build:private のときだけ入れる）、
//    カタログの distribution:'private-preview'。
// 4. 潮流の日別ファイル：全10データについて、最新日のファイルの一覧（index）の日付がすべて dist/ にあること。
// 5. CSP（2026-10-12）：index.html に <meta http-equiv="Content-Security-Policy"> があり、許可先が 'self'・data:・https://cyberjapandata.gsi.go.jp だけであること
//    （判定は scripts/csp.mjs の cspProblems）。
// 6. 需要家の補助資料上の名称（2026-10-13、docs/RULES.md 3節「需要家」）：配信データに auxName の項目がないこと。内部ファイル
//    docs/research/customer-aux-names.json（配布しない。公開リポジトリにはない）があれば、そこにある名称が dist/ のどこにも出てこないこと。
// 7. 手元の絶対パス・ユーザー名（2026-10-14 オーナー承認）：Windows の絶対パス・ホームのパス・file:// の URL・OneDrive・AppData・UNC パスと、
//    実行している人のユーザー名・ホームフォルダー（実行時に取得し、このファイルには書かない）が中身にないこと。エラー文はファイル名だけ。
//    GitHub Actions（GITHUB_ACTIONS）では、実行時に取得したユーザー名・ホームの照合を外す（runner という語の誤検出を避ける）。
// 8. 出典・免責（2026-10-31 オーナー承認、docs/RULES.md 5節「公開の基本」）：index.html か assets/ の js に、免責文と出典の表示の文字列
//    （DISPLAY_MARKS。OSM の加工データを ODbL で提供する旨を含む）があること。誤りの報告窓口（GitHub Issues）の検査は 2026-11-03 オーナー指示で外した。
// 9. 変圧器の一覧・空容量（2026-11-02 保留49）：配信データ（data/ の json）に、変圧器の行の項目 banks と空容量の項目
//    （availableMW・upstreamAvailable…・availableOriginal）がないこと。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {cspProblems} from './csp.mjs';
import {hashOf} from './flow-split.mjs';

const FLOW_LATEST = ['tohoku-flow-latest', 'hokkaido-flow-latest', 'tokyo-flow-latest', 'chubu-flow-latest', 'hokuriku-flow-latest', 'kansai-flow-latest', 'chugoku-flow-latest', 'shikoku-flow-latest', 'kyushu-flow-latest', 'tie-flow-latest'];
const ASSET = /^assets\/[A-Za-z0-9_-]+\.(?:js|css|png|svg|jpg|webp|woff2?|ttf)$/;
const ROOT_FILES = new Set(['index.html', 'manifest.webmanifest', 'sw.js', 'LICENSE.txt']);
const FORBIDDEN_NAME = /(^|\/)(\.git|\.claude|\.env[^/]*|tmp|docs|scripts|tools|tests|reports|node_modules)(\/|$)|\.map$|\.previous$|(^|\/)data\/(raw|processed|validation|private)(\/|$)|substation-voltages|line-capacity|network-capacity|private-preview-access|access\.json$/i;
export const FORBIDDEN_TEXT = [
  [/"password"\s*:/, '認証情報（password）'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '秘密鍵'],
  [/\bghp_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub のトークン'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS のキー'],
  [/[a-z0-9-]+\.trycloudflare\.com/i, '一時トンネルの URL'],
  // 公開物に作業の経緯（「オーナー」の語・保留番号）を出さない（2026-11-22 指示。データは scripts/public-wording.mjs で置き換える）
  [/オーナー|保留\d/, '作業の経緯（「オーナー」・保留番号）'],
];
// 需要家の補助資料上の名称（配布しない内部ファイル）。名称そのものと、事業者タグ・「変電所」などを除いた固有の部分の両方で探す
const AUX_FILE = path.join(import.meta.dirname, '../docs/research/customer-aux-names.json');
export function auxNameMarks(file = AUX_FILE) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')).entries.flatMap(e => [e.auxName, e.auxName.replace(e.operatorTag ?? '', '').replace(/(変電所|発電所|開閉所|線)$/, '')]).filter(x => x && x.length >= 2);
}
// 手元の絶対パス：JSON・JS の文字列では \ が \\ と書かれるので両方に当てる。UNC（\\ホスト\共有）は区切りの段数をそろえて照合する（\r\n などに当てない）
export const LOCAL_LABEL = '手元の絶対パス・ユーザー名';
const LOCAL_PATTERNS = [
  /(?<![A-Za-z0-9])[A-Za-z]:(?:\\{1,2}|\/)(?:Users|Windows|Documents|OneDrive|Program Files|ProgramData)\b/i,
  /(?<![A-Za-z0-9])[A-Za-z]:(\\{1,2})[A-Za-z0-9_.-]+\1/,
  /\/(?:Users|home)\/[A-Za-z0-9_.-]+\//,
  /file:\/\//i,
  /OneDrive|AppData/i,
  /(?<![\\A-Za-z0-9])\\\\[A-Za-z0-9.-]+\\[A-Za-z0-9$_.-]+/,
  /(?<![\\A-Za-z0-9])\\\\\\\\[A-Za-z0-9.-]+\\\\[A-Za-z0-9$_.-]+/,
];
/** 実行している人のユーザー名とホーム（GitHub Actions では照合しない） */
export function localIdentity(env = process.env) {
  if (env.GITHUB_ACTIONS) return {};
  try { return {user: os.userInfo().username, home: os.homedir()}; } catch { return {}; }
}
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function localMarks({user, home} = {}) {
  const marks = [...LOCAL_PATTERNS];
  if (user && user.length >= 3) marks.push(new RegExp('(?<![A-Za-z0-9])' + escRe(user) + '(?![A-Za-z0-9])', 'i'));
  if (home) { const fwd = home.replace(/\\/g, '/');
    for (const h of new Set([home, fwd, home.replace(/\\/g, '\\\\'), fwd.replace(/^([A-Za-z]):/, (m, d) => '/' + d.toLowerCase())])) marks.push(new RegExp(escRe(h), 'i')); }
  return marks;
}
// 出典の画面に必ず出す文字列（docs/RULES.md 5節の出典表示と免責）。出典の画面は ⓘ と「免責・データソース」（2026-11-16 保留118。出典は src/legal.ts の表、免責文は ⓘ）。同じ JS に入るのでビルド全体で探す
export const DISPLAY_MARKS = [
  ['判断には使わないでください', '免責文'],
  ['OCCTO 系統情報サービス', 'OCCTO の出典'],
  ['© OpenStreetMap contributors', 'OpenStreetMap の出典'],
  ['背景地図：国土地理院', '地理院タイルの出典'],
  ['ベクトルタイル（試験公開）を加工', '地理院ベクトルタイルの出典'],
  ['加工したデータも ODbL 1.0 で提供', 'OSM の加工データの提供の案内'],
];
export const CAPACITY_KEYS = /"(banks|availableMW|upstreamAvailable[A-Za-z]*|availableOriginal)"\s*:/;
const PRIVATE_MARK = /<meta\s+name=["']grid-build["']\s+content=["']private-preview["']/i;

function walk(dir, base = dir) { return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => { const p = path.join(dir, e.name); return e.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')]; }); }

/** dist/ を確かめ、問題の一覧を返す（空なら合格） */
// listOnly：許可リストの照合と日別ファイルの件数だけ（npm run build の最後の verify-build から呼ぶ）
export function checkPublish(dir = 'dist', {listOnly = false, auxNames = auxNameMarks(), identity = localIdentity()} = {}) {
  const errors = [], local = localMarks(identity);
  if (!fs.existsSync(path.join(dir, 'index.html'))) return ['index.html がない（npm run build の後に実行する）'];
  const files = walk(dir), catalog = JSON.parse(fs.readFileSync(path.join(dir, 'data/catalog.json'), 'utf8'));
  // 許可するデータ：カタログ登録（携帯用だけのデータは除く）と日別ファイル
  const allowed = new Set(['data/catalog.json', 'data/connection-gaps.json', 'data/LICENSE.txt']);
  for (const d of catalog.datasets) {
    if (d.distribution === 'private-preview') errors.push('携帯用だけのデータがカタログにある：' + d.id);
    else if (/^\.\/data\/[a-z0-9-]+\.json$/.test(d.url)) allowed.add(d.url.slice(2));
  }
  for (const id of FLOW_LATEST) {
    const d = catalog.datasets.find(x => x.id === id); if (!d) { errors.push('カタログに ' + id + ' がない'); continue; }
    const latestFile = path.join(dir, d.url.slice(2)); if (!fs.existsSync(latestFile)) { errors.push('最新日のファイルがない：' + d.url); continue; }
    const index = JSON.parse(fs.readFileSync(latestFile, 'utf8')).index ?? [], daysDir = d.url.slice(2).replace(/-latest\.json$/, '-days/');
    if (!index.length) errors.push('日付・ハッシュの一覧が空：' + d.url);
    // 日別ファイルの中身が一覧のハッシュ（flow-split.mjs の hashOf）と合うことも確かめる（2026-11-24。一覧と日別ファイルの版の食い違いを配置しない）。
    // バイト列のまま照合する。listOnly（build の最後）でも照合する
    for (const e of index) { const f = daysDir + e.date + '.json'; allowed.add(f); if (!fs.existsSync(path.join(dir, f))) { errors.push('日別ファイルがない：' + f); continue; } if (hashOf(fs.readFileSync(path.join(dir, f))) !== e.hash) errors.push('日別ファイルの中身が一覧のハッシュと合わない（改行の変換の可能性も）：' + f); }
  }
  for (const f of files) {
    if (!listOnly && FORBIDDEN_NAME.test(f)) errors.push('禁止リストのファイル：' + f);
    else if (!(ROOT_FILES.has(f) || ASSET.test(f) || allowed.has(f))) errors.push('許可リストにないファイル：' + f);
    if (!listOnly && /\.(html|js|css|json|txt|webmanifest)$/.test(f)) { const text = fs.readFileSync(path.join(dir, f), 'utf8'); for (const [re, label] of FORBIDDEN_TEXT) if (re.test(text)) errors.push(`中身に${label}：${f}`);
      if (local.some(re => re.test(text))) errors.push(`中身に${LOCAL_LABEL}：${f}`);
      if (/^data\/.*\.json$/.test(f) && /"auxName"\s*:/.test(text)) errors.push('中身に需要家の補助資料上の名称の項目（auxName）：' + f);
      if (/^data\/.*\.json$/.test(f) && CAPACITY_KEYS.test(text)) errors.push('中身に変圧器の一覧・空容量の項目（' + text.match(CAPACITY_KEYS)[1] + '）：' + f);
      for (const n of auxNames) if (text.includes(n)) { errors.push('中身に需要家の補助資料上の名称：' + f); break; } }
  }
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  if (!listOnly && PRIVATE_MARK.test(html)) errors.push('携帯用ビルドの目印が index.html にある（npm run build:private の出力を配置しようとしている）');
  if (!listOnly) { const metas = [...html.matchAll(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(["'])(.*?)\1/gi)];
    if (metas.length > 1) errors.push('CSP の <meta> が複数ある');
    errors.push(...cspProblems(metas[0]?.[2]).map(e => e + '（index.html）')); }
  if (!listOnly) {
    const shown = [html, ...files.filter(f => /^assets\/.*\.js$/.test(f)).map(f => fs.readFileSync(path.join(dir, f), 'utf8'))].join('\n');
    for (const [mark, label] of DISPLAY_MARKS) if (!shown.includes(mark)) errors.push('出典の画面に' + label + 'がない：' + mark);
  }
  return errors;
}

if (process.argv[1]?.endsWith('check-publish.mjs')) {
  const dir = 'dist', errors = checkPublish(dir);
  if (errors.length) { console.error('公開前チェック：失敗 ' + errors.length + '件'); for (const e of errors.slice(0, 50)) console.error('  ' + e); process.exit(1); }
  const days = walk(dir).filter(f => /-days\//.test(f)).length;
  console.log(`公開前チェック：合格（${dir}/ のファイル ${walk(dir).length}件、うち潮流の日別ファイル ${days}件）`);
}
