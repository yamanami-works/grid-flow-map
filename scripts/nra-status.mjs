// 原子力規制委員会「発電所の現在の運転状況」（https://www.nra.go.jp/jimusho/operation_status.html）の読み取り（2026-11-10 保留110 オーナー承認）。
// ページの文字列は配信データに入れない：発電所は見出しの id（決まった一覧 KNOWN_PLANTS にあるものだけ）、号機は「n号機」か「-」、状態は決まった語（STATUSES）だけ。
// 検証：概況の基数（状態ごとの「n 基」）と、発電所別の一覧から数えた数が一致しないときは読み取りを失敗にする（ページの形が変わったとき誤って載せない）。
export const NRA_URL = 'https://www.nra.go.jp/jimusho/operation_status.html';
export const NRA_NAME = '原子力規制委員会「発電所の現在の運転状況」';
export const STATUSES = ['運転中', '停止中', '建設中', '廃止措置中', '廃止'];
export const KNOWN_PLANTS = ['tomari', 'ohma', 'tkhigashidori', 'thhigashidori', 'onagawa', 'fukushima2', 'kashiwazaki', 'tokai2', 'tokai', 'hamaoka', 'shika', 'tsuruga', 'monju', 'fugen', 'mihama', 'ooi', 'takahama', 'shimane', 'ikata', 'genkai', 'sendai'];
const text = s => s.replace(/<[^>]*>/g, '').replace(/\s+/g, '');

/** HTML から {pageUpdated:'YYYY-MM-DD', plants:{id:{'1号機'|'-':状態}}} を返す。形が違えば例外 */
export function parseNraStatus(html) {
  const up = html.match(/最終更新日[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!up) throw Error('最終更新日が見つからない');
  const pageUpdated = `${up[1]}-${up[2].padStart(2, '0')}-${up[3].padStart(2, '0')}`;
  // 概況：<dt class="status">状態 …</dt> <dd>n 発電所</dd> <dd>m 基</dd>
  const summary = {};
  for (const m of html.matchAll(/<dt class="status">([\s\S]*?)<\/dt>\s*<dd>\s*(\d+)\s*発電所\s*<\/dd>\s*<dd>\s*(\d+)\s*基\s*<\/dd>/g)) {
    const s = text(m[1]).replace(/（注\d+）/g, '');
    if (!STATUSES.includes(s)) throw Error('概況に知らない状態の語');
    summary[s] = Number(m[3]);
  }
  if (Object.keys(summary).length !== STATUSES.length) throw Error('概況の状態の数が違う');
  const plants = {};
  const blocks = [...html.matchAll(/<h3 id="([a-z0-9]+)">[\s\S]*?<\/h3>\s*<ul class="plant__info">([\s\S]*?)<\/ul>/g)];
  for (const [, id, body] of blocks) {
    if (!KNOWN_PLANTS.includes(id)) throw Error('知らない発電所の見出し：' + id);
    if (plants[id]) throw Error('見出しが重複：' + id);
    const units = {};
    for (const li of body.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const m = li[1].match(/^\s*(\d+号機|-)\s*:\s*<span class="status_status-[a-z-]+">([^<]+)<\/span>/);
      if (!m) throw Error('号機の行の形が違う：' + id);
      const s = m[2].trim();
      if (!STATUSES.includes(s)) throw Error('知らない状態の語：' + id);
      if (units[m[1]]) throw Error('号機が重複：' + id);
      units[m[1]] = s;
    }
    if (!Object.keys(units).length) throw Error('号機がない：' + id);
    plants[id] = units;
  }
  if (Object.keys(plants).length !== KNOWN_PLANTS.length) throw Error(`発電所の数が違う（${Object.keys(plants).length}/${KNOWN_PLANTS.length}）`);
  const count = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const u of Object.values(plants)) for (const s of Object.values(u)) count[s]++;
  for (const s of STATUSES) if (count[s] !== summary[s]) throw Error(`概況の基数と一覧が合わない：${s} ${summary[s]}/${count[s]}`);
  return {pageUpdated, plants};
}

/** 配信データの形を確かめる（読み戻したファイル・手元のファイルに使う） */
export function validateNuclearStatus(d) {
  if (d?.schemaVersion !== 1 || d.source?.url !== NRA_URL || d.source?.name !== NRA_NAME) throw Error('nuclear-status の形が違う');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.pageUpdated) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(d.retrievedAt) || !/^[0-9a-f]{64}$/.test(d.sha256)) throw Error('nuclear-status の日付・ハッシュの形が違う');
  for (const [id, units] of Object.entries(d.plants ?? {})) {
    if (!KNOWN_PLANTS.includes(id)) throw Error('知らない発電所：' + id);
    for (const [u, s] of Object.entries(units)) if (!/^(\d+号機|-)$/.test(u) || !STATUSES.includes(s)) throw Error('号機・状態の形が違う：' + id);
  }
  return d;
}
