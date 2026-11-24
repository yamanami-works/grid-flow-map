import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { lines as allLines, facilities as allFacilities, facilityById, timestamps, kindLabels } from './data';
import { usage, band, colors, direction, defaults, sampleAt, isExtraHighVoltage, validThresholds } from './domain';
import type { TransmissionLine, Facility, Thresholds } from './domain';

const icons: Record<string, string> = {
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9zM2 14l10 6 10-6M2 18l10 6 10-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
};
const icon = (name: string) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.bolt}</svg>`;
const lines = allLines.filter(l => l.voltageKV === 500 || l.voltageKV === 275);
const facilities = allFacilities.filter(f => lines.some(l => l.from === f.id || l.to === f.id));
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const fmt = (value: number | null | undefined) => value == null ? '未公表・不明' : value.toLocaleString('ja-JP');
const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const state = {
  hour: 12, query: '', voltages: new Set(lines.map(l => l.voltageKV)),
  facilityTypes: new Set(['substation', 'switchyard', 'plant']),
  flow: true, animate: true, selected: null as { type: 'line' | 'facility'; id: string } | null,
  tab: 'line' as 'line' | 'facility', thresholds: { ...defaults } as Thresholds,
};
$('#app').innerHTML = `
  <header class="topbar">
    <div class="brand"><div class="brand-mark">${icon('bolt')}</div><div><span class="wordmark">GRID<span class="brand-slash">/</span></span><span class="brand-title">送電線マップ</span></div></div>
    <div class="header-region"><span class="green-dot"></span> 東北エリア <span class="muted">東北６県・新潟</span></div>
    <div class="header-right"><a href="./" class="demo-link">実データに戻る</a><span class="demo-tag">PROTOTYPE · 仮想データ</span><button class="icon-button" id="about" aria-label="データと出典について">${icon('info')}</button></div>
  </header>
  <main class="workspace">
    <aside class="sidebar" aria-label="設備を探す">
      <div class="sidebar-heading"><div class="eyebrow">EXPLORE THE NETWORK</div><h1>電気の道を、見渡す。</h1><p>送電線と電気の流れを地図から探索</p></div>
      <label class="search-box">${icon('search')}<input id="search" type="search" placeholder="送電線・設備名で検索" aria-label="送電線・設備名で検索" /></label>
      <div class="section-title">電圧階級 <span>kV</span></div>
      <div class="voltage-filters">${[500, 275].map(v => `<button class="voltage-chip active" data-voltage="${v}" aria-pressed="true">${v}</button>`).join('')}</div>
      <div class="filter-note">特別高圧（7 kV超）を対象</div>
      <div class="layer-toggles"><label><input id="flow-toggle" type="checkbox" checked/><span>潮流を色と動きで表示</span></label><button class="icon-button small" id="settings" aria-label="使用率の色分け設定">${icon('settings')}</button></div>
      <div class="facility-filters">${Object.entries(kindLabels).map(([key, label]) => `<label><input type="checkbox" data-kind="${key}" checked/>${label}</label>`).join('')}</div>
      <div class="list-tabs" role="tablist" aria-label="設備の種類"><button role="tab" aria-selected="true" id="tab-line">送電線 <span id="line-count"></span></button><button role="tab" aria-selected="false" id="tab-facility">設備 <span id="facility-count"></span></button></div>
      <div class="result-list" id="results"></div>
      <div class="sidebar-footer"><span class="outline-dot"></span> 掲載設備・ルート・数値はすべて仮想です</div>
    </aside>
    <section class="map-area" aria-label="東北送電線地図">
      <div id="map"></div>
      <div class="map-top"><div class="map-label"><span class="green-dot"></span><b>TOHOKU</b><span>東北・新潟</span></div><div class="basemaps" role="group" aria-label="背景地図"><button data-base="map" aria-pressed="true">地図</button><button data-base="photo" aria-pressed="false">航空写真</button><button data-base="gsi" aria-pressed="false">国土地理院</button></div></div>
      <div class="demo-banner">操作デモ <span>架空の系統・潮流を表示中</span></div>
      <div class="map-controls"><button id="zoom-in" class="icon-button" aria-label="地図を拡大">＋</button><button id="zoom-out" class="icon-button" aria-label="地図を縮小">−</button><div class="control-divider"></div><button id="fit" class="icon-button" aria-label="東北の全設備を表示">${icon('target')}</button></div>
      <div class="map-status" id="map-status" role="status" hidden></div>
      <button class="mobile-browse" id="browse">${icon('search')} 設備を探す</button>
      <div class="map-legend"><div class="legend-title">運用容量に対する使用率 <button id="animation-toggle" class="text-button" aria-pressed="true">動き ON</button></div><div class="legend-bands" id="legend"></div><div class="legend-foot"><span>→ 潮流方向</span><span>線幅：電圧階級</span></div></div>
      <div class="time-panel"><button id="play" class="play-button" aria-label="仮想の24時間を再生">${icon('play')}</button><div class="time-meta"><span>仮想シナリオ · 09.20</span><b id="time-label">12:00 <small>JST</small></b></div><div class="time-slider"><input id="hour" type="range" min="0" max="23" step="1" value="12" aria-label="表示時刻（仮想シナリオ）"/><div><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div></div></div>
      <section id="detail" class="detail-panel" aria-label="選択した設備の詳細" hidden></section>
    </section>
  </main>
  <dialog id="info-dialog"><div class="dialog-top"><span class="eyebrow">DATA & SOURCES</span><button class="icon-button" data-close-dialog aria-label="閉じる">${icon('close')}</button></div><h2>データについて</h2><p class="callout">この初期版の送電線・設備・座標・容量・潮流はすべて仮想データです。実際の系統状態を表すものではありません。</p><h3>実データの整備対象</h3><p>東北６県と新潟。公開資料の設備番号と地理的なルートを照合し、実績・予想・対象時刻・出典を区別して取り込みます。リアルタイムデータは未接続です。</p><a href="https://nw.tohoku-epco.co.jp/consignment/system/demand/" target="_blank" rel="noopener noreferrer">東北電力ネットワーク：潮流実績 ↗</a><a href="https://nw.tohoku-epco.co.jp/consignment/system/announcement/" target="_blank" rel="noopener noreferrer">東北電力ネットワーク：予想潮流・運用容量 ↗</a><h3>背景地図</h3><p>「地図」は地理院の淡色地図、「航空写真」は全国最新写真（シームレス）、「国土地理院」は標準地図です。写真の撮影時期は場所によって異なります。</p><a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">出典：国土地理院・地理院タイル一覧 ↗</a><h3>表示の考え方</h3><p>使用率＝潮流の絶対値 ÷ その時刻に適用する運用容量。色の境界はアプリ独自の仮設定で、電力会社の警報基準ではありません。容量や潮流が不明な場合は灰色、潮流0 MWは静止表示します。</p><p>発電設備容量・変圧器容量と送電系統の運用容量は別の値です。未公表の運用容量は推定で埋めません。</p></dialog>
  <dialog id="settings-dialog"><div class="dialog-top"><span class="eyebrow">DISPLAY SETTINGS</span><button class="icon-button" data-close-dialog aria-label="閉じる">${icon('close')}</button></div><h2>使用率の色分け</h2><p>アプリ独自の表示基準です。電力会社の警報基準ではありません。</p><form id="threshold-form"><label class="number-field">緑 → 黄の境界（%）<input type="number" id="threshold-low" min="1" max="99" required value="50"/></label><label class="number-field">黄 → 赤の境界（%）<input type="number" id="threshold-high" min="2" max="100" required value="80"/></label><p id="threshold-error" role="alert"></p><button class="primary-button" type="submit">表示に適用</button></form></dialog>
`;

const map = L.map('map', { zoomControl: false, minZoom: 5, maxZoom: 18, attributionControl: true }).setView([38.85, 140.45], 7);
map.attributionControl.setPrefix(false);
const attribution = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">出典：国土地理院</a>';
const tiles: Record<string, string> = { map: 'pale/{z}/{x}/{y}.png', photo: 'seamlessphoto/{z}/{x}/{y}.jpg', gsi: 'std/{z}/{x}/{y}.png' };
let base: L.TileLayer;
let tileErrors = 0;
function setBase(key: string) {
  if (base) map.removeLayer(base);
  tileErrors = 0; $('#map-status').hidden = true;
  base = L.tileLayer(`https://cyberjapandata.gsi.go.jp/xyz/${tiles[key]}`, { attribution, maxZoom: 18, crossOrigin: true });
  base.on('tileerror', () => { tileErrors++; if (tileErrors >= 3) { $('#map-status').textContent = '背景地図を一部取得できません。通信状態を確認するか、地図を切り替えてください。'; $('#map-status').hidden = false; } });
  base.addTo(map);
  document.querySelectorAll<HTMLButtonElement>('[data-base]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.base === key)));
}
setBase('map');
L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
const network = L.layerGroup().addTo(map);
const flowPane = map.createPane('flowArrows');
flowPane.style.zIndex = '450'; flowPane.style.pointerEvents = 'none'; flowPane.setAttribute('aria-hidden', 'true');
const arrowLayer = L.layerGroup().addTo(map);
let arrowPaths: { line: TransmissionLine; sign: number; color: string }[] = [];
function visibleLines() {
  return lines.filter(l => isExtraHighVoltage(l.voltageKV) && state.voltages.has(l.voltageKV) && (!state.query || [l.name, l.id, facilityById.get(l.from)!.name, facilityById.get(l.to)!.name].some(s => s.toLowerCase().includes(state.query))));
}
function visibleFacilities() {
  const ids = new Set(visibleLines().flatMap(l => [l.from, l.to]));
  return facilities.filter(f => state.facilityTypes.has(f.kind) && (ids.has(f.id) || (state.query && f.name.toLowerCase().includes(state.query))));
}
function sample(line: TransmissionLine) { return sampleAt(line, timestamps[state.hour]); }
function lineColor(line: TransmissionLine) { return state.flow ? colors[band(usage(sample(line)), state.thresholds)] : '#3a667c'; }
function lineWidth(line: TransmissionLine) { return line.voltageKV >= 500 ? 5 : line.voltageKV >= 275 ? 4 : line.voltageKV >= 154 ? 3 : 2; }
function fitAll() { map.fitBounds(L.latLngBounds(facilities.map(f => f.position)), { padding: [60, 85], animate: false }); }
function updateMap() {
  network.clearLayers(); arrowPaths = [];
  visibleLines().forEach(line => {
    const selected = state.selected?.type === 'line' && state.selected.id === line.id;
    const width = lineWidth(line);
    L.polyline(line.path, { color: selected ? '#163c36' : '#ffffff', weight: width + (selected ? 6 : 3), opacity: selected ? 0.6 : 0.9, interactive: false }).addTo(network);
    L.polyline(line.path, { color: lineColor(line), weight: width, opacity: 0.95, dashArray: state.flow && usage(sample(line)) === null ? '7 6' : undefined }).addTo(network);
    L.polyline(line.path, { color: '#000', weight: 22, opacity: 0, bubblingMouseEvents: false }).addTo(network).on('click', () => select('line', line.id, false));
    const sign = direction(sample(line));
    if (state.flow && sign !== null && sign !== 0) arrowPaths.push({ line, sign, color: lineColor(line) });
  });
  visibleFacilities().forEach(f => {
    const symbol = f.kind === 'plant' ? 'ϟ' : f.kind === 'switchyard' ? '◇' : '';
    const node = L.marker(f.position, { icon: L.divIcon({ className: 'facility-marker-wrapper', html: `<span class="facility-marker ${f.kind} ${state.selected?.id === f.id ? 'selected' : ''}">${symbol}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }), title: f.name, alt: f.name, keyboard: true });
    node.bindTooltip(esc(f.name), { direction: 'top', offset: [0, -12], className: 'facility-tooltip' }).on('click', () => select('facility', f.id, false)).addTo(network);
    node.getElement()?.setAttribute('aria-label', `${f.name}（${kindLabels[f.kind]}）`);
  });
  drawArrows();
}
// Arrows are interpolated along projected segments; negative MW reverses the path.
// Fixed-speed motion indicates direction only, not a quantitative flow velocity.
function drawArrows() {
  arrowLayer.clearLayers();
  const phase = state.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? (performance.now() / 90) % 65 : 30;
  for (const item of arrowPaths) {
    const points = (item.sign > 0 ? item.line.path : [...item.line.path].reverse()).map(p => map.latLngToLayerPoint(p));
    const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    const total = lengths.reduce((a, b) => a + b, 0);
    for (let distance = phase; distance < total; distance += 65) {
      let remaining = distance, segment = 0;
      while (segment < lengths.length - 1 && remaining > lengths[segment]) remaining -= lengths[segment++];
      const start = points[segment], end = points[segment + 1], length = lengths[segment];
      if (!length) continue;
      const fraction = remaining / length;
      const p = L.point(start.x + (end.x - start.x) * fraction, start.y + (end.y - start.y) * fraction);
      if (!map.getBounds().pad(0.1).contains(map.layerPointToLatLng(p))) continue;
      const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
      L.marker(map.layerPointToLatLng(p), { pane: 'flowArrows', interactive: false, keyboard: false, icon: L.divIcon({ className: 'flow-arrow-wrap', html: `<span class="flow-arrow" style="transform:rotate(${angle}deg);color:${item.color}">›</span>`, iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(arrowLayer);
    }
  }
}
map.on('zoomend moveend', drawArrows);
setInterval(() => { if (state.flow && state.animate && !document.hidden) drawArrows(); }, 100);

function renderList() {
  const shown = visibleLines(), nodes = visibleFacilities();
  $('#line-count').textContent = String(shown.length); $('#facility-count').textContent = String(nodes.length);
  let html = state.tab === 'line' ? shown.map(line => {
    const percent = usage(sample(line));
    return `<button class="result-item ${state.selected?.id === line.id ? 'selected' : ''}" data-select-line="${line.id}"><span class="line-swatch" style="--line-color:${lineColor(line)}"></span><span class="result-main"><b>${esc(line.name)}</b><small>${line.voltageKV} kV <span>·</span> ${line.id}</small></span><span class="result-value" style="color:${lineColor(line)}">${percent === null ? '—' : `${percent.toFixed(0)}<small>%</small>`}</span></button>`;
  }).join('') : nodes.map(f => `<button class="result-item ${state.selected?.id === f.id ? 'selected' : ''}" data-select-facility="${f.id}"><span class="list-node ${f.kind}">${f.kind === 'plant' ? 'ϟ' : f.kind === 'switchyard' ? '◇' : '▪'}</span><span class="result-main"><b>${esc(f.name)}</b><small>${kindLabels[f.kind]}</small></span><span class="muted">↗</span></button>`).join('');
  if (!html) html = '<div class="empty-state">該当する設備がありません。<br/>検索条件やフィルターを変更してください。</div>';
  $('#results').innerHTML = html;
  document.querySelectorAll<HTMLButtonElement>('[data-select-line]').forEach(b => b.onclick = () => select('line', b.dataset.selectLine!));
  document.querySelectorAll<HTMLButtonElement>('[data-select-facility]').forEach(b => b.onclick = () => select('facility', b.dataset.selectFacility!));
}
function select(type: 'line' | 'facility', id: string, focus = true) {
  state.selected = { type, id };
  $('.sidebar').classList.remove('mobile-open');
  $('#browse').innerHTML = `${icon('search')} 設備を探す`;
  if (focus) {
    if (type === 'line') map.fitBounds(L.latLngBounds(lines.find(l => l.id === id)!.path), { paddingTopLeft: [40, 90], paddingBottomRight: [matchMedia('(min-width: 1100px)').matches ? 360 : 40, matchMedia('(max-width: 760px)').matches ? 300 : 160], maxZoom: 9 });
    else map.setView(facilityById.get(id)!.position, 9);
  }
  renderList(); updateMap(); renderDetail();
}
function facilityLink(f: Facility) { return `<button class="endpoint" data-node="${f.id}"><span class="endpoint-dot ${f.kind}"></span><span><small>${kindLabels[f.kind]}</small><b>${esc(f.name)}</b></span><span class="endpoint-arrow">↗</span></button>`; }
function renderDetail() {
  const panel = $('#detail');
  if (!state.selected) { panel.hidden = true; return; }
  panel.hidden = false;
  const close = `<button class="icon-button" id="close-detail" aria-label="設備詳細を閉じる">${icon('close')}</button>`;
  if (state.selected.type === 'line') {
    const line = lines.find(l => l.id === state.selected!.id)!;
    const s = sample(line), percent = usage(s), sign = direction(s);
    const from = facilityById.get(line.from)!, to = facilityById.get(line.to)!;
    const start = sign === -1 ? to : from, end = sign === -1 ? from : to;
    panel.innerHTML = `<div class="detail-top"><span class="eyebrow">TRANSMISSION LINE · ${line.id}</span>${close}</div><h2>${esc(line.name)}</h2><div class="detail-tags"><span>${line.voltageKV} kV</span><span>仮想データ</span></div><div class="usage-card"><div>運用容量に対する使用率<strong style="color:${lineColor(line)}">${percent === null ? '—' : percent.toFixed(1)}<small>${percent === null ? '' : '%'}</small></strong></div><div class="usage-track"><span style="width:${Math.min(100, percent ?? 0)}%;background:${lineColor(line)}"></span></div><div class="usage-numbers"><span>潮流 <b>${s?.mw == null ? '不明' : `${fmt(Math.abs(s.mw))} MW`}</b></span><span>運用容量 <b>${s?.capacityMW == null ? '不明' : `${fmt(s.capacityMW)} MW`}</b></span></div>${percent !== null && percent > 100 ? '<p class="over-capacity">運用容量を超える仮想シナリオです</p>' : ''}</div><div class="detail-section-title">${sign === null ? '端点（潮流方向は不明）' : sign === 0 ? '端点（潮流 0 MW・流れなし）' : '潮流方向'}</div><div class="endpoints">${facilityLink(start)}<div class="endpoint-connector">${sign === 0 || sign === null ? '│' : '↓'}</div>${facilityLink(end)}</div><div class="detail-note">${sign === -1 ? '逆方向：終点 → 始点' : '登録方向：始点 → 終点'}<br/>対象：2026/09/20 ${String(state.hour).padStart(2, '0')}:00 JST<br/>出典：操作確認用の仮想シナリオ<br/>ルート：仮想座標・実際の線路位置ではありません</div>`;
  } else {
    const f = facilityById.get(state.selected.id)!;
    const connected = lines.filter(l => l.from === f.id || l.to === f.id);
    panel.innerHTML = `<div class="detail-top"><span class="eyebrow">NETWORK FACILITY</span>${close}</div><h2>${esc(f.name)}</h2><div class="detail-tags"><span>${kindLabels[f.kind]}</span><span>仮想データ</span></div><div class="facility-capacity"><span>運用容量</span><strong>${fmt(f.operatingCapacityMW)}${f.operatingCapacityMW === null ? '' : ' <small>MW</small>'}</strong></div>${f.ratedOutputMW ? `<p class="rated-capacity">参考：発電設備容量 ${fmt(f.ratedOutputMW)} MW<br/><small>運用容量とは異なる指標です。</small></p>` : ''}<div class="detail-section-title">接続する送電線 <span>${connected.length}</span></div>${connected.map(l => `<button class="connected-line" data-connected="${l.id}">${esc(l.name)}<span>${l.voltageKV} kV ↗</span></button>`).join('')}<div class="detail-note">出典：操作確認用の仮想データ<br/>位置・名称・容量は実在設備を示しません。<br/>未公表の運用容量は推定で補完しません。</div>`;
  }
  $('#close-detail').onclick = () => { state.selected = null; renderDetail(); renderList(); updateMap(); };
  panel.querySelectorAll<HTMLButtonElement>('[data-node]').forEach(b => b.onclick = () => {
    const f = facilityById.get(b.dataset.node!)!; state.facilityTypes.add(f.kind);
    document.querySelector<HTMLInputElement>(`[data-kind="${f.kind}"]`)!.checked = true;
    select('facility', f.id, false);
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-connected]').forEach(b => b.onclick = () => {
    const l = lines.find(l => l.id === b.dataset.connected)!;
    state.voltages.add(l.voltageKV); state.query = ''; $<HTMLInputElement>('#search').value = '';
    const chip = document.querySelector<HTMLButtonElement>(`[data-voltage="${l.voltageKV}"]`)!; chip.classList.add('active'); chip.setAttribute('aria-pressed', 'true');
    select('line', l.id);
  });
}
function renderLegend() {
  const { low, high } = state.thresholds;
  $('#legend').innerHTML = state.flow ? `<span><i style="background:${colors.low}"></i>${low}%未満</span><span><i style="background:${colors.medium}"></i>${low}–${high}%未満</span><span><i style="background:${colors.high}"></i>${high}%以上</span><span><i style="background:${colors.unknown}"></i>不明</span>` : '<span>潮流表示 OFF · 線幅で電圧階級を表示</span>';
}
function refresh() {
  if (state.selected && !(state.selected.type === 'line' ? visibleLines() : visibleFacilities()).some(x => x.id === state.selected!.id)) state.selected = null;
  renderList(); updateMap(); renderDetail(); renderLegend();
}
$('#search').addEventListener('input', e => { state.query = (e.target as HTMLInputElement).value.trim().toLowerCase(); refresh(); });
document.querySelectorAll<HTMLButtonElement>('[data-voltage]').forEach(b => b.onclick = () => { const v = Number(b.dataset.voltage); state.voltages.has(v) ? state.voltages.delete(v) : state.voltages.add(v); b.classList.toggle('active', state.voltages.has(v)); b.setAttribute('aria-pressed', String(state.voltages.has(v))); refresh(); });
document.querySelectorAll<HTMLInputElement>('[data-kind]').forEach(c => c.onchange = () => { c.checked ? state.facilityTypes.add(c.dataset.kind!) : state.facilityTypes.delete(c.dataset.kind!); refresh(); });
$('#flow-toggle').onchange = e => { state.flow = (e.target as HTMLInputElement).checked; refresh(); };
for (const tab of ['line', 'facility'] as const) $(`#tab-${tab}`).onclick = () => { state.tab = tab; $('#tab-line').setAttribute('aria-selected', String(tab === 'line')); $('#tab-facility').setAttribute('aria-selected', String(tab === 'facility')); renderList(); };
document.querySelectorAll<HTMLButtonElement>('[data-base]').forEach(b => b.onclick = () => setBase(b.dataset.base!));
$('#zoom-in').onclick = () => map.zoomIn(); $('#zoom-out').onclick = () => map.zoomOut(); $('#fit').onclick = fitAll;
$('#animation-toggle').onclick = () => { state.animate = !state.animate; $('#animation-toggle').textContent = `動き ${state.animate ? 'ON' : 'OFF'}`; $('#animation-toggle').setAttribute('aria-pressed', String(state.animate)); drawArrows(); };
function setHour(hour: number) { state.hour = hour; $('#time-label').innerHTML = `${String(hour).padStart(2, '0')}:00 <small>JST</small>`; ($<HTMLInputElement>('#hour')).value = String(hour); refresh(); }
$('#hour').addEventListener('input', e => setHour(Number((e.target as HTMLInputElement).value)));
let playback: ReturnType<typeof setInterval> | null = null;
function stopPlayback() { if (playback) clearInterval(playback); playback = null; $('#play').innerHTML = icon('play'); $('#play').setAttribute('aria-label', '仮想の24時間を再生'); }
$('#play').onclick = () => {
  if (playback) stopPlayback();
  else { playback = setInterval(() => setHour((state.hour + 1) % 24), 1100); $('#play').innerHTML = icon('pause'); $('#play').setAttribute('aria-label', '再生を一時停止'); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
$('#about').onclick = () => $<HTMLDialogElement>('#info-dialog').showModal();
$('#settings').onclick = () => $<HTMLDialogElement>('#settings-dialog').showModal();
document.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach(b => b.onclick = () => b.closest('dialog')!.close());
$('#threshold-form').onsubmit = e => {
  e.preventDefault();
  const thresholds = { low: Number($<HTMLInputElement>('#threshold-low').value), high: Number($<HTMLInputElement>('#threshold-high').value) };
  if (!validThresholds(thresholds)) { $('#threshold-error').textContent = '0 < 緑・黄の境界 < 黄・赤の境界 ≤ 100 となる値を入力してください。'; return; }
  state.thresholds = thresholds; $('#threshold-error').textContent = ''; $<HTMLDialogElement>('#settings-dialog').close(); refresh();
};
$('#browse').onclick = () => { const open = $('.sidebar').classList.toggle('mobile-open'); $('#browse').innerHTML = `${icon(open ? 'close' : 'search')} ${open ? '地図に戻る' : '設備を探す'}`; };
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { state.selected = null; $('.sidebar').classList.remove('mobile-open'); $('#browse').innerHTML = `${icon('search')} 設備を探す`; refresh(); } });
new ResizeObserver(() => map.invalidateSize()).observe($('#map'));
fitAll(); refresh();
