// 連系線の前回分の残し方（2026-11-01 公開残件3-B、保留42 オーナー承認）。
// Actions では原本（data/raw/occto-tie-<日付>/）がその回に取り直した日しか残らないので、原本から作り直せない日・線は、
// 前回の public/data/tie-flow.json（公開中のサイトから読み戻したもの）の値をそのまま残す。0 や仮の値では埋めない。
// - 作り直した線が0本の日（原本がない日を含む）は、前回のその日をそのまま使う
// - 作り直した日でも、原本の CSV がない線・運用容量（ID の tie-<コード>- / tie-cap-<コード>- のコードで判断）は前回の値を残す
//   （三重東近江線 tie-04・越前嶺南線 tie-06 は推定で CSV のコードがないので、作り直せなかったときは前回分を残す）
const codeOf = id => /^tie-(?:cap-)?(\d{2})-/.exec(id)?.[1];
/** prev：前回のその日（なければ undefined）、built：作り直したその日（線が0本なら null）、hasRaw(コード)：その日の原本の CSV があるか */
export function mergeTieDay(prev, built, hasRaw) {
  if (!built?.actual?.lines?.length) return prev ?? null;
  if (!prev) return built;
  const kept = [];
  const keep = (next, old = []) => { const k = old.filter(o => !next.some(n => n.id === o.id) && !hasRaw(codeOf(o.id))); kept.push(...k); return [...next, ...k]; };
  let lines = keep(built.actual.lines, prev.actual?.lines);
  const capacities = keep(built.capacities, prev.capacities);
  // 越前嶺南線＝関西フェンス−三重東近江線（推定）なので、2線は同じ回の値にそろえる。片方を前回分で残したら、もう片方も前回分にする
  const pair = ['tie-04-三重東近江線', 'tie-06-越前嶺南線'];
  if (pair.some(id => kept.some(k => k.id === id)) && pair.every(id => prev.actual?.lines?.some(l => l.id === id)))
    lines = lines.map(l => pair.includes(l.id) ? prev.actual.lines.find(p => p.id === l.id) : l);
  // 前回の値を1つでも残した日の取得時刻は、前回と今回の古い方（取り直しの順番と、資料の日付の区別のため）
  const retrievedAt = kept.length && prev.retrievedAt && (!built.retrievedAt || prev.retrievedAt < built.retrievedAt) ? prev.retrievedAt : built.retrievedAt;
  return {...built, retrievedAt, actual: {...built.actual, lines}, capacities};
}
/** 作り直す日の候補：原本のある日と前回の日を合わせた新しい順の30日 */
export const tieDates = (rawDates, prevDays) => [...new Set([...rawDates, ...prevDays.map(d => d.date)])].sort().reverse().slice(0, 30);
