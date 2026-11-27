// 現在地ボタンの判定と決まった文（leaflet を使わない部分。tests/locate.test.mjs で検査）。2026-11-26。
// 現在地を受け付ける範囲（日本の概略。朝鮮半島・台湾・ロシア沿海州・サハリンにかからない四角の組み合わせ。国境付近の小さな島などは誤ることがある）
// [南, 西, 北, 東]（緯度・経度）
export const JAPAN_BOXES: readonly (readonly [number, number, number, number])[] = [
  [30.0, 128.4, 34.1, 133.1],   // 九州・五島・壱岐・大隅諸島・四国西部
  [34.05, 129.15, 34.72, 129.5], // 対馬（韓国南岸の島にかからない幅）
  [32.5, 130.8, 35.0, 142.2],   // 中国・四国・近畿・中部・関東の南部・伊豆諸島北部
  [35.0, 131.5, 41.6, 142.2],   // 中国の北部・近畿・中部・関東・東北（鬱陵島にかからない西端）
  [41.3, 139.3, 45.6, 149.0],   // 北海道・北方領土
  [24.0, 122.9, 30.0, 131.4],   // 南西諸島・大東諸島
  [24.0, 138.5, 33.0, 154.0],   // 伊豆諸島南部・小笠原諸島・南鳥島
];
export const LOCATE_ZOOM = 11;
export const ACCURACY_MAX_M = 5000; // 誤差の円の半径の上限（大きすぎる円で地図を覆わない）
export const LOCATE_OPTIONS: PositionOptions = {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000};
export const NOTICE_MS = 5000;

export type LocateResult = 'denied' | 'unavailable' | 'timeout' | 'outside';
export const LOCATE_MESSAGES: Record<LocateResult, string> = {
  denied: '位置情報の利用が許可されていません。ブラウザの設定で許可すると使えます。',
  unavailable: '現在地を取得できませんでした。',
  timeout: '現在地の取得に時間がかかったため中止しました。もう一度お試しください。',
  outside: '現在地が地図の範囲（日本）の外です。',
};

export const inJapan = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  JAPAN_BOXES.some(([s, w, n, e]) => lat >= s && lat <= n && lng >= w && lng <= e);

// GeolocationPositionError の code（1 拒否・2 取得不可・3 時間切れ）を決まった区分にする
export const errorResult = (code: number): LocateResult => code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable';

// 使える環境か（HTTPS などの安全な接続で、ブラウザが位置情報に対応している）
export const canLocate = (w: {isSecureContext?: boolean; navigator?: {geolocation?: unknown}}) =>
  !!w.isSecureContext && !!w.navigator?.geolocation;

