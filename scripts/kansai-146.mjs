// ---- 保留146（2026-11-22 指示「姫路第一発電所の開閉所を記載してそこから国土地理院の送電線記号をなぞって飾磨港変電所まで送電線を描いて」、回答「すべて推奨で」）。
// build-kansai.mjs から applyKansai136 のあとに呼ぶ。提案と図：../reports/approvals/evidence-20261122-p146/proposal.txt、../reports/figures/p146-decision.html（リポジトリ外）。
// 一次資料：関西電力送配電 空容量一覧（154kV以上・送電線）No.35 飾磨港線（275kV、2回線、AI→開閉所）、No.36 送電線（開閉所→AM）。同（変電所、2026年11月17日更新）AI 飾磨港。
// 開閉所の名前・位置は一覧にない。姫路第一発電所の構内の OSM の名前のない変電所の区画（way 798162352、関西電力送配電・275kV）を「開閉所」に当てたのは推定。
// 経路は国土地理院 ベクトルタイル（試験公開、experimental_bvmap、送電線 ftCode 8202、z15、2026-11-19取得、data/raw/gsi-bvmap/15）の記号だけ。No.36 の始点は変えない（別件）。
import {readFileSync} from 'node:fs';
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const KS146 = '関西電力送配電 空容量一覧（154kV以上・送電線）';
const KS_SUB146 = '関西電力送配電 空容量一覧（154kV以上・変電所、2026年11月17日更新）';
const WHY146 = '2026-11-22 本アプリの判断（姫路第一発電所の開閉所を記載し、国土地理院の送電線記号をなぞって飾磨港変電所まで描く）';
const GSI146 = '国土地理院 ベクトルタイル（試験公開、送電線 ftCode 8202、z15、2026-11-19取得）';
// 地理院の記号の点（開閉所の区画の中→構内の北東の分岐点→北西へ→飾磨港変電所の区画の中）
const R35 = [[34.773393, 134.669509], [34.774272, 134.67041], [34.775002, 134.671167], [34.77533, 134.671504], [34.775894, 134.672087], [34.776354, 134.67151], [34.776861, 134.670866], [34.777147, 134.67041], [34.777716, 134.669496], [34.778044, 134.66897], [34.782558, 134.666666], [34.783296, 134.666288], [34.783333, 134.666306], [34.784047, 134.666666], [34.785232, 134.667267], [34.785629, 134.667639]];
const kmOf = (p) => p.slice(1).reduce((s, q, i) => s + 6371 * Math.hypot((q[1] - p[i][1]) * Math.PI / 180 * Math.cos(p[i][0] * Math.PI / 180), (q[0] - p[i][0]) * Math.PI / 180), 0);
const inside = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [yi, xi] = ring[i], [yj, xj] = ring[j]; if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi) c = !c; } return c; };
const set = (x, label, value) => { const a = x.attributes.find((y) => y.label === label); if (!a) throw Error('146：属性がない ' + label); a.value = value; };
export function applyKansai146(lines, facilities) {
  if (facilities.some((x) => x.id === 'osm-way-798162352') || lines.some((l) => l.id === 'kansai-275-飾磨港線')) throw Error('146：登録済み');
  const Fc = (id, name) => { const f = facilities.find((x) => x.id === id); if (!f || f.name !== name) throw Error('146：設備が想定と違う ' + id); return f; };
  const sk = Fc('osm-way-798162366', '飾磨港変電所'); Fc('osm-way-364849743', '姫路第一発電所');
  const n36 = lines.find((l) => l.id === 'kansai-plant-275-way-364849743');
  if (!n36 || n36.name !== '送電線（No.36）（推定）') throw Error('146：No.36 の線が想定と違う');
  const F = read('data/raw/kansai-osm/facilities.json').elements;
  const area = (id) => F.find((x) => x.type === 'way' && x.id === id);
  const eSw = area(798162352), eSk = area(798162366);
  const t = eSw?.tags ?? {};
  if (!eSw || t.power !== 'substation' || t.voltage !== '275000' || t.operator !== '関西電力送配電' || t.name) throw Error('146：OSM の区画 798162352 が想定と違う');
  const ring = (e) => e.geometry.map((g) => [g.lat, g.lon]);
  if (!inside(R35[0], ring(eSw)) || !inside(R35.at(-1), ring(eSk))) throw Error('146：線の端が区画の中にない');
  const r = ring(eSw), position = [r.reduce((s, q) => s + q[0], 0) / r.length, r.reduce((s, q) => s + q[1], 0) / r.length].map((v) => +v.toFixed(7));
  // ---- 設備：姫路第一発電所の開閉所（推定）
  const sw = { id: 'osm-way-798162352', assetId: 'kansai-fac-way-798162352', name: '姫路第一発電所の開閉所（推定）', kind: 'switchyard', position, voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/798162352',
    attributes: [
      { label: '要注意（位置推定）', value: '位置は OSM の名前のない変電所の区画を開閉所とみなしたもので、一次資料で位置を確認していない。一覧の「開閉所」をこの区画に当てたのも推定。開閉所の名前・位置は一次資料にない。' },
      { label: '位置の根拠', value: `OSM の名前のない変電所の区画（way 798162352、屋外、事業者 関西電力送配電、275kV、2026-10-02時点）。姫路第一発電所の区画の中の南東寄り。${GSI146}の送電線記号がこの区画から出る。` },
      { label: '名称の根拠', value: `${KS146}の No.35 飾磨港線（AI→開閉所）・No.36 送電線（開閉所→AM）の「開閉所」を、この区画に当てた推測（${WHY146}）。名前は本アプリで付けた。` },
      { label: '系統との接続', value: '飾磨港線（推定、No.35）で飾磨港変電所へ。No.36 は描いた線の始点（姫路第一発電所の区画の端の点）を変えていないので、地図ではこの開閉所につながっていない（OSM の線 way 1301079225 がその点とこの区画を結ぶ）。' },
      { label: '出典', value: `${KS146}（data/raw/tso-lines、2026-10-04取得）。位置は OSM（data/raw/kansai-osm、2026-10-02時点）と${GSI146}。${WHY146}。` }] };
  facilities.push(sw);
  // ---- 線：飾磨港線（推定）（No.35）
  lines.push({ id: 'kansai-275-飾磨港線', assetId: 'kansai-275-飾磨港線', name: '飾磨港線（推定）', named: true, voltageKV: 275, currentType: 'ac', osmIds: [-14601], sourceOsmIds: [], paths: [R35],
    tracedParts: [{ osmId: -14601, basis: '国土地理院の送電線記号' }],
    connections: [{ node: null, position: R35[0], status: 'facility-area', facilities: [{ id: sw.id, name: sw.name }], neighborWays: [] },
      { node: null, position: R35.at(-1), status: 'facility-area', facilities: [{ id: sk.id, name: sk.name }], neighborWays: [] }],
    referenceReview: { status: 'partial', endpoints: '姫路第一発電所の開閉所（推定）―飾磨港変電所' },
    attributes: [
      { label: '要注意（C区分）', value: '一次資料で開閉所側の端点を確定できず、国土地理院の送電線記号だけで描いた参考表示。' }, { label: '照合区分', value: 'C区分' },
      { label: '照合の根拠', value: `一覧の行（No.35 飾磨港線 AI→開閉所）はあるが、端（開閉所）の名前・位置は公表されていない。開閉所を姫路第一発電所の構内の区画に当てたのは推定（${WHY146}）。` },
      { label: '要注意（C区分・推定）', value: '公表資料で開閉所の名前・位置が伏せられているため、国土地理院の記号から推定して描いた参考表示。実際の線と違う可能性がある。' },
      { label: '公表の行', value: `${KS146} No.35：飾磨港線（275kV）、2回線、AI→開閉所` },
      { label: '名称の確認', value: `${KS_SUB146}に「AI　飾磨港（275/77kV）」。` },
      { label: '端点の根拠', value: '端点の対応付けは推定：開閉所（推定）の区画の中から国土地理院の記号を、構内の北東の分岐点（34.77589,134.67209）を通って北西へたどり、飾磨港変電所の区画の中で終わる。開閉所から分岐点までの記号は No.35 と No.36 の両方が通る（まとめて描いた）可能性がある（推測）。' },
      { label: '区分', value: '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。' },
      { label: '地理参照', value: `国土地理院の送電線記号だけ（約${kmOf(R35).toFixed(2)}km）。構内の分岐点より北西（分岐点→飾磨港変電所）は分岐・並行する記号なし。開閉所→分岐点の記号は No.36 側と共通の可能性がある。同じ経路に OSM の 275kV の線（way 798162355・798162353、名前なし、2回線）があり、記号と同じ点を通る（線は OSM からは描いていない）。個別回線は未確認。` },
      { label: '出典', value: `${KS146}（data/raw/tso-lines、2026-10-04取得）。経路は${GSI146}。${WHY146}。` }] });
  // ---- 飾磨港変電所：位置の根拠の文（798162352 を使わない）と系統との接続を直す
  const pos = sk.attributes.find((a) => a.label === '位置の根拠');
  const old = '姫路第一の構内の南の 275kV の区画（way 798162352）は姫路第一の開閉設備とみなし、使わない。';
  if (!pos?.value.includes(old)) throw Error('146：飾磨港変電所の位置の根拠が想定と違う');
  pos.value = pos.value.replace(old, '姫路第一の構内の南の 275kV の区画（way 798162352）は「姫路第一発電所の開閉所（推定）」とした（2026-11-22）。');
  set(sk, '系統との接続', '飾磨港線（推定、No.35）で姫路第一発電所の開閉所（推定）へ。');
}
