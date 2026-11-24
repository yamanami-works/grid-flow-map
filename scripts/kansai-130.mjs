// 保留130（2026-11-18 オーナー指示、回答「1は姫路周り以外は実施してよい」「3は関西だけ」「5はOk」）：関西の北側の線の追加と修正。
// scripts/build-kansai.mjs が照合区分の付け直し（applyTiers）の前に applyKansai130、後に applyKansai130Late を呼ぶ。
// 一次資料：関西電力送配電「154kV以上の系統図」（https://www.kansai-td.co.jp/interchange/takusou/pdf/154kv_more_mapping.pdf 、図中の表記は2026年11月13日時点、2026-11-17取得。
// 原本はリポジトリに入れない）と送電線一覧（154kv_more_line.csv、2026年10月7日更新）。系統図の記号の読み解き（AE＝新愛本、BB＝北大阪、⊗＝城端開閉所など）は推定。
// 地理は OSM（data/raw/p130-hida、2026-11-18取得。data/raw/kansai-osm、2026-10-02時点）。補助資料。
import { readFileSync, existsSync } from 'node:fs';
import { movedFile } from './move-to-kansai-130.mjs';
import { applyPlantPrimary } from './plant-primary.mjs';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const KS_LINE = '関西電力送配電 空容量一覧（154kV以上・送電線、2026年10月7日更新）';
const KS_MAP = '関西電力送配電「154kV以上の系統図」（図中の表記は2026年11月13日時点、2026-11-17取得）';
const OWNER = '2026-11-18 オーナー指示（保留130）、回答「1は姫路周り以外は実施してよい」';
const JOHANA = 'osm-way-315757225', TOMINAMI = 'osm-way-324055341', KITAOSAKA = 'osm-way-110847002';
const dm = (a, b) => 6371000 * Math.hypot((b[1] - a[1]) * Math.PI / 180 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * Math.PI / 180);
const km = (paths) => paths.reduce((s, p) => s + p.slice(1).reduce((t, q, i) => t + dm(p[i], q), 0), 0) / 1000;
const set = (x, label, value) => { const i = x.attributes.findIndex((a) => a.label === label); if (i < 0) x.attributes.push({ label, value }); else x.attributes[i] = { label, value }; };
const moved = () => ['hokuriku', 'chubu'].map((r) => { if (!existsSync(movedFile(r))) throw Error('130-6：北陸・中部の builder を先に実行する ' + movedFile(r)); return read(movedFile(r)); });
// OSM の線分を from→to の向きでたどる（使う原本は ways に合わせて読む）
function chain(files, steps) {
  const el = files.flatMap((f) => read(f).elements), pos = new Map(el.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
  return steps.map(([way, from, to]) => {
    const w = el.find((e) => e.type === 'way' && e.id === way); if (!w || !/275000/.test(w.tags?.voltage ?? '')) throw Error('130：OSM の線分が想定と違う ' + way);
    const i = w.nodes.indexOf(from), j = w.nodes.indexOf(to); if (i < 0 || j < 0 || (i !== 0 && i !== w.nodes.length - 1) || (j !== 0 && j !== w.nodes.length - 1)) throw Error('130：線分の端が想定と違う ' + way);
    const ids = i < j ? w.nodes : [...w.nodes].reverse(), p = ids.map((n) => pos.get(n)); if (p.some((q) => !q)) throw Error('130：点が足りない ' + way); return p;
  });
}
export function applyKansai130(lines, facilities) {
  const [hk] = moved();
  // 城端開閉所（北陸のデータと同じ ID・同じ内容で関西にも載せる）
  { const j = hk.facilities.find((x) => x.id === JOHANA); if (!j || facilities.some((x) => x.id === JOHANA)) throw Error('130：城端開閉所'); facilities.push(structuredClone(j)); }
  const johana = facilities.find((x) => x.id === JOHANA);
  // ---- 130-2・130-7 新北陸幹線（一覧 No.214、新愛本～城端）：2本とも富南変電所（OSM では 154/66kV、北陸電力送配電）を端にしていた。
  // 系統図では No.214 は AE（新愛本）から城端開閉所（⊗）へ続き、富南は途中の 154kV の設備（陸B と推定）の脇を通るだけ。
  // OSM では富南の区画の脇の点（node 3308289179）から 275kV・2回線の線（way 1025730747）、1回線の2本（way 1025730745・1025730746）、関西電力送配電の 2回線の線（way 315757229、約28.8km）、構内の線分（way 829531884）で城端開閉所の区画に入る。
  // 320560150 をこの経路で城端開閉所まで延ばす。320560153 は同じ点で 320560150 の経路に入るので、その点（分岐点、共有ノード）で止める（同じ経路を2本で重ねて描かない）
  const l150 = lines.find((x) => x.id === 'ledger-kansai-275-320560150'), l153 = lines.find((x) => x.id === 'ledger-kansai-275-320560153');
  if (!l150 || !l153 || l150.name !== '新北陸幹線' || l153.name !== '新北陸幹線') throw Error('130-7：新北陸幹線が想定と違う');
  const users = lines.filter((x) => x.connections.some((c) => c.facilities.some((f) => f.id === TOMINAMI))).map((x) => x.id).sort().join();
  if (users !== 'ledger-kansai-275-320560150,ledger-kansai-275-320560153') throw Error('130-2：富南変電所につながる線が想定と違う ' + users);
  {
    const k = l150.connections.findIndex((c) => c.node === 3308289179); if (k < 0) throw Error('130-7：320560150 の富南側の端がない');
    const p = chain(['data/raw/p130-hida/lines-275.json'], [[1025730747, 3308289179, 3308293063], [1025730745, 3308293063, 9457178335], [315757229, 9457178335, 7742566688], [829531884, 7742566688, 7742566685]]);
    if (dm(p[0][0], l150.connections[k].position) > 1) throw Error('130-7：延長の始点が端と合わない');
    const ids = [1025730747, 1025730745, 315757229, 829531884];
    if (lines.some((x) => x.osmIds.some((i) => ids.includes(Math.abs(i))))) throw Error('130-7：線分は使用済み');
    l150.paths.push(...p); l150.osmIds.push(...ids); if (l150.sourceOsmIds) l150.sourceOsmIds = [...new Set([...l150.sourceOsmIds, ...ids])];
    l150.connections[k] = { node: 7742566685, position: p.at(-1).at(-1), status: 'facility-area', facilities: [{ id: johana.id, name: johana.name }], neighborWays: [] };
    l150.referenceReview = { ...l150.referenceReview, endpoints: '城端開閉所―新愛本変電所' };
    l150._k130 = km(p);
  }
  // 2026-11-18 オーナー指示「城端開閉所～新愛本変電所の新北陸幹線なので、新愛本変電所から黒部第四発電所までの送電線は一緒に選択されないようにして」：
  // 320560150 は、新愛本の手前の点（node 3270705214）から黒部川第四発電所側の OSM の線分（way 618344814・1239288599・1239288600・761185974・572566517、約25km）も持っていた（取り込み時の同名の線のまとまり）。
  // これらを「新北陸幹線（黒部川第四発電所側）」（extra-kansai-275-572566514）へ移し、その線を黒部川第四発電所から新愛本の手前の点まで（共有ノード、推定）にする。
  // 新愛本の区画に入る短い線分（way 1239288603、約0.2km）は 320560150 が使うので、黒四側の線は手前の点で止める（重ねて描かない）
  {
    const kuro = lines.find((x) => x.id === 'extra-kansai-275-572566514'), K = [618344814, 1239288599, 1239288600, 761185974, 572566517];
    if (!kuro || kuro.connections[1]?.node !== 5500674490 || kuro.connections[1]?.status !== 'shared-node') throw Error('130-7：黒四側の線が想定と違う');
    if (!K.every((id) => l150.osmIds.includes(id))) throw Error('130-7：320560150 に黒四側の線分がない');
    const keep = l150.osmIds.map((id, i) => !K.includes(id));
    const moved = K.map((id) => l150.paths[l150.osmIds.indexOf(id)]);
    l150.paths = l150.paths.filter((_, i) => keep[i]); l150.osmIds = l150.osmIds.filter((_, i) => keep[i]);
    if (l150.sourceOsmIds) l150.sourceOsmIds = l150.sourceOsmIds.filter((id) => !K.includes(id));
    kuro.paths.push(...moved); kuro.osmIds.push(...K); if (kuro.sourceOsmIds) kuro.sourceOsmIds = [...new Set([...kuro.sourceOsmIds, ...K])];
    const p3270 = [36.8548909, 137.5522403];
    if (!moved.some((p) => [p[0], p.at(-1)].some((q) => dm(q, p3270) < 1)) || !l150.paths.some((p) => [p[0], p.at(-1)].some((q) => dm(q, p3270) < 1))) throw Error('130-7：新愛本の手前の点が想定と違う');
    kuro.connections[1] = { node: 3270705214, position: p3270, status: 'shared-node', facilities: [], neighborWays: [320560150, 1239288603] };
    kuro.referenceReview = { ...kuro.referenceReview, endpoints: '黒部川第四発電所―分岐点（新北陸幹線と共有、新愛本変電所の手前）' };
    kuro._k130 = km(moved);
  }
  {
    const k = l153.connections.findIndex((c) => c.node === 3308289179); if (k < 0) throw Error('130-7：320560153 の富南側の端がない');
    l153.connections[k] = { node: 3308289179, position: l153.connections[k].position, status: 'shared-node', facilities: [], neighborWays: [1025730747, 320560150] };
    l153.referenceReview = { ...l153.referenceReview, endpoints: '分岐点（新北陸幹線の 320560150 と共有）―新愛本変電所' };
  }
  { const i = facilities.findIndex((x) => x.id === TOMINAMI); if (i < 0) throw Error('130-2：富南変電所がない'); facilities.splice(i, 1); }
  // ---- 130-8 大黒部幹線（一覧 No.205、275kV、開閉所→BB）：系統図で城端開閉所（⊗）から西へ出て、嶺南（E）の脇を南へ通り BB（北大阪変電所と推定、オーナー説明と一致）へ。
  // OSM の線名はない。城端開閉所の構内の線分（way 315757226）、関西電力送配電の 275kV・2回線の線（way 256682326、約151km）、線名なしの 2回線の線（way 722638593・768407345）、北大阪変電所の構内の線分（way 637743781）でつながる
  {
    if (lines.some((x) => x.name === '大黒部幹線')) throw Error('130-8：登録済み');
    const ids = [315757226, 256682326, 722638593, 768407345, 637743781];
    if (lines.some((x) => x.osmIds.some((i) => ids.includes(Math.abs(i))))) throw Error('130-8：線分は使用済み');
    const kita = facilities.find((x) => x.id === KITAOSAKA); if (!kita || kita.name !== '北大阪変電所') throw Error('130-8：北大阪変電所がない');
    const p = chain(['data/raw/p130-hida/lines-275.json', 'data/raw/kansai-osm/lines-275.json'], [[315757226, 3218895064, 3218895563], [256682326, 3218895563, 9164942611], [722638593, 9164942611, 2195046512], [768407345, 2195046512, 1264455696], [637743781, 1264455696, 6011952252]]);
    const len = km(p);
    lines.push({ id: 'kansai-275-way-256682326', assetId: 'kansai-275-way-256682326', name: '大黒部幹線', named: true, voltageKV: 275, currentType: 'ac', osmIds: ids, paths: p,
      connections: [{ node: 3218895064, position: p[0][0], status: 'facility-area', facilities: [{ id: johana.id, name: johana.name }], neighborWays: [] },
        { node: 6011952252, position: p.at(-1).at(-1), status: 'facility-area', facilities: [{ id: kita.id, name: kita.name }], neighborWays: [] }],
      referenceReview: { status: 'partial', endpoints: '城端開閉所―北大阪変電所' },
      // 北大阪変電所の手前の鉄塔（node 1264455696）を新生駒線（新生駒→宝塚）の経路と共有する。共架とみなし、新生駒線の潮流の行の「分岐」に数えない（src/flow-path.ts、保留108 と同じ扱い）
      coHungWith: ['kansai-275-新生駒線'],
      attributes: [{ label: '要注意（C区分）', value: '線名・端点は一次資料の一覧と系統図によるが、端点の記号の読み解きは推定で、経路は OSM の線名のない線分で描いた参考表示。' }, { label: '照合区分', value: 'C区分' },
        { label: '公表の線名', value: `${KS_LINE} No.205：大黒部幹線（275kV）、2回線、開閉所→BB。` },
        { label: '端点の根拠', value: `端点の対応付けは推定（北大阪側の記号 BB を北大阪変電所とみなした）。${KS_MAP}で、No.205 は城端開閉所（⊗）から西へ出て、嶺南（E）の脇を南へ通り BB へ向かう。BB＝北大阪変電所は推定（2026-11-18 オーナー指示「城端開閉所～北大阪変電所間の275kV大黒部幹線を描いて」と一致）。` },
        { label: '区分', value: '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。' },
        { label: '地理参照', value: `OSM 5線分（計約${len.toFixed(1)}km）：城端開閉所の構内の線分（way 315757226）、関西電力送配電の 275kV・2回線の線（way 256682326、線名なし）、線名なしの 2回線の線（way 722638593・768407345）、北大阪変電所の構内の線分（way 637743781）。北大阪変電所の手前の点（node 1264455696）は新生駒線と共有する。OSM に線名はなく、一覧の線名を当てた（推定）。個別回線は未確認。` },
        { label: '共架', value: '北大阪変電所の手前の鉄塔（OSM の共有点 node 1264455696）を新生駒線と共有する。同じ鉄塔に載る別の線とみなした（推測、一次資料では未確認）。新生駒線の潮流（OCCTO の行）はこの点で分かれる線として扱わない。' },
        { label: '出典', value: `${KS_LINE}、${KS_MAP}。地理はOSM（data/raw/p130-hida 2026-11-18取得、data/raw/kansai-osm 2026-10-02時点）。${OWNER}。` }] });
  }
}
export function applyKansai130Late(lines, facilities) {
  const [hk, cb] = moved();
  for (const [r, src] of [['hokuriku', hk], ['chubu', cb]]) { const d = read(`public/data/${r}-trunk.json`); if (src.lines.some((l) => d.lines.some((x) => x.id === l.id))) throw Error('130-6：' + r + ' のデータに移した線が残る（' + r + ' の builder を先に実行する）'); }
  // ---- 130-6 北陸・中部のデータから移した線・設備を足す（ID はそのまま）
  for (const src of [hk, cb]) {
    for (const f of src.facilities) if (!facilities.some((x) => x.id === f.id)) facilities.push(structuredClone(f));
    for (const l of src.lines) { if (lines.some((x) => x.id === l.id)) throw Error('130-6：登録済み ' + l.id); lines.push(structuredClone(l)); }
  }
  const moveNote = (l, from) => set(l, '収録の地域（2026-11-18）', `以前は${from}のデータに載せていた。関西電力送配電の154kV以上の系統図・送電線一覧に載る線なので、関西のデータに移した（ID は変えていない。2026-11-18 オーナー指示「関西のタブで表示するようにして」、回答「3は関西だけ」）。`);
  // ---- 130-9 新成出水力発電所の電源線（推定）→ 新北陸幹線（成出～城端）（一覧 No.213）
  {
    const l = lines.find((x) => x.id === 'plant-hokuriku-275-1028287103');
    if (!l || l.name !== '新成出水力発電所の電源線（推定）' || l.connections.map((c) => c.facilities[0]?.id).join() !== 'osm-way-440225776,' + JOHANA) throw Error('130-9：新成出の電源線が想定と違う');
    l.name = '新北陸幹線（成出～城端）'; l.named = true;
    l.attributes = l.attributes.filter((a) => a.label !== '要注意（C区分・推定）' && a.label !== '推定の内容');
    set(l, '要注意（C区分）', '線名は一次資料の一覧によるが、端点の記号の読み解き（陸D＝新成出水力発電所）は推定で、経路は OSM の線名のない線分で描いた参考表示。');
    set(l, '公表の線名', `${KS_LINE} No.213：新北陸幹線(成出~城端)（275kV）、1回線、開閉所→陸D。`);
    set(l, '端点の根拠', `端点の対応付けは推定（記号 陸D を新成出水力発電所とみなした）。${KS_MAP}で、No.213 は城端開閉所（⊗）から南の 陸D（発電所の□）へ。陸D＝新成出水力発電所は推定（OSM の線が発電所の区画から城端開閉所まで続く）。`);
    set(l, '区分', '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。');
    set(l, '照合の根拠', '一覧の線名・端点の記号はあるが、端点の記号（陸D）の読み解きは推定で、経路は OSM の線名のない線分。');
    set(l, '出典', `${KS_LINE}、${KS_MAP}。地理はOSM（app/data/raw の全取得、2026-09-20～10-06取得）。${OWNER}。`);
    set(l, '名前の変更（2026-11-18）', '以前は「新成出水力発電所の電源線（推定）」（発電所名から付けた仮の名前）。2026-11-18 オーナー指示「「成出水力発電所の電源線（推定）」は、新北陸幹線に名称変更（関西資料のNo213）」で一覧の線名にした。');
    moveNote(l, '北陸');
  }
  // ---- 130-11 御母衣幹線 → 御母衣北幹線（一覧 No.203）
  {
    const l = lines.find((x) => x.id === 'jpower-275-way-440218167');
    if (!l || l.name !== '御母衣幹線' || l.connections.map((c) => c.facilities[0]?.id).join() !== 'osm-way-440218167,osm-way-161946848') throw Error('130-11：御母衣幹線が想定と違う');
    l.name = '御母衣北幹線'; l.named = true;
    set(l, '区分', '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。');
    set(l, '公表の線名', `${KS_LINE} No.203：御母衣北幹線（275kV）、2回線、開閉所→BE。`);
    set(l, '照合の根拠', '一覧の線名はあるが、端点（一覧では「開閉所→BE」）と描いた線の両端（御母衣発電所・関開閉所）は一致しない。経路は OSM の線名のない線分。');
    set(l, '端点の根拠', `端点の対応付けは推定。一覧の No.203 の端点は「開閉所→BE」（BE＝甲賀と推定）。${KS_MAP}では No.203 は御母衣の開閉所（⊗）から関開閉所（⊗）まで描かれ、関開閉所から先は No.201（丸山幹線（関~甲賀））で BE へ続くと読んだ（推定）。御母衣の開閉所は OSM に区画がなく、発電所の区画（OSM way 440218167）の脇の 275kV の区画（way 440218169）とみられる。地図では北の端を御母衣発電所の区画にしている（推定）。`);
    set(l, '出典', `${KS_LINE}、${KS_MAP}。J-POWER送変電 送変電事業地図（2026-10-04確認）。地理はOSM（app/data/raw の各地域の取得と jpower-osm、2026-09-30〜10-04取得）。${OWNER}。`);
    set(l, '線名の根拠', `${KS_MAP}で、No.203 は御母衣の開閉所（⊗）から南へ関開閉所（⊗）へ向かい、No.201 で BE（甲賀）へ続く。OSM の線（way 212039849）の事業者の登録は関西電力。J-POWER送変電の送変電事業地図（2026-10-04確認）の御母衣幹線（御母衣発電所→名古屋変電所）とは別の線とみなした（推定。2026-11-18 オーナー回答「5はOk」）。OSM には御母衣発電所から南へ別の 275kV の線（way 1257806203、事業者の登録は中部電力）もある（描いていない）。`);
    set(l, '名前の変更（2026-11-18）', '以前は「御母衣幹線」（J-POWER送変電の送変電事業地図の線名を当てていた）。2026-11-18 オーナー指示「御母衣幹線の正しい名称は御母衣北幹線（関西資料のNo203）では？」で一覧の線名にした。');
    moveNote(l, '中部');
  }
  // 富南変電所がどこからも参照されていないこと
  if (lines.some((x) => x.connections.some((c) => c.facilities.some((f) => f.id === TOMINAMI))) || facilities.some((x) => x.id === TOMINAMI)) throw Error('130-2：富南変電所が残る');
  // ---- 130-7 の属性（照合区分の付け直しのあと）
  const l150 = lines.find((x) => x.id === 'ledger-kansai-275-320560150'), l153 = lines.find((x) => x.id === 'ledger-kansai-275-320560153');
  set(l150, '端点の根拠', `${KS_MAP}で、No.214 新北陸幹線(新愛本~城端)（2回線、AE→開閉所）は AE（新愛本）から城端開閉所（⊗）へ続く。途中の 154kV の設備（陸B、富南変電所と推定）の脇を通る。`);
  set(l150, '端の変更（2026-11-18）', `以前は富南変電所（OSM では 154/66kV、北陸電力送配電）を端にしていた。富南の区画の脇の点（node 3308289179）から OSM の 275kV の線（way 1025730747・1025730745・315757229、構内の way 829531884、計約${(l150._k130 ?? 0).toFixed(1)}km）で城端開閉所まで延ばした。富南変電所は 275kV の線につながらないので収録しない（2026-11-18 オーナー指示「富南変電所は275kV変電所でないと思われるので削除」「新北陸幹線の城端開閉所～新愛本変電所が途中で終わっているので描いて」）。`);
  delete l150._k130;
  set(l150, '黒四側の区間（2026-11-18）', '以前はこの線に、新愛本変電所の手前の点から黒部川第四発電所側の OSM の線分（way 618344814・1239288599・1239288600・761185974・572566517）も含めていた。城端開閉所～新愛本変電所の線なので、それらは「新北陸幹線（黒部川第四発電所側）」へ移した（2026-11-18 オーナー指示「新愛本変電所から黒部第四発電所までの送電線は一緒に選択されないようにして」）。');
  {
    const kuro = lines.find((x) => x.id === 'extra-kansai-275-572566514');
    set(kuro, '端点の根拠', '新愛本側の端点は推定：新愛本変電所の手前（約200m）の点（node 3270705214）で新北陸幹線（320560150）の経路に入るので、その点（共有ノード）を端とした。新愛本変電所の区画に入る線分（way 1239288603）は 320560150 で描く。一覧の No.216 新北陸幹線(黒四~新愛本)（275kV、2回線、発電所→AE）に当たると推定。');
    set(kuro, '端の変更（2026-11-18）', `以前は黒部川第四発電所の構内の短い区間（約0.6km）だけで、その先は新北陸幹線（320560150）に含めていた。新北陸幹線の 320560150 から黒四側の OSM の線分5本（計約${(kuro._k130 ?? 0).toFixed(1)}km）を移し、新愛本変電所の手前の点まで延ばした（2026-11-18 オーナー指示）。`);
    delete kuro._k130;
  }
  set(l153, '端点の根拠', '富南側の端点は推定：もう1本の新北陸幹線（320560150）との共有ノード（node 3308289179）を端とした。1回線ずつ2本の線が同じ鉄塔に載るのか、この点でつながるのかは一次資料では未確認。');
  set(l153, '端の変更（2026-11-18）', '以前は富南変電所を端にしていた。富南の区画の脇の点（node 3308289179）で、もう1本の新北陸幹線（320560150）の城端開閉所への経路に入るので、その点（分岐点・共有ノード）で止めた（同じ経路を2本で重ねて描かない）。1回線ずつ2本の線が同じ鉄塔に載るのか、この点でつながるのかは未確認。2026-11-18 オーナー指示「富南変電所は275kV変電所でないと思われるので削除」。');
  // 2026-11-18 保留130-10 変更レビュー：取り込み時の「公表の線名」は No.204〜216 をまとめて名乗っていた。No.208・210・213 などを別の線として描いたので、No.214 の行だけにする
  for (const l of [l150, l153]) set(l, '公表の線名', `${KS_LINE} No.214：新北陸幹線(新愛本~城端)（275kV）、2回線、AE→開閉所。以前はこの線に No.204・208・210・213・214・216 をまとめて当てていた（2026-11-18 に No.214 だけにした。No.208・210・213 は別の線として描いている）。`);
  // 2026-11-18 オーナー回答「130-2＋7は案aでokだが選択すると分岐した各々の回線含めた全体が選択されるようにして(2回線の新北陸幹線の纏まりとする)」：
  // 2本（各1回線）に同じ選択のまとまり（selectGroup）を付け、どちらを選んでも2本を一緒に強調する（src/real.ts の selectedGeometries）
  for (const l of [l150, l153]) {
    l.selectGroup = 'kansai-新北陸幹線-No.214';
    set(l, '選択のまとまり', '新北陸幹線（No.214、新愛本～城端、2回線）の1回線ずつの2本（320560150・320560153）を1つのまとまりとして扱う。どちらを選んでも2本を一緒に強調する。320560153 は富南の脇の合流点まで描き、そこから城端開閉所までは 320560150 で描く（2026-11-18 オーナー回答）。');
  }
}
// ---- 保留130-10（2026-11-18 オーナー指示「新成出発電所～御母衣発電所間の新北陸幹線（関西資料のNo208）を描いて。またその幹線上の水力発電所（御母衣第二、鳩谷、下小鳥）とその電源線も描いて」、
// 回答「4はOK」「No210はNo208新北陸幹線の分岐として描いて。下小鳥の線は推奨でOK」）。照合区分の付け直しのあと（北陸・中部から移した御母衣発電所・新成出水力発電所が入ったあと）に足す。
// 地理は OSM（data/raw/p130-hida、2026-11-18取得）。発電所の位置は Google マップで当たりを付けた（座標・名前は記録しない）。国土地理院の地図注記（z15、2026-11-18取得）に3発電所の名前はない
const HIDA = 'data/raw/p130-hida/lines-275.json';
function chainNodes(steps) {
  const el = read(HIDA).elements, pos = new Map(el.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
  return steps.map(([way, from, to]) => {
    const w = el.find((e) => e.type === 'way' && e.id === way); if (!w || !/275000/.test(w.tags?.voltage ?? '')) throw Error('130-10：OSM の線分が想定と違う ' + way);
    const i = w.nodes.indexOf(from), j = w.nodes.indexOf(to); if (i < 0 || j < 0 || (i !== 0 && i !== w.nodes.length - 1) || (j !== 0 && j !== w.nodes.length - 1)) throw Error('130-10：線分の端が想定と違う ' + way);
    const p = (i < j ? w.nodes : [...w.nodes].reverse()).map((n) => pos.get(n)); if (p.some((q) => !q)) throw Error('130-10：点が足りない ' + way); return p;
  });
}
const kmOf = (paths) => paths.reduce((s, p) => s + p.slice(1).reduce((t, q, i) => t + 6371 * Math.hypot((q[1] - p[i][1]) * Math.PI / 180 * Math.cos(p[i][0] * Math.PI / 180), (q[0] - p[i][0]) * Math.PI / 180), 0), 0);
export function applyKansai130_10(lines, facilities) {
  const SRC = `${KS_LINE}、${KS_MAP}。地理はOSM（data/raw/p130-hida、2026-11-18取得）。2026-11-18 オーナー指示（保留130-10）、回答「4はOK」「No210はNo208新北陸幹線の分岐として描いて。下小鳥の線は推奨でOK」。`;
  const C = () => [{ label: '要注意（C区分）', value: '線名・端点は一次資料の一覧と系統図によるが、記号の読み解き・発電所の対応は推定で、経路は OSM の線名のない線分で描いた参考表示。' }, { label: '照合区分', value: 'C区分' }, { label: '照合の根拠', value: 'OCCTO の公表区間はない。一覧の線名・端点の記号の読み解きは推定で、経路は OSM の線名のない線分。' }];
  const fac = (id) => { const f = facilities.find((x) => x.id === id); if (!f) throw Error('130-10：設備がない ' + id); return f; };
  const used = new Set(lines.flatMap((l) => l.osmIds.map(Math.abs)));
  const add = (l, steps) => {
    const ids = steps.map((s) => s[0]); if (ids.some((i) => used.has(i))) throw Error('130-10：線分は使用済み ' + l.id); ids.forEach((i) => used.add(i));
    if (lines.some((x) => x.id === l.id)) throw Error('130-10：登録済み ' + l.id);
    const p = chainNodes(steps), line = { ...l, voltageKV: 275, currentType: 'ac', osmIds: ids, paths: p };
    line.connections[0].position = p[0][0]; line.connections[1].position = p.at(-1).at(-1);
    set(line, '地理参照', `OSM ${ids.length}線分（計約${kmOf(p).toFixed(1)}km、線名なし）。個別回線は未確認。`);
    set(line, '出典', SRC);
    lines.push(line); return line;
  };
  const omo = fac('osm-way-440218167'), nari = fac('osm-way-440225776');
  // 発電所（鳩谷は OSM の名前のない 275kV の区画、御母衣第二・下小鳥は OSM に区画がなく線の端に置く）
  {
    const g = read('data/raw/p130-hida/facilities.json').elements.find((e) => e.type === 'way' && e.id === 1028287061);
    if (!g || g.tags?.power !== 'substation' || g.tags?.name || g.tags?.voltage !== '275000') throw Error('130-10：鳩谷の区画が想定と違う');
    const c = [g.geometry.reduce((s, q) => s + q.lat, 0) / g.geometry.length, g.geometry.reduce((s, q) => s + q.lon, 0) / g.geometry.length].map((v) => Math.round(v * 1e7) / 1e7);
    if (facilities.some((x) => ['osm-way-1028287061', 'kansai-place-御母衣第二発電所', 'kansai-place-下小鳥発電所'].includes(x.id))) throw Error('130-10：設備は登録済み');
    facilities.push({ id: 'osm-way-1028287061', assetId: 'kansai-fac-way-1028287061', name: '鳩谷発電所', kind: 'plant', position: c, voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/1028287061',
      attributes: [{ label: '要注意（C区分）', value: '名前は OSM の名前のない 275kV の区画に当てた推定。' },
        { label: '名称・位置の根拠', value: 'OSM の名前のない 275kV の変電所の区画（way 1028287061、No.208 の線の脇）。発電所の開閉設備とみなし、名前を当てた（推定）。Google マップで当たりを付けた。国土地理院の地図注記（z15、2026-11-18取得）に発電所の名前はない。' },
        { label: '名称の根拠', value: `2026-11-18 オーナー指示（新北陸幹線（No.208）の上の水力発電所）。${KS_LINE}の No.210 の線名「新北陸幹線(御母衣~鳩谷)」（1回線、発電所→BG）に鳩谷の名がある。関西電力送配電の系統図では No.208 に発電所の□が付く（名前の記載なし）。` },
        { label: '発電所の種別', value: '一次資料で未確認。' }, { label: '出典', value: SRC }] });
    for (const [id, name, pos, way] of [['kansai-place-御母衣第二発電所', '御母衣第二発電所', [36.1267331, 136.9043845], 1028287092], ['kansai-place-下小鳥発電所', '下小鳥発電所', [36.3005397, 137.0995957], 829531888]])
      facilities.push({ id, assetId: id, name, kind: 'plant', position: pos, voltages: [275], scopeConnected: true,
        attributes: [{ label: '要注意（位置推定）', value: '発電所の区画・名称が OSM にも国土地理院の地図注記にもないため、位置は推定。' },
          { label: '位置の根拠', value: `OSM の 275kV・1回線の線（way ${way}）の端に置いた。Google マップで当たりを付けた。国土地理院の地図注記（z15、2026-11-18取得）に名前はない。` },
          { label: '名称の根拠', value: '2026-11-18 オーナー指示（新北陸幹線（No.208）の上の水力発電所）。関西電力送配電の系統図では No.208 に発電所の□が付く（名前の記載なし）。' },
          { label: '発電所の種別', value: '一次資料で未確認。' }, { label: '出典', value: SRC }] });
  }
  const haya = fac('osm-way-1028287061'), omo2 = fac('kansai-place-御母衣第二発電所'), shimo = fac('kansai-place-下小鳥発電所');
  const LINE_KIND = { label: '区分', value: '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。' };
  const PLANT_KIND = { label: '区分', value: '発電所の電源線（OCCTOの地内実績に行がないため潮流なし）' };
  // No.208 新北陸幹線（御母衣～成出）：御母衣の 275kV の区画の中の点 → 新成出の区画の中の点。1回線の対の線分は片方だけ使う
  add({ id: 'kansai-275-way-1028287090', assetId: 'kansai-275-way-1028287090', name: '新北陸幹線（御母衣～成出）', named: true,
    connections: [{ node: 9480332993, status: 'facility-area', facilities: [{ id: omo.id, name: omo.name }], neighborWays: [] }, { node: 9480333026, status: 'facility-area', facilities: [{ id: nari.id, name: nari.name }], neighborWays: [] }],
    referenceReview: { status: 'partial', endpoints: '御母衣発電所―新成出水力発電所' },
    attributes: [...C(), { label: '公表の線名', value: `${KS_LINE} No.208：新北陸幹線(御母衣~成出)（275kV）、1回線、陸D→BG。` },
      { label: '端点の根拠', value: `端点の対応付けは推定。${KS_MAP}で No.208 は 陸D（新成出水力発電所とみなした）から南の御母衣の開閉所（⊗）へ。終点の記号 BG は No.204（御母衣～栗東）の終点と同じで、潮流の向きの終点（栗東と推定、2026-11-18 オーナー回答「4はOK」）。御母衣側は発電所の脇の 275kV の区画（OSM way 440218169）の中の点で、地図では御母衣発電所の区画につないだ（御母衣北幹線と同じ扱い）。` },
      LINE_KIND,
      { label: '並行する回線', value: '御母衣～鳩谷の合流点（way 1028287090）・鳩谷～成出（way 1028287068・1028287071・1028287102）は OSM で 2回線の鉄塔。1回線ずつの対の線分のうち片方（way 1028287088・1028287069・1028287077・1028287096 など）は描いていない。No.210（鳩谷から）は No.208 の分岐として描いた（2026-11-18 オーナー回答）。' }] },
    [[1028287087, 9480332993, 9480333002], [1028287090, 9480333002, 9480332825], [1028287066, 9480332825, 9480332830], [1028287068, 9480332830, 9480332844], [1028287070, 9480332844, 9480332855], [1028287071, 9480332855, 9480332872], [1028287076, 9480332872, 9480332884], [1028287102, 9480332884, 9480333062], [1028287095, 9480333062, 9480333026]]);
  // No.210 新北陸幹線（御母衣～鳩谷）：No.208 の分岐（オーナー回答）。鳩谷の区画 → 三角形の 1回線の線 → No.208 の上の点（node 9480332825、御母衣側の 2回線の線の北端）
  add({ id: 'kansai-275-way-1028287067', assetId: 'kansai-275-way-1028287067', name: '新北陸幹線（御母衣～鳩谷）', named: true,
    connections: [{ node: 9480332820, status: 'facility-area', facilities: [{ id: haya.id, name: haya.name }], neighborWays: [] }, { node: 9480332825, status: 'shared-node', facilities: [], neighborWays: [1028287090, 1028287066] }],
    referenceReview: { status: 'section', endpoints: '鳩谷発電所―分岐点（新北陸幹線（御母衣～成出））' },
    attributes: [...C(), { label: '公表の線名', value: `${KS_LINE} No.210：新北陸幹線(御母衣~鳩谷)（275kV）、1回線、発電所→BG。` },
      { label: '分岐点の推定', value: '新北陸幹線（御母衣～成出、No.208）の分岐として描いた（2026-11-18 オーナー回答「No210はNo208新北陸幹線の分岐として描いて」）。分岐点は OSM の線が No.208 の線に合流する点（node 9480332825、御母衣側の 2回線の線の北端）とみなした（推定）。発電所側の端を鳩谷発電所とみなしたのも推定。' },
      LINE_KIND] },
    [[1028287062, 9480332820, 9480332822], [1028287067, 9480332822, 9480332826], [1028287065, 9480332826, 9480332825]]);
  // 下小鳥発電所の電源線（推定）：下小鳥（線の東端）→ way 829531888 → 鳩谷の区画
  add({ id: 'kansai-plant-275-way-829531888', assetId: 'kansai-plant-275-way-829531888', name: '下小鳥発電所の電源線（推定）', named: false,
    connections: [{ node: 7742566750, status: 'facility-area', facilities: [{ id: shimo.id, name: shimo.name }], neighborWays: [] }, { node: 9480323510, status: 'facility-area', facilities: [{ id: haya.id, name: haya.name }], neighborWays: [] }],
    referenceReview: { status: 'partial', endpoints: '下小鳥発電所―鳩谷発電所' },
    attributes: [...C(), { label: '端点の根拠', value: '端点の対応付けは推定：OSM の 275kV・1回線の線（way 829531888、線名なし）は鳩谷の 275kV の区画の中から東へ延びる。東の端を下小鳥発電所とみなした（2026-11-18 オーナー回答「下小鳥の線は推奨でOK」）。一覧の匿名の行 No.211（送電線、1回線、発電所→BG。系統図で東へ長い発電所の線）に当たるかは未確認。' }, PLANT_KIND] },
    [[829531888, 7742566750, 9480323510]]);
  // 御母衣第二発電所の電源線（推定）：御母衣第二（線の南端）→ way 1028287092 → 御母衣の 275kV の区画の中の点（御母衣発電所につなぐ）
  add({ id: 'kansai-plant-275-way-1028287092', assetId: 'kansai-plant-275-way-1028287092', name: '御母衣第二発電所の電源線（推定）', named: false,
    connections: [{ node: 9480332986, status: 'facility-area', facilities: [{ id: omo2.id, name: omo2.name }], neighborWays: [] }, { node: 9480332987, status: 'facility-area', facilities: [{ id: omo.id, name: omo.name }], neighborWays: [] }],
    referenceReview: { status: 'partial', endpoints: '御母衣第二発電所―御母衣発電所' },
    attributes: [...C(), { label: '端点の根拠', value: '端点の対応付けは推定：OSM の 275kV・1回線の線（way 1028287092、線名なし）の南端を御母衣第二発電所とみなし、北端（御母衣発電所の脇の 275kV の区画の中）は御母衣発電所につないだ。一覧の匿名の行 No.209・212（送電線、1回線、発電所→BG）のどれに当たるかは未確認。' }, PLANT_KIND] },
    [[1028287092, 9480332986, 9480332987]]);
}
// ---- 保留131（2026-11-18 オーナー指示「No.204（御母衣～栗東）の提案と祖山発電所と新祖山発電所も描いて、そこから城端開閉所へつながる送電線を描いて」、
// 回答「131-1は描く。持ち主は関西電力でOK」「131-2は案a」「御母衣第二の種別と出力を記載して」）。applyKansai130_10 のあとに呼ぶ
function chainFiles(files, steps) {
  const el = files.flatMap((f) => read(f).elements), pos = new Map(el.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
  return steps.map((s) => {
    if (s.straight) { const [a, b] = s.straight.map((n) => pos.get(n)); if (!a || !b) throw Error('131：直線の点がない'); return [a, b]; }
    const [way, from, to] = s, w = el.find((e) => e.type === 'way' && e.id === way); if (!w || !/275000/.test(w.tags?.voltage ?? '')) throw Error('131：OSM の線分が想定と違う ' + way);
    const i = w.nodes.indexOf(from), j = w.nodes.indexOf(to); if (i < 0 || j < 0 || (i !== 0 && i !== w.nodes.length - 1) || (j !== 0 && j !== w.nodes.length - 1)) throw Error('131：線分の端が想定と違う ' + way);
    const p = (i < j ? w.nodes : [...w.nodes].reverse()).map((n) => pos.get(n)); if (p.some((q) => !q)) throw Error('131：点が足りない ' + way); return p;
  });
}
export function applyKansai131(lines, facilities) {
  const OWN = '2026-11-18 オーナー指示（保留131）、回答「131-1は描く。持ち主は関西電力でOK」「131-2は案a」';
  const fac = (id) => { const f = facilities.find((x) => x.id === id); if (!f) throw Error('131：設備がない ' + id); return f; };
  const used = new Set(lines.flatMap((l) => l.osmIds.map(Math.abs)));
  const C = () => [{ label: '要注意（C区分）', value: '線名・端点は一次資料の一覧と系統図によるが、記号の読み解き・発電所の対応は推定で、経路は OSM の線名のない線分で描いた参考表示。' }, { label: '照合区分', value: 'C区分' }, { label: '照合の根拠', value: 'OCCTO の公表区間はない。一覧の線名・端点の記号の読み解きは推定で、経路は OSM の線名のない線分。' }];
  const add = (l, files, steps, src) => {
    const ids = steps.map((s, i) => s.straight ? -(Math.abs(s.straight[0]) % 1000000000) * 10 - 3 : s[0]);
    if (ids.some((i) => i > 0 && used.has(i))) throw Error('131：線分は使用済み ' + l.id); ids.forEach((i) => used.add(i));
    if (lines.some((x) => x.id === l.id)) throw Error('131：登録済み ' + l.id);
    const p = chainFiles(files, steps), line = { ...l, voltageKV: 275, currentType: 'ac', osmIds: ids, paths: p };
    const parts = ids.filter((i) => i < 0); if (parts.length) line.schematicParts = parts.map((osmId) => ({ osmId, construction: 'unknown' }));
    line.connections[0].position = p[0][0]; line.connections[1].position = p.at(-1).at(-1);
    const km = kmOf(p), gap = parts.length ? kmOf(p.filter((_, i) => ids[i] < 0)) : 0;
    set(line, '地理参照', `OSM ${ids.filter((i) => i > 0).length}線分${parts.length ? '＋直線（約' + gap.toFixed(2) + 'km、OSM の線の切れ目を補った・破線）' : ''}、計約${km.toFixed(1)}km、線名なし。個別回線は未確認。`);
    set(line, '出典', src); lines.push(line); return line;
  };
  // ---- 131-1 No.204 新北陸幹線（御母衣～栗東）：御母衣の 275kV の区画の中の点 → OSM（中部電力の登録の 2回線の線）→ 栗東変電所（栗東線と同じ点）
  {
    const omo = fac('osm-way-440218167'), rit = fac('osm-way-191382967');
    if (rit.name !== '栗東変電所') throw Error('131-1：栗東変電所が想定と違う');
    const SRC = `${KS_LINE}、${KS_MAP}。地理はOSM（data/raw/p130-hida・p130-gifu 2026-11-18取得、data/raw/chubu-osm・kansai-osm）。${OWN}。`;
    add({ id: 'kansai-275-way-1257806203', assetId: 'kansai-275-way-1257806203', name: '新北陸幹線（御母衣～栗東）', named: true,
      connections: [{ node: 9480332991, status: 'facility-area', facilities: [{ id: omo.id, name: omo.name }], neighborWays: [] }, { node: 2015727050, status: 'facility-area', facilities: [{ id: rit.id, name: rit.name }], neighborWays: [] }],
      referenceReview: { status: 'partial', endpoints: '御母衣発電所―栗東変電所' },
      attributes: [...C(), { label: '公表の線名', value: `${KS_LINE} No.204：新北陸幹線(御母衣~栗東)（275kV）、2回線、開閉所→BG。` },
        { label: '端点の根拠', value: `端点の対応付けは推定。${KS_MAP}で No.204 は御母衣の開閉所（⊗）から南西へ BG へ。BG＝栗東変電所は推定（No.208〜212 の終点と同じ記号、2026-11-18 オーナー回答「4はOK」）。御母衣側は発電所の脇の 275kV の区画（OSM way 440218169）の中の点で、地図では御母衣発電所の区画につないだ。栗東側は栗東線と同じ点（node 2015727050）で栗東変電所につないだ。` },
        { label: '持ち主', value: '関西電力（2026-11-18 オーナー回答「持ち主は関西電力でOK」）。OSM の事業者の登録は中部電力株式会社（way 1257806203）・中部電力パワーグリッド（way 170568515）で、一覧（関西電力送配電）と食い違う（OSM は補助資料）。' },
        { label: '区分', value: '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。' }] },
      ['data/raw/p130-hida/lines-275.json', 'data/raw/p130-gifu/lines-275.json', 'data/raw/chubu-osm/lines-275.json', 'data/raw/kansai-osm/lines-275.json'],
      [[1028287085, 9480332991, 9480332999], [1257806203, 9480332999, 2013903718], { straight: [2013903718, 2013903726] }, [170568515, 2013903726, 2013803379], [708029575, 2013803379, 2015727052], [708029578, 2015727052, 2015727050]], SRC);
  }
  // ---- 131-2 祖山・新祖山（案a）：区画B（way 1028287115）＝新祖山発電所、区画A（way 1028287111）＝祖山発電所。OSM の 1回線の線（way 618344831）を No.206 新祖山線（新祖山→城端開閉所）に、
  // 祖山は区画内の線（way 1028287114）で新祖山の区画につなぐ。No.207（送電線、1回線、発電所→BB）は OSM に経路がなく描かない
  {
    const SRC = `${KS_LINE}、${KS_MAP}。地理はOSM（data/raw/p130-hida、2026-11-18取得）。${OWN}。`;
    const F = read('data/raw/p130-hida/facilities.json').elements;
    for (const [osm, name, other] of [[1028287115, '新祖山発電所', '祖山発電所（区画 way 1028287111）'], [1028287111, '祖山発電所', '新祖山発電所（区画 way 1028287115）']]) {
      const g = F.find((e) => e.type === 'way' && e.id === osm); if (!g || g.tags?.power !== 'substation' || g.tags?.name || g.tags?.voltage !== '275000') throw Error('131-2：区画が想定と違う ' + osm);
      if (facilities.some((x) => x.id === 'osm-way-' + osm || x.name === name)) throw Error('131-2：登録済み ' + name);
      const c = [g.geometry.reduce((s, q) => s + q.lat, 0) / g.geometry.length, g.geometry.reduce((s, q) => s + q.lon, 0) / g.geometry.length].map((v) => Math.round(v * 1e7) / 1e7);
      facilities.push({ id: 'osm-way-' + osm, assetId: 'kansai-fac-way-' + osm, name, kind: 'plant', position: c, voltages: [275], scopeConnected: true, url: 'https://www.openstreetmap.org/way/' + osm,
        attributes: [{ label: '要注意（C区分）', value: '名前は OSM の名前のない 275kV の区画に当てた推定。' },
          { label: '名称・位置の根拠', value: `OSM の名前のない 275kV の変電所の区画（way ${osm}）。発電所の開閉設備とみなし、名前を当てた（推定）。Google マップで当たりを付けた。すぐ隣の区画は${other}で、どちらの区画がどちらの発電所かは OSM・国土地理院の地図注記からは決まらない（2026-11-18 オーナー回答「131-2は案a」で決めた）。` },
          { label: '名称の根拠', value: `2026-11-18 オーナー指示「祖山発電所と新祖山発電所も描いて」。${KS_LINE}に No.206 新祖山線（発電所→BB）がある。` },
          { label: '発電所の種別', value: '一次資料で未確認。' }, { label: '出典', value: SRC }] });
    }
    const joha = fac(JOHANA), shin = fac('osm-way-1028287115'), so = fac('osm-way-1028287111');
    add({ id: 'kansai-275-way-618344831', assetId: 'kansai-275-way-618344831', name: '新祖山線', named: true,
      connections: [{ node: 9480333161, status: 'facility-area', facilities: [{ id: shin.id, name: shin.name }], neighborWays: [] }, { node: 5844656036, status: 'facility-area', facilities: [{ id: joha.id, name: joha.name }], neighborWays: [] }],
      referenceReview: { status: 'partial', endpoints: '新祖山発電所―城端開閉所' },
      attributes: [...C(), { label: '公表の線名', value: `${KS_LINE} No.206：新祖山線（275kV）、1回線、発電所→BB。` },
        { label: '端点の根拠', value: `端点の対応付けは推定。${KS_MAP}で No.206・207 は城端開閉所（⊗）から東の発電所の□へ。OSM の 275kV・1回線の線（way 618344831、事業者の登録は関西電力）が城端開閉所の脇から区画 B（新祖山発電所とみなした）へ続く。No.207（送電線、1回線）は OSM に経路がなく描いていない（2026-11-18 オーナー回答「131-2は案a」）。` },
        { label: '区分', value: '各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。' }] },
      ['data/raw/p130-hida/lines-275.json'], [[618344831, 9480333161, 5844656037], [829531886, 5844656037, 5844656036]], SRC);
    add({ id: 'kansai-plant-275-way-1028287114', assetId: 'kansai-plant-275-way-1028287114', name: '祖山発電所の電源線（推定）', named: false,
      connections: [{ node: 9480333154, status: 'facility-area', facilities: [{ id: so.id, name: so.name }], neighborWays: [] }, { node: 9480333156, status: 'facility-area', facilities: [{ id: shin.id, name: shin.name }], neighborWays: [] }],
      referenceReview: { status: 'partial', endpoints: '祖山発電所―新祖山発電所' },
      attributes: [...C(), { label: '端点の根拠', value: '端点の対応付けは推定：OSM の区画内の 275kV の線（way 1028287114、事業者の登録は関西電力）が区画 A（祖山発電所とみなした）と区画 B（新祖山発電所とみなした）を結ぶ。祖山発電所はこの線と新祖山線で城端開閉所へつながるとみなした（2026-11-18 オーナー回答「131-2は案a」）。一覧の No.207 に当たるかは未確認。' },
        { label: '区分', value: '発電所の電源線（OCCTOの地内実績に行がないため潮流なし）' }] },
      ['data/raw/p130-hida/lines-275.json'], [[1028287114, 9480333154, 9480333156]], SRC);
  }
  // ---- 御母衣第二発電所の種別と出力（2026-11-18 オーナー指示「御母衣第二の種別と出力を記載して」）：J-POWER 水力発電所一覧（2026年7月1日現在）。
  // 種別は docs/research/plant-primary-sources.json、出力は public/data/plant-profiles.json（事業者の資料）。ここでは設備の属性を一次資料に合わせる
  {
    const f = fac('kansai-place-御母衣第二発電所');
    f.attributes = f.attributes.filter((a) => a.label !== '発電所の種別');
    set(f, '事業者', '電源開発（J-POWER）');
    set(f, '名称の根拠', 'J-POWER 水力発電所一覧（2026年7月1日現在、https://www.jpower.co.jp/bs/renewable_energy/hydro/ichiran.html 、2026-11-18確認）に「御母衣第二」（庄川水系大白川、岐阜県大野郡白川村）。位置は推定（位置の根拠）。');
    applyPlantPrimary('kansai', lines, [f]);
  }
  // ---- 祖山・新祖山の種別と出力（2026-11-18 オーナー「祖山と新祖山発電所の種別と出力は下記で確認できる。」関西電力 水力発電所一覧）
  for (const id of ['osm-way-1028287115', 'osm-way-1028287111']) {
    const f = fac(id); f.attributes = f.attributes.filter((a) => a.label !== '発電所の種別'); set(f, '事業者', '関西電力');
    set(f, '名称の根拠', `関西電力 水力発電所一覧（https://www.kepco.co.jp/energy_supply/energy/newenergy/water/plant/list.html 、基準日の記載なし、2026-11-18確認）に「${f.name}」（庄川水系庄川）。2026-11-18 オーナー指示「祖山発電所と新祖山発電所も描いて」。どちらの区画をどちらの発電所に当てるかは推定（名称・位置の根拠）。`);
    applyPlantPrimary('kansai', lines, [f]);
  }
}
// ---- 保留132（2026-11-18 オーナー指示「次は丸山変電所に接続する新丸山発電所とその間の送電線、丸山発電所を描いて」、回答「推奨どおり」）。applyKansai131 のあとに呼ぶ
// 種別・出力は関西電力 水力発電所一覧（docs/research/plant-primary-sources.json・public/data/plant-profiles.json）。両発電所とも OSM に区画がない
export function applyKansai132(lines, facilities) {
  const SRC = `関西電力 水力発電所一覧（https://www.kepco.co.jp/energy_supply/energy/newenergy/water/plant/list.html 、基準日の記載なし、2026-11-18確認）。地理はOSM（data/raw/p130-gifu、2026-11-18取得）。国土地理院の地図注記（z15、2026-11-18取得）。2026-11-18 オーナー指示（保留132）、回答「推奨どおり」。`;
  const sub = facilities.find((x) => x.id === 'osm-way-192745005'); if (!sub || !/^丸山変電所/.test(sub.name)) throw Error('132：丸山変電所がない');
  if (facilities.some((x) => ['kansai-place-丸山発電所', 'kansai-place-新丸山発電所'].includes(x.id))) throw Error('132：登録済み');
  const el = read('data/raw/p130-gifu/lines-275.json').elements, pos = new Map(el.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
  const w = el.find((e) => e.type === 'way' && e.id === 192745037);
  if (!w || w.tags?.voltage !== '275000' || w.nodes[0] !== 2032778050 || w.nodes.at(-1) !== 2032778359) throw Error('132：OSM の線（way 192745037）が想定と違う');
  if (lines.some((l) => l.osmIds.some((i) => Math.abs(i) === 192745037))) throw Error('132：線分は使用済み');
  const p = w.nodes.map((n) => pos.get(n)); if (p.some((q) => !q)) throw Error('132：点が足りない');
  const plant = (id, name, position, posWhy, extra) => ({ id, assetId: id, name, kind: 'plant', position, voltages: [275], scopeConnected: true,
    attributes: [{ label: '要注意（位置推定）', value: '発電所の区画が OSM にないため、位置は推定。' }, { label: '位置の根拠', value: posWhy },
      { label: '名称の根拠', value: `関西電力 水力発電所一覧に「${name}」（木曽川水系木曽川）。2026-11-18 オーナー指示「丸山変電所に接続する新丸山発電所とその間の送電線、丸山発電所を描いて」。関西電力送配電の系統図で No.202 丸山幹線の端に並ぶ発電所の□を丸山・新丸山とみなしたのは推定（図中の表記は2026年11月13日時点）。` },
      { label: '事業者', value: '関西電力' }, ...extra, { label: '出典', value: SRC }] });
  facilities.push(plant('kansai-place-新丸山発電所', '新丸山発電所', p[0], 'OSM の 275kV の線（way 192745037、事業者 KEPCO）の東端に置いた。Google マップで当たりを付けた。国土地理院の地図注記に名前はない（近くに「丸山ダム」）。', []));
  facilities.push(plant('kansai-place-丸山発電所', '丸山発電所', [35.46989, 137.16083], '国土地理院の地図注記「丸山発電所」の位置（z15、2026-11-18取得）。Google マップで当たりを付けた。地図記号・空中写真では確かめていない。',
    [{ label: '系統との接続', value: '丸山変電所に直接つながるとみなした（推測、電圧は未確認）。OSM に丸山発電所からの線はなく、変電所の区画の西約0.1km にある。' }]));
  const shin = facilities.find((x) => x.id === 'kansai-place-新丸山発電所'), maru = facilities.find((x) => x.id === 'kansai-place-丸山発電所');
  maru.voltages = []; // 丸山発電所は系統につながる電圧が未確認（変更レビューの要修正：仮の値で埋めない、原則3）
  const km = p.slice(1).reduce((t, q, i) => t + 6371 * Math.hypot((q[1] - p[i][1]) * Math.PI / 180 * Math.cos(p[i][0] * Math.PI / 180), (q[0] - p[i][0]) * Math.PI / 180), 0);
  lines.push({ id: 'kansai-plant-275-way-192745037', assetId: 'kansai-plant-275-way-192745037', name: '新丸山発電所の電源線（推定）', named: false, voltageKV: 275, currentType: 'ac', osmIds: [192745037], paths: [p],
    connections: [{ node: 2032778050, position: p[0], status: 'facility-area', facilities: [{ id: shin.id, name: shin.name }], neighborWays: [] }, { node: 2032778359, position: p.at(-1), status: 'facility-area', facilities: [{ id: sub.id, name: sub.name }], neighborWays: [] }],
    referenceReview: { status: 'partial', endpoints: '新丸山発電所―丸山変電所' },
    attributes: [{ label: '要注意（C区分）', value: '一次資料で区間・端点を確定できず、OSMの地理登録で描いた参考表示。' }, { label: '照合区分', value: 'C区分' },
      { label: '照合の根拠', value: 'OCCTO の公表区間はない。発電所と変電所の対応は推定で、経路は OSM の線名のない線分。' },
      { label: '端点の根拠', value: '端点の対応付けは推定：OSM の 275kV の線（way 192745037、線名なし、事業者 KEPCO）の東端を新丸山発電所とみなし、西端（丸山変電所の区画のすぐ外の点）は丸山変電所につないだ（栗東線などと同じ扱い）。' },
      { label: '区分', value: '発電所の電源線（OCCTOの地内実績に行がないため潮流なし）' },
      { label: '地理参照', value: `OSM 1線分（約${km.toFixed(1)}km、線名なし）。個別回線は未確認。` }, { label: '出典', value: SRC }] });
  for (const f of [shin, maru]) applyPlantPrimary('kansai', lines, [f]);
}
