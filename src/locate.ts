// 現在地ボタン（2026-11-26。規則は docs/RULES.md 5節「個人情報」）。
// 押したときだけ端末から位置を1回取得し、地図の移動と現在地の点の表示だけに使う。
// 座標は保存（ブラウザの保存領域・URL）も送信もしない。ブラウザのエラー文は出さず、決まった文だけを出す。
import L from 'leaflet';
import {inJapan, errorResult, canLocate, LOCATE_MESSAGES, LOCATE_OPTIONS, LOCATE_ZOOM, ACCURACY_MAX_M, NOTICE_MS, type LocateResult} from './locate-core.ts';

export function bindLocate(map: L.Map, button: HTMLButtonElement, notice: HTMLElement) {
  if (!canLocate(window)) { button.hidden = true; return; }
  button.hidden = false;
  let busy = false, timer = 0;
  let marks: L.Layer[] = [];
  const show = (r: LocateResult) => {
    notice.textContent = LOCATE_MESSAGES[r]; notice.hidden = false;
    clearTimeout(timer); timer = window.setTimeout(() => { notice.hidden = true; notice.textContent = ''; }, NOTICE_MS);
  };
  const done = () => { busy = false; button.removeAttribute('aria-busy'); };
  button.onclick = () => {
    if (busy) return;
    busy = true; button.setAttribute('aria-busy', 'true');
    navigator.geolocation.getCurrentPosition(pos => {
      done();
      const {latitude: lat, longitude: lng, accuracy} = pos.coords;
      if (!inJapan(lat, lng)) { show('outside'); return; }
      notice.hidden = true; clearTimeout(timer);
      for (const m of marks) map.removeLayer(m);
      const at: L.LatLngTuple = [lat, lng];
      marks = [
        L.circle(at, {radius: Math.min(Number.isFinite(accuracy) ? accuracy : 0, ACCURACY_MAX_M), interactive: false, color: '#2b7de9', weight: 1, opacity: .5, fillColor: '#2b7de9', fillOpacity: .12}),
        L.circleMarker(at, {radius: 7, interactive: false, color: '#fff', weight: 2, fillColor: '#2b7de9', fillOpacity: 1}),
      ];
      for (const m of marks) m.addTo(map);
      map.setView(at, Math.max(map.getZoom(), LOCATE_ZOOM));
    }, err => { done(); show(errorResult(err.code)); }, LOCATE_OPTIONS);
  };
}
