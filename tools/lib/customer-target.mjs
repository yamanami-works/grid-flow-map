// 需要家の対象電圧（docs/RULES.md 3節「対象範囲」と「需要家」の1。2026-10-11 オーナー指示で地域ごとの基幹電圧にそろえた）
// 全国 500/275kV。地域の基幹階級として北海道 187kV、中国・九州 220kV、四国 187kV。
export const CUSTOMER_TARGET_KV = {national: [500, 275], hokkaido: [187], chugoku: [220], kyushu: [220], shikoku: [187]};
export const customerTargetText = '全国500/275kV、北海道187kV、中国・九州220kV、四国187kV';
/** 受電電圧 kv が、設備の地域（areas）の対象か */
export function isCustomerTargetKV(areas, kv) {
  return CUSTOMER_TARGET_KV.national.includes(kv) || (areas ?? []).some(a => (CUSTOMER_TARGET_KV[a] ?? []).includes(kv));
}
