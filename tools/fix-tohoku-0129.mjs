// 0129線の経路の付け替え（2026-10-10 オーナー判断「案A」）→ docs/research/tohoku-0129-fix.json（scripts/build-tohoku.mjs が反映）。
// 0129線（東仙台変電所→仙台変電所、東北電力NW No.0129）は、OSMの線が途切れた地点から仙台変電所まで約8.6kmを直線で補っていた。
// その区間は OSM の way 103671668（約9.5km）と、仙台変電所の構内に入る way 829088724 が通っている。OSMではどちらも0129線の東側と同じ
// 「新仙台火力線」（275kV/154kV・4回線）の名で登録されており、0129線と同じ鉄塔とみなす。途切れた約240m（way 103746719 の西端〜way 103671668 の東端）
// だけ直線で残す。別に描いていた「新仙台火力線」（osm-103671668-275）は描かない（tests/baseline/approved-removals.json に登録）。
import fs from 'node:fs';
import path from 'node:path';
import { loadUnion } from './lib/osm-union.mjs';
const APP = path.resolve(import.meta.dirname, '..');
const { nodes, ways } = loadUnion(APP);
const way = id => { const w = ways.find(x => x.id === id); if (!w) throw Error('OSM way がない：' + id); return w; };
const pts = w => w.nodes.map(n => nodes.get(n)).filter(Boolean);
const d = (a, b) => Math.hypot((a[0] - b[0]) * 110540, (a[1] - b[1]) * 111320 * Math.cos(a[0] * Math.PI / 180));
const len = p => p.slice(1).reduce((s, q, i) => s + d(p[i], q), 0);
const A = way(103746719), B = way(103671668), C = way(829088724);
const gapFrom = A.nodes.at(-1), gapTo = B.nodes.at(-1);            // 0129線の途切れた地点 → way 103671668 の東端
if (gapFrom !== 1196938409 || gapTo !== 1196938146) throw Error('端のノードが想定と違う（OSMの更新を確認）');
const bPath = pts(B).reverse();                                     // 東端 → 西端（仙台変電所のそば）
const west = B.nodes[0];
const cNodes = C.nodes[0] === west ? C.nodes : C.nodes.at(-1) === west ? [...C.nodes].reverse() : null;
if (!cNodes) throw Error('way 829088724 が way 103671668 の西端につながっていない');
const cPath = cNodes.map(n => nodes.get(n));
const gap = [nodes.get(gapFrom), nodes.get(gapTo)];
const out = {
  note: 'tools/fix-tohoku-0129.mjs が生成（2026-10-10 オーナー判断「案A」）。scripts/build-tohoku.mjs が 0129線の直線（-9301）をこの経路に置き換え、新仙台火力線（osm-103671668-275）を描かない。',
  lineId: 'tohoku-section-0129', replaceOsmId: -9301, dropLineIds: ['osm-103671668-275'],
  paths: [{osmId: -9301, path: gap}, {osmId: 103671668, path: bPath}, {osmId: 829088724, path: cPath}],
  end: {node: cNodes.at(-1), position: cPath.at(-1)},
  meters: {gap: Math.round(d(...gap)), way103671668: Math.round(len(bPath)), way829088724: Math.round(len(cPath))},
};
fs.writeFileSync(path.join(APP, 'docs/research/tohoku-0129-fix.json'), JSON.stringify(out, null, 1) + '\n');
console.log(out.meters, 'end', out.end);
