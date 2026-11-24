// 連系線潮流実績の CSV（OCCTO CA01S070、5分値）を読む（2026-11-02 セキュリティレビュー E）。取得（fetch-occto-tie.mjs）の保存前と、tie-flow.mjs の両方で使う。
// 見出しが既知の16列と全文一致し（列の並びが変わって別の列を潮流実績として読まないように）、288行（00:05〜24:00 の5分刻み）、各行が16列、日付列が対象日、
// 時刻列がその並びどおりであることを確かめる（行の欠け・ずれで値が別の時刻に入らないように）。
// 値は前後の空白を除いて空なら欠測（null。0 にしない、原則3）、数字の形なら数値、それ以外は失敗（形式の変化として止める）。エラー文に CSV の中身は入れない。
export const TIE_HEADER = '連系線,対象日付,対象時刻,運用容量(順方向),運用容量(逆方向),広域調整枠(順方向),広域調整枠(逆方向),マージン(順方向),マージン(逆方向),空容量(順方向),空容量(逆方向),計画潮流(順方向),計画潮流(逆方向),潮流実績,運用容量拡大分(順方向),運用容量拡大分(逆方向)';
export const TIE_ROWS = 288;
const COLUMNS = TIE_HEADER.split(',').length, NUMBER = /^-?\d+(?:\.\d+)?$/;

/** i 行目（0 から）の時刻：00:05 … 24:00 */
export const tieTime = i => { const m = (i + 1) * 5; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

/** CSV の文字列を読み、各行の {time, capF, capR, mw} を返す。date は YYYY-MM-DD、label はエラー文に付ける名前 */
export function parseTieCsv(text, date, label = '') {
  const lines = text.trim().split(/\r?\n/), at = label ? ' (' + label + ')' : '';
  if (lines[0] !== TIE_HEADER) throw Error('tie CSV: header changed' + at);
  const rows = lines.slice(1).map(l => l.split(','));
  if (rows.length !== TIE_ROWS) throw Error(`tie CSV: ${rows.length} rows, want ${TIE_ROWS}` + at);
  const day = date.replaceAll('-', '/');
  const num = (v, i, k) => { const s = v.trim(); if (s === '') return null; if (!NUMBER.test(s)) throw Error(`tie CSV: not a number at row ${i + 1}, column ${k + 1}` + at); return Number(s); };
  return rows.map((r, i) => {
    if (r.length !== COLUMNS) throw Error(`tie CSV: ${r.length} columns at row ${i + 1}, want ${COLUMNS}` + at);
    if (r[1] !== day || r[2] !== tieTime(i)) throw Error(`tie CSV: date or time out of order at row ${i + 1}` + at);
    return {time: r[2], capF: num(r[3], i, 3), capR: num(r[4], i, 4), mw: num(r[13], i, 13)};
  });
}
