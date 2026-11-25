// 発電所の号機の運転状態（HJKS「停止情報一覧」）を1日1回取得して public/data/unit-outages.json に書く（2026-11-24 保留149 オーナー承認、docs/RULES.md 3節・5節）。
//   node scripts/fetch-hjks-outages.mjs [<公開中のサイトの URL（https://…/）>] [--restore-only]
// 流れは scripts/fetch-nra-status.mjs と同じ：
// 1) サイトの URL があれば、公開中のサイトの前回分を読み戻す（data/catalog.json の sha256 と照合。手元より新しい取得日時のときだけ置き換える）。
// 2) --restore-only（main への push の配置）なら取得しない。
// 3) 手元（または読み戻した）ファイルの取得日が日本時間の今日なら取得しない（1日1回）。
// 4) 停止情報一覧のページを開いて Cookie と _csrf を受け取り、同じフォームを CSV で送信する（検索条件はすべて空。約12MB、MS932）。
//    読み取り・検証・照合して書く。CSV の原本は保存しない。どこで失敗しても前回分を残して終了コード0（潮流の配置を止めない）。
//    前回分が2日より古ければ、画面は運転状態を表示せず「取得できていません」と出す（src/unit-outages.ts）。
import {readFile, writeFile, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readLimited} from './read-limited.mjs';
import {HJKS_NAME, HJKS_URL, OUTAGES_URL, buildUnitOutages, validateUnitOutages} from './hjks-outages.mjs';
import {checkBase} from './restore-flows.mjs';

const FILE = 'public/data/unit-outages.json', UNITS = 'public/data/plant-units.json';
const PAGE_MAX = 2 * 1024 * 1024, CSV_MAX = 40 * 1024 * 1024, TIMEOUT_MS = 30000, UA = 'grid-flow-map (daily status check)';
const sha256 = b => createHash('sha256').update(b).digest('hex');
const jstDate = d => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(d);
const jstIso = d => jstDate(d) + 'T' + new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}).format(d) + '+09:00';
const warn = m => console.log((process.env.GITHUB_ACTIONS === 'true' ? '::warning::' : '注意：') + m);

async function get(url, {fetchImpl = fetch, maxBytes = PAGE_MAX, init = {}} = {}) {
  const res = await fetchImpl(url, {redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), ...init, headers: {'User-Agent': UA, 'Cache-Control': 'no-cache', ...(init.headers ?? {})}});
  if (res.status !== 200) { await res.body?.cancel?.(); throw Error(`HTTP ${res.status}: ${url}`); }
  try { return {res, bytes: await readLimited(res, maxBytes)}; } catch (e) { throw e?.code === 'TOO_LARGE' ? Error('大きすぎる: ' + url) : e; }
}
async function writeAtomic(text) { await writeFile(FILE + '.tmp', text); await rename(FILE + '.tmp', FILE); }

/** 地図の号機（HJKS の「運転中」）の一覧 */
export function mapUnits(plantUnits) {
  const list = [];
  for (const [facilityId, p] of Object.entries(plantUnits?.plants ?? {})) for (const u of p.units ?? []) if (u.status === '運転中' && u.code && u.unit) list.push({facilityId, code: u.code, unit: u.unit, format: u.format});
  return list;
}

/** 停止情報一覧の CSV を取る（ページの Cookie と _csrf を使う） */
export async function fetchOutagesCsv({fetchImpl = fetch} = {}) {
  const {res, bytes} = await get(OUTAGES_URL, {fetchImpl});
  // セッション（JSESSIONID）と振り分け装置の Cookie を同じまま送る（別のサーバーに届くと _csrf が合わない。2026-11-24 確認）。名前・値が英数字と ._- だけのものに限る
  const all = (res.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0].trim()), cookies = all.filter(c => /^[A-Za-z0-9._-]{1,64}=[A-Za-z0-9._-]{1,200}$/.test(c));
  if (cookies.filter(c => c.startsWith('JSESSIONID=')).length !== 1) throw Error(`セッションの Cookie がない（形が合わず除いた Cookie ${all.length - cookies.length}件）`);
  if (all.length > cookies.length) console.log(`号機の運転状態：形が合わず送らなかった Cookie ${all.length - cookies.length}件`);
  const csrf = bytes.toString('utf8').match(/<input type="hidden" name="_csrf" value="([0-9a-f-]{36})"/)?.[1];
  if (!csrf) throw Error('_csrf が見つからない');
  const form = new URLSearchParams({area: '', company: '', plantcd: '', name: '', format: '', unitname: '', maintemode: '', assortment: '', startdtfrom: '', startdtto: '', csv: 'csv', _csrf: csrf});
  const {res: r2, bytes: csv} = await get(OUTAGES_URL, {fetchImpl, maxBytes: CSV_MAX, init: {method: 'POST', body: form.toString(), headers: {'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies.join('; '), Referer: OUTAGES_URL}}});
  if (!/^text\/csv\b/i.test(r2.headers.get('content-type') ?? '')) throw Error('CSV ではない応答');
  return csv;
}

export async function run({base = null, restoreOnly = false, now = new Date(), fetchImpl = fetch} = {}) {
  let current = null;
  try { current = validateUnitOutages(JSON.parse(await readFile(FILE, 'utf8'))); } catch (e) { if (e.code !== 'ENOENT') warn('手元の号機の運転状態のファイルが読めない：' + e.message); }
  if (base) {
    try {
      checkBase(base);
      const t = Date.now(), cat = JSON.parse((await get(`${base}data/catalog.json?t=${t}`, {fetchImpl})).bytes.toString('utf8'));
      const d = cat?.datasets?.find(x => x?.id === 'unit-outages');
      if (!d) throw Error('サイトのカタログに unit-outages がない（初回）');
      if (d.url !== './data/unit-outages.json' || !/^[0-9a-f]{64}$/.test(d.sha256 ?? '')) throw Error('サイトのカタログの unit-outages の形が違う');
      const {bytes} = await get(`${base}data/unit-outages.json?t=${t}`, {fetchImpl});
      if (sha256(bytes) !== d.sha256) throw Error('sha256 が一致しない');
      const site = validateUnitOutages(JSON.parse(bytes.toString('utf8')));
      if (!current || site.retrievedAt > current.retrievedAt) { await writeAtomic(bytes); current = site; console.log('号機の運転状態：公開中のサイトの前回分を読み戻した（' + site.retrievedAt + '）'); }
    } catch (e) { warn('号機の運転状態の前回分を読み戻せない：' + e.message); }
  }
  if (restoreOnly) return {fetched: false, reason: 'restore-only'};
  if (current && current.retrievedAt.slice(0, 10) === jstDate(now)) { console.log('号機の運転状態：今日（日本時間）は取得済み（' + current.retrievedAt + '）'); return {fetched: false, reason: 'today'}; }
  try {
    const units = mapUnits(JSON.parse((await readFile(UNITS, 'utf8')).replace(/^﻿/, '')));
    if (!units.length) throw Error('地図の号機がない');
    const csv = await fetchOutagesCsv({fetchImpl});
    const text = new TextDecoder('shift_jis', {fatal: true}).decode(csv);
    const b = buildUnitOutages(text, units, now);
    const data = validateUnitOutages({schemaVersion: 1, source: {name: HJKS_NAME, url: HJKS_URL}, latestUpdate: b.latestUpdate, retrievedAt: jstIso(now), sha256: sha256(csv), units: b.units});
    await writeAtomic(JSON.stringify(data, null, 1) + '\n');
    const n = Object.values(b.units).reduce((a, u) => a + Object.keys(u).length, 0);
    console.log(`号機の運転状態：取得（HJKS の最終更新 ${b.latestUpdate}、${b.rows}行、停止日時が9999年の行 ${b.skipped9999}、復旧予定日が9999年の行 ${b.recovery9999}、停止・出力低下中の号機 ${n}）`);
    return {fetched: true};
  } catch (e) { warn('号機の運転状態を取得できない（前回分のまま）：' + e.message); return {fetched: false, reason: 'error'}; }
}

if (process.argv[1]?.endsWith('fetch-hjks-outages.mjs')) {
  const args = process.argv.slice(2), base = args.find(a => !a.startsWith('--')) ?? null;
  if (args.some(a => a.startsWith('--') && a !== '--restore-only') || args.filter(a => !a.startsWith('--')).length > 1) { console.error('使い方：node scripts/fetch-hjks-outages.mjs [<https://…/>] [--restore-only]'); process.exit(2); }
  // 予期しない例外でも配置を止めない（2026-11-24 提案レビュー）
  try { await run({base, restoreOnly: args.includes('--restore-only')}); } catch (e) { warn('号機の運転状態：予期しない失敗（前回分のまま）：' + (e?.message ?? e)); }
}
