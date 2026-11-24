// 東京の点検（2026-11-17 オーナー回答、保留124）。scripts/build-tokyo-pilot.mjs が電源開発の取り込み（mergeJpower）のあとに呼ぶ。
// オーナー回答（原文）：「124-2は国土地理院の送電線記号に沿って引き込み分岐線を記載。124-8は池上線の中間から分岐。それ以外は推奨で承認。
// 124-4は国土地理院の送電線記号に沿って記載。名称は新野田線と一次資料で確認できなければ引き込み線の扱いにして。」
// 続く指示（2026-11-17、原文）：「一覧どおり高輪→分岐点を川崎高輪線にして。」（124-8 の向き）
// 判断用の図と照合の記録は reports 側（リポジトリの外）。国土地理院の送電線記号はベクトルタイル（試験公開）を tools と同じ条件で取得した（data/raw/gsi-bvmap）。
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const dm = (a, b) => 6371000 * Math.hypot((b[1] - a[1]) * Math.PI / 180 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * Math.PI / 180);
const km = (p) => p.slice(1).reduce((t, q, i) => t + dm(p[i], q), 0) / 1000;
const inside = (p, R) => { let c = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const [yi, xi] = R[i], [yj, xj] = R[j]; if ((yi > p[0]) != (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) c = !c; } return c; };
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const GSI = '国土地理院 ベクトルタイル（試験公開、experimental_bvmap、送電線 ftCode 8202、2026-11-17取得）';
const MAP = '東京PG「系統構成 500kV,275kV系統」（予想潮流の資料 https://www.tepco.co.jp/pg/consignment/system/pdf/kikan_yosochoryu.pdf の4ページ、2026-09-02更新、確認日 2026-11-16。原本は保存しない）';
const JP_LIST = 'J-POWER 水力発電所一覧（2026年7月1日現在）（https://www.jpower.co.jp/bs/renewable_energy/hydro/ichiran.html 、2026-11-16確認）';
const OWNER = '2026-11-17 オーナー回答（保留124）';

// ---- 124-1 送電線につながっていない発電所7か所を削除（オーナー指示 2026-11-16）と、保留125 の8か所・保留126 の3か所・保留127 の2か所（2026-11-17）。理由は tests/baseline/approved-removals.json
export const REMOVED_PLANTS = ['osm-way-1078429703', 'osm-way-926402862', 'osm-way-1154169960', 'osm-way-704399794', 'osm-way-1133676170', 'osm-way-1444382011', 'osm-way-917145638',
  // 保留125（2026-11-17 オーナー指示「東京エリアで描いた500kV,275kV送電線に明らかに接続していない下記の発電所を削除。…」、同日「保留125は全て承認」）
  'osm-way-943646268', 'osm-way-1133603221', 'osm-way-1198135329', 'osm-way-404901529', 'osm-way-404901530', 'osm-way-1161552601', 'osm-way-1100962066', 'osm-way-1092461703',
  // 保留126（2026-11-17 オーナー指示「城山水力発電所、中津川第一発電所、秋元発電所も154kV連系なので削除して」、同日「進めて」）
  'osm-way-246750093', 'osm-way-1135976065', 'osm-way-180786612',
  // 保留127 の追加の指示（2026-11-17 オーナー指示「加えて、品川火力発電所、JFE扇島火力発電所は削除」）
  'osm-way-565401935', 'osm-way-619569840'];

function lineById(lines, id) { const l = lines.find((x) => x.id === id); if (!l) throw Error('東京の点検：線がない ' + id); return l; }
function facById(facilities, id) { const f = facilities.find((x) => x.id === id); if (!f) throw Error('東京の点検：設備がない ' + id); return f; }
function setAttr(o, label, value) { const i = o.attributes.findIndex((a) => a.label === label); if (i < 0) o.attributes.push({ label, value }); else o.attributes[i] = { label, value }; }
function ring(raw, id, name) {
  const w = raw.elements.find((e) => e.type === 'way' && e.id === id);
  if (!w || (name !== undefined && (w.tags?.name ?? null) !== name)) throw Error('東京の点検：OSMの区画が変わった ' + id);
  const r = w.geometry.map((q) => [q.lat, q.lon]), v = r.slice(0, -1), pos = [v.reduce((s, p) => s + p[0], 0) / v.length, v.reduce((s, p) => s + p[1], 0) / v.length];
  if (!inside(pos, r)) throw Error('東京の点検：代表点が区画の外 ' + id);
  return { w, ring: r, pos };
}
// 分岐元の線の点（経路の頂点）を探す
function vertexOf(line, p, maxM) {
  let best = null;
  line.paths.forEach((P) => P.forEach((q) => { const d = dm(p, q); if (!best || d < best.d) best = { d, q }; }));
  if (!best || best.d > maxM) throw Error('東京の点検：分岐点が分岐元の線の点から離れている ' + line.id);
  return best.q;
}
function noNegId(lines, id) { if (lines.some((l) => l.osmIds.includes(id))) throw Error('東京の点検：仮IDの重複 ' + id); }

export function applyTokyoCheck1117(lines, facilities) {
  // ---- 124-1
  {
    const linked = new Set(lines.flatMap((l) => l.connections.flatMap((c) => c.facilities.map((f) => f.id))));
    for (const id of REMOVED_PLANTS) {
      if (linked.has(id)) throw Error('124-1・125〜127：削除する発電所に線がつながっている ' + id);
      const i = facilities.findIndex((f) => f.id === id); if (i < 0) throw Error('124-1・125〜127：発電所がない ' + id);
      if (facilities[i].kind !== 'plant') throw Error('124-1・125〜127：発電所でない ' + id);
      facilities.splice(i, 1);
    }
    // 保留126：中津川第一の重複（OSM relation 15402384、2026-10-03 承認済み削除）は build-tokyo-pilot.mjs が way 1135976065 のあるうちに消す。順番が変わって残ったら止める
    if (facilities.some((f) => f.id === 'osm-relation-15402384')) throw Error('126：中津川第一の重複 relation 15402384 が残っている');
  }
  const tkFac = read('data/raw/tokyo-osm/facilities.json'), tkAt = tkFac.osm3s?.timestamp_osm_base?.slice(0, 10);
  const subs = read('data/raw/tokyo-275/substations.json'), subAt = subs.osm3s?.timestamp_osm_base?.slice(0, 10);
  if (!tkAt || !subAt) throw Error('東京の点検：OSMの取得時点が原本にない');

  // ---- 124-2 大鳥発電所・大津岐発電所と、国土地理院の送電線記号に沿った引込分岐線
  const plant = (o) => ({ kind: 'plant', voltages: [], scopeConnected: true, ...o });
  {
    if (facilities.some((f) => /大鳥発電所|大津岐発電所/.test(f.name))) throw Error('124-2：登録済み');
    // 大鳥発電所：OSMに区画がない（docs/JPOWER.md）。位置は国土地理院の地図注記
    facilities.push(plant({ id: 'tokyo-place-大鳥発電所', assetId: 'tokyo-place-大鳥発電所', name: '大鳥発電所', position: [37.21593, 139.21351], url: 'https://www.jpower.co.jp/bs/renewable_energy/hydro/ichiran.html',
      attributes: [
        { label: '位置の確認', value: '国土地理院の地図注記「大鳥発電所」（北緯37.21593・東経139.21351、2026-11-16取得）。国土地理院の標準地図で同じ位置に発電所の記号、シームレス空中写真（撮影年未確認、2026-11-17取得）で大鳥ダムの脇に発電所の建屋が見える。' },
        { label: '事業者', value: '電源開発（J-POWER）' },
        { label: '発電方式（一次資料）', value: '水力（ダム式・最大出力 182,000kW・1963-11-20 運転開始・所在地 福島県南会津郡只見町）' },
        { label: '出典（発電方式）', value: JP_LIST },
        { label: '出力の扱い', value: '発電所の出力は送電容量として扱わない。運転状態・号機構成は未照合。' },
      ], plantType: { label: '水力（ダム式）', source: 'J-POWER 水力発電所一覧（2026年7月1日現在）' } }));
    // 大津岐発電所：OSM の名前のない水力の建物（way 480494782）に名前を当てる（推定）
    const o = ring(tkFac, 480494782, null);
    if (o.w.tags?.power !== 'plant' || o.w.tags?.['plant:source'] !== 'hydro') throw Error('124-2：大津岐の区画のタグが変わった');
    facilities.push(plant({ id: 'osm-way-480494782', assetId: 'tokyo-fac-plant-480494782', name: '大津岐発電所', position: o.pos, url: 'https://www.openstreetmap.org/way/480494782',
      attributes: [
        { label: '要注意（C区分）', value: 'OSM の名前のない水力の建物に、電源開発の一覧の発電所名を当てた（推定）。' },
        { label: '名称・位置の根拠', value: `OSM の名前のない水力の建物（way 480494782、power=plant・plant:source=hydro、${tkAt}時点）。大津岐川（国土地理院の地図注記）が奥只見湖に入る近くで、電源開発の一覧の所在地（福島県南会津郡檜枝岐村）の範囲。国土地理院の送電線記号がこの建物に入る。国土地理院の地図注記「大津岐ダム」は約3.5km 南東。` },
        { label: '事業者', value: '電源開発（J-POWER）' },
        { label: '発電方式（一次資料）', value: '水力（ダム水路式・最大出力 38,000kW・1968-12-23 運転開始・所在地 福島県南会津郡檜枝岐村）' },
        { label: '出典（発電方式）', value: JP_LIST },
        { label: '出力の扱い', value: '発電所の出力は送電容量として扱わない。運転状態・号機構成は未照合。' },
      ], plantType: { label: '水力（ダム水路式）', source: 'J-POWER 水力発電所一覧（2026年7月1日現在）' } }));
    if (!inside([37.0713494, 139.2680356], o.ring)) throw Error('124-2：大津岐の記号の端が建物の外');

    const feeder = ({ id, osmId, name, parent, parentWay, route, fac, ownerNote, pathNote }) => {
      noNegId(lines, osmId);
      const p = lineById(lines, parent), br = vertexOf(p, route[0], 15), path = [br, ...route.slice(1)];
      lines.push({ id, assetId: id, name, named: false, voltageKV: p.voltageKV, currentType: 'ac', osmIds: [osmId], paths: [path], tracedParts: [{ osmId, basis: '国土地理院の送電線記号' }], tsoSection: null,
        referenceReview: { status: 'section', endpoints: `${p.name}（分岐点）―${fac.name}` },
        connections: [{ node: null, position: br, status: 'shared-node', facilities: [], neighborWays: [parentWay] }, { node: null, position: path.at(-1), status: 'facility-area', facilities: [{ id: fac.id, name: fac.name }], neighborWays: [] }],
        attributes: [
          { label: '照合区分', value: 'C区分' },
          { label: '要注意（C区分）', value: '線の存在・経路・分岐元は国土地理院の送電線記号だけが根拠。一次資料で区間・端点・電圧を確認していない参考表示。' },
          { label: '公表区間', value: '東京PG の設備一覧・OCCTO に行はない（電源開発の発電所の電源線）。' },
          { label: '分岐点の推定', value: `国土地理院の送電線記号が${p.name}（地図の線）に合流する点を分岐点とみなした（推定。記号の端から地図の線の点まで約${Math.round(dm(route[0], br))}m）。分岐（T）か引き込み（π）か、回線は未確認。` },
          { label: '電圧の推定', value: `${p.voltageKV}kV は分岐元の線（${p.name}）の電圧から推定した値。国土地理院の記号からは電圧を決めない（docs/RULES.md 3節）。発電所の規模によっては低い電圧の可能性もある（一次資料で未確認）。` },
          { label: 'オーナーの説明', value: ownerNote },
          { label: '区分', value: `${p.name}の途中から${fac.name}へ分かれる線。この線には潮流を割り当てない。` },
          { label: '経路の根拠', value: `国土地理院の送電線記号だけ（約${km(path).toFixed(1)}km、分岐・並行する記号なし）。${pathNote}OSM に線はない。` },
          { label: '出典', value: `${GSI}。${JP_LIST}。${OWNER}。` },
        ] });
      setAttr(p, '途中の分岐', [p.attributes.find((a) => a.label === '途中の分岐')?.value, `途中から${fac.name}への引込線（国土地理院の送電線記号、推定）が分かれる（${OWNER}）。`].filter(Boolean).join(''));
    };
    // 大鳥：田子倉発電所の連系線（田子倉―奥只見、OSM way 232998816）から西へ。記号は只見川の西岸を回って発電所の手前で終わる
    feeder({ id: 'tokyo-feeder-275-gsi-大鳥', osmId: -9911701, name: '大鳥発電所への引込線（田子倉発電所の連系線の分岐）', parent: 'jpower-275-way-158064651', parentWay: 232998816,
      route: [[37.2181246, 139.2241466], [37.2182335, 139.22335], [37.217629, 139.21875], [37.2173364, 139.2166659], [37.2172595, 139.2161107], [37.2166678, 139.2132917], [37.2160975, 139.21058], [37.2160484, 139.2126882]],
      fac: { id: 'tokyo-place-大鳥発電所', name: '大鳥発電所' },
      ownerNote: '大鳥発電所は奥只見線か田子倉線につながる（2026-11-16）。国土地理院の送電線記号に沿って引込分岐線を描く（2026-11-17）。記号では田子倉発電所の連系線（田子倉―奥只見）から分かれる。',
      pathNote: '発電所の側は、記号のとおり只見川の西岸を回り、発電所の地図注記の約70m 西で終わる。' });
    // 大津岐：奥只見線（OSM way 233259795）から北東へ。空中写真で記号に沿って伐採した線路の跡が見える
    feeder({ id: 'tokyo-feeder-275-gsi-大津岐', osmId: -9911702, name: '大津岐発電所への引込線（奥只見線の分岐）', parent: 'tokyo-section-57', parentWay: 233259795,
      route: [[37.0677753, 139.2608956], [37.0683853, 139.2614508], [37.0685094, 139.2626953], [37.0688904, 139.2664477], [37.0691943, 139.266665], [37.0712574, 139.2681295], [37.0713494, 139.2680356]],
      fac: { id: 'osm-way-480494782', name: '大津岐発電所' },
      ownerNote: '大津岐発電所は奥只見線か田子倉線につながる（2026-11-16）。国土地理院の送電線記号に沿って引込分岐線を描く（2026-11-17）。記号では奥只見線から分かれる。',
      pathNote: '発電所の側は OSM の水力の建物の中で終わる。国土地理院の空中写真（撮影年未確認、2026-11-17取得）で、記号に沿って伐採した線路の跡が見える。' });
  }

  // ---- 124-3 梓川線の端を安曇水力発電所に、分岐点→水殿水力発電所を No.78 に（オーナーの説明 2026-11-16「梓川線の端点は安曇水力発電所で梓川線から分岐して水殿水力発電所までがNo78の送電線」）
  // No.78（送電線No.78（電源線））は梓川線と同じ OSM の線（新信濃→水殿 約13.7km）に重ねて描いていた。中部・九州の分岐線と同じく、分岐点から先だけにする
  {
    const az = lineById(lines, 'tokyo-section-77'), n78 = lineById(lines, 'tokyo-section-78'), ad = lineById(lines, 'plant-tokyo-275-315662803'), aF = facById(facilities, 'osm-way-727005862'), sF = facById(facilities, 'osm-way-787208208');
    if (az.osmIds.join() !== '315662812' || az.paths.length !== 1 || az.connections[1].facilities[0]?.id !== sF.id) throw Error('124-3：梓川線の形が想定と違う');
    if (JSON.stringify(n78.paths) !== JSON.stringify(az.paths) || n78.osmIds.join() !== '315662812' || n78.connections[1].facilities[0]?.id !== sF.id) throw Error('124-3：No.78 が梓川線と同じ経路でない');
    if (ad.osmIds.join() !== '315662803' || ad.connections[1].node !== 3217940674 || ad.connections[0].facilities[0]?.id !== aF.id) throw Error('124-3：安曇の電源線の形が想定と違う');
    const raw = read('data/raw/tokyo-275/held-lines-west-north.json'), N = new Map(raw.elements.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
    const bp = N.get(3217940674), P = az.paths[0], k = P.findIndex((q) => same(q, bp));
    if (!bp || k <= 0 || k >= P.length - 1) throw Error('124-3：分岐点が梓川線の途中の点にない');
    if (!same(ad.paths[0].at(-1), bp)) throw Error('124-3：安曇の電源線の端が分岐点と違う');
    const toBr = P.slice(0, k + 1), toSuidono = P.slice(k), toAzumi = [...ad.paths[0]].reverse(), oldKm = km(P);
    az.paths = [toBr, toAzumi]; az.osmIds = [315662812, 315662803];
    az.connections = [az.connections[0], { ...ad.connections[0] }];
    az.referenceReview = { status: 'section', endpoints: '新信濃変電所―安曇水力発電所' };
    setAttr(az, '地理参照', `OSM 2線分。way 315662812 の新信濃側（分岐点 node 3217940674 まで、約${km(toBr).toFixed(1)}km）と、分岐点から安曇水力発電所までの way 315662803（約${km(toAzumi).toFixed(1)}km、以前は「安曇水力発電所の電源線（推定）」として描いた線）。way 315662812 の分岐点から水殿水力発電所までは No.78。275kVの共有ノードだけで連結。個別回線・母線は未確認。`);
    setAttr(az, '分岐点の推定', '安曇側の端と No.78 との分岐点は、OSM の共有ノード（node 3217940674）を分岐点とみなした（推定）。分岐点から安曇水力発電所までは、以前「安曇水力発電所の電源線（推定）」として描いた OSM の線。');
    setAttr(az, '端点の判断', `東京PG資料は発電所端点を匿名化（No.77：新信濃―発電所）。端を安曇水力発電所とし、分岐点から水殿水力発電所までを No.78 とするのはオーナーの説明（2026-11-16）。分岐点は OSM の共有ノード（node 3217940674）とみなした（推定）。以前は OSM のとおり水殿水力発電所までを梓川線として描いていた。`);
    n78.paths = [toSuidono];
    n78.connections = [{ node: 3217940674, position: bp, status: 'shared-node', facilities: [], neighborWays: [315662803] }, n78.connections[1]];
    n78.referenceReview = { status: 'section', endpoints: '梓川線（分岐点）―水殿水力発電所' };
    const g = n78.attributes.find((a) => a.label === '地理参照'); if (!g?.value.startsWith('OSM 1線分（計約13.7km）。')) throw Error('124-3：No.78 の地理参照の文が変わった');
    g.value = `OSM 1線分の一部（way 315662812 の分岐点 node 3217940674 から水殿水力発電所まで、約${km(toSuidono).toFixed(2)}km、線名なし、275kV・1回線）。残りは梓川線。個別回線・母線は未確認。`;
    setAttr(n78, '分岐点の推定', '梓川線との分岐点は、梓川線と共有する OSM node 3217940674 とみなした（推定）。');
    setAttr(n78, '分岐元との関係', `新信濃側から分岐点までは梓川線と同じ鉄塔（線路）を通るとみられる。地図ではこの区間を梓川線として描き、No.78 は分岐点から先だけを描く（以前は新信濃から水殿まで約${oldKm.toFixed(1)}kmを梓川線と重ねて描いていた）。分岐点で電気的につながるのか、同じ鉄塔に載る別の回線なのかは一次資料では未確認。`);
    setAttr(n78, '端点の判断', `梓川線から分岐して水殿水力発電所までが No.78 とするのはオーナーの説明（2026-11-16）。分岐点は梓川線と共有する OSM node 3217940674 とみなした（推定）。系統構成図(78) は新信濃から梓川線(77)と同じ匿名の発電所《1002065》へ向かう線として描かれ、オーナーの説明（77 の端は安曇、78 の端は水殿）とは食い違う（どちらの読みが正しいかは一次資料で未確認）。`);
    setAttr(n78, '出典', n78.attributes.find((a) => a.label === '出典').value + `${OWNER}。`);
    lines.splice(lines.indexOf(ad), 1);
    aF.scopeConnected = true; aF.attributes = aF.attributes.filter((a) => !(a.label === '系統との接続' && /未収録/.test(a.value)));
  }

  // ---- 124-4 新野田変電所への 500kV の引込線（OSM の線名は「新野田線」だが一次資料で確認できないので引込線として扱う）
  {
    const sk = lineById(lines, 'tokyo-section-47'), nf = facById(facilities, 'osm-relation-13768299');
    const raw = read('data/raw/tokyo-500/north.json'), N = new Map(raw.elements.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
    const w = raw.elements.find((e) => e.type === 'way' && e.id === 340294682);
    if (!w || w.tags?.name !== '新野田線' || w.tags?.voltage !== '500000' || w.nodes[0] !== 1645500408 || w.nodes.at(-1) !== 1645500377) throw Error('124-4：OSMの線が変わった');
    if (lines.some((l) => l.osmIds.includes(340294682))) throw Error('124-4：登録済み');
    noNegId(lines, -9911703);
    const route = w.nodes.map((n) => N.get(n)), tail = [route.at(-1), [35.930802, 139.910545]];
    if (!sk.paths.some((P) => P.some((q) => same(q, route[0])))) throw Error('124-4：分岐点が新京葉線の点にない');
    if (dm(tail[0], tail[1]) > 80 || dm(tail[1], nf.position) > 60) throw Error('124-4：記号の端が想定と違う');
    const at = raw.osm3s?.timestamp_osm_base?.slice(0, 10);
    lines.push({ id: 'tokyo-feeder-500-340294682', assetId: 'tokyo-feeder-500-340294682', name: '新野田変電所への引込線（新京葉線の分岐）', named: false, voltageKV: 500, currentType: 'ac', osmIds: [340294682, -9911703], paths: [route, tail], tracedParts: [{ osmId: -9911703, basis: '国土地理院の送電線記号' }], tsoSection: null,
      referenceReview: { status: 'section', endpoints: '新京葉線（分岐点）―新野田変電所' },
      connections: [{ node: 1645500408, position: route[0], status: 'shared-node', facilities: [], neighborWays: [sk.osmIds[0]] }, { node: null, position: tail[1], status: 'facility-area', facilities: [{ id: nf.id, name: nf.name }], neighborWays: [] }],
      attributes: [
        { label: '照合区分', value: 'C区分' },
        { label: '要注意（C区分）', value: '一次資料で区間・線名を確定できず、OSM と国土地理院の送電線記号で描いた参考表示。' },
        { label: '線名', value: 'OSM の線名は「新野田線」（補助資料）。東京PG の設備一覧・予想潮流の表・OCCTO に新野田への 500kV の線の行はなく（新京葉線の行は新古河→新京葉）、一次資料で線名を確認できないので引込線として扱う（2026-11-17 オーナー指示）。' },
        { label: '公表設備対応', value: '新野田変電所は東京PG の予想潮流の表で 500/275kV の変電所（2026-09-02更新）。' },
        { label: '分岐点の推定', value: '新京葉線と共有する OSM node 1645500408 を分岐点とみなした（推定）。分岐（T）か引き込み（π）か、回線は未確認。' },
        { label: '経路の根拠', value: `OSM 1線分（way 340294682、約${km(route).toFixed(2)}km、500kV・2回線）。国土地理院の送電線記号と7〜17m で重なる。OSM の端（鉄塔）から変電所の中の約${Math.round(dm(...tail))}mは国土地理院の送電線記号をなぞった（2026-11-17 オーナー指示「国土地理院の送電線記号に沿って記載」）。` },
        { label: '区分', value: '新京葉線の途中から新野田変電所へ分かれる線。OCCTO に行がないため潮流なし。' },
        { label: '出典', value: `東京PG 予想潮流の表（2026-09-02更新）。地理はOSM（data/raw/tokyo-500、${at}時点）と${GSI}。${OWNER}。` },
      ] });
    setAttr(sk, '途中の分岐', [sk.attributes.find((a) => a.label === '途中の分岐')?.value, `途中から新野田変電所への 500kV の引込線（OSM の線名「新野田線」）が分かれる（推定、${OWNER}）。`].filter(Boolean).join(''));
  }

  // ---- 124-5 南多摩・中相模・墨東の変電所（地図の線がすでに区画の中を通る。引込の線分は描かない）
  for (const [id, name, lineId, extra] of [
    [145080115, '南多摩変電所', 'tokyo-section-91', '東京PG の設備計画（500kV・275kV）にも「東京都八王子市、275/66kV」の変電所として載る。'],
    [162844704, '中相模変電所', 'tokyo-section-100', ''],
    [156962045, '墨東変電所', 'tokyo-section-132', ''],
  ]) {
    if (facilities.some((f) => f.name === name || f.id === 'osm-way-' + id)) throw Error('124-5：登録済み ' + name);
    const s = ring(subs, id, name);
    if (s.w.tags?.power !== 'substation' || s.w.tags?.operator !== '東京電力パワーグリッド' || !/^275000/.test(s.w.tags?.voltage ?? '')) throw Error('124-5：OSMのタグが変わった ' + name);
    const l = lineById(lines, lineId);
    if (!l.paths.flat().some((q) => inside(q, s.ring))) throw Error('124-5：線が区画の中を通らない ' + name);
    facilities.push({ id: 'osm-way-' + id, assetId: 'tokyo-fac-substation-' + id, name, kind: 'substation', position: s.pos, voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/' + id,
      attributes: [
        { label: '運営者', value: '東京電力パワーグリッド' },
        { label: '公表設備対応', value: `${MAP}に変電所として載る。${extra}` },
        { label: 'OSM登録', value: `OSMの区画（way ${id}、power=substation、${s.w.tags.voltage.split(';').map((v) => Number(v) / 1000 + 'kV').join(';')}、事業者 東京電力パワーグリッド、${subAt}時点）。` },
        { label: '線との関係', value: `${l.name}（地図の線）が区画の中を通る。引込か通過かは一次資料で未確認（電気的な接続は推定しない）。OSM の区画の中で分かれる1回線の引込の線分は描かない（${OWNER}）。` },
        { label: '代表点の取り方', value: 'OSMの区画の頂点の平均（区画の内側にあることを確認）。' },
      ] });
    const g = l.attributes.find((a) => a.label === '地理参照'), old = `経路の途中で他の設備区画（${name}）を通過。途中の設備との電気的接続は推定しない。`;
    if (!g?.value.includes(old)) throw Error('124-5：地理参照の文が変わった ' + lineId);
    g.value = g.value.replace(old, `経路の途中で${name}の区画の中を通る（東京PGの系統構成図で変電所。引込か通過かは一次資料で未確認。電気的接続は推定しない）。`);
  }

  // ---- 124-6 南横須賀変電所：Google マップで当たりを付けた、横須賀火力発電所の西隣の OSM の名前のない東京PG の変電所の区画（名前を当てた推定）
  {
    if (facilities.some((f) => f.name === '南横須賀変電所' || f.id === 'osm-way-1347097155')) throw Error('124-6：登録済み');
    const s = ring(tkFac, 1347097155, null);
    if (s.w.tags?.power !== 'substation' || s.w.tags?.operator !== '東京電力パワーグリッド') throw Error('124-6：OSMのタグが変わった');
    const ends = ['tokyo-section-101', 'tokyo-section-102'].map((id) => lineById(lines, id).paths.flat().filter((q) => inside(q, s.ring)).length);
    facilities.push({ id: 'osm-way-1347097155', assetId: 'tokyo-fac-substation-1347097155', name: '南横須賀変電所', kind: 'substation', position: s.pos, voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/1347097155',
      attributes: [
        { label: '要注意（C区分）', value: 'OSM の名前のない東京PG の変電所の区画に、一次資料の系統図の「南横須賀」の名前を当てた（推定）。' },
        { label: '名称・位置の根拠', value: `${MAP}に「南横須賀」の変電所が載る。Google マップで当たりを付けた位置の、OSM の名前のない変電所の区画（way 1347097155、power=substation、事業者 東京電力パワーグリッド、電圧の登録なし、${tkAt}時点）。国土地理院 シームレス空中写真（撮影年未確認、2026-11-16取得）で区画の中に屋内の変電設備が見える。電圧 275kV は系統図（500kV・275kV系統）に載ることから。` },
        { label: '線との関係', value: `東京南線（No.101・102、地図の線）の OSM の端がこの区画の中にある（地図の線の点 ${ends.join('・')}点）。地図の東京南線の端は JERA 横須賀火力発電所のまま（${OWNER}）。OCCTO の東京南線の行の端点名「南横須賀」が、この変電所か発電所かは未確認。` },
        { label: '運営者', value: '東京電力パワーグリッド（OSMの登録）' },
        { label: '代表点の取り方', value: 'OSMの区画の頂点の平均（区画の内側にあることを確認）。' },
      ] });
  }

  // ---- 124-8 川崎高輪線と池上線（オーナー回答「池上線の中間から分岐」（2026-11-17）、続けて「一覧どおり高輪→分岐点を川崎高輪線にして。」（2026-11-17））
  // 設備一覧の向き：No.129 川崎高輪線＝高輪→発電所、No.128 池上線＝川崎高輪線分岐→池上。分岐点は池上線（地中、2点だけの直線）の中点に置く（推定）
  {
    const O2 = '2026-11-17 オーナー指示「一覧どおり高輪→分岐点を川崎高輪線にして。」';
    const kt = lineById(lines, 'tokyo-section-129'), ik = lineById(lines, 'ledger-tokyo-275-1551517537'), tk = facById(facilities, 'osm-node-14111800029');
    if (kt.connections[0].facilities[0]?.id !== tk.id || kt.paths.length !== 1 || kt.paths[0].length !== 2 || !same(kt.paths[0][0], tk.position)) throw Error('124-8：川崎高輪線の形が想定と違う');
    if (ik.paths.length !== 1 || ik.paths[0].length !== 2 || ik.connections[1].status !== 'shared-node' || !same(ik.paths[0][1], tk.position)) throw Error('124-8：池上線の形が想定と違う');
    const [a, b] = ik.paths[0], mid = [+((a[0] + b[0]) / 2).toFixed(7), +((a[1] + b[1]) / 2).toFixed(7)], fullKm = km([a, b]);
    // 池上線：池上変電所→分岐点（OSM way 1551517537 の池上側の半分）
    ik.paths = [[a, mid]];
    ik.connections = [ik.connections[0], { node: null, position: mid, status: 'shared-node', facilities: [], neighborWays: [] }];
    ik.referenceReview = { status: 'section', endpoints: '池上変電所―川崎高輪線の分岐点（推定）' };
    setAttr(ik, '分岐点の推定', `設備一覧 No.128 の「川崎高輪線分岐」を、池上線の OSM の線（地中、2点だけの直線）の中点とみなした（推定。${OWNER}、${O2}）。`);
    setAttr(ik, '端点の判断', `設備一覧 No.128 のとおり、川崎高輪線の分岐点→池上変電所として描く。OSM の線は高輪変電所の点（node 14111800029）まで続くが、分岐点から高輪変電所までは川崎高輪線（No.129）として描く（${O2}）。`);
    const g1 = ik.attributes.find((x) => x.label === '地理参照'); if (!g1?.value.startsWith('OSM 1線分（計約8.0km）')) throw Error('124-8：池上線の地理参照の文が変わった');
    g1.value = `OSM 1線分（way 1551517537、全長約${fullKm.toFixed(1)}km、地中、2点だけの直線）の池上側の半分（約${km(ik.paths[0]).toFixed(1)}km）。OSMの線名：池上線。高輪側の半分は川崎高輪線として描く。個別回線は未確認。`;
    // 川崎高輪線：高輪変電所→分岐点（池上線の OSM の線の北半分と同じ位置）→川崎火力発電所（直線・ルート不明）
    kt.paths = [[tk.position, mid, kt.paths[0][1]]];
    kt.referenceReview = { status: 'section', endpoints: '高輪変電所―川崎火力発電所（分岐点まで池上線の OSM の地中の位置、その先は直線・ルート不明）' };
    setAttr(kt, '分岐点の推定', `池上線（No.128「川崎高輪線分岐→池上」）が分かれる点を、池上線の OSM の線（地中、2点だけの直線）の中点とみなした（推定。${OWNER}、${O2}）。`);
    setAttr(kt, '地理参照', `線全体をルート不明の表示（破線）で描く。高輪変電所から分岐点までは OSM の池上線（way 1551517537、地中、2点だけの直線）の北半分と同じ位置（約${km([tk.position, mid]).toFixed(1)}km）、分岐点から川崎火力発電所までは直線（約${km([mid, kt.paths[0][2]]).toFixed(1)}km、実際の経路ではない）。`);
  }
}
