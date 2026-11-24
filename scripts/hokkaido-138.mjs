// ---- 保留138（2026-11-20 オーナー指示「函館幹線沿いの今金中里変電所と上八雲開閉所、およびその電源線を記載して。」「電源開発のせたな中里ウィンドファーム（風力）とユーラスの八雲ソーラーパーク（太陽光）の発電所を記載して。…」
// 「知内線沿いの木古内開閉所とその電源線を追加して。またそこに連系する電源開発の上ノ国第二風力発電所（風力）（41.739636, 140.126059）を追加して…」、
// 2026-11-21 回答「L4〜L6は電圧が低いので描かないことに変更。ただし、L1～3と発電所の関係が分かるようにそれぞれの詳細タブに分かるように記載。他は推奨でOK。」）。
// build-hokkaido-pilot.mjs から mergeJpower（一次資料の発電所の追加を含む）のあとに呼ぶ。
// 提案と図：../reports/approvals/evidence-20261120-p138/proposal-138.md、../reports/figures/p138-donan.html（リポジトリ外）。
// 設備3つ（今金中里変電所・上八雲開閉所・木古内開閉所）と、支線3本（今金中里支線・上八雲支線・鶴岡支線、187kV）を足す。
// 支線の分岐点（函館幹線No.299・No.366、知内線No.53）の位置は分からないので、既存の線（OSM）の最寄りの節点から直線でつなぐ（推測）。函館幹線・知内線の経路・端点は変えない。
// 発電所3つは docs/research/plant-primary-sources.json の addFacilities。発電所と設備の間の線はオーナー回答により描かず（上ノ国第二→木古内は 187kV の可能性もある）、属性に関係を書く。
const H94 = '北海道電力 第94期第3四半期報告書（https://www.hepco.co.jp/corporate/ir/ir_lib/pdf/94quarterlyreport_3q.pdf 、2026-11-20確認）';
const H96 = '北海道電力 第96期第3四半期報告書（https://www.hepco.co.jp/corporate/ir/ir_lib/pdf/96quarterlyreport_3q.pdf 、2026-11-20確認）';
const H99 = '北海道電力 第99期第2四半期報告書（https://www.hepco.co.jp/corporate/ir/ir_lib/pdf/99quarterlyreport_2q.pdf 、2026-11-20確認。第99期第3四半期報告書も同じ記載）';
const OWN = '2026-11-20 オーナー指示（保留138）、2026-11-21 オーナー回答「L4〜L6は電圧が低いので描かないことに変更。ただし、L1～3と発電所の関係が分かるようにそれぞれの詳細タブに分かるように記載。他は推奨でOK。」';
const PHOTO = (d) => `国土地理院 地理院地図の空中写真（全国最新写真（シームレス）、撮影 ${d}、2026-11-20閲覧）で見える設備の中心。Google マップで当たりを付けた`;
const kmOf = (p) => p.slice(1).reduce((s, q, i) => s + 6371 * Math.hypot((q[1] - p[i][1]) * Math.PI / 180 * Math.cos(p[i][0] * Math.PI / 180), (q[0] - p[i][0]) * Math.PI / 180), 0);
export function applyHokkaido138(lines, facilities) {
  const L = (id, name) => { const l = lines.find((x) => x.id === id); if (!l || l.name !== name) throw Error('138：線が想定と違う ' + id); return l; };
  const P = (id, name) => { const f = facilities.find((x) => x.id === id); if (!f || f.name !== name || f.kind !== 'plant') throw Error('138：発電所がない（plant-primary-sources の addFacilities）' + id); return f; };
  const hk = L('hokkaido-section-53', '函館幹線'), sr = L('hokkaido-section-48', '知内線');
  const setana = P('hokkaido-place-せたな大里ウインドファーム', 'せたな大里ウインドファーム'), yakumo = P('relation/11816417', 'ユーラス八雲ソーラーパーク'), kami2 = P('hokkaido-place-上ノ国第二風力発電所', '上ノ国第二風力発電所');
  const ids = ['hokkaido-place-今金中里変電所', 'hokkaido-place-上八雲開閉所', 'hokkaido-place-木古内開閉所'];
  if (facilities.some((x) => ids.includes(x.id))) throw Error('138：登録済み');
  // 分岐点：既存の線の経路の途中の節点（OSM の節点番号で確かめる）
  const onLine = (l, osmId, node, pt) => { const i = l.osmIds.indexOf(osmId), p = l.paths[i]; if (!p || !p.slice(1, -1).some((q) => q[0] === pt[0] && q[1] === pt[1])) throw Error('138：分岐点が ' + l.name + ' の経路の途中にない ' + node); return { node, position: pt, status: 'shared-node', facilities: [], neighborWays: [osmId] }; };
  const B1 = onLine(hk, 180133431, 2600591558, [42.3938683, 140.1269169]), B2 = onLine(hk, 180133431, 2600590299, [42.2398148, 140.2075834]), B3 = onLine(sr, 254271543, 13363298140, [41.6778084, 140.3927696]);
  const fac = (id, name, kind, position, attrs) => { const f = { id, assetId: id, name, kind, position, voltages: [187], scopeConnected: true, attributes: attrs }; facilities.push(f); return f; };
  const imakane = fac(ids[0], '今金中里変電所', 'substation', [42.39398, 140.12736], [
    { label: '要注意（位置推定）', value: '名前を地図の上で裏付ける根拠（国土地理院の注記・一次資料の所在地）がないため、位置は推定。' },
    { label: '位置の根拠', value: `${PHOTO('2022年7〜10月')}。函館幹線（OSM）から東へ約40m。` },
    { label: '公表接続', value: `${H94}：今金中里支線（新設）、函館幹線No.299〜今金中里（変）、187kV、亘長0.1km、1回線、2017年3月着工・2017年5月運用開始。` },
    { label: '持ち主', value: '一次資料で未確認（北海道電力の報告書は「今金中里（変）」と書くだけ）。' },
    { label: '要注意（描いていない線）', value: 'せたな大里ウインドファーム（電源開発、50,000kW、約22km 西）がこの変電所に連系するとみなした（推測。一次資料で未確認）。発電所との間の線は、電圧が 187kV より低いとみて描かない（2026-11-21 オーナー回答）。' },
    { label: '出典', value: `${H94}。位置は国土地理院の空中写真。${OWN}。` }]);
  const kamiyakumo = fac(ids[1], '上八雲開閉所', 'switchyard', [42.24038, 140.20914], [
    { label: '要注意（位置推定）', value: '名前を地図の上で裏付ける根拠（国土地理院の注記・一次資料の所在地）がないため、位置は推定。' },
    { label: '位置の根拠', value: `${PHOTO('2022年7〜10月')}。並んだ2つの設備（もう1つはユーラス八雲ソーラーパークの連系変電所と推定）のうち、函館幹線の鉄塔に近い西側に当てた（推定）。函館幹線（OSM）から約140m。` },
    { label: '公表接続', value: `${H96}：上八雲支線（新設）、函館幹線No.366〜上八雲開閉所、187kV、亘長0.2km、1回線、支線 2019年10月・上八雲開閉所（新設）2019年12月運用開始。` },
    { label: '要注意（描いていない線）', value: 'ユーラス八雲ソーラーパーク（連系容量 75,000kW、約7km 北東）が、自営線（約14km）で隣の「連系変電所」につながり、上八雲開閉所（北海道電力の設備）に連系する（ユーラスのパンフレット）。自営線（電圧が 187kV より低いとみる）と連系変電所（自営線の電圧を上げる設備）は描かない（2026-11-21 オーナー回答）。' },
    { label: '出典', value: `${H96}。ユーラスエナジー パンフレット「ユーラス八雲ソーラーパーク」（2026-11-21確認）。位置は国土地理院の空中写真。${OWN}。` }]);
  const kikonai = fac(ids[2], '木古内開閉所', 'switchyard', [41.67768, 140.3915], [
    { label: '要注意（位置推定）', value: '名前を地図の上で裏付ける根拠（国土地理院の注記・一次資料の所在地）がないため、位置は推定。' },
    { label: '位置の根拠', value: `${PHOTO('2022年7〜9月')}（運用開始の直前・同時期の写真で、設備が写っている）。知内線（OSM）から約110m。` },
    { label: '名称の根拠', value: '名前はオーナー指示（2026-11-20）。一次資料（北海道電力の報告書）では「Ａ開閉所」と符号化されている（他社申込に伴う工事のため）。' },
    { label: '公表接続', value: `${H99}：鶴岡支線（新設）、知内線No.53〜Ａ開閉所、187kV、亘長0.1km、1回線、2020年9月着工・2022年9月運用開始。この「Ａ開閉所」を木古内開閉所とみなした（推測。長さ0.1kmと、知内線から約110mの位置が合う）。2020年の北海道電力の供給計画には「知内線No.53―仮称上ノ国第二風力開閉所」の連系線の新設計画がある（docs/research/hokkaido-shiriuchi-kitami-review.json）。` },
    { label: '要注意（描いていない線）', value: '上ノ国第二風力発電所（電源開発、41,532kW、約22km 西）がこの開閉所に連系するとみなした（推測。オーナー指示「そこに連系する電源開発の上ノ国第二風力発電所」と、供給計画の仮称「上ノ国第二風力開閉所」による）。発電所との間の線は描かない（2026-11-21 オーナー回答「電圧が低いので描かない」による。開閉所は変圧しないので 187kV の線の可能性もある。OSM には発電所の位置から東へ 187kV 1回線の線（way 1470207150）が約8km あるが、開閉所までつながっていない）。' },
    { label: '出典', value: `${H99}。位置は国土地理院の空中写真。${OWN}。` }]);
  // 支線3本：既存の線の節点→設備（直線、架空。分岐点は推測）
  const branch = (id, name, from, f, km, pub, plant) => {
    const paths = [[from.position, f.position]], d = kmOf(paths[0]);
    lines.push({ id, assetId: id, name, named: true, voltageKV: 187, currentType: 'ac', osmIds: [-13801 - lines.filter((x) => x.id.startsWith('hokkaido-138-')).length], sourceOsmIds: [], paths,
      schematicParts: [], connections: [from, { node: null, position: f.position, status: 'facility-area', facilities: [{ id: f.id, name: f.name }], neighborWays: [] }],
      referenceReview: { status: 'partial', endpoints: `${pub.from}（推定の分岐点）―${f.name}` },
      attributes: [{ label: '要注意（C区分）', value: pub.caution ?? '両端の名前は一次資料で分かるが、分岐点の位置を特定できない参考表示。' }, { label: '照合区分', value: 'C区分' },
        { label: '照合の根拠', value: `公表の分岐点（${pub.from}）の位置は未特定。${pub.line}（OSM）の、${f.name}にいちばん近い節点（node ${from.node}）を分岐点とみなした（推測）。` },
        { label: '公表区間', value: pub.text },
        { label: '注記', value: `分岐点（${pub.from}）の位置は未特定で、${pub.line}のいちばん近い節点とみなした（推測）。${plant}` },
        { label: '区分', value: '支線（OCCTOの地内実績に行がないため潮流なし）。' },
        { label: '地理参照', value: `直線（約${d.toFixed(2)}km。公表の亘長 ${km}km）。経路は描いていない（短い区間のため直線で表す）。OSM・国土地理院の記号に線の登録はない。` },
        { label: '出典', value: `${pub.src}。位置は国土地理院の空中写真と OSM。${OWN}。` }] });
    // 直線は架空とみなす（短い支線）：線種は実線
    lines.at(-1).schematicParts = [{ osmId: lines.at(-1).osmIds[0], construction: 'overhead' }];
  };
  branch('hokkaido-138-今金中里支線', '今金中里支線', B1, imakane, '0.1', { from: '函館幹線No.299', line: '函館幹線', text: '北海道NW 系統空容量（基幹系統・送電線）送56：今金中里支線、187kV、1回線。公表区間は 函館幹線No.299〜今金中里（変）（北海道電力 第94期第3四半期報告書）。', src: H94 },
    'この支線の先の今金中里変電所に、せたな大里ウインドファーム（電源開発、50,000kW）が連系するとみなした（推測。一次資料で未確認）。発電所との間の線は電圧が低いとみて描かない。');
  branch('hokkaido-138-上八雲支線', '上八雲支線', B2, kamiyakumo, '0.2', { from: '函館幹線No.366', line: '函館幹線', text: '北海道NW 系統空容量（基幹系統・送電線）送57：上八雲支線、187kV、1回線。公表区間は 函館幹線No.366〜上八雲開閉所（北海道電力 第96期第3四半期報告書）。', src: H96 },
    'この支線の先の上八雲開閉所に、ユーラス八雲ソーラーパーク（連系容量 75,000kW）が自営線（約14km）と連系変電所を介して連系する（ユーラスのパンフレット）。自営線（電圧が低いとみる）と連系変電所は描かない。');
  branch('hokkaido-138-鶴岡支線', '鶴岡支線', B3, kikonai, '0.1', { from: '知内線No.53', line: '知内線', text: '北海道NW 系統空容量（基幹系統・送電線）送50：鶴岡支線、187kV、1回線。公表区間は 知内線No.53〜Ａ開閉所（北海道電力 第99期第2四半期報告書）。Ａ開閉所＝木古内開閉所とみなした（推測）。', src: H99, caution: '一次資料の端の名前は「Ａ開閉所」（名前を伏せた符号）で、木古内開閉所とみなした（推測）。分岐点の位置も特定できない参考表示。' },
    'この支線の先の木古内開閉所に、上ノ国第二風力発電所（電源開発、41,532kW）が連系するとみなした（推測）。発電所との間の線は描かない（2026-11-21 オーナー回答「電圧が低いので描かない」による。開閉所は変圧しないので 187kV の線の可能性もある。OSM には発電所の位置から東へ 187kV 1回線の線（way 1470207150）が約8km あるが、開閉所までつながっていない）。');
  // 発電所の詳細：系統との接続
  const conn = (p, v, short) => { p.attributes = [...p.attributes.filter((a) => a.label !== '系統との接続' && a.label !== '要注意（描いていない線）'), { label: '要注意（描いていない線）', value: short }, { label: '系統との接続', value: v }]; };
  conn(setana, '今金中里変電所（今金中里支線で函館幹線へ、187kV）に連系するとみなした（推測。一次資料で未確認）。発電所と変電所の間の線（約22km）は、電圧が 187kV より低いとみて描かない（2026-11-21 オーナー回答）。', '今金中里変電所（今金中里支線で函館幹線へ）に連系するとみなした（推測）。発電所と変電所の間の線は電圧が低いため描いていない。');
  conn(yakumo, '自営線（約14km）で上八雲開閉所の隣の連系変電所へつながり、上八雲開閉所（上八雲支線で函館幹線へ、187kV）に連系する（ユーラスのパンフレット）。自営線（電圧が 187kV より低いとみる）と連系変電所は描かない（2026-11-21 オーナー回答）。', '自営線（約14km）と連系変電所を介して上八雲開閉所（上八雲支線で函館幹線へ）に連系する（ユーラスのパンフレット）。自営線と連系変電所は描いていない。');
  conn(kami2, '木古内開閉所（鶴岡支線で知内線へ、187kV）に連系するとみなした（推測。オーナー指示と、2020年の供給計画の仮称「上ノ国第二風力開閉所」による）。発電所と開閉所の間の線（約22km）は描かない（2026-11-21 オーナー回答「電圧が低いので描かない」による。開閉所は変圧しないので 187kV の線の可能性もある。OSM には発電所の位置から東へ 187kV 1回線の線（way 1470207150）が約8km あるが、開閉所までつながっていない）。', '木古内開閉所（鶴岡支線で知内線へ）に連系するとみなした（推測）。発電所と開閉所の間の線（約22km）は描いていない（オーナー回答。187kV の可能性もある）。');
  // 函館幹線・知内線の「公表区間との対応」に支線の扱いを書き足す（経路・端点・照合表は変えない）
  const add = (l, label, s) => { const a = l.attributes.find((x) => x.label === label); if (!a) throw Error('138：' + l.name + ' の属性「' + label + '」がない'); if (!a.value.includes(s)) a.value += s; };
  add(hk, '公表区間との対応', ' 今金中里支線（#299）・上八雲支線（#366）は、#299・#366 の位置が分からないので、それぞれの設備にいちばん近い節点から推測で分けて描いた（保留138、この線は1本のまま）。');
  sr.attributes.push({ label: '支線', value: '鶴岡支線（知内線No.53〜Ａ開閉所＝木古内開閉所とみなした、推測）を、No.53 の位置が分からないので木古内開閉所にいちばん近い節点から推測で分けて描いた（保留138、この線は1本のまま）。' });
}
