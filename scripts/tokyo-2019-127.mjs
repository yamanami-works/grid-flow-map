// 保留127：東京PG「275kV以上系統 空容量マッピング」2019年4月24日作成の旧版（系統は2019年4月22日時点）の系統図による接続の見直し。
// scripts/build-tokyo-pilot.mjs が applyTokyoCheck1117 のあとに呼ぶ。資料の記録と照合表は docs/research/tokyo-akiyouryou-2019.md。
// オーナー回答（2026-11-17、原文）：「K1は承認。…K11と方針は承認」。方針：2019年の資料だけで裏付けられる接続は照合区分 B（「2019年時点」と明記）。
// 資料は転載禁止のため、数値と図は入れない。
import fs from 'node:fs';
const SRC2019 = '東京PG「275kV以上系統 空容量マッピング」（2019年4月24日作成の旧版、系統は2019年4月22日時点、https://www.tepco.co.jp/pg/consignment/system/pdf/akiyouryou_kikan.pdf 、確認日 2026-11-17。原本は保存するがリポジトリに入れない）';
const OWNER = '2026-11-17 オーナー回答（保留127）';

function lineById(lines, id) { const l = lines.find((x) => x.id === id); if (!l) throw Error('保留127：線がない ' + id); return l; }
function setAttr(o, label, value) { const i = o.attributes.findIndex((a) => a.label === label); if (i < 0) o.attributes.push({ label, value }); else o.attributes[i] = { label, value }; }
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

export function applyTokyo2019(lines, facilities) {
  // ---- K1：No.15 を常陸那珂火力線（那珂—常陸那珂）に当て直し、OSM から描いていた plant- の線を No.15 に統合する
  {
    const s15 = lineById(lines, 'tokyo-section-15'), s14 = lineById(lines, 'tokyo-section-14'), pi = lines.findIndex((x) => x.id === 'plant-tokyo-275-103827618');
    if (pi < 0) throw Error('K1：常陸那珂火力線（plant-）がない');
    const p = lines[pi];
    if (s15.osmIds.join() !== s14.osmIds.join() || s15.connections.at(-1).facilities[0]?.id !== 'osm-relation-1527911') throw Error('K1：No.15 が想定（No.14 と同じ線で東海第二まで）と違う');
    if (p.connections[0].facilities[0]?.id !== 'osm-way-103827577' || p.connections[1].facilities[0]?.id !== 'osm-way-105291887') throw Error('K1：常陸那珂火力線の端が想定と違う');
    const paths = [...p.paths].reverse().map((x) => [...x].reverse());
    for (let k = 1; k < paths.length; k++) if (!same(paths[k][0], paths[k - 1].at(-1))) throw Error('K1：経路がつながらない');
    if (!same(paths[0][0], p.connections[1].position) || !same(paths.at(-1).at(-1), p.connections[0].position)) throw Error('K1：経路の端と接続点が合わない');
    const geo = p.attributes.find((a) => a.label === '地理参照')?.value ?? '';
    s15.name = '常陸那珂火力線'; s15.named = true;
    s15.paths = paths; s15.osmIds = [...p.osmIds].reverse(); s15.sourceOsmIds = [...p.osmIds].reverse();
    s15.connections = [p.connections[1], p.connections[0]];
    s15.referenceReview = { status: 'section', endpoints: '那珂変電所―常陸那珂火力発電所' };
    s15.attributes = s15.attributes.filter((a) => !/^要注意/.test(a.label));
    setAttr(s15, '照合区分', 'B区分');
    setAttr(s15, '公表区間', '東京PG 基幹275kV No.15：端点匿名（2回線）。2019年の系統図では「常陸那珂火力線（15）」で那珂—常陸那珂（2019年時点）。');
    setAttr(s15, '名称の出典', `線名「常陸那珂火力線」は ${SRC2019} の系統図の表記（2019年時点の名称）。今の東京PG の資料（設備一覧・系統構成図）では名前と発電所が伏せてある。`);
    setAttr(s15, '端点の根拠', `2019年の系統図で（15）は那珂変電所から常陸那珂（発電所）への線。今の系統構成図の(15)は「那珂から匿名発電所《1002017》」。2019年時点の構成として、系統図の（15）で両端を確かめた（照合区分 B）。`);
    setAttr(s15, '地理参照', `OSMの線名：常陸那珂火力線。${geo}`);
    setAttr(s15, '経路の差し替え（2026-11-17）', '以前は No.14 と同じ OSM の線（那珂—東海第二、東海原子力線を経由）に重ねて描いていた。2019年の系統図に合わせ、OSM から別に描いていた「常陸那珂火力線」（plant-tokyo-275-103827618）の経路に替え、その線は No.15 に統合した（ID・公表区間は No.15 のまま）。');
    setAttr(s15, '出典', `東京PG系統構成・設備一覧2026-06-22版（基幹275kV）、${SRC2019}。地理はOSM（app/data/raw の全取得、2026-09-20～10-06取得）。${OWNER}「K1は承認」。`);
    lines.splice(pi, 1);
  }
  // ---- K11：電源線の名前を2019年の系統図の名称で補う（No.30・31。No.15 は K1）
  {
    for (const [id, name, other] of [['tokyo-section-30', '千葉火力線1・2L', '1・2L'], ['tokyo-section-31', '千葉火力線3・4L', '3・4L']]) {
      const l = lineById(lines, id); if (l.name !== `送電線No.${id.slice(-2)}（電源線）`) throw Error('K11：名前が想定と違う ' + id);
      l.name = name;
      setAttr(l, '名称の出典', `線名は ${SRC2019} の系統図の表記「（${id.slice(-2)}）千葉火力線${other.replace('・', ',')}」（2019年時点の名称）。今の東京PG の資料では名前と発電所が伏せてある。`);
      setAttr(l, '公表区間との対応', `系統構成図(30)(31)はどちらも千葉中央から《1002014》の発電所記号へ向かう。2019年の系統図では（30）が千葉火力線1,2L、（31）が千葉火力線3,4L（2019年時点）。(${id.slice(-2)})を OSM の千葉火力線${other}に対応付けたのは推定（今の資料では番号と線の対応が伏せてあり、2019年時点の表記に基づくため、今も同じかは確かめられない）。`);
    }
  }
  // ---- K2：信濃川変電所（推定）の位置を、信濃川発電所の南の区画（オーナーが地図で指定、2026-11-17）へ移す。名前・ID は変えない。
  // 中東京幹線の2本を、国土地理院の送電線記号（川を渡る2本）に沿って新しい位置まで延ばす。信濃川発電所（OSM）はそのまま
  {
    const f = facilities.find((x) => x.id === 'tokyo-est-信濃川変電所'); if (!f) throw Error('K2：信濃川変電所がない');
    const yama = lineById(lines, 'ledger-tokyo-275-232998813'), naka = lineById(lines, 'ledger-tokyo-275-319098733');
    const old = f.position, dm = (a, b) => 6371000 * Math.hypot((b[1] - a[1]) * Math.PI / 180 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * Math.PI / 180);
    const yEnd = yama.paths.at(-1).at(-1), nStart = naka.paths[0][0];
    if (yama.connections.at(-1).facilities[0]?.id !== f.id || naka.connections[0].facilities[0]?.id !== f.id) throw Error('K2：中東京幹線の端が信濃川変電所でない');
    if (dm(yEnd, [37.0522627, 138.6858449]) > 1 || dm(nStart, [37.05175, 138.6852295]) > 1) throw Error('K2：中東京幹線の端の位置が想定と違う');
    // 国土地理院の送電線記号（ftCode 8202、2026-11-17取得）の点。東側の点は中東京幹線の端から約12m以内、西側の点は区画の東の縁
    const GSI_Y = [[37.05224, 138.68591], [37.05255, 138.68336]], GSI_N = [[37.05184, 138.68531], [37.05215, 138.68333]];
    if (dm(GSI_Y[0], yEnd) > 15 || dm(GSI_N[0], nStart) > 15) throw Error('K2：記号の端と線の端が離れすぎ');
    const pos = [37.0527, 138.6830];
    f.position = pos;
    setAttr(f, '要注意（位置推定）', '変電所の区画・名称がOSMにも国土地理院の地図注記にもないため、位置は推定。');
    setAttr(f, '位置の根拠', `オーナーが地図で指定した区画（信濃川発電所の南、川の西岸。2026-11-17）。国土地理院の地図で、東から川を渡る送電線記号がこの区画の東の縁に集まる。座標は区画の中ほどを地図から読んだ値。以前（2026-10-10）は川の東の、OSM の線が集まる2点の中点（約${Math.round(dm(old, pos))}m 東）に置いていた。`);
    const add = (l, atEnd, route, osmId) => {
      if (atEnd) { l.paths.push([l.paths.at(-1).at(-1), ...route, pos]); l.osmIds.push(osmId); l.connections[l.connections.length - 1] = { ...l.connections.at(-1), node: null, position: pos }; }
      else { l.paths.unshift([pos, ...[...route].reverse(), l.paths[0][0]]); l.osmIds.unshift(osmId); l.connections[0] = { ...l.connections[0], node: null, position: pos }; }
      l.tracedParts = [...(l.tracedParts ?? []), { osmId, basis: '国土地理院の送電線記号' }];
      const seg = atEnd ? l.paths.at(-1) : l.paths[0];
      const m = Math.round(seg.slice(1).reduce((s, q, i) => s + dm(seg[i], q), 0));
      const e = l.attributes.find((a) => a.label === '端点の判断'); if (!e) throw Error('K2：端点の判断がない ' + l.id);
      const before = e.value;
      e.value = e.value
        .replace(/終点の信濃川変電所はOSMに区画がなく、[^。]*で止める。/, '終点の信濃川変電所はOSM・国土地理院の地図注記に区画・名称がない。')
        .replace(/位置は一次資料で未確認。東京電力 信濃川発電所の区画の東で[^。]*で止める。/, '位置は一次資料で未確認。')
        .replace(' 2026-10-10 オーナー判断で信濃川変電所を推定位置（2点の中点）に置き、この端をつないだ。', ' 2026-10-10 オーナー判断で信濃川変電所（推定）にこの端をつないだ（位置は 2026-11-17 に移した）。');
      if (e.value === before) throw Error('K2：端点の判断の文が想定と違う ' + l.id);
      setAttr(l, '信濃川側の端（2026-11-17）', `OSM の線の端（川の東岸）から先は、国土地理院の送電線記号に沿って川を渡り、オーナーが地図で指定した信濃川変電所の位置（推定）まで約${m}m を描く（最後の数十m は区画の中で変電所の点まで直線）。記号からは接続先を決めていない。2026-11-17 オーナー回答「信濃川変電所は赤丸の場所」。`);
    };
    add(yama, true, GSI_Y, -9912701);
    add(naka, false, GSI_N, -9912702);
    for (const l of [yama, naka]) for (let k = 1; k < l.paths.length; k++) if (!same(l.paths[k][0], l.paths[k - 1].at(-1))) throw Error('K2：経路がつながらない ' + l.id);
  }
  // ---- K7・K8・K9：2019年の系統図にある電源線 No.142・106・32 を、両端を直線で結んで描く（OSM に経路がない。2026-11-17 オーナー回答「K7、8、９は承認」）
  {
    const fac = (id) => { const f = facilities.find((x) => x.id === id); if (!f) throw Error('K7〜K9：設備がない ' + id); return f; };
    if (lines.some((l) => ['tokyo-section-142', 'tokyo-section-106', 'tokyo-section-32'].includes(l.id))) throw Error('K7〜K9：登録済み');
    // K9：JFE千葉。OSM の「JFE Steel East Power Plant」（way 1165957087、power=plant、名前の英語表記だけ）に、2019年の系統図の名称「JFE千葉」を当てる（推定）
    if (facilities.some((f) => f.id === 'osm-way-1165957087')) throw Error('K9：JFE千葉が登録済み');
    const raw = JSON.parse(fs.readFileSync('data/raw/tokyo-osm/facilities.json', 'utf8')), at = raw.osm3s?.timestamp_osm_base?.slice(0, 10);
    const w = raw.elements.find((e) => e.type === 'way' && e.id === 1165957087);
    if (!w || w.tags?.name !== 'JFE Steel East Power Plant' || w.tags?.power !== 'plant' || !at) throw Error('K9：OSM の区画が変わった');
    const ring = w.geometry.map((q) => [q.lat, q.lon]), v = ring.slice(0, -1), jpos = [v.reduce((s, q) => s + q[0], 0) / v.length, v.reduce((s, q) => s + q[1], 0) / v.length];
    const jfe = { id: 'osm-way-1165957087', assetId: 'osm-way-1165957087', name: 'JFE千葉', kind: 'plant', position: jpos, voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/1165957087',
      attributes: [
        { label: '要注意（C区分）', value: '名前は2019年の系統図の表記を、OSM の区画に当てた推定。' },
        { label: '名称・位置の根拠', value: `名前「JFE千葉」は ${SRC2019} の系統図の発電所の表記（千葉中央変電所に（32）でつながる）。位置は OSM の発電所の区画（way 1165957087、OSMの名前は英語表記「JFE Steel East Power Plant」、${at}時点）。系統図上の並び（千葉中央から（32）でつながる発電所）と矛盾しないことから名前を当てた（推定）。` },
        { label: '種別', value: '事業者・発電方式・出力・運転状態は一次資料で未照合。需要家の自家発か発電事業者かも未確認。発電所の出力は送電容量として扱わない。' },
        { label: '出典', value: `${SRC2019}。位置は OSM（data/raw/tokyo-osm、${at}時点）。${OWNER}「K7、8、９は承認」。` }] };
    facilities.push(jfe);
    const SPEC = [
      ['tokyo-section-142', '送電線No.142（電源線）', 'osm-way-605327349', 'osm-way-588341171', -142, 'D', '2019年の系統図で（142）は横浜（火力）—扇島パワー。今の資料では線名・端点が伏せてある。', null],
      ['tokyo-section-106', '東扇島火力線', 'osm-way-82104580', 'osm-way-605327352', -106, 'D', '2019年の系統図で東扇島火力線（106）は南川崎—東扇島。今の資料では線名・端点が伏せてある。線名は2019年時点の名称。', null],
      ['tokyo-section-32', '送電線No.32（電源線）', 'osm-way-211241774', 'osm-way-1165957087', -32, 'C', '2019年の系統図で（32）は千葉中央—JFE千葉。今の資料では線名・端点が伏せてある。', 'JFE千葉側の端点は、2019年の系統図の「JFE千葉」を OSM の区画に当てた設備とみなした（推定）。'],
    ];
    for (const [id, name, aId, bId, osmId, tier, sec, guess] of SPEC) {
      const a = fac(aId), b = fac(bId);
      const attributes = [{ label: '照合区分', value: tier + '区分' },
        tier === 'D' ? { label: '要注意（D区分・ルート不明）', value: '両端は分かるが地理経路がOSMに登録されていないため、両端を直線で結んだ表示。実際のルートではない。' }
          : { label: '要注意（C区分）', value: '端点の一方が名前を当てた推定の設備で、経路は不明のため両端を直線で結んだ表示。実際のルートではない。' },
        { label: '公表区間', value: `東京PG 基幹275kV No.${osmId * -1}：線名・端点匿名（2回線）。${sec}` },
        { label: '端点の根拠', value: (guess ? guess + ' ' : '') + `両端は ${SRC2019} の系統図による（2019年時点）。` },
        { label: '地中・架空', value: '地中・架空の別は不明→破線。' },
        { label: '出典', value: `東京PG系統構成・設備一覧2026-06-22版（基幹275kV）の No.${osmId * -1}、${SRC2019}。端点の位置は地図の設備の位置。${OWNER}「K7、8、９は承認」。` }];
      lines.push({ id, assetId: id, name, voltageKV: 275, currentType: 'ac', named: !name.startsWith('送電線No.'), schematic: true, construction: 'unknown', paths: [[a.position, b.position]], osmIds: [osmId], sourceOsmIds: [], schematicParts: [{ osmId, construction: 'unknown' }], tsoSection: null,
        connections: [{ node: null, position: a.position, status: 'facility-area', facilities: [{ id: a.id, name: a.name }], neighborWays: [] }, { node: null, position: b.position, status: 'facility-area', facilities: [{ id: b.id, name: b.name }], neighborWays: [] }],
        referenceReview: { status: 'section', endpoints: `${a.name}―${b.name}（直線・ルート不明）` }, attributes });
    }
  }
  // ---- K10：鹿島（2026-11-17 オーナー回答「既存の日本製鉄鹿島火力発電所場所は鹿島パワーに。…その南南西に鹿島共同火力発電所を描写。既存の「鹿島変電所から北への線（名称未確認）」の送電線をNo40（推定）にする。」、
  // 確認への回答「紫色が鹿島パワー線。赤丸で囲んだ発電所の位置で追加。」）。日本製鉄鹿島火力発電所・鹿島共同火力発電所の -place は docs/research/plant-primary-sources.json の addFacilities で足す
  {
    const kp = facilities.find((x) => x.id === 'osm-way-754317488');
    if (!kp || kp.name !== '日本製鉄鹿島火力発電所') throw Error('K10：OSM の日本製鉄鹿島火力発電所の区画がない');
    for (const id of ['tokyo-place-日本製鉄鹿島火力発電所', 'tokyo-place-鹿島共同火力発電所']) if (!facilities.some((f) => f.id === id)) throw Error('K10：設備がない ' + id);
    const old = kp.name;
    kp.name = '鹿島パワー 鹿島火力発電所';
    for (const l of lines) for (const c of l.connections ?? []) for (const x of c.facilities ?? []) if (x.id === kp.id) x.name = kp.name;
    { const kl = lineById(lines, 'plant-tokyo-275-1082612595'); kl.referenceReview = { ...kl.referenceReview, endpoints: kl.referenceReview.endpoints.replace(old, kp.name) };
      for (const a of kl.attributes) a.value = a.value.split(old).join(kp.name);
      if (JSON.stringify(kl).includes(old)) throw Error('K10：鹿島パワー線に旧名が残る'); }
    setAttr(kp, '別名', old + '（OSM の名前）');
    setAttr(kp, 'OSM登録', '種別：石炭、事業者：日本製鉄株式会社；鹿島パワー株式会社（OSM の登録）。運転状態・号機構成は未照合（発電所出力は送電容量として扱わない）。');
    setAttr(kp, '要注意（C区分・名称）', '名前はオーナーの説明（2026-11-17）による。一次資料では未確認（HJKS の転記 2026-10-09 に鹿島パワーの行はない。事業者の資料は未確認）。');
    setAttr(kp, '名称の根拠', `鹿島パワー線の端の OSM の区画（way 754317488、OSM の名前「日本製鉄鹿島火力発電所」、事業者「日本製鉄株式会社；鹿島パワー株式会社」）を、オーナーの説明で鹿島パワーの鹿島火力発電所とした。日本製鉄の鹿島火力発電所（HJKS「日本製鉄㈱ 鹿島発電所」）は、オーナーが示した位置に別の設備（tokyo-place-日本製鉄鹿島火力発電所）として置いた。${OWNER}。`);
    // 北への線を No.40 の分岐の残る一方（推定）とする。tsoSection・照合表は変えない。北の端はつながない
    const n = lineById(lines, 'tokyo-feeder-275-300345941');
    if (n.name !== '鹿島変電所から北への線（名称未確認）' || n.connections.at(-1).status !== 'unresolved') throw Error('K10：北への線が想定と違う');
    const kj = facilities.find((x) => x.id === 'tokyo-place-鹿島共同火力発電所'), endP = n.paths.at(-1).at(-1);
    const dm = (a, b) => 6371000 * Math.hypot((b[1] - a[1]) * Math.PI / 180 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * Math.PI / 180);
    n.name = '送電線No.40（推定・分かれ先）';
    n.attributes = n.attributes.filter((a) => a.label !== '要注意（E区分）');
    setAttr(n, '照合区分', 'C区分');
    setAttr(n, '要注意（C区分）', '公表区間 No.40 との対応はオーナーの説明（2026-11-17）と OSM の ref「40」によるもので、一次資料では未確認。北の行き先も未確認。');
    setAttr(n, '公表区間との対応', `東京PG「系統構成 500kV,275kV系統 予想潮流」（2025-12-01）では No.40 は鹿島から2つの発電所（番号で匿名）へ分かれ、地図の tokyo-section-40（鹿島変電所—鹿島火力発電所）はその一方。この線を No.40 の分岐の残る一方とみなした（推定。オーナーの説明 2026-11-17、一次資料未確認）。${SRC2019} の系統図では（40）は鹿島—鹿島共火（2019年時点）。潮流・容量の行には対応させていない。`);
    setAttr(n, '北の端', `行き先は未確認で、どこにもつないでいない。北の端は鹿島共同火力発電所（推定位置）の約${(dm(endP, kj.position) / 1000).toFixed(1)}km 西。北の端の周りにOSMの設備の登録はない。`);
    { const s40 = lineById(lines, 'tokyo-section-40'), e = s40.attributes.find((a) => a.label === '端点の根拠'); if (!e || !/分岐の先のもう一方は描いていない/.test(e.value)) throw Error('K10：No.40 の端点の根拠が想定と違う');
      e.value += ' 2026-11-17：2019年の東京PG の系統図では（40）は鹿島—鹿島共火で、地図の端（鹿島火力発電所）とは異なる（端点は変えていない）。分岐の先のもう一方は「送電線No.40（推定・分かれ先）」（鹿島変電所から北への線）と推定した（オーナーの説明、一次資料未確認、保留127）。'; }
    const cls = n.attributes.find((a) => a.label === '区分'); if (cls) cls.value = '鹿島から分かれる No.40 の一方と推定した送電線（オーナーの説明、一次資料未確認）。OSMでは6本の線分に ref「40」の登録がある（補助資料）。OCCTOの行・容量表の行とは対応付けていない（潮流なし）。';
  }
}
