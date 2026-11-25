// 発電所の号機の運転状態（HJKS「停止情報一覧」、scripts/fetch-hjks-outages.mjs が1日1回取得。2026-11-24）。
// 出すのは区分（計画停止・計画外停止・出力低下）と停止日・復旧予定日だけ。登録のない号機には何も書かない（運転中とも書かない。2026-11-25）。
// 原子力は原子力規制委員会の運転状態（src/nuclear-status.ts）を使い、ここでは扱わない（データにも入れていない）。
export type UnitOutage = {kind: '計画停止' | '計画外停止' | '出力低下'; from: string; to: string | null};
export type UnitOutages = {schemaVersion: 1; source: {name: string; url: string}; latestUpdate: string; retrievedAt: string; sha256: string; units: Record<string, Record<string, UnitOutage>>};
/** 取得が古い（2日より前）ときは運転状態を出さない（原子力と同じ） */
export const OUTAGE_STALE_DAYS = 2;
export function outagesStale(d: UnitOutages, now: Date): boolean {
  const t = Date.parse(d.retrievedAt);
  return !Number.isFinite(t) || now.getTime() - t > OUTAGE_STALE_DAYS * 86400000;
}
const ymd = (s: string) => s.replace(/-/g, '/');
/** 号機の表示。古い・データがない・登録がないときは null */
export function unitOutageView(d: UnitOutages | null, facilityId: string, hjksUnit: string, now: Date): {text: string; tone: 'stop' | 'unplanned' | 'low'} | null {
  if (!d || outagesStale(d, now)) return null;
  const o = d.units[facilityId]?.[hjksUnit];
  if (!o) return null;
  // 取得後に復旧予定日を過ぎた登録（取得から最大2日は表示に使う）は、停止中とは言えないので出さない
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(now);
  if (o.to && o.to < today) return null;
  const span = ymd(o.from) + '〜' + (o.to ? ' 復旧予定' + ymd(o.to) : ' 復旧予定未定');
  return {text: o.kind + '中 ' + span, tone: o.kind === '計画外停止' ? 'unplanned' : o.kind === '出力低下' ? 'low' : 'stop'};
}
