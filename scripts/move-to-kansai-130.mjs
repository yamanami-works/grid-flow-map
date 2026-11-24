// 保留130-6（2026-11-18 オーナー指示「下記は関西送配電の資料…に記載のある系統なので関西のタブで表示するようにして」、回答「3は関西だけ」）：
// 関西電力送配電の154kV以上の系統図・送電線一覧にある線を、北陸・中部のデータから関西のデータへ移す（ID は変えない）。
// 北陸・中部の builder が書き出しの直前に呼び、移す線・設備を docs/research/kansai-130-from-<地域>.json に書き出して自分のデータから外す。
// 関西の builder（scripts/kansai-130.mjs）がそのファイルを読んで足す。北陸・中部の builder を先に実行する。
// 設備は、移す線だけがつながるもの（move）は移し、ほかの線もつながるもの（copy）は両方のデータに同じ ID で載せる（関開閉所と同じ扱い）。
import { writeFileSync } from 'node:fs';
const SPEC = {
  // 新成出水力発電所の電源線（推定）→ 新北陸幹線（成出～城端）（一覧 No.213、名前は scripts/kansai-130.mjs で直す）
  hokuriku: { lines: ['plant-hokuriku-275-1028287103'], move: ['osm-way-440225776'], copy: ['osm-way-315757225'] },
  // 御母衣幹線 → 御母衣北幹線（一覧 No.203、名前は scripts/kansai-130.mjs で直す）。関開閉所は関西のデータに載っている
  chubu: { lines: ['jpower-275-way-440218167'], move: ['osm-way-440218167'], copy: [] },
};
export const movedFile = (region) => `docs/research/kansai-130-from-${region}.json`;
export function moveToKansai130(region, lines, facilities) {
  const s = SPEC[region]; if (!s) throw Error('130-6：地域 ' + region);
  const out = { note: `生成ファイル（scripts/move-to-kansai-130.mjs、${region} の builder が書き出す）。保留130-6：関西のデータへ移す線・設備。手で編集しない。`, lines: [], facilities: [] };
  for (const id of s.lines) { const i = lines.findIndex((x) => x.id === id); if (i < 0) throw Error('130-6：線がない ' + id); out.lines.push(lines.splice(i, 1)[0]); }
  for (const id of s.move) {
    if (lines.some((l) => l.connections.some((c) => c.facilities.some((f) => f.id === id)))) throw Error('130-6：ほかの線がつながる設備は移さない ' + id);
    const i = facilities.findIndex((x) => x.id === id); if (i < 0) throw Error('130-6：設備がない ' + id); out.facilities.push(facilities.splice(i, 1)[0]);
  }
  for (const id of s.copy) { const f = facilities.find((x) => x.id === id); if (!f) throw Error('130-6：設備がない ' + id); out.facilities.push(structuredClone(f)); }
  for (const l of out.lines) for (const c of l.connections) for (const f of c.facilities) if (!out.facilities.some((x) => x.id === f.id) && !['osm-way-161946848'].includes(f.id)) throw Error('130-6：移す線の端の設備が足りない ' + f.id);
  writeFileSync(movedFile(region), JSON.stringify(out, null, 1) + '\n');
}
