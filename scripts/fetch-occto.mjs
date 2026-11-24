// OCCTO 地内送電線の潮流実績（CB01S020）と運用容量（CB01S010）を取得して <出力先>/actual.json・capacity.json に保存する（取得記録 *.source.json 付き）。
// scripts/fetch-occto.ps1 を Node に置き換えたもの（2026-10-31 公開残件2：GitHub Actions の Linux で PowerShell に頼らず動かすため）。
// 使い方: node scripts/fetch-occto.mjs <YYYY-MM-DD|YYYY/MM/DD> [--area 02] [--out <dir>] [--allow-empty-capacity]
// - 出力先の既定は data/raw/occto-<日付>（東北が使う）。応答は受け取ったバイト列のまま保存し、そのバイト列から sha256（大文字16進、ps1 と同じ表記）を計算する。
// - --allow-empty-capacity：運用容量だけ「該当データが存在しません」（YA000010SW、OCCTO 側の未公表）のときは止めずに記録する（ps1 の -AllowEmptyCapacity と同じ）。
// - 要求は HTTPS だけ・転送（redirect）は失敗・要求の間を1秒あける・1回ごとに上限時間（docs/RULES.md 5節「OCCTO への取得は…過度なアクセスをしない」）。
import {mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {readLimited as readLimitedBase} from './read-limited.mjs';

const BASE = 'https://occtonet3.occto.or.jp/public/dfw/RP11/OCCTO/';
const UA = 'powerflow-site occto fetch';
const AREAS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
const KINDS = [['actual', 'CB01S020'], ['capacity', 'CB01S010']];
export const EMPTY_CAPACITY = 'YA000010SW';

/** 応答の判定：'ok'（使える）・'empty'（運用容量の未公表として記録だけ）。それ以外は例外 */
export function judge(data, {kind, allowEmptyCapacity = false} = {}) {
  const errors = data?.root?.errMessage;
  if (errors?.length) {
    if (allowEmptyCapacity && kind === 'capacity' && Array.isArray(errors) && errors.every(e => e?.msgId === EMPTY_CAPACITY)) return 'empty';
    throw Error('Incomplete or failed OCCTO response: ' + JSON.stringify(errors).slice(0, 200));
  }
  const table = data?.root?.bizRoot?.table?.table1?.table1;
  if (Number(table?.totalPage) > 1 || !table?.rows?.length) throw Error('Incomplete or failed OCCTO response');
  return 'ok';
}

/** 応答のバイト列を JSON として読む（BOM を外す）。読めなければ例外 */
export function parseBody(bytes) {
  try { return JSON.parse(Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/, '')); }
  catch { throw Error('OCCTO response is not JSON'); }
}

export const sha256Upper = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();

// 再試行（2026-10-31 公開残件3-A）：接続の失敗と 5xx のときだけ、5秒あけて1回だけ送り直す。4xx・転送・証明書の誤り・上限時間切れは送り直さない。
// 1要求あたり最大2回。連系線（fetch-occto-tie.mjs）は以前から線ごとにログインからやり直す1回の再試行を持つので、session({retry: false}) で切る（2026-11-02 セキュリティレビュー E）
const RETRY_CODES = new Set(['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);
export const retryable = e => RETRY_CODES.has(e?.cause?.code ?? e?.code);
/** send() を送り、接続の失敗か 5xx なら delayMs あけて1回だけ送り直す（2回目の結果をそのまま返す・投げる） */
export async function retryOnce(send, {wait = ms => new Promise(r => setTimeout(r, ms)), delayMs = 5000, log = console.error} = {}) {
  let r;
  try { r = await send(); } catch (e) { if (!retryable(e)) throw e; log('retry after connection error: ' + (e.cause?.code ?? e.code)); await wait(delayMs); return send(); }
  if (r.status >= 500) { log('retry after HTTP ' + r.status); await r.body?.cancel?.().catch(() => {}); await wait(delayMs); return send(); }
  return r;
}

// 応答の大きさの上限（2026-11-02 セキュリティレビュー E）：今の最大は地域の actual.json 約243KB、連系線の CSV 約30KB。Content-Length が上限を超えたら読まずに失敗し、
// 読みながら数えて超えたら読むのをやめて失敗する（極端に大きな応答で実行環境のメモリを使い切らない）
export const MAX_BYTES = 5 * 1024 * 1024;
/** 応答の本体を上限まで読む。超えたら失敗（本体は read-limited.mjs。2026-11-24 に共通化） */
export const readLimited = (r, maxBytes = MAX_BYTES) => readLimitedBase(r, maxBytes);

/** Cookie を引き継いで要求する関数を作る（値に = を含む Cookie も切らない）。retry:false で再試行を切る、maxBytes は応答の大きさの上限 */
export function session({fetchImpl = fetch, wait = ms => new Promise(r => setTimeout(r, ms)), intervalMs = 1000, timeoutMs = 60000, retryDelayMs = 5000, retry = true, maxBytes = MAX_BYTES, userAgent = UA, log = console.error} = {}) {
  const jar = new Map();
  let last = 0;
  return async function request(url, body, xhr = false) {
    if (!url.startsWith('https://')) throw Error('HTTPS only');
    const gap = last + intervalMs - Date.now(); if (last && gap > 0) await wait(gap);
    const cookie = [...jar].map(([k, v]) => k + '=' + v).join('; ');
    const send = () => fetchImpl(url, {method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
      headers: {'User-Agent': userAgent, ...(cookie ? {Cookie: cookie} : {}), ...(body ? {'Content-Type': 'application/x-www-form-urlencoded'} : {}), ...(xhr ? {'X-Requested-With': 'XMLHttpRequest'} : {})},
      body: body ? new URLSearchParams(body).toString() : undefined});
    const r = retry ? await retryOnce(send, {wait, delayMs: retryDelayMs, log}) : await send();
    last = Date.now();
    if (typeof r.headers.getSetCookie !== 'function') throw Error('this Node has no Headers.getSetCookie (Node 18.14 or later is required)');
    for (const s of r.headers.getSetCookie()) { const kv = s.split(';')[0], i = kv.indexOf('='); if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1)); }
    if (r.status >= 300 && r.status < 400) throw Error(`OCCTO redirected (${r.status})`);
    if (!r.ok) throw Error(`OCCTO HTTP ${r.status}`);
    return readLimited(r, maxBytes);
  };
}

/** 1日・1地域分を取得して保存する */
export async function fetchOccto({date, area = '02', out, allowEmptyCapacity = false, request = session(), log = console.log}) {
  if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(date ?? '')) throw Error('date must be YYYY-MM-DD');
  if (!AREAS.includes(area)) throw Error('area must be 01-10');
  const day = date.replaceAll('-', '/'), dir = out || 'data/raw/occto-' + day.replaceAll('/', '-');
  mkdirSync(dir, {recursive: true}); mkdirSync('tmp', {recursive: true});
  writeFileSync(`tmp/occto-${area}-login.html`, await request(BASE + 'SD/LOGIN_login'));
  for (const [kind, code] of KINDS) {
    writeFileSync(`tmp/occto-${area}-${kind}-form.html`, await request(`${BASE}SD/${code}C?fwExtention.pathInfo=${code}C&fwExtention.prgbrh=0`, {'fwExtention.pathInfo': 'MENU'}));
    const params = {'fwExtention.pathInfo': code + 'C', 'fwExtention.prgbrh': '0', 'fwExtention.formId': code + 'P', 'fwExtention.actionType': 'reference',
      'fwExtention.actionSubType': 'headerInput', transitionContextKey: 'DEFAULT', tgtNngp: day, areaCdAreaSumNon: area, daPtn: '00', 'table1.dispRowNum': '100', 'table1.startIndex': '0'};
    if (kind === 'capacity') Object.assign(params, {ysuFlowDnmCd: '7', dispKouhyoData: '2'});
    const url = `${BASE}SD/${code}C`, bytes = await request(url, params, true), file = join(dir, kind + '.json');
    writeFileSync(file, bytes);
    const state = judge(parseBody(bytes), {kind, allowEmptyCapacity});
    const retrievedAt = new Date().toISOString();
    if (state === 'empty') {
      writeFileSync(file + '.source.json', JSON.stringify({url, date: day, area, retrievedAt, format: 'public search response: no data'}, null, 2));
      log(`capacity: not published (${EMPTY_CAPACITY})`); continue;
    }
    writeFileSync(file + '.source.json', JSON.stringify({url, date: day, area, retrievedAt, sha256: sha256Upper(bytes), format: 'public search response (same table as CSV)'}, null, 2));
    log(`${kind}: ${parseBody(bytes).root.bizRoot.table.table1.table1.rows.length} rows`);
  }
}

if (process.argv[1]?.endsWith('fetch-occto.mjs')) {
  const args = process.argv.slice(2), opt = name => { const i = args.indexOf(name); if (i < 0) return undefined; if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(name + ' needs a value'); return args[i + 1]; };
  await fetchOccto({date: args[0], area: opt('--area') ?? '02', out: opt('--out'), allowEmptyCapacity: args.includes('--allow-empty-capacity')});
}
