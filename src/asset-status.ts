// 線・設備の運用状態（2026-10-03）。
// - データに status があればそれを使う（東京・西日本などは builder で設定）。
// - 東北は2026-10-04の作り直しでデータ側（scripts/build-tohoku.mjs）へ移した。廃止発電所は2026-10-09にデータ側へ移した（下の注記）。
// - 未設定は読み込み時に既定値 '運用中' を入れ、statusConfirmed=false とする（詳細欄は送電線・設備とも「運用中」を出さない：real.ts の statusShown。2026-11-07）。
import type {AssetStatus, AssetStatusInfo, GeoFacility, GeoLine} from './real-domain.ts';
type Override = Pick<AssetStatusInfo,'status'|'plannedStart'|'statusSource'|'statusCheck'>;
// 2026-10-09：廃止発電所と、その電源線の運用状態はデータ側（docs/research/retired-plants.json → scripts/retired-plants.mjs、各 builder）へ移した。
// 根拠（各社の公表・HJKS）もそちらに1本化。この対応表は、データに入れられない個別の上書きが出たときだけ使う。
export const STATUS_OVERRIDES: Record<string, Override> = {};
/** 対応表を当て、未設定には既定値を入れる（同じ物を2回通しても結果は変わらない）。 */
export function applyStatus<T extends GeoLine | GeoFacility>(items: T[]): T[] {
  for (const x of items) {
    const o = STATUS_OVERRIDES[x.id];
    if (o) { Object.assign(x, o); if (o.status) x.statusConfirmed = true; }
    if (x.status && x.statusConfirmed === undefined) x.statusConfirmed = true;
    if (!x.status) { x.status = '運用中'; x.statusConfirmed = false; }
  }
  return items;
}
export function statusLabel(x: AssetStatusInfo): string {
  const s: AssetStatus = x.status ?? '運用中';
  // 廃止発電所の電源線など：線の状態は3区分のまま、運用状態を一次資料で確認できていないもの（2026-10-09）
  if (x.statusCheck && x.statusConfirmed === false) return '運用状態 未確認';
  if (x.statusCheck) return s + '（要確認）';
  return x.statusConfirmed === false ? s + '（未確認）' : s;
}
export const isPlanned = (x: AssetStatusInfo) => x.status === '建設中' || x.status === '計画中';
