// 関開閉所（OSM way 161946848）の属性。関西のデータ（丸山幹線の端）と中部のデータ（御母衣幹線・関分岐の端、2026-11-16 保留121c）に同じ設備IDで載るため、
// 両方のビルド（scripts/build-kansai.mjs・scripts/build-chubu.mjs）が applyTiers の後にこの属性の組にそろえる（2026-11-16 変更レビューの要修正2）
export const SEKI_ID = 'osm-way-161946848';
const MAP_NOTE = '中部電力パワーグリッド 系統空容量・予想潮流マッピング（2026-09-29取得、照合だけに使用）';
export function sekiAttributes() {
  return [
    {label: '要注意（C区分）', value: '持ち主と、どの線がどの母線につながるかは一次資料で未確認。位置は OSM の区画と国土地理院の地図注記で確認した。'},
    {label: 'OSM登録', value: '名称：関開閉所、電圧：275kV'},
    {label: '位置の確認', value: '国土地理院の地図注記「関開閉所」（OSM の区画の中心から約20m、2026-11-16取得）。'},
    {label: '名称の根拠', value: `${MAP_NOTE}の「関開閉所」。`},
    {label: '持ち主', value: '未確認。J-POWER送変電の送変電事業地図（2026-10-04確認）では御母衣幹線は御母衣発電所から名古屋変電所へ向かい、関開閉所は描かれていない。'},
    {label: '他の地域のデータ', value: '関西のデータ（丸山幹線の端）と中部のデータ（御母衣幹線・関分岐の端）に同じ設備として載る。'},
    {label: '出典', value: `${MAP_NOTE}。国土地理院の地図注記。地理はOSM（app/data/raw の各地域の取得、2026-09-30〜10-04取得）。`},
  ];
}
export function applySekiAttributes(facilities) {
  const f = facilities.find(x => x.id === SEKI_ID);
  if (!f || f.name !== '関開閉所') throw Error('関開閉所：設備がない');
  f.attributes = sekiAttributes();
}
