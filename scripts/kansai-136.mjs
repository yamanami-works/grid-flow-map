// ---- 保留136（2026-11-16 オーナー指示「南姫路変電所、高砂変電所、飾磨港変電所を追加」「一次資料で、高砂変電所に接続する３つの発電所は、左から高砂火力発電所、実証設備複合サイクル発電所（三菱重工）、神鋼加古川発電所、として描写して。」、
// 2026-11-19 回答「(a)は②、(b)は推奨、(c)は②」）。build-kansai.mjs から applyKansai135 のあとに呼ぶ。
// 提案と図：../reports/approvals/evidence-20261118-p130/proposal-136.md、../reports/figures/p136-takasago.html（リポジトリ外）。
// 変電所の名前は関西電力送配電 空容量一覧（154kV以上・変電所、2026年11月17日更新）：AI 飾磨港、AJ 南姫路、AL 高砂（どれも 275/77kV）。位置は OSM・国土地理院の地図（Google マップで当たりを付けた）。
import {readFileSync} from 'node:fs';
import {applyPlantPrimary} from './plant-primary.mjs';
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const KS_SUB136 = '関西電力送配電 空容量一覧（154kV以上・変電所、2026年11月17日更新）';
const KS_LINE136 = '関西電力送配電 空容量一覧（154kV以上・送電線）';
const OWN136 = '2026-11-16 オーナー指示「南姫路変電所、高砂変電所、飾磨港変電所を追加」「一次資料で、高砂変電所に接続する３つの発電所は、左から高砂火力発電所、実証設備複合サイクル発電所（三菱重工）、神鋼加古川発電所、として描写して。」、2026-11-19 回答（保留136）「(a)は②、(b)は推奨、(c)は②」';
const inside = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [yi, xi] = ring[i], [yj, xj] = ring[j]; if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi) c = !c; } return c; };
const kmOf = (paths) => paths.reduce((t, p) => t + p.slice(1).reduce((s, q, i) => s + 6371 * Math.hypot((q[1] - p[i][1]) * Math.PI / 180 * Math.cos(p[i][0] * Math.PI / 180), (q[0] - p[i][0]) * Math.PI / 180), 0), 0);
const set = (x, label, value) => { const a = x.attributes.find((y) => y.label === label); if (a) a.value = value; else x.attributes.push({ label, value }); };
export function applyKansai136(lines, facilities) {
  const L = (id, name) => { const l = lines.find((x) => x.id === id); if (!l || (name && l.name !== name)) throw Error('136：線が想定と違う ' + id + ' ' + l?.name); return l; };
  const Fc = (id, name) => { const f = facilities.find((x) => x.id === id); if (!f || f.name !== name) throw Error('136：設備が想定と違う ' + id); return f; };
  const ids = ['kansai-place-高砂変電所', 'osm-way-367261471', 'osm-way-798162366', 'osm-way-1093999564', 'osm-way-969601128'];
  if (facilities.some((x) => ids.includes(x.id))) throw Error('136：登録済み');
  const F = read('data/raw/kansai-osm/facilities.json').elements, area = (id, check) => { const e = F.find((x) => x.type === 'way' && x.id === id); if (!e || !check(e.tags ?? {})) throw Error('136：OSM の区画が想定と違う ' + id); return e; };
  const ring = (e) => e.geometry.map((g) => [g.lat, g.lon]), cen = (e) => { const r = ring(e); return [r.reduce((t, q) => t + q[0], 0) / r.length, r.reduce((t, q) => t + q[1], 0) / r.length].map((v) => +v.toFixed(7)); };
  const eMh = area(367261471, (t) => t.power === 'substation' && !t.name), eSk = area(798162366, (t) => t.power === 'substation' && !t.name);
  const eTp = area(1093999564, (t) => t.power === 'plant' && t.name === 'T-Point (Tomoni) Power Plant'), eKb = area(969601128, (t) => t.power === 'plant' && t.name === 'Kobe Steel Kakogawa Works Power Station');
  const SRCF = `${KS_SUB136}（確認 2026-11-19）。位置は OSM（data/raw/kansai-osm、2026-10-02時点）と国土地理院の地図（2026-11-19確認）。${OWN136}。`;
  // ---- 変電所3つ
  const sub = (id, assetId, name, code, position, url, attrs) => ({ id, assetId, name, kind: 'substation', position, voltages: [275, 77], scopeConnected: true, ...(url ? { url } : {}),
    attributes: [...attrs, { label: '名称の確認', value: `${KS_SUB136}に「${code}　${name.replace(/変電所$/, '')}（275/77kV）」。` }, { label: '出典', value: SRCF }] });
  facilities.push(sub('kansai-place-高砂変電所', 'kansai-place-高砂変電所', '高砂変電所', 'AL', [34.75715, 134.76354], null, [
    { label: '要注意（位置推定）', value: '変電所の区画・名称が OSM にも国土地理院の地図注記にもないため、位置は推定。' },
    { label: '位置の根拠', value: '国土地理院 標準地図の発電所等の地図記号（名前なし）と、空中写真（2012年5月撮影）の建屋・変圧器の位置（2026-11-19確認）。Google マップで当たりを付けた。' }]));
  facilities.push(sub('osm-way-367261471', 'kansai-fac-way-367261471', '南姫路変電所', 'AJ', cen(eMh), 'https://www.openstreetmap.org/way/367261471', [
    { label: '要注意（位置推定）', value: '名前は OSM の名前のない変電所の区画に当てた推定（Google マップの当たりによる。国土地理院の地図注記・一次資料の所在地はない）。' },
    { label: '位置の根拠', value: 'OSM の名前のない変電所の区画（way 367261471、建物、事業者 関西電力送配電）。国土地理院の地図で送電線の記号が集まる建屋。姫路第二発電所の北の脇。Google マップで当たりを付けた。' }]));
  facilities.push(sub('osm-way-798162366', 'kansai-fac-way-798162366', '飾磨港変電所', 'AI', cen(eSk), 'https://www.openstreetmap.org/way/798162366', [
    { label: '要注意（位置推定）', value: '名前は OSM の名前のない変電所の区画に当てた推定（Google マップの当たりによる。国土地理院の地図注記・一次資料の所在地はない）。OSM のタグは power=substation だけで、需要家の変電所の可能性もある。' },
    { label: '位置の根拠', value: 'OSM の名前のない変電所の区画（way 798162366）。国土地理院 標準地図の発電所等の地図記号（名前なし）が約0.07km 脇にある。Google マップで当たりを付けた。姫路第一の構内の南の 275kV の区画（way 798162352）は姫路第一の開閉設備とみなし、使わない。' },
    { label: '系統との接続', value: '未確認。一覧の No.35 飾磨港線（AI→開閉所）は描いていない。' }]));
  const tks = facilities.at(-3), mh = facilities.at(-2);
  // ---- 発電所2つ（種別・出力は一次資料で未確認）
  const plant = (e, name, extra, warn) => ({ id: 'osm-way-' + e.id, assetId: 'kansai-fac-way-' + e.id, name, kind: 'plant', position: cen(e), voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/' + e.id,
    attributes: [{ label: '要注意（C区分）', value: warn }, { label: '別名', value: `${e.tags.name}（OSM の名前）` },
      { label: '名称の根拠', value: `オーナー指示（2026-11-16）「一次資料で、高砂変電所に接続する３つの発電所は、左から高砂火力発電所、実証設備複合サイクル発電所（三菱重工）、神鋼加古川発電所、として描写して。」。関西電力送配電の系統図で高砂（AL）の下に発電所の□が3つ並ぶ。OSM の区画（way ${e.id}）に名前を当てたのは推定。` },
      ...extra, { label: '出典', value: `OSM（data/raw/kansai-osm、2026-10-02時点）。${OWN136}。` }] });
  facilities.push(plant(eTp, '実証設備複合サイクル発電所（三菱重工）', [{ label: '系統との接続', value: '送電線（No.52）（推定）で高砂変電所へ（推定）。' } ], '名前は資料と一致するが、OSM の発電所の区画に当てたのは位置による推定。種別・出力は持ち主の公表資料による（発電方式の欄）。'));
  facilities.push(plant(eKb, '神鋼加古川発電所', [{ label: '系統との接続', value: '高砂変電所に直接つながるとみなした（推測、2026-11-19 オーナー回答「(b)は推奨」）。OSM の 275kV の線（way 1301298483）は両端とも行き先がなく、発電所の区画まで約1.5km の切れ目があるため描いていない。' }], '名前は資料（神戸製鋼技報）と一致するが、OSM の発電所の区画に当てたのは位置による推定。種別は持ち主の公表資料。発電所全体の出力は一次資料で未確認。'));
  const tp = facilities.at(-2);
  applyPlantPrimary('kansai', lines, facilities.slice(-2)); // 保留137：種別・出力（docs/research/plant-primary-sources.json）
  const tk = Fc('osm-way-605382256', '高砂火力発電所');
  set(tk, '系統との接続', '高砂変電所に直接つながるとみなした（推測、2026-11-19 オーナー回答「(a)は②」）。No.43（高砂変電所→新加古川変電所）は高砂変電所から描く。');
  // ---- 送電線（No.52）（推定）：T-Point の区画の脇→OSM way 1580889887・1014971185・1580889884→高砂変電所の脇
  const el = read('data/raw/p130-himeji/lines-275.json').elements, pos = new Map(el.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]])), W = (id) => el.find((e) => e.type === 'way' && e.id === id);
  const w1 = W(1580889887), w2 = W(1014971185), w3 = W(1580889884);
  if (!w1 || !w2 || !w3 || w1.tags?.ref !== '52' || w2.tags?.ref !== '52' || w1.nodes.at(-1) !== w2.nodes[0] || w2.nodes.at(-1) !== w3.nodes[0]) throw Error('136：No.52 の OSM の線が想定と違う');
  if (lines.some((l) => l.osmIds.some((i) => [1580889887, 1014971185, 1580889884].includes(Math.abs(i))))) throw Error('136：線分は使用済み');
  const p52 = [w1, w2, w3].map((w) => w.nodes.map((n) => pos.get(n)));
  const tail52 = [p52[2].at(-1), tks.position];
  if (p52.flat().some((q) => !q)) throw Error('136：点が足りない');
  lines.push({ id: 'kansai-275-way-1580889887', assetId: 'kansai-275-way-1580889887', name: '送電線（No.52）（推定）', named: false, voltageKV: 275, currentType: 'ac', osmIds: [1580889887, 1014971185, 1580889884, -13602], paths: [...p52, tail52], schematicParts: [{ osmId: -13602, construction: 'overhead' }],
    connections: [{ node: w1.nodes[0], position: p52[0][0], status: 'facility-area', facilities: [{ id: tp.id, name: tp.name }], neighborWays: [] },
      { node: null, position: tks.position, status: 'facility-area', facilities: [{ id: tks.id, name: tks.name }], neighborWays: [] }],
    referenceReview: { status: 'partial', endpoints: '実証設備複合サイクル発電所（三菱重工）―高砂変電所' },
    attributes: [{ label: '要注意（C区分）', value: '一次資料で区間・端点を確定できず、OSMの地理登録で描いた参考表示。' }, { label: '照合区分', value: 'C区分' },
      { label: '照合の根拠', value: '一覧の行（No.52 送電線 発電所→AL）は発電所名が伏せられている。OSM の線の ref=52 が一覧の番号と同じだが、偶然の一致の可能性もある（OSM の ref は鉄塔の番号などのこともある）。当てはめは推測。' },
      { label: '公表の行', value: `${KS_LINE136} No.52：送電線（275kV）、2回線、発電所→AL。AL＝高砂（${KS_SUB136}）。` },
      { label: '端点の根拠', value: `端点の対応付けは推定：OSM の線の東の端（T-Point の区画の西の脇、約0.14km）を実証設備複合サイクル発電所（三菱重工）、西の端（高砂変電所の位置の北の脇）から高砂変電所の位置まで約${kmOf([tail52]).toFixed(2)}km を直線で補った。一覧の「発電所→AL」は1行だけで、AL の下の発電所は3つある。` },
      { label: '区分', value: '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。' },
      { label: '地理参照', value: `OSM 3線分（way 1580889887・1014971185・1580889884、計約${kmOf(p52).toFixed(1)}km、ref=52）と直線（約${kmOf([tail52]).toFixed(2)}km）。way 1580889887 は 4回線（275kV・77kV）の登録。個別回線は未確認。` },
      { label: '出典', value: `${KS_LINE136}・${KS_SUB136}（確認 2026-11-19）。地理はOSM（data/raw/p130-himeji、2026-11-18取得）。${OWN136}。` }] });
  // ---- No.43：今の「高砂火力発電所の連系線」の始まりを高砂変電所に移す（(a)②）。高砂変電所の位置→今の始まりの点（高砂火力の区画の中）は直線
  const K6 = L('kansai-plant-275-way-605382256', '高砂火力発電所の連系線');
  if (K6.connections[0].facilities[0]?.id !== tk.id) throw Error('136：No.43 の始まりが想定と違う');
  const head43 = [tks.position, K6.paths[0][0]];
  K6.name = '送電線（No.43）（推定）'; K6.paths = [head43, ...K6.paths]; K6.osmIds = [-13601, ...K6.osmIds]; K6.schematicParts = [...(K6.schematicParts ?? []), { osmId: -13601, construction: 'overhead' }];
  K6.connections = [{ node: null, position: tks.position, status: 'facility-area', facilities: [{ id: tks.id, name: tks.name }], neighborWays: [] }, K6.connections[1]];
  K6.referenceReview = { status: 'partial', endpoints: '高砂変電所―新加古川変電所' };
  for (const [label, value] of [['区分', '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。'], ['照合の根拠', '一覧の行（No.43 送電線 AL→AM）は線名が伏せられている。AL＝高砂、AM＝新加古川（変電所一覧）。経路は OSM の線（以前の「高砂火力発電所の連系線」）。'],
    ['公表の行', `${KS_LINE136} No.43：送電線（275kV）、2回線、AL→AM。AL＝高砂、AM＝新加古川（${KS_SUB136}）。`],
    ['端点の根拠', `端点の対応付けは推定：高砂変電所の位置（位置推定）から、高砂火力発電所の区画の中の OSM の線の始まりまで約${kmOf([head43]).toFixed(2)}km を直線で補った。高砂火力発電所の構内を通る形は推測（発電所を中継しているわけではない）。`],
    ['名前の訂正（2026-11-19）', '以前は「高砂火力発電所の連系線」として高砂火力発電所から描いていた。オーナー回答「(a)は②」により No.43 とし、始まりを高砂変電所に移した。'],
    ['出典', `${KS_LINE136}・${KS_SUB136}（確認 2026-11-19）。地理はOSM（data/raw/kansai-osm）。${OWN136}。`]]) set(K6, label, value);
  // ---- (c)②：No.37・39・40 の端を南姫路変電所に移す。No.39＝今の「姫路第二発電所の連系線」（2026-11-18 オーナー回答「39と43と44は既存の線でOk」）
  const mhRing = ring(eMh), h2 = Fc('osm-way-367261461', '姫路第二発電所');
  const K5 = L('kansai-plant-275-way-367261461', '姫路第二発電所の連系線'), l37 = L('kansai-275-gsi-姫路第二接続', '送電線（No.37）（推定）'), l40 = L('ledger-infer-kansai-275-185027449', '送電線（No.40）（推定）');
  const mhc = { id: mh.id, name: mh.name };
  if (!mhRing.some((q) => q[0] === +K5.paths[0][0][0].toFixed(7) && q[1] === +K5.paths[0][0][1].toFixed(7)) && !inside(K5.paths[0][0], mhRing)) throw Error('136：No.39 の始まりが南姫路の区画の上にない');
  K5.name = '送電線（No.39）（推定）'; K5.connections = [{ ...K5.connections[0], facilities: [mhc] }, K5.connections[1]];
  K5.referenceReview = { status: 'partial', endpoints: '南姫路変電所―新加古川変電所' };
  for (const [label, value] of [['区分', '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。'], ['照合の根拠', '一覧の行（No.39 送電線 AJ→AM）は線名が伏せられている。AJ＝南姫路、AM＝新加古川（変電所一覧）。オーナー回答（2026-11-18「39と43と44は既存の線でOk」）で、以前の「姫路第二発電所の連系線」を No.39 とした。'],
    ['公表の行', `${KS_LINE136} No.39：送電線（275kV）、2回線、AJ→AM。AJ＝南姫路、AM＝新加古川（${KS_SUB136}）。`],
    ['端点の根拠', '端点の対応付けは推定：OSM の線の始まりの点（node 7465091899）は南姫路変電所の区画（way 367261471）の角にある。以前は姫路第二発電所の区画の点として姫路第二につないでいた。'],
    ['名前の訂正（2026-11-19）', '以前は「姫路第二発電所の連系線」。オーナー回答「(c)は②」により No.39 とし、始まりを南姫路変電所にした。'],
    ['出典', `${KS_LINE136}・${KS_SUB136}（確認 2026-11-19）。地理はOSM（data/raw/kansai-osm）。${OWN136}。`]]) set(K5, label, value);
  for (const l of [l37, l40]) {
    const start = l.paths[0][0]; if (!inside(start, ring(F.find((x) => x.id === 367261461))) || l.connections[0].facilities[0]?.id !== h2.id) throw Error('136：始まりが姫路第二の区画の中にない ' + l.name);
    const head = [mh.position, start], nid = l === l37 ? -13611 : -13612;
    l.paths = [head, ...l.paths]; l.osmIds = [nid, ...l.osmIds]; l.schematicParts = [...(l.schematicParts ?? []), { osmId: nid, construction: 'overhead' }];
    l.connections = [{ node: null, position: mh.position, status: 'facility-area', facilities: [mhc], neighborWays: [] }, l.connections[1]];
    l.referenceReview = { ...l.referenceReview, endpoints: l.referenceReview.endpoints.replace('姫路第二発電所', '南姫路変電所') };
    if (l === l40) {
      set(l, '照合の根拠', `一覧の行（No.40 送電線 AJ→開閉所）は線名が伏せられている。AJ＝南姫路（${KS_SUB136}）、開閉所を宝塚開閉所とみなしたのはオーナー回答による推定。`);
      set(l, '端点の根拠', '端点の対応付けは推定：南姫路変電所から直線で姫路第二発電所の区画の中の点へ、そこから国土地理院の記号を P12→P10→P9→P17→P22→P24→P25→X→P29 とたどり、P29 から先は OSM の線で宝塚開閉所へ。');
      set(l, '共架（推測）', 'P24→P25（G37、約1.3km）は送電線（No.39）（推定）と同じ鉄塔に載るとみなした（推測。オーナー回答 2026-11-19「(e)推奨で」）。');
    } else {
      set(l, '照合の根拠', `一覧の行（No.37 送電線 AJ→AM）は線名・端点が伏せられている。AJ＝南姫路（${KS_SUB136}）。系統図に番号のない線があり（オーナー回答）、No.37 に当てたのはオーナー回答「(g)37は(f)の送電線にあてて」による。`);
      set(l, '端点の根拠', '端点の対応付けは推定：南姫路変電所から直線で姫路第二発電所の区画の中の点へ、そこから国土地理院の記号を P11→P8 とたどり、P8 で No.36 の OSM の点（node 2841061873）につないだ（推測）。P11 から姫路第二へ向かうもう1本の記号（G12）は同じ線の別の回線とみなし、別には描かない。');
    }
    set(l, '端点の付け替え（2026-11-19）', `オーナー回答「(c)は②」により、始まりを姫路第二発電所の区画の中の点から南姫路変電所（AJ）に移した。南姫路変電所の区画の中心から以前の始まりの点まで約${kmOf([head]).toFixed(2)}km を直線で補った（推測）。`);
  }
  set(h2, '系統との接続', '南姫路変電所に直接つながるとみなした（推測、2026-11-19 オーナー回答「(c)は②」）。No.37・39・40 は南姫路変電所から描く。');
}
