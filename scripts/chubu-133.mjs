// ---- 保留133（2026-11-18 オーナー指示「長野水力発電所の追加とそこから関開閉所までの送電線を追加」「小坂川発電所を追加」、2026-11-19 回答「いずれも推奨で承認」）
// scripts/build-chubu.mjs から、照合区分の付け直し（applyTiers）と関開閉所の属性（seki-switchyard.mjs）のあとに呼ぶ。
// 種別・出力は docs/research/plant-primary-sources.json と public/data/plant-profiles.json（J-POWER・中部電力の水力発電所一覧）
import {readFileSync} from 'node:fs';
import {applyPlantPrimary} from './plant-primary.mjs';
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const inside = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [yi, xi] = ring[i], [yj, xj] = ring[j]; if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi) c = !c; } return c; };
const km = (p) => p.slice(1).reduce((t, q, i) => t + 6371 * Math.hypot((q[1] - p[i][1]) * Math.PI / 180 * Math.cos(p[i][0] * Math.PI / 180), (q[0] - p[i][0]) * Math.PI / 180), 0);
const OWN = '2026-11-18 オーナー指示（保留133）、2026-11-19 回答「いずれも推奨で承認」';
export function applyChubu133(lines, facilities) {
  if (facilities.some((x) => ['osm-way-1136534571', 'chubu-place-小坂川発電所'].includes(x.id))) throw Error('133：登録済み');
  const seki = facilities.find((x) => x.id === 'osm-way-161946848'); if (!seki || seki.name !== '関開閉所') throw Error('133：関開閉所がない');
  // 長野発電所：OSM の区画（way 1136534571、名前「長野水力発電所」、事業者 電源開発）
  const area = read('data/raw/chubu-osm/facilities-3.json').elements.find((e) => e.type === 'way' && e.id === 1136534571);
  if (!area || area.tags?.name !== '長野水力発電所' || area.tags?.power !== 'plant') throw Error('133：長野の区画が想定と違う');
  const ringN = area.geometry.map((g) => [g.lat, g.lon]);
  const sekiArea = read('data/raw/chubu-osm/facilities-1.json').elements.find((e) => e.type === 'way' && e.id === 161946848);
  if (!sekiArea?.geometry) throw Error('133：関開閉所の区画がない');
  const ringS = sekiArea.geometry.map((g) => [g.lat, g.lon]);
  const el = read('data/raw/p130-nagano/lines-all.json').elements, w = (id) => el.find((e) => e.type === 'way' && e.id === id);
  const a = w(1075743690), b = w(1315442307);
  if (!a || !b || a.nodes[0] !== 9865740262 || a.nodes.at(-1) !== 9865740259 || b.nodes[0] !== 12175933748 || b.nodes.at(-1) !== 9865740259) throw Error('133：OSM の線が想定と違う');
  if (a.tags.voltage || b.tags.voltage) throw Error('133：電圧の登録が増えた。見直す');
  if (lines.some((l) => l.osmIds.some((i) => [1075743690, 1315442307].includes(Math.abs(i))))) throw Error('133：線分は使用済み');
  const pa = a.geometry.map((g) => [g.lat, g.lon]), pb = b.geometry.map((g) => [g.lat, g.lon]).reverse();
  const path = [...pa, ...pb.slice(1)];
  if (!inside(path[0], ringN) || !inside(path.at(-1), ringS)) throw Error('133：線の端が区画の中にない');
  const c = [ringN.reduce((t, q) => t + q[0], 0) / ringN.length, ringN.reduce((t, q) => t + q[1], 0) / ringN.length].map((v) => +v.toFixed(7));
  const SRC_N = `J-POWER 水力発電所一覧（2026年7月1日現在、https://www.jpower.co.jp/bs/renewable_energy/hydro/ichiran.html 、2026-11-18確認）。国土地理院の地図注記「長野(地下)発電所」（z15、2026-11-18取得）。地理はOSM（data/raw/chubu-osm、data/raw/p130-nagano 2026-11-18取得）。${OWN}。`;
  facilities.push({ id: 'osm-way-1136534571', assetId: 'chubu-fac-way-1136534571', name: '長野発電所', kind: 'plant', position: c, voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/1136534571',
    attributes: [{ label: '要注意（C区分）', value: '発電所があることは一次資料（J-POWER の一覧）で確認したが、区画と位置は OSM と国土地理院の地図注記による。' },
      { label: '名称の根拠', value: 'J-POWER 水力発電所一覧に「長野」（九頭竜川、福井県大野市長野）。名前は一覧に合わせて「長野発電所」とした。' },
      { label: '別名', value: '長野水力発電所（OSM の名前）' },
      { label: '位置の根拠', value: 'OSM の発電所の区画（way 1136534571、事業者 電源開発）。国土地理院の地図注記「長野(地下)発電所」が区画の中心から約0.4km。' },
      { label: '電圧', value: '275kV は推定（電源線の電圧推定による。OSM の区画に電圧の登録はない）。' },
      { label: '事業者', value: '電源開発（J-POWER）' }, { label: '出典', value: SRC_N }] });
  const nag = facilities.at(-1);
  const L = km(path);
  lines.push({ id: 'chubu-plant-275-way-1075743690', assetId: 'chubu-plant-275-way-1075743690', name: '長野発電所の電源線（推定）', named: false, voltageKV: 275, currentType: 'ac', osmIds: [1075743690, 1315442307], paths: [path],
    connections: [{ node: 9865740262, position: path[0], status: 'facility-area', facilities: [{ id: nag.id, name: nag.name }], neighborWays: [] },
      { node: 12175933748, position: path.at(-1), status: 'facility-area', facilities: [{ id: seki.id, name: seki.name }], neighborWays: [] }],
    referenceReview: { status: 'partial', endpoints: '長野発電所―関開閉所' },
    attributes: [{ label: '要注意（C区分）', value: '一次資料で区間・端点・電圧を確定できず、OSMの地理登録で描いた参考表示。' }, { label: '照合区分', value: 'C区分' },
      { label: '照合の根拠', value: 'OCCTO の公表区間はない。経路は OSM の線名・電圧の登録がない線分で、発電所と開閉所の対応は推定。' },
      { label: '端点の根拠', value: '端点の対応付けは推定：OSM の線（way 1075743690）の端（node 9865740262）が長野発電所の区画の中に、way 1315442307 の端（node 12175933748）が関開閉所の区画（way 161946848）の中にある。2本は node 9865740259 でつながる。' },
      { label: '電圧の根拠', value: '電圧推定：OSM に電圧の登録がない。関開閉所が 275kV の開閉所のため 275kV とみなした（推定）。J-POWER・中部電力パワーグリッドの資料では未照合。' },
      { label: '持ち主', value: '未確認（J-POWER と推定）。OSM に事業者の登録はない。' },
      { label: '分岐', value: '取得した範囲（北緯35.48〜35.95・東経136.62〜136.92、電圧を問わない送電線）に、この2本と点を共有する線はない（分岐なし）。' },
      { label: '区分', value: '発電所の電源線（OCCTOの地内実績に行がないため潮流なし）' },
      { label: '地理参照', value: `OSM 2線分（way 1075743690・1315442307、計約${L.toFixed(1)}km、線名なし）。個別回線は未確認。` }, { label: '出典', value: SRC_N }] });
  // 小坂川発電所：OSM に区画なし。国土地理院の地図記号（発電所等）と空中写真（2022年9〜10月撮影）の建屋の位置
  facilities.push({ id: 'chubu-place-小坂川発電所', assetId: 'chubu-place-小坂川発電所', name: '小坂川発電所', kind: 'plant', position: [35.91714, 137.32975], voltages: [], scopeConnected: true,
    attributes: [{ label: '要注意（位置推定）', value: '発電所の区画が OSM にないため、位置は推定。' },
      { label: '位置の根拠', value: '国土地理院の地図（標準地図）の発電所の地図記号と、空中写真（2022年9〜10月撮影）の建屋・水圧管の位置（2026-11-19確認）。地図記号と注記に名前はなく、この記号を小坂川発電所とみなしたのは Google マップでの当たり付けによる推定。' },
      { label: '名称の根拠', value: '中部電力 水力発電所一覧（2026年3月末現在）に「小坂川」（木曽川水系、小坂川他）。2026-11-18 オーナー指示「小坂川発電所を追加」。同じ一覧の別の「小坂」（飛騨川他、50,100kW）ではなく、小坂川の谷（飛騨川との合流点より東）にある記号に当てた（推定）。' },
      { label: '系統との接続', value: '未確認。OSM に発電所からの線の登録はなく、線は描いていない（最寄りの 275kV は馬瀬北部線、約1km）。' },
      { label: '事業者', value: '中部電力' },
      { label: '出典', value: `中部電力 水力発電所一覧（2026年3月末現在、https://www.chuden.co.jp/energy/renew/ren_setsubi/water/wat_chuden/wat_list/ 、2026-11-19確認）。国土地理院の地図（標準地図・空中写真、2026-11-19確認）。${OWN}。` }] });
  applyPlantPrimary('chubu', lines, [nag, facilities.at(-1)]);
}
// ---- 保留134（2026-11-19 オーナー指示「小坂川発電所の電源線は地理院地図からたどって、高根馬瀬線に接続して。」、回答「134はaで。」＝電圧は 275kV と推定）
// 経路は国土地理院 ベクトルタイル（試験公開、experimental_bvmap、送電線 ftCode 8202、z16、2026-11-19取得、data/raw/gsi-bvmap/16）の点。
// ①建屋→記号の始まり（約0.14km）と、②記号の終わり→高根馬瀬線の点（約0.03km）は記号がないので直線で補う。高根馬瀬線の経路・端点は変えない
export function applyChubu134(lines, facilities) {
  const osa = facilities.find((x) => x.id === 'chubu-place-小坂川発電所'), tm = lines.find((x) => x.id === 'chubu-275-高根馬瀬線');
  if (!osa || !tm) throw Error('134：小坂川発電所か高根馬瀬線がない');
  if (lines.some((l) => l.id === 'chubu-plant-275-gsi-小坂川')) throw Error('134：登録済み');
  const B = [35.9229128, 137.3405768];
  if (!tm.paths.some((p) => p.slice(1, -1).some((q) => q[0] === B[0] && q[1] === B[1]))) throw Error('134：分岐点 B が高根馬瀬線の経路の途中にない');
  const GSI = [[35.91838, 137.32975], [35.91868, 137.3297], [35.91767, 137.33196], [35.91883, 137.33333], [35.91934, 137.33393], [35.91982, 137.33455], [35.92011, 137.3349], [35.9202, 137.335], [35.92113, 137.33613], [35.92291, 137.34009], [35.92295, 137.3402]];
  const paths = [[osa.position, GSI[0]], GSI, [GSI.at(-1), B]];
  const km = paths.reduce((t, p) => t + p.slice(1).reduce((s, q, i) => s + 6371 * Math.hypot((q[1] - p[i][1]) * Math.PI / 180 * Math.cos(p[i][0] * Math.PI / 180), (q[0] - p[i][0]) * Math.PI / 180), 0), 0);
  const SRC = `経路は国土地理院 ベクトルタイル（試験公開、experimental_bvmap、送電線 ftCode 8202、z16、2026-11-19取得）。高根馬瀬線は OSM（way 209518469）。2026-11-19 オーナー指示「小坂川発電所の電源線は地理院地図からたどって、高根馬瀬線に接続して。」、回答「134はaで。」（保留134）。`;
  lines.push({ id: 'chubu-plant-275-gsi-小坂川', assetId: 'chubu-plant-275-gsi-小坂川', name: '小坂川発電所の電源線（推定）', named: false, voltageKV: 275, currentType: 'ac',
    osmIds: [-13401, -13402, -13403], sourceOsmIds: [], paths,
    schematicParts: [{ osmId: -13401, construction: 'overhead' }, { osmId: -13403, construction: 'overhead' }], tracedParts: [{ osmId: -13402, basis: '国土地理院の送電線記号' }],
    connections: [{ node: null, position: osa.position, status: 'facility-area', facilities: [{ id: osa.id, name: osa.name }], neighborWays: [] },
      { node: 2207396758, position: B, status: 'shared-node', facilities: [], neighborWays: [209518469] }],
    referenceReview: { status: 'partial', endpoints: '小坂川発電所―高根馬瀬線との分岐点（推定）' },
    attributes: [{ label: '要注意（C区分）', value: '経路は国土地理院の送電線記号だけによる参考表示。一次資料で区間・接続・電圧を確定できていない。' }, { label: '照合区分', value: 'C区分' },
      { label: '照合の根拠', value: 'OCCTO の公表区間はない（発電所の電源線）。高根馬瀬線との分岐点を推定した。' },
      { label: '端点の根拠', value: '端点の対応付けは推定：国土地理院の送電線記号が、小坂川発電所の北の点（空中写真で見える屋外の開閉設備の北端付近）から北へ約0.03km 出て南東へ曲がり（ここまで同じ1つの記号）、その先は北東へ1本で続いて、高根馬瀬線の記号の上で終わる。終わりの点に最も近い高根馬瀬線の OSM の点（node 2207396758、約0.03km）を分岐点とみなした。分岐点で電気的につながるかは一次資料で未確認。' },
      { label: '直線で補った区間', value: '発電所の建屋の位置→記号の始まり（約0.14km）と、記号の終わり→高根馬瀬線の点（約0.03km）。' },
      { label: '電圧の根拠', value: '電圧推定：記号からは電圧は決まらない。高根馬瀬線（275kV）に直接つなぐというオーナー指示（2026-11-19、回答「134はaで。」）により 275kV とみなした。77kV など別の電圧の線の可能性もある。' },
      { label: '持ち主', value: '未確認（中部電力と推定）。' },
      { label: '区分', value: '発電所の電源線（OCCTOの地内実績に行がないため潮流なし）' },
      { label: '地理参照', value: `国土地理院の送電線記号（約1.22km）と直線2区間、計約${km.toFixed(1)}km。OSM に線の登録はない。個別回線は未確認。` }, { label: '出典', value: SRC }] });
  osa.voltages = [275];
  osa.attributes = osa.attributes.filter((a) => a.label !== '系統との接続');
  const at = osa.attributes.findIndex((a) => a.label === '事業者'); if (at < 0) throw Error('134：小坂川発電所の属性「事業者」がない');
  osa.attributes.splice(at, 0, { label: '電圧', value: '275kV は推定（電源線の電圧推定による。2026-11-19 オーナー回答「134はaで。」）。' });
}
