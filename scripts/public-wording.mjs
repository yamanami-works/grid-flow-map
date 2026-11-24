// 公開データの文言の調整（2026-11-22 指示、保留143）：「オーナー」と保留番号を公開物に出さない。
// 対応表 docs/research/public-wording.json の before と完全に一致する文字列だけを after に置き換える。
// 置き換えたあとに「オーナー」や「保留<番号>」が残れば書き出しを止める（新しい文は対応表に足すか、書き出し元の文を直す）。
// 対応表を直したら、東京→東北の順に書き出す（build-tohoku.mjs は連系線・設備を tokyo-trunk.json から写すため。tests/ties.test.ts で確かめる）。
import {readFileSync} from 'node:fs';
export const FORBIDDEN = /オーナー|保留\d/;
let table;
function loadTable() {
  if (!table) {
    const {entries} = JSON.parse(readFileSync(new URL('../docs/research/public-wording.json', import.meta.url), 'utf8'));
    table = new Map(entries.map(e => [e.before, e.after]));
  }
  return table;
}
// 1つの文字列の公開時の文言（テストで、書き出し元の表の文と配信データを比べるときに使う）
export const publicText = (s) => loadTable().get(s) ?? s;
// value の中の文字列をすべて置き換えた新しい値を返す。used には使った before を足す。
export function rewrite(value, map, used) {
  if (typeof value === 'string') { const t = map.get(value); if (t === undefined) return value; used?.add(value); return t; }
  if (Array.isArray(value)) return value.map(v => rewrite(v, map, used));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) { const o = {}; for (const k of Object.keys(value)) o[k] = rewrite(value[k], map, used); return o; }
  return value;
}
export function leftovers(value, path = '$', out = []) {
  if (typeof value === 'string') { if (FORBIDDEN.test(value)) out.push(path + ': ' + value.slice(0, 80)); }
  else if (Array.isArray(value)) value.forEach((v, i) => leftovers(v, path + '[' + i + ']', out));
  else if (value && typeof value === 'object') for (const k of Object.keys(value)) { if (FORBIDDEN.test(k)) out.push(path + ' のキー ' + k); leftovers(value[k], path + '.' + k, out); }
  return out;
}
// 書き出し処理から呼ぶ。file は public/data の名前（対応表の file と同じ。使わなかった行の警告に使う）。
export function publicWording(data, file, map = loadTable()) {
  const used = new Set();
  const result = rewrite(data, map, used);
  const left = leftovers(result);
  if (left.length) throw Error(`${file}: 公開データに「オーナー」または保留番号が残っています（docs/research/public-wording.json に足すか、元の文を直してください）\n` + left.slice(0, 10).join('\n'));
  if (map === table) {
    const unused = JSON.parse(readFileSync(new URL('../docs/research/public-wording.json', import.meta.url), 'utf8')).entries.filter(e => e.file === file && !used.has(e.before));
    if (unused.length) console.warn(`${file}: 対応表の ${unused.length} 行が使われませんでした（元の文が変わった可能性）\n` + unused.slice(0, 3).map(e => '  ' + e.before.slice(0, 60)).join('\n'));
  }
  return result;
}
