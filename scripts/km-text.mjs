// 距離の書き方（2026-11-04 オーナー指示 保留74・75）：小数1桁で 0.0 になる短い長さを「約0.0km」と書かない。
// kmText：0.05km 未満（0 より大きい）は「0.1km未満」、それ以外は「約X.Xkm」。
// unnamedText：名前のない線分の長さ。0m は「名称なしの線分なし」、それ以外は「うち名称なし」＋kmText。
export const kmText = m => { const km = (m / 1000).toFixed(1); return km === '0.0' ? '0.1km未満' : `約${km}km`; };
export const unnamedText = m => m === 0 ? '名称なしの線分なし' : `うち名称なし${kmText(m)}`;
