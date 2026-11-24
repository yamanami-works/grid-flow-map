// 前回分の読み戻し（2026-10-31 保留39①・42 オーナー承認、docs/RULES.md 5節「前回分の引き継ぎ」）。
// 潮流は Git に入れないので、Actions では毎回の取得の前に、公開中のサイトから30日分（10データ）を読み戻して取得の土台にする。
//   node scripts/restore-flows.mjs <サイトの URL（https://…/ で終わる）> [--initial]
// - 公開物の data/catalog.json の sha256（vite.config.ts が書く）と、受け取ったバイト列の sha256 を照らし合わせ、
//   schemaVersion と validateFlowDays（日付・48コマ・重複）も確かめてから、受け取ったバイト列のまま public/data/ に書く。
// - 書き込み先はサイトの url ではなく、手元に固定した対応（SPLIT_FLOWS と手元の catalog）で決める。サイトの url が違えば失敗。
// - 東北は各日を public/data/occto/<日付>.json にも書く（update-occto.mjs が読む形。30日の窓の中だけ）。
// - 1つでも失敗したら何も書かずに終了コード1（配置しない）。
// - --initial（初回の配置。手動実行の入力で明示）のときだけ、サイトにカタログがない（404）か、潮流の全10データに sha256 がない場合に、何も書かずに成功で終える。
//   照合の不一致・形式の誤りは --initial でも失敗。
import {readFile, writeFile, rename, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readLimited} from './read-limited.mjs';
import path from 'node:path';
import {SPLIT_FLOWS} from './flow-split.mjs';
import {validateFlowDays} from './validate-flow.mjs';
import {windowDates} from './occto-publication.mjs';

const TIMEOUT_MS = 60000, INTERVAL_MS = 1000, MAX_BYTES = 32 * 1024 * 1024;
const TOHOKU = 'occto-tohoku';
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const todayJst = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(new Date());

/** サイトの URL を確かめる（https:// で始まり / で終わる。認証情報・クエリ・フラグメントなし） */
export function checkBase(base) {
  let u;
  try { u = new URL(base); } catch { throw Error('サイトの URL が不正'); }
  if (u.protocol !== 'https:' || !base.endsWith('/') || u.username || u.password || u.search || u.hash || u.href !== base) throw Error('サイトの URL は https:// で始まり / で終わるものだけ');
  return base;
}

/** 1回の要求。転送は失敗、上限時間・大きさの上限つき。戻り値：{status, bytes}（404 は bytes なし） */
export async function get(fetchImpl, url, maxBytes = MAX_BYTES) {
  const res = await fetchImpl(url, {redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: {'Cache-Control': 'no-cache'}});
  if (res.status === 404) { await res.body?.cancel?.(); return {status: 404}; }
  if (res.status !== 200) { await res.body?.cancel?.(); throw Error(`HTTP ${res.status}: ${url}`); }
  // 読みながら数えて上限を超えたら止める（2026-11-24。全体を読んでから確かめるのをやめた）
  let bytes; try { bytes = await readLimited(res, maxBytes); } catch (e) { throw e?.code === 'TOO_LARGE' ? Error('大きすぎる: ' + url) : e; }
  return {status: 200, bytes};
}

/** 読み戻して確かめ、全部そろってから書く。戻り値：{restored:[ファイル名], occtoDays:日数, initial:真偽} */
export async function restoreFlows({base, initial = false, fetchImpl = fetch, root = '.', today = todayJst(), interval = INTERVAL_MS, log = console.log}) {
  checkBase(base);
  const t = Date.now();
  // 手元の固定の対応：SPLIT_FLOWS の名前 → 手元の catalog の潮流データ（id・url・schemaVersion）
  const local = JSON.parse(await readFile(path.join(root, 'public/data/catalog.json'), 'utf8'));
  const targets = SPLIT_FLOWS.map(name => {
    const url = `./data/${name}.json`, d = local.datasets.find(x => x.purpose === 'flow' && x.url === url);
    if (!d) throw Error('手元のカタログに潮流がない: ' + name);
    return {name, url, id: d.id, schemaVersion: d.schemaVersion};
  });
  const cat = await get(fetchImpl, `${base}data/catalog.json?t=${t}`);
  if (cat.status === 404) {
    if (initial) { log('初回：サイトにカタログがないので前回分なしで始める'); return {restored: [], occtoDays: 0, initial: true}; }
    throw Error('サイトにカタログがない（初回でなければ配置しない）');
  }
  let site;
  try { site = JSON.parse(cat.bytes.toString('utf8')); } catch { throw Error('サイトのカタログが JSON でない'); }
  if (!Array.isArray(site?.datasets)) throw Error('サイトのカタログの形が違う');
  const entries = targets.map(x => {
    const d = site.datasets.find(s => s?.id === x.id);
    if (!d) throw Error('サイトのカタログに潮流がない: ' + x.id);
    if (d.url !== x.url || d.purpose !== 'flow') throw Error('サイトのカタログの url が手元と違う: ' + x.id);
    if (d.schemaVersion !== x.schemaVersion) throw Error('schemaVersion が手元と違う: ' + x.id);
    return {...x, sha256: d.sha256};
  });
  const withHash = entries.filter(e => e.sha256 !== undefined).length;
  if (withHash === 0 && initial) { log('初回：サイトのカタログに sha256 がないので前回分なしで始める'); return {restored: [], occtoDays: 0, initial: true}; }
  if (withHash !== entries.length) throw Error('サイトのカタログに sha256 がない潮流がある');
  const got = [];
  for (const e of entries) {
    if (!/^[0-9a-f]{64}$/.test(e.sha256)) throw Error('sha256 の形が違う: ' + e.id);
    await sleep(interval);
    const r = await get(fetchImpl, `${base}${e.url.slice(2)}?t=${t}`);
    if (r.status !== 200) throw Error('読み戻せない: ' + e.url);
    if (sha256(r.bytes) !== e.sha256) throw Error('sha256 が一致しない: ' + e.id);
    let json;
    try { json = JSON.parse(r.bytes.toString('utf8')); } catch { throw Error('JSON でない: ' + e.id); }
    if (json?.schemaVersion !== e.schemaVersion) throw Error('ファイルの schemaVersion が違う: ' + e.id);
    validateFlowDays(json.days);
    got.push({...e, bytes: r.bytes, days: json.days});
  }
  // 東北の日別（update-occto.mjs の土台）：30日の窓の中の日だけ
  const window = new Set(windowDates(today));
  const occto = got.find(g => g.name === TOHOKU).days.filter(d => window.has(d.date));
  // ここまでで全部確かめた。書く（.tmp に書いてから置き換える）。置き換えの途中で失敗すると一部だけ置き換わるが、
  // そのときは終了コード1でワークフローが止まり、配置しない（Actions の作業コピーは毎回捨てる）
  const writes = [...got.map(g => [path.join(root, 'public/data', g.name + '.json'), g.bytes]), ...occto.map(d => [path.join(root, 'public/data/occto', d.date + '.json'), JSON.stringify(d)])];
  await mkdir(path.join(root, 'public/data/occto'), {recursive: true});
  for (const [file, data] of writes) await writeFile(file + '.tmp', data);
  for (const [file] of writes) await rename(file + '.tmp', file);
  log(`読み戻し：${got.length}データ、東北の日別${occto.length}日`);
  return {restored: got.map(g => g.name + '.json'), occtoDays: occto.length, initial: false};
}

if (process.argv[1]?.endsWith('restore-flows.mjs')) {
  const args = process.argv.slice(2), base = args.find(a => !a.startsWith('--'));
  const unknown = args.filter(a => a.startsWith('--') && a !== '--initial');
  if (!base || unknown.length || args.filter(a => !a.startsWith('--')).length !== 1) { console.error('使い方：node scripts/restore-flows.mjs <https://…/> [--initial]'); process.exit(2); }
  await restoreFlows({base, initial: args.includes('--initial')}).catch(e => { console.error('読み戻しに失敗（何も書いていない）：' + e.message); process.exit(1); });
}
