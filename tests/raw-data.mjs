// 公開リポジトリの Actions で、公開リポジトリに入れないもの（原本 data/raw など、データ準備の道具 tools/prep）を使うテストだけを飛ばす（2026-11-01 保留44・45 オーナー承認）。
// 飛ばすのは、目印 GRID_PUBLIC_CHECKOUT=1 が Actions（GITHUB_ACTIONS=true）で付いていて、かつファイルがないときだけ。
// 手元では目印を付けないので、ファイルがなければ今までどおり失敗する（全テストは push の前に手元で必ず通す）。
import {existsSync} from 'node:fs';
export const publicCheckout = () => process.env.GRID_PUBLIC_CHECKOUT === '1' && process.env.GITHUB_ACTIONS === 'true';
const skipIfAbsent = (label, files) => {
  const missing = files.filter(f => !existsSync(f));
  return publicCheckout() && missing.length ? label + '（公開リポジトリ）：' + missing.join('、') : false;
};
/** 飛ばすときは理由の文字列、飛ばさないときは false（node:test の skip にそのまま渡す） */
export const rawSkip = (...files) => skipIfAbsent('原本なし', files);
/** tools/prep（公開リポジトリに入れないデータ準備の道具）を使うテスト用 */
export const prepSkip = (...files) => skipIfAbsent('データ準備の道具なし', files);
/** 公開リポジトリに入れないと決めたファイル（data/validation/miyagi-ishinomaki.json など。保留49・95）を使うテスト用 */
export const excludedSkip = (...files) => skipIfAbsent('公開に入れないファイルなし', files);
