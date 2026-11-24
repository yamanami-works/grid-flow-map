// 原子力の号機の運転状態（原子力規制委員会）を1日1回取得して public/data/nuclear-status.json に書く（2026-11-10 保留110 オーナー承認、docs/RULES.md 3節・5節）。
//   node scripts/fetch-nra-status.mjs [<公開中のサイトの URL（https://…/）>] [--restore-only]
// 1) サイトの URL があれば、公開中のサイトの前回分を読み戻す（data/catalog.json の sha256 と照合。手元より新しい取得日時のときだけ置き換える）。
//    GitHub Actions は毎回まっさらな checkout から始まるので、これがないと30分ごとに取得してしまう。
// 2) --restore-only（main への push の配置）なら取得しない。
// 3) 手元（または読み戻した）ファイルの取得日が日本時間の今日なら取得しない（1日1回）。
// 4) 規制委のページを取得・読み取り・検証して書く。取得・読み取りに失敗しても前回分を残して終了コード0（潮流の配置を止めない）。
//    前回分が2日より古ければ、画面は運転状態を表示せず「取得できていません」と出す（src/nuclear-status.ts）。
import {readFile, writeFile, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readLimited} from './read-limited.mjs';
import {NRA_URL, NRA_NAME, parseNraStatus, validateNuclearStatus} from './nra-status.mjs';
import {checkBase} from './restore-flows.mjs';

const FILE = 'public/data/nuclear-status.json', MAX_BYTES = 2 * 1024 * 1024, TIMEOUT_MS = 30000;
const sha256 = b => createHash('sha256').update(b).digest('hex');
const jstDate = d => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(d);
const jstIso = d => jstDate(d) + 'T' + new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}).format(d) + '+09:00';
const warn = m => console.log((process.env.GITHUB_ACTIONS === 'true' ? '::warning::' : '注意：') + m);

export async function get(url, {fetchImpl = fetch, maxBytes = MAX_BYTES} = {}) {
  const res = await fetchImpl(url, {redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: {'User-Agent': 'grid-flow-map (daily status check)', 'Cache-Control': 'no-cache'}});
  if (res.status !== 200) { await res.body?.cancel?.(); throw Error(`HTTP ${res.status}: ${url}`); }
  // 読みながら数えて上限を超えたら止める（2026-11-24。全体を読んでから確かめるのをやめた）
  try { return await readLimited(res, maxBytes); } catch (e) { throw e?.code === 'TOO_LARGE' ? Error('大きすぎる: ' + url) : e; }
}
async function writeAtomic(text) { await writeFile(FILE + '.tmp', text); await rename(FILE + '.tmp', FILE); }

export async function run({base = null, restoreOnly = false, now = new Date()} = {}) {
  let current = null;
  try { current = validateNuclearStatus(JSON.parse(await readFile(FILE, 'utf8'))); } catch (e) { if (e.code !== 'ENOENT') warn('手元の運転状態のファイルが読めない：' + e.message); }
  if (base) {
    try {
      checkBase(base);
      const t = Date.now(), cat = JSON.parse((await get(`${base}data/catalog.json?t=${t}`)).toString('utf8'));
      const d = cat?.datasets?.find(x => x?.id === 'nuclear-status');
      if (!d) throw Error('サイトのカタログに nuclear-status がない（初回）');
      if (d.url !== './data/nuclear-status.json' || !/^[0-9a-f]{64}$/.test(d.sha256 ?? '')) throw Error('サイトのカタログの nuclear-status の形が違う');
      const bytes = await get(`${base}data/nuclear-status.json?t=${t}`);
      if (sha256(bytes) !== d.sha256) throw Error('sha256 が一致しない');
      const site = validateNuclearStatus(JSON.parse(bytes.toString('utf8')));
      if (!current || site.retrievedAt > current.retrievedAt) { await writeAtomic(bytes); current = site; console.log('運転状態：公開中のサイトの前回分を読み戻した（' + site.retrievedAt + '）'); }
    } catch (e) { warn('運転状態の前回分を読み戻せない：' + e.message); }
  }
  if (restoreOnly) return {fetched: false, reason: 'restore-only'};
  if (current && current.retrievedAt.slice(0, 10) === jstDate(now)) { console.log('運転状態：今日（日本時間）は取得済み（' + current.retrievedAt + '）'); return {fetched: false, reason: 'today'}; }
  try {
    const html = await get(NRA_URL), parsed = parseNraStatus(html.toString('utf8'));
    const data = validateNuclearStatus({schemaVersion: 1, source: {name: NRA_NAME, url: NRA_URL}, pageUpdated: parsed.pageUpdated, retrievedAt: jstIso(now), sha256: sha256(html), plants: parsed.plants});
    await writeAtomic(JSON.stringify(data, null, 1) + '\n');
    console.log(`運転状態：取得（規制委の最終更新日 ${data.pageUpdated}、${Object.keys(data.plants).length}発電所）`);
    return {fetched: true};
  } catch (e) { warn('運転状態を取得できない（前回分のまま）：' + e.message); return {fetched: false, reason: 'error'}; }
}

if (process.argv[1]?.endsWith('fetch-nra-status.mjs')) {
  const args = process.argv.slice(2), base = args.find(a => !a.startsWith('--')) ?? null;
  if (args.some(a => a.startsWith('--') && a !== '--restore-only') || args.filter(a => !a.startsWith('--')).length > 1) { console.error('使い方：node scripts/fetch-nra-status.mjs [<https://…/>] [--restore-only]'); process.exit(2); }
  await run({base, restoreOnly: args.includes('--restore-only')});
}
