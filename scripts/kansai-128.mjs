// 保留128（2026-11-17 オーナー指示、回答「推奨どおり」）：関西の設備・線の追加と修正。scripts/build-kansai.mjs が照合区分の付け直し（applyTiers）の前に呼ぶ。
// 一次資料：関西電力送配電 空容量一覧（154kV以上）の送電線（2026年10月7日更新）と変電所（2026年9月30日更新）。送電線の行の向きは変電所の記号で書かれ、
// 変電所の表で記号と名前が対応する（AG＝南赤穂、AN＝東播、AO＝西神戸、AP＝神戸、AQ＝新神戸、AR＝三宮、AX＝嶺南（275kV側）、BO＝南大阪、BP＝泉北）。
// 位置の当たりに Google マップを使ったものは、座標・名前を記録しない（docs/RULES.md 3節「設備の位置」）。
import { readFileSync } from 'node:fs';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const KS_LINE = '関西電力送配電 空容量一覧（154kV以上・送電線、2026年10月7日更新）';
const KS_SUB = '関西電力送配電 空容量一覧（154kV以上・変電所、2026年9月30日更新）';
const OWNER = '2026-11-17 オーナー指示（保留128）、回答「推奨どおり」';
const FAC = () => read('data/raw/kansai-osm/facilities.json');
const centroid = (g) => [g.reduce((s, p) => s + p.lat, 0) / g.length, g.reduce((s, p) => s + p.lon, 0) / g.length].map((v) => Math.round(v * 1e7) / 1e7);

// OSM の名前のない区画に、一次資料の変電所名を当てて足す（C）
function addNamedSubstation(facilities, osmId, name, code, kv, raw, extra = []) {
  const e = raw.elements.find((x) => x.type === 'way' && x.id === osmId);
  if (!e || e.tags?.power !== 'substation' || e.tags?.name) throw Error('保留128：OSM の区画が想定と違う ' + osmId);
  if (facilities.some((f) => f.id === 'osm-way-' + osmId || f.name === name)) throw Error('保留128：登録済み ' + name);
  const f = { id: 'osm-way-' + osmId, assetId: 'kansai-fac-way-' + osmId, name, kind: 'substation', position: centroid(e.geometry), voltages: kv, scopeConnected: true, url: 'https://www.openstreetmap.org/way/' + osmId,
    attributes: [
      { label: '要注意（C区分）', value: '名前は一次資料の変電所名を、OSM の名前のない区画に当てた推定。' },
      { label: '名称・位置の根拠', value: `${KS_SUB}に「${code}　${name.replace(/変電所$/, '')}（${kv.join('/')}kV）」。位置は OSM の名前のない変電所の区画（way ${osmId}${e.tags?.operator ? '、事業者 ' + e.tags.operator : ''}）。Google マップで当たりを付け、この区画に名前を当てた（推定）。位置は OSM の区画による（国土地理院の地図では未確認）。` },
      { label: 'OSM登録', value: `名称なし${e.tags?.voltage ? '、電圧：' + e.tags.voltage : ''}${e.tags?.operator ? '、事業者：' + e.tags.operator : ''}` },
      ...extra,
      { label: '出典', value: `${KS_SUB}（確認 2026-11-17）。位置は OSM（data/raw/kansai-osm、2026-10-02時点）。${OWNER}。` }] };
  facilities.push(f);
  return f;
}

export function applyKansai128(lines, facilities) {
  const raw = FAC();
  // ---- 128-6 南赤穂変電所（AG、275/77kV）：OSM の名前のない区画（事業者 関西電力送配電）。線はつながない（一覧に南赤穂を端とする 275kV の行はない）
  addNamedSubstation(facilities, 621200283, '南赤穂変電所', 'AG', [275, 77], raw, [
    { label: '系統との接続', value: '接続する送電線は未確認（地図の線につないでいない）。赤穂発電所の連系線（275kV）が区画の近く（約50m）を通るが、位置が近いだけで接続の根拠ではない。' }]);
  // ---- 128-2 青葉線の分岐→高浜原子力発電所：OSM の「青葉線」は分岐点（node 3269615289、地図の青葉線の経路上）で舞鶴側と高浜側に分かれる。
  // 高浜側の2回線の線分（way 324539820）と、発電所の区画に入る1回線の線分（way 324539831）を分岐線として描く（C＋推測）。一覧の 500kV の匿名の行（No.16・18・28 など、発電所→新綾部）のどれに当たるかは未確認
  {
    const ao = lines.find((x) => x.id === 'kansai-plant-500-way-605420894'), tk = facilities.find((x) => x.id === 'osm-way-456491990');
    if (!ao || ao.name !== '青葉線' || !tk) throw Error('128-2：青葉線・高浜原子力発電所がない');
    const L500 = read('data/raw/kansai-osm/lines-500.json').elements, NODE = new Map(L500.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
    const way = (id, a, b) => { const w = L500.find((e) => e.type === 'way' && e.id === id); if (!w || w.tags?.name !== '青葉線' || w.nodes[0] !== a || w.nodes.at(-1) !== b) throw Error('128-2：OSM の線分が想定と違う ' + id); return w.nodes.map((n) => NODE.get(n)); };
    const p1 = way(324539820, 3269615289, 3312442972), p2 = way(324539831, 3312442972, 3312443680);
    if ([p1, p2].flat().some((x) => !x)) throw Error('128-2：点が足りない');
    if (!ao.paths.flat().some((q) => q[0] === p1[0][0] && q[1] === p1[0][1])) throw Error('128-2：分岐点が青葉線の経路にない');
    if (lines.some((x) => x.osmIds.some((i) => [324539820, 324539831].includes(Math.abs(i))))) throw Error('128-2：線分は使用済み');
    const dm = (a, b) => 6371000 * Math.hypot((b[1] - a[1]) * Math.PI / 180 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * Math.PI / 180);
    const km = [p1, p2].reduce((s, p) => s + p.slice(1).reduce((t, q, i) => t + dm(p[i], q), 0), 0) / 1000;
    lines.push({ id: 'kansai-plant-500-way-324539820', assetId: 'kansai-plant-500-way-324539820', name: '青葉線（高浜原子力発電所への分岐、推定）', named: true, voltageKV: 500, currentType: 'ac', osmIds: [324539820, 324539831], paths: [p1, p2],
      connections: [{ node: 3269615289, position: p1[0], status: 'shared-node', facilities: [], neighborWays: [320444669, 324539814] },
        { node: 3312443680, position: p2.at(-1), status: 'facility-area', facilities: [{ id: tk.id, name: tk.name }], neighborWays: [] }],
      referenceReview: { status: 'partial', endpoints: '青葉線との分岐点（推定）―高浜原子力発電所' },
      attributes: [{ label: '要注意（C区分）', value: '一次資料で区間・端点を確定できず、OSMの地理登録で描いた参考表示。' }, { label: '照合区分', value: 'C区分' },
        { label: '分岐点の推定', value: '青葉線との分岐点を、OSM の「青葉線」の線分が舞鶴側と高浜側に分かれる共有ノード（node 3269615289）とみなした（推定）。電気的に分岐でつながるのか、同じ鉄塔に載る別の回線なのかは一次資料では未確認。' },
        { label: '一覧との対応', value: `${KS_LINE}の 500kV の匿名の行（線名・発電所名は伏せてある）（送電線、発電所→D（新綾部）、No.16・18・28 など）のどれに当たるかは未確認。OCCTOに行なし（潮流なし）。` },
        { label: '地理参照', value: `OSM 2線分（way 324539820（青葉線、500kV・2回線）・324539831（青葉線、1回線、発電所の区画に入る）、計約${km.toFixed(1)}km）。分かれ目（node 3312442972）から発電所の区画へは、ほかにも1回線の線分（way 324539833・1210956683〜1210956686）がある（描いていない）。個別回線は未確認。` },
        { label: '出典', value: `地理はOSM（data/raw/kansai-osm、2026-10-02時点、OSMの線名「青葉線」）。${OWNER}「青葉線は分岐して高浜原子力発電所にも接続されているので追加して」。` }] });
  }
  // ---- 128-1 美浜：一覧 No.59・60「送電線 275kV 2回線 発電所→AX（嶺南の275kV側）」の2行に合わせ、地図の 500kV の「美浜原子力発電所の連系線」を 275kV の No.59 に作り替え（ID は残す）、
  // No.60 を OSM の 275kV の線（way 725340694 の全体、美浜の区画の内側から嶺南の縁まで）と嶺南の区画に入る1回線（way 1084685262）で足す。発電所名は一覧で伏せてあり、美浜とするのは推定。
  // ID の数字は線の way 番号（既存の線は発電所の区画の番号）。way 725340694 は way 725359061 とは別の経路（数百m 離れて並ぶ）。way 725340694 の合流点から先は、以前は北陸のデータの「もんじゅの電源線（推定）」が使っていた。もんじゅの線は合流点で止める（scripts/build-hokuriku.mjs、オーナー回答「(a)でno60は美浜原子力発電所の敷地まで伸ばして描いて」2026-11-18）
  {
    const l59 = lines.find((x) => x.id === 'kansai-plant-500-way-605420905');
    if (!l59 || l59.voltageKV !== 500 || l59.osmIds.join() !== '725359061' || l59.connections[0].facilities[0]?.id !== 'osm-way-605420905' || l59.connections[1].facilities[0]?.id !== 'osm-relation-11529219') throw Error('128-1：美浜の連系線が想定と違う');
    const L275 = read('data/raw/kansai-osm/lines-275.json').elements, NODE = new Map(L275.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
    const w = L275.find((e) => e.type === 'way' && e.id === 725340694), w2 = L275.find((e) => e.type === 'way' && e.id === 1084685262);
    if (!w || w.tags?.voltage !== '275000' || w.tags?.circuits !== '2' || w.nodes[0] !== 6802060389 || w.nodes.at(-1) !== 6801965947) throw Error('128-1：OSM の 275kV の線（way 725340694）が想定と違う');
    if (!w2 || w2.nodes.at(-1) !== 6801965947 || w2.nodes.length !== 2) throw Error('128-1：OSM の線（way 1084685262）が想定と違う');
    if (lines.some((x) => x.osmIds.some((i) => [725340694, 1084685262].includes(Math.abs(i))))) throw Error('128-1：線分は使用済み');
    const p = w.nodes.map((n) => NODE.get(n)), p2 = [...w2.nodes].reverse().map((n) => NODE.get(n)); if ([p, p2].flat().some((x) => !x)) throw Error('128-1：点が足りない');
    const dm = (a, b) => 6371000 * Math.hypot((b[1] - a[1]) * Math.PI / 180 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * Math.PI / 180);
    const km = [p, p2].reduce((s, q) => s + q.slice(1).reduce((t, r, i) => t + dm(q[i], r), 0), 0) / 1000;
    const pub = (no) => `${KS_LINE} No.${no}：送電線（線名は伏せてある）、275kV、2回線、発電所→AX。AX＝嶺南変電所の275kV側（${KS_SUB}）。発電所名は伏せてある。`;
    const guess = (no) => `発電所側の端点を美浜原子力発電所とみなした（推定）。一覧の No.59・60 はどちらも発電所→嶺南（275kV 2回線）で、オーナーの説明「275kVの2回線×２」（2026-11-17）による。嶺南に 275kV でつながる発電所はほかにもある（もんじゅ・敦賀など）ため、No.${no} がこの線かは未確認。No.59・60 と2つの経路の対応も未確認（仮に当てた）。`;
    const set = (x, label, value) => { const i = x.attributes.findIndex((a) => a.label === label); if (i < 0) x.attributes.push({ label, value }); else x.attributes[i] = { label, value }; };
    l59.voltageKV = 275; l59.name = '美浜原子力発電所の連系線（No.59、推定）';
    l59.referenceReview = { ...l59.referenceReview, endpoints: '美浜原子力発電所（推定）―嶺南変電所' };
    { const mf = facilities.find((x) => x.id === 'osm-way-605420905'); if (!mf || mf.voltages.join() !== '500') throw Error('128-1：美浜の電圧が想定と違う'); mf.voltages = [275]; }
    set(l59, '一覧との対応', pub(59)); set(l59, '端点の根拠', guess(59));
    set(l59, '電圧の根拠（2026-11-18）', `電圧は一次資料（一覧の No.59・60 は 275kV）に合わせて 500kV→275kV にした。OSM の線（way 725359061）の電圧の登録は 500kV で、一次資料と食い違う（OSM は補助資料）。一覧で嶺南（500kV側）につながる発電所の行は No.25 の1行だけで、地図の 500kV の発電所の線（敦賀・美浜）の2本のうち敦賀に当たると推定した（美浜に当たる 500kV の行は残らない）。オーナー回答「(a)でno60は美浜原子力発電所の敷地まで伸ばして描いて」（2026-11-18）。`);
    set(l59, '出典', `${KS_LINE}（確認 2026-11-17）、${KS_SUB}。地理はOSM（data/raw/kansai-osm、2026-10-02時点）。${OWNER}、回答「(a)でno60は美浜原子力発電所の敷地まで伸ばして描いて」（2026-11-18）。`);
    lines.push({ id: 'kansai-plant-275-way-725340694', assetId: 'kansai-plant-275-way-725340694', name: '美浜原子力発電所の連系線（No.60、推定）', named: false, voltageKV: 275, currentType: 'ac', osmIds: [725340694, 1084685262], paths: [p, p2],
      connections: [{ node: 6802060389, position: p[0], status: 'facility-area', facilities: [{ id: 'osm-way-605420905', name: '美浜原子力発電所' }], neighborWays: [] },
        { node: w2.nodes[0], position: p2.at(-1), status: 'facility-area', facilities: [{ id: 'osm-relation-11529219', name: '嶺南変電所' }], neighborWays: [] }],
      referenceReview: { status: 'partial', endpoints: '美浜原子力発電所（推定）―嶺南変電所' },
      attributes: [{ label: '要注意（C区分）', value: '一次資料で端点の発電所を確定できず、OSMの地理登録で描いた参考表示。' }, { label: '照合区分', value: 'C区分' },
        { label: '一覧との対応', value: pub(60) }, { label: '端点の根拠', value: guess(60) },
        { label: 'もんじゅの電源線との関係', value: '美浜原子力発電所の東約2km（OSM node 6801932107）で、北陸のデータの「もんじゅ（発電所）の電源線（推定）」がこの線に合流する。合流点から先は、以前はもんじゅの電源線として描いていた区間（オーナー回答により 2026-11-18 からこの線として描く）。電気的に合流するのか、同じ鉄塔に載る別の回線かは未確認。' },
        { label: '地理参照', value: `OSM 2線分（way 725340694（275kV・2回線、線名なし）・1084685262（嶺南変電所の区画に入る1回線）、計約${km.toFixed(1)}km）。美浜側の端は美浜原子力発電所の区画の内側。個別回線は未確認。OCCTOに行なし（潮流なし）。` },
        { label: '出典', value: `${KS_LINE}（確認 2026-11-17）。地理はOSM（data/raw/kansai-osm、2026-10-02時点）。${OWNER}、回答「(a)でno60は美浜原子力発電所の敷地まで伸ばして描いて」（2026-11-18）。` }] });
  }
}

// 直線で描く線（端点・経路の照合区分を自分で付ける）は、照合区分の付け直し（applyTiers）のあとで足す。applyTiers は直線を一律 D にするため（端が推定の直線は C＋推測にする：docs/RULES.md 3節）
export function applyKansai128Late(lines, facilities) {
  const raw = FAC();
  // ---- 128-3 泉北変電所・堺港発電所と、No.89（発電所→泉北）・No.86 南大阪泉北線（泉北→南大阪）。OSM に経路がないため両端を直線で結ぶ（ルート不明・破線）
  {
    const F = raw.elements, fac = (id) => { const f = facilities.find((x) => x.id === id); if (!f) throw Error('128-3：設備がない ' + id); return f; };
    const osm = (id, name) => { const e = F.find((x) => x.type === 'way' && x.id === id); if (!e || e.tags?.name !== name) throw Error('128-3：OSM の区画が想定と違う ' + id); return e; };
    if (facilities.some((f) => /泉北変電所|堺港/.test(f.name))) throw Error('128-3：登録済み');
    const sb = osm(191939689, '泉北変電所'), sk = osm(605687568, '堺港火力発電所');
    facilities.push({ id: 'osm-way-191939689', assetId: 'kansai-fac-way-191939689', name: '泉北変電所', kind: 'substation', position: centroid(sb.geometry), voltages: [275, 77], scopeConnected: true, url: 'https://www.openstreetmap.org/way/191939689',
      attributes: [{ label: 'OSM登録', value: '名称：泉北変電所' }, { label: '名称の確認', value: `${KS_SUB}に「BP　泉北（275/77kV）」。OSM の区画の名前「泉北変電所」が一致したので当てた（OSM に電圧・事業者のタグはない）。位置は OSM の区画による（国土地理院の地図では未確認）。` },
        { label: '出典', value: `${KS_SUB}（確認 2026-11-17）。位置は OSM の区画（data/raw/kansai-osm、2026-10-02時点）。${OWNER}「泉北変電所がないので追加。」。` }] });
    facilities.push({ id: 'osm-way-605687568', assetId: 'kansai-fac-way-605687568', name: '堺港発電所', kind: 'plant', position: centroid(sk.geometry), voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/605687568',
      attributes: [{ label: '別名', value: '堺港火力発電所（OSM の名前）' }, { label: 'OSM登録', value: '種別：ガス、事業者：関西電力株式会社。運転状態は未照合（号機と出力は HJKS で確認。発電所出力は送電容量として扱わない）。' },
        { label: '名称の確認', value: 'HJKS の発電所名「堺港発電所」（関西電力株式会社、2026-10-09 取得のユニット一覧）。' },
        { label: '出典', value: `HJKS（2026-10-09取得）。位置は OSM の区画（data/raw/kansai-osm、2026-10-02時点）。${OWNER}「そこから堺港発電所への送電線と発電所を追加。」。` }] });
    const minami = fac('osm-way-108199478');
    const SPEC = [
      ['kansai-275-送電線No.89', '堺港発電所の電源線（No.89、推定）', 'osm-way-605687568', 'osm-way-191939689', -8901, 89, '送電線（線名は伏せてある）、275kV、2回線、発電所→BP（泉北）。', '発電所側の端点を堺港発電所とみなした（推定）。一覧の No.89 は発電所→泉北で発電所名は伏せてある。オーナーの説明「泉北変電所…そこから堺港発電所への送電線」（2026-11-17）による。'],
      ['kansai-275-南大阪泉北線', '南大阪泉北線', 'osm-way-191939689', 'osm-way-108199478', -8601, 86, '南大阪泉北線、275kV、2回線、BP（泉北）→BO（南大阪）。', null],
    ];
    for (const [id, name, aId, bId, osmId, no, row, guess] of SPEC) {
      if (lines.some((l) => l.id === id)) throw Error('128-3：登録済み ' + id);
      const a = fac(aId), b = fac(bId);
      lines.push({ id, assetId: id, name, named: !guess, voltageKV: 275, currentType: 'ac', schematic: true, construction: 'unknown', osmIds: [osmId], sourceOsmIds: [], schematicParts: [{ osmId, construction: 'unknown' }], paths: [[a.position, b.position]],
        connections: [{ node: null, position: a.position, status: 'facility-area', facilities: [{ id: a.id, name: a.name }], neighborWays: [] }, { node: null, position: b.position, status: 'facility-area', facilities: [{ id: b.id, name: b.name }], neighborWays: [] }],
        referenceReview: { status: guess ? 'partial' : 'section', endpoints: `${a.name}${guess ? '（推定）' : ''}―${b.name}（直線・ルート不明）` },
        attributes: [guess ? { label: '要注意（C区分）', value: '端点の発電所は一覧で伏せてあり推定。経路は不明のため両端を直線で結んだ表示（実際のルートではない）。' }
          : { label: '要注意（D区分・ルート不明）', value: '両端は一次資料で分かるが、地理経路が OSM に登録されていないため、両端を直線で結んだ表示（実際のルートではない）。' },
          { label: '照合区分', value: guess ? 'C区分' : 'D区分' },
          { label: '照合の根拠', value: guess ? '一覧に行はあるが発電所名が伏せてあり、端点の発電所を推定した直線（経路も不明）。' : '両端は一覧の記号（変電所の表で名前と対応）で確定。経路が不明のため直線。' },
          { label: '一覧との対応', value: `${KS_LINE} No.${no}：${row}BP＝泉北、BO＝南大阪（${KS_SUB}）。OCCTOに行なし（潮流なし）。` },
          ...(guess ? [{ label: '端点の根拠', value: guess }] : []),
          { label: '地中・架空', value: '地中・架空の別は不明（OSM に経路がない）→破線。' },
          { label: '出典', value: `${KS_LINE}（確認 2026-11-17）。端点の位置は地図の設備の位置。${OWNER}。` }] });
    }
  }
  // ---- 128-4 三宮変電所・神戸発電所と、No.50 三宮線（三宮→神戸）・No.51（発電所→三宮）・No.92（発電所→新神戸）。神戸の市街地の3回線で OSM に経路がない→直線（線種不明＝破線）
  // オーナーの指示文の「新神戸発電所」は新神戸変電所（AQ）と読んだ（2026-11-17 回答「推奨どおり」）
  {
    const F = raw.elements, fac = (id) => { const f = facilities.find((x) => x.id === id); if (!f) throw Error('128-4：設備がない ' + id); return f; };
    if (facilities.some((f) => /三宮変電所|^神戸発電所/.test(f.name))) throw Error('128-4：登録済み');
    const kb = F.find((x) => x.type === 'way' && x.id === 456491991); if (!kb || kb.tags?.name !== '神鋼神戸発電所') throw Error('128-4：OSM の区画が想定と違う 456491991');
    // 三宮変電所（AR、275/77kV）：OSM に区画がなく、市街地の建物の中。Google マップで当たりを付け、国土地理院の標準地図でその建物の中心を読んだ位置（推定）
    facilities.push({ id: 'kansai-place-三宮変電所', assetId: 'kansai-place-三宮変電所', name: '三宮変電所', kind: 'substation', position: [34.6889, 135.1944], voltages: [275, 77], scopeConnected: true,
      attributes: [{ label: '要注意（位置推定）', value: '変電所の区画・名称が OSM にも国土地理院の地図注記にもないため、位置は推定。' },
        { label: '位置の根拠', value: 'Google マップで当たりを付けた。国土地理院 標準地図（2026-11-16取得）で当たりの位置にある建物の中心付近。市街地の建物の中で、空中写真では変電設備を確かめられない。' },
        { label: '名称の確認', value: `${KS_SUB}に「AR　三宮（275/77kV）」。` },
        { label: '出典', value: `${KS_SUB}（確認 2026-11-17）。${OWNER}「三宮変電所を追加。」。` }] });
    facilities.push({ id: 'osm-way-456491991', assetId: 'kansai-fac-way-456491991', name: '神戸発電所', kind: 'plant', position: centroid(kb.geometry), voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/456491991',
      attributes: [{ label: '別名', value: '神鋼神戸発電所（OSM の名前）' }, { label: 'OSM登録', value: '種別：石炭、事業者：神鋼神戸発電株式会社。運転状態・号機構成は未照合（10万kW以上の号機の出力は HJKS で確認。発電所出力は送電容量として扱わない）。' },
        { label: '名称の確認', value: 'HJKS の発電所名「神戸発電所」（株式会社コベルコパワー神戸、株式会社コベルコパワー神戸第二、2026-10-09 取得のユニット一覧）。国土地理院 標準地図（2026-11-16取得）の注記は「神鋼火力発電所」。' },
        { label: '出典', value: `HJKS（2026-10-09取得）。位置は OSM の区画（data/raw/kansai-osm、2026-10-02時点）。${OWNER}「神戸発電所を追加して」。` }] });
    const SPEC = [
      ['kansai-275-三宮線', '三宮線', 'kansai-place-三宮変電所', 'osm-way-839369877', -5001, 50, '三宮線、275kV、3回線、AR（三宮）→AP（神戸）。', null],
      ['kansai-275-送電線No.51', '神戸発電所の電源線（No.51、推定）', 'osm-way-456491991', 'kansai-place-三宮変電所', -5101, 51, '送電線（線名は伏せてある）、275kV、3回線、発電所→AR（三宮）。', '発電所側の端点を神戸発電所とみなした（推定）。一覧の No.51 は発電所→三宮で発電所名は伏せてある。オーナーの説明「神戸発電所を追加して、そこから…三宮変電所への送電線も追加」（2026-11-17）による。'],
      ['kansai-275-送電線No.92', '神戸発電所の電源線（No.92、推定）', 'osm-way-456491991', 'osm-way-110340505', -9201, 92, '送電線（線名は伏せてある）、275kV、3回線、発電所→AQ（新神戸）。', '発電所側の端点を神戸発電所とみなした（推定）。一覧の No.92 は発電所→新神戸で発電所名は伏せてある。オーナーの説明「神戸発電所を追加して、そこから新神戸発電所…への送電線も追加」（2026-11-17、「新神戸発電所」は新神戸変電所と読んだ）による。'],
    ];
    for (const [id, name, aId, bId, osmId, no, row, guess] of SPEC) {
      if (lines.some((l) => l.id === id)) throw Error('128-4：登録済み ' + id);
      const a = fac(aId), b = fac(bId);
      lines.push({ id, assetId: id, name, named: !guess, voltageKV: 275, currentType: 'ac', schematic: true, construction: 'unknown', osmIds: [osmId], sourceOsmIds: [], schematicParts: [{ osmId, construction: 'unknown' }], paths: [[a.position, b.position]],
        connections: [{ node: null, position: a.position, status: 'facility-area', facilities: [{ id: a.id, name: a.name }], neighborWays: [] }, { node: null, position: b.position, status: 'facility-area', facilities: [{ id: b.id, name: b.name }], neighborWays: [] }],
        referenceReview: { status: guess ? 'partial' : 'section', endpoints: `${a.name}${guess ? '（推定）' : ''}―${b.name}（直線・ルート不明）` },
        attributes: [guess ? { label: '要注意（C区分）', value: '端点の発電所は一覧で伏せてあり推定。経路は不明のため両端を直線で結んだ表示（実際のルートではない）。' }
          : { label: '要注意（D区分・ルート不明）', value: '両端は一次資料で分かるが、地理経路が OSM に登録されていないため、両端を直線で結んだ表示（実際のルートではない）。三宮変電所の位置は推定。' },
          { label: '照合区分', value: guess ? 'C区分' : 'D区分' },
          { label: '照合の根拠', value: guess ? '一覧に行はあるが発電所名が伏せてあり、端点の発電所を推定した直線（経路も不明）。' : '両端は一覧の記号（変電所の表で名前と対応）で確定。経路が不明のため直線。' },
          { label: '一覧との対応', value: `${KS_LINE} No.${no}：${row}AP＝神戸、AQ＝新神戸、AR＝三宮（${KS_SUB}）。OCCTOに行なし（潮流なし）。` },
          ...(guess ? [{ label: '端点の根拠', value: guess }] : []),
          { label: '地中・架空', value: '地中・架空の別は不明（OSM に経路がない）→破線。' },
          { label: '出典', value: `${KS_LINE}（確認 2026-11-17）。端点の位置は地図の設備の位置。${OWNER}。` }] });
    }
  }
  // ---- 128-5 東播変電所（AN、275/77kV）と東播支線（No.46、AN→AO）の描き直し。今の「東播支線（推定）」（OSM way 967479427、西神戸変電所の近くの約0.7km）は東播に届いていない。
  // 国土地理院の送電線記号で、西神戸線の点（OSM node 1956121368）から南西へ分かれて東播変電所の区画に入る線をなぞり、ID は残して描き直す（分岐点は推定）。照合表は変えない
  {
    const tb = addNamedSubstation(facilities, 961857473, '東播変電所', 'AN', [275, 77], raw, [
      { label: '系統との接続', value: '東播支線（推定の分岐点で西神戸線から分かれる）が区画に入る。OCCTO の照合表では西神戸線の終点が「新加古川変電所（東播変電所）」で、一覧（AM 新加古川・AN 東播を別の変電所として載せる）と食い違う（照合表は変えていない）。' }]);
    const nk = lines.find((x) => x.id === 'kansai-275-西神戸線'), l = lines.find((x) => x.id === 'ledger-infer-kansai-275-967479427');
    if (!nk || !l || l.name !== '東播支線（推定）' || l.osmIds.join() !== '967479427') throw Error('128-5：西神戸線・東播支線が想定と違う');
    const BR = [34.7646193, 134.9653541];
    if (!nk.paths.flat().some((q) => q[0] === BR[0] && q[1] === BR[1])) throw Error('128-5：分岐点が西神戸線の経路にない');
    // 国土地理院 ベクトルタイル（試験公開、experimental_bvmap、送電線 ftCode 8202、2026-11-18取得）の点。最後の点は東播変電所の区画の内側
    const GSI = [[34.76418, 134.96485], [34.76347, 134.96411], [34.7634, 134.96402], [34.76248, 134.96246], [34.76226, 134.9621], [34.76174, 134.96155], [34.76084, 134.96059], [34.75998, 134.96]];
    const path = [BR, ...GSI], dm = (a, b) => 6371000 * Math.hypot((b[1] - a[1]) * Math.PI / 180 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * Math.PI / 180);
    const km = path.slice(1).reduce((s, q, i) => s + dm(path[i], q), 0) / 1000;
    const old = l.paths[0];
    l.osmIds = [-4601]; l.sourceOsmIds = []; l.paths = [path]; l.tracedParts = [{ osmId: -4601, basis: '国土地理院の送電線記号' }];
    l.connections = [{ node: 1956121368, position: BR, status: 'shared-node', facilities: [], neighborWays: [185032771] },
      { node: null, position: path.at(-1), status: 'facility-area', facilities: [{ id: tb.id, name: tb.name }], neighborWays: [] }];
    l.referenceReview = { status: 'partial', endpoints: '西神戸線との分岐点（推定）―東播変電所' };
    l.attributes = [{ label: '要注意（C区分）', value: '分岐点は推定、経路は国土地理院の送電線記号による参考表示。' }, { label: '照合区分', value: 'C区分' },
      { label: '照合の根拠', value: '一覧の行（No.46 東播支線 AN→AO）はあるが、西神戸線との分岐点を推定した。' },
      { label: '公表の行', value: `${KS_LINE} No.46：東播支線（275kV）、2回線、AN→AO。AN＝東播、AO＝西神戸（${KS_SUB}）。OCCTOに行なし（潮流なし）。` },
      { label: '分岐点の推定', value: '西神戸線との分岐点を、国土地理院の送電線記号が西神戸線から分かれる所に最も近い西神戸線の点（OSM node 1956121368、約3m）とみなした（推定）。電気的に分岐でつながるのか、同じ鉄塔に載る別の回線なのかは未確認。' },
      { label: '地理参照', value: `国土地理院の送電線記号をなぞった約${km.toFixed(1)}km（OSM に線がない）。東播変電所側の端は区画の内側。個別回線は未確認。` },
      { label: '描き直し（2026-11-18）', value: `以前は西神戸変電所の近くの OSM の線（way 967479427、約0.7km、${old[0].map((v) => v.toFixed(4)).join(',')} 付近）を東播支線と推定していたが、東播変電所に届いていなかった。ID はそのままで描き直した。${OWNER}「東播変電所を追加して、西神戸線から分岐する東播支線を追加」。` },
      { label: '出典', value: `${KS_LINE}（確認 2026-11-17）。経路は国土地理院 ベクトルタイル（試験公開、experimental_bvmap、送電線 ftCode 8202、2026-11-18取得）。東播変電所は OSM の区画（data/raw/kansai-osm）。` }];
  }
}
