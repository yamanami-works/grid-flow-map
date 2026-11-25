// 発電所の号機の運転状態（HJKS「停止情報一覧」の CSV）の読み取りと照合（2026-11-24 保留149 オーナー承認、docs/RULES.md 3節・5節）。
// 配信データに入れるのは、地図の号機（public/data/plant-units.json の「運転中」、原子力を除く）に当たる登録の
// 区分（計画停止・計画外停止・出力低下）・停止日・復旧予定日・最終更新日時だけ。停止原因・低下量・種別・CSV の原本は入れない。
// 照合は発電所コード＋ユニット名の完全一致だけ（名前の推測で付けない）。
export const HJKS_NAME = '日本卸電力取引所 発電情報公開システム（HJKS）停止情報一覧';
// 出典のリンクは HJKS のトップ（JEPX の免責事項・著作権：トップページ以外へのリンクは断る、2026-11-24 確認）。取得はこの URL ではなく OUTAGES_URL
export const HJKS_URL = 'https://hjks.jepx.or.jp/hjks/';
export const OUTAGES_URL = 'https://hjks.jepx.or.jp/hjks/outages';
export const HEADER = ['エリア', '発電事業者', '発電所コード', '発電所名', '発電形式', 'ユニット名', '認可出力', '停止区分', '種別', '低下量', '停止日時', '復旧見通し', '復旧予定日', '停止原因', '最終更新日時'];
export const KINDS = ['計画外停止', '計画停止', '出力低下']; // 並びは優先順（1号機に複数の登録があるとき先のものを出す）
const MIN_ROWS = 1000; // これより少なければ形が変わったとみなす（2026-11-24 は約6万行）
// 設備 ID・ユニット名は日本語を含む（例 tokyo-place-…発電所）。制御文字と <>"'& を含まない80字以内だけを通す（画面ではさらにエスケープする）
const SAFE = /^[^\x00-\x1f\x7f<>"'&]{1,80}$/;
const DT = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/, D = /^(\d{4})\/(\d{2})\/(\d{2})$/;

/** CSV（引用符・引用符の中の改行・"" に対応）を行の配列にする */
export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (q) throw Error('CSV の引用符が閉じていない');
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

/** 日本時間の 'YYYY-MM-DD' と 'YYYY-MM-DDTHH:MM' */
export function jstParts(now) {
  const f = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(now);
  const [d, t] = f.split(' ');
  return {date: d, minute: d + 'T' + t};
}

/**
 * CSV の文字列と地図の号機から、今（日本時間）の運転状態を返す。形が違えば例外。
 * units：[{facilityId, code, unit, format}]（plant-units.json の「運転中」の号機）
 * 返り値：{latestUpdate:'YYYY-MM-DDTHH:MM', rows, skipped9999, recovery9999, units:{facilityId:{unit:{kind, from, to}}}}
 */
export function buildUnitOutages(csvText, units, now) {
  const rows = parseCsv(csvText);
  if (!rows.length || rows[0].join(',') !== HEADER.join(',')) throw Error('CSV の見出しが違う');
  const body = rows.slice(1);
  if (body.length < MIN_ROWS) throw Error(`CSV の行が少ない（${body.length}）`);
  const ix = Object.fromEntries(HEADER.map((h, i) => [h, i]));
  const {date: today, minute: nowMin} = jstParts(now);
  const want = new Map(units.filter(u => !/^原子力/.test(u.format ?? '')).map(u => [u.code + '|' + u.unit, u]));
  const found = new Map(); let latest = '', skipped9999 = 0, recovery9999 = 0;
  for (const r of body) {
    if (r.length === HEADER.length + 1 && r[HEADER.length] === '') r.pop(); // データの行は末尾にカンマが付く（見出しの行には付かない。2026-11-24 確認）
    if (r.length !== HEADER.length) throw Error('CSV の列の数が違う');
    const kind = r[ix['停止区分']];
    if (!KINDS.includes(kind)) throw Error('知らない停止区分');
    const up = r[ix['最終更新日時']].match(DT);
    if (!up) throw Error('最終更新日時の形が違う');
    const upIso = `${up[1]}-${up[2]}-${up[3]}T${up[4]}:${up[5]}`;
    if (upIso > latest) latest = upIso;
    const st = r[ix['停止日時']].match(DT);
    if (!st) throw Error('停止日時の形が違う');
    if (st[1] === '9999') { skipped9999++; continue; } // 未定を表すとみられる行。今の状態には使わない
    const rec = r[ix['復旧予定日']], rm = rec === '' ? null : rec.match(D);
    if (rec !== '' && !rm) throw Error('復旧予定日の形が違う');
    if (rm && rm[1] === '9999') recovery9999++; // 復旧予定日が9999年は「未定」として扱う（停止日時の9999年とは別）
    const from = `${st[1]}-${st[2]}-${st[3]}`, fromMin = `${from}T${st[4]}:${st[5]}`, to = rm && rm[1] !== '9999' ? `${rm[1]}-${rm[2]}-${rm[3]}` : null;
    if (fromMin > nowMin) continue; // これからの予定
    if (to !== null && to < today) continue; // 復旧予定日を過ぎた登録は出さない（閉じられていない登録があるため。2026-11-24 オーナー回答）
    const u = want.get(r[ix['発電所コード']] + '|' + r[ix['ユニット名']]);
    if (!u) continue;
    const k = u.facilityId + '\u0000' + u.unit, prev = found.get(k), cand = {kind, from, to};
    if (!prev || KINDS.indexOf(kind) < KINDS.indexOf(prev.kind) || (kind === prev.kind && from < prev.from)) found.set(k, cand);
  }
  if (!latest) throw Error('最終更新日時がない');
  const out = {};
  for (const [k, v] of [...found].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) { const [fid, unit] = k.split('\u0000'); (out[fid] ??= {})[unit] = v; }
  return {latestUpdate: latest, rows: body.length, skipped9999, recovery9999, units: out};
}

/** 配信データの形を確かめる（読み戻したファイル・手元のファイルに使う） */
export function validateUnitOutages(d) {
  if (d?.schemaVersion !== 1 || d.source?.name !== HJKS_NAME || d.source?.url !== HJKS_URL) throw Error('unit-outages の形が違う');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.latestUpdate) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(d.retrievedAt) || !/^[0-9a-f]{64}$/.test(d.sha256)) throw Error('unit-outages の日付・ハッシュの形が違う');
  if (!d.units || typeof d.units !== 'object' || Array.isArray(d.units)) throw Error('unit-outages の号機の形が違う');
  for (const [fid, units] of Object.entries(d.units)) {
    if (!SAFE.test(fid) || !units || typeof units !== 'object') throw Error('unit-outages の設備 ID の形が違う');
    for (const [name, s] of Object.entries(units)) {
      if (!SAFE.test(name) || !KINDS.includes(s?.kind) || !/^\d{4}-\d{2}-\d{2}$/.test(s.from) || !(s.to === null || /^\d{4}-\d{2}-\d{2}$/.test(s.to)) || Object.keys(s).length !== 3) throw Error('unit-outages の号機・状態の形が違う：' + fid);
    }
  }
  return d;
}
