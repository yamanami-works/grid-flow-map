// 川薩・川内まわりの修正（2026-10-10 オーナー承認、川薩開閉所の位置は「案A」）→ docs/research/kyushu-sensatsu-fix.json（scripts/build-kyushu.mjs が反映）。
// 一次資料：九州電力送配電「基幹系統 系統構成（実績）」2024年度（「川薩SWS」と「63 川内」は別の設備）、
//   送電線一覧・変圧器一覧（27 川内・出水地区、2026-09-29更新、data/raw/tso-lines/kyushu/）：
//   No.3 川薩南九州線 220kV 2回線 川薩sws→南九州、No.4 川内分岐線 220kV 南九州→川内、No.2 出水分岐線 220kV 南九州→出水、
//   川内変電所は220/110kV・220/66kVの変圧器を持つ。川薩は変圧器一覧になく、系統開閉所（SWS）。
// 1. OSMの区画「川内電力所」（way 237476160、220/110/66kV、220kVのOSM線「川内分岐線」が入る）を「川薩変電所」から「川内変電所」に直す。
// 2. 「川薩開閉所」を置く（案A）。OSMに区画がないので、旧川内発電所の敷地内で新鹿児島線と川内火力線（OSM名）の端が集まる4ノードの中心を推定位置とする。
// 3. 新鹿児島線は OSM の「新鹿児島線」の線分だけ（川薩開閉所の推定位置→新鹿児島変電所）。川内火力線・川内分岐線を経由させない。
// 4. 川薩南九州線を OSM の「川内火力線」の経路で追加（線名は一次資料、OSM名は違う）。5. 川内分岐線を追加（川薩南九州線の途中の分岐→川内変電所）。
//    出水分岐線（ledger-kyushu-220-237475788）の起点を川薩南九州線との分岐（共有ノード）に直す。
//    電源線「川内火力線」（kyushu-plant-220-way-365487155、OSM way 700628500。川内発電所は2022-04-01廃止）は川薩南九州線の一部として描くので、別の線としては描かない。
import fs from 'node:fs';
import path from 'node:path';
const APP = path.resolve(import.meta.dirname, '..');
const els = JSON.parse(fs.readFileSync(path.join(APP, 'data/raw/kyushu-osm/lines-220.json'), 'utf8')).elements;
const nodes = new Map(els.filter(e => e.type === 'node').map(n => [n.id, [n.lat, n.lon]]));
const way = id => { const w = els.find(e => e.type === 'way' && e.id === id); if (!w) throw Error('OSM way がない：' + id); return w; };
const d = (a, b) => Math.hypot((a[0] - b[0]) * 110540, (a[1] - b[1]) * 111320 * Math.cos(a[0] * Math.PI / 180));
const len = p => p.slice(1).reduce((s, q, i) => s + d(p[i], q), 0);
// way を from ノード側から並べた経路
const run = (id, from) => { const w = way(id); const ns = w.nodes[0] === from ? w.nodes : w.nodes.at(-1) === from ? [...w.nodes].reverse() : null; if (!ns) throw Error(`way ${id} の端が ${from} でない（OSMの更新を確認）`); return {osmId: id, nodes: ns, path: ns.map(n => nodes.get(n))}; };
const chain = (start, ids) => { const out = []; let at = start; for (const id of ids) { const r = run(id, at); out.push(r); at = r.nodes.at(-1); } return out; };
// 川薩開閉所の推定位置：新鹿児島線（405699053・700628504）と川内火力線（700628501・700628502）の西の端
const ends = [6579577260, 6579577261, 6579577262, 6579577263].map(n => nodes.get(n));
if (ends.some(p => !p)) throw Error('川薩の端のノードがない（OSMの更新を確認）');
const sws = [ends.reduce((s, p) => s + p[0], 0) / 4, ends.reduce((s, p) => s + p[1], 0) / 4];
const spread = Math.max(...ends.map(p => d(p, sws)));
const shinKagoshima = chain(6579577263, [405699053, 700628503, 237473951]); // 川薩→新鹿児島
const sensatsuMinamikyushu = chain(6579577260, [700628501, 700628500, 215443524, 696299882]); // 川薩→南九州
const sendaiBranch = chain(2248909074, [237475856, 609317321]); // 川薩南九州線の分岐→川内変電所
if (!way(215443524).nodes.includes(2248909074)) throw Error('川内分岐線の起点が川薩南九州線の上にない');
if (way(700628500).nodes.at(-1) !== 2248828145 || way(237475788).nodes[0] !== 2248828145) throw Error('出水分岐線の分岐ノードが想定と違う');
const km = r => Math.round(r.reduce((s, x) => s + len(x.path), 0) / 100) / 10;
const out = {
  note: 'tools/fix-kyushu-sensatsu.mjs が生成（2026-10-10 オーナー承認、川薩開閉所の位置は案A）。scripts/build-kyushu.mjs が反映する。',
  source: '九州電力送配電「基幹系統 系統構成（実績）」2024年度・送電線一覧／変圧器一覧（27 川内・出水地区、2026-09-29更新）',
  sendaiSubstation: {id: 'osm-way-237476160', from: '川薩変電所', to: '川内変電所'},
  sws: {id: 'kyushu-sws-sensatsu', assetId: 'kyushu-fac-sws-sensatsu', name: '川薩開閉所', position: sws, spreadM: Math.round(spread)},
  shinKagoshima: {id: 'kyushu-220-新鹿児島線', km: km(shinKagoshima), parts: shinKagoshima.map(({osmId, path}) => ({osmId, path})), swsNode: 6579577263},
  sensatsuMinamikyushu: {km: km(sensatsuMinamikyushu), parts: sensatsuMinamikyushu.map(({osmId, path}) => ({osmId, path})), swsNode: 6579577260, endNode: sensatsuMinamikyushu.at(-1).nodes.at(-1)},
  sendaiBranch: {km: km(sendaiBranch), parts: sendaiBranch.map(({osmId, path}) => ({osmId, path})), startNode: 2248909074, endNode: sendaiBranch.at(-1).nodes.at(-1)},
  izumiBranch: {id: 'ledger-kyushu-220-237475788', startNode: 2248828145, startPosition: nodes.get(2248828145)},
  dropLineIds: ['kyushu-plant-220-way-365487155'],
};
fs.writeFileSync(path.join(APP, 'docs/research/kyushu-sensatsu-fix.json'), JSON.stringify(out, null, 1) + '\n');
console.log('川薩開閉所', sws, '端の広がり', Math.round(spread) + 'm', '新鹿児島線', out.shinKagoshima.km + 'km', '川薩南九州線', out.sensatsuMinamikyushu.km + 'km', '川内分岐線', out.sendaiBranch.km + 'km');
