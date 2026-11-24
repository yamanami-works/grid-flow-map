// 送電線チェック（2026-10-09 オーナー指示：ルートの tmp-*.mjs / tmp-*.ts の接続・欠落・OCCTO照合系を統合。元は archive/tmp-scripts-2026-10/）。
// 使い方（app で実行）: node tools/audit-lines.mjs [--area tohoku|hokkaido|tokyo|chubu|hokuriku|kansai|chugoku|shikoku|kyushu|tie|all] [--voltage 500,275] [--out <dir>]
//   [--line <線名またはID>]（複数可。名前は正規化して部分一致、複数ヒットなら候補を出して終了）[--detail]（線ごとの情報カード）
//   --line のときもチェックは全体で行い、出力だけを「指定線＋両端の設備＋その設備につながる線」に関係する指摘に絞る。出力は <out>/line/（全体レポートの前回差分の基準は上書きしない）
// 出力: <out>/line-audit-<日付>.json と .txt（既定 ../reports/line-audit）。error が1件でもあれば終了コード1。データは書き換えない。
// 照合はアプリの処理（各エリアの reviewed*Day と referenceFlowPath）をそのまま使う（Node 22.18 は .ts を直接読める）。
import fs from 'node:fs';
import path from 'node:path';
import {referenceFlowPath, flowBranches} from '../src/flow-path.ts';
import {candidateGeometry} from '../src/real-domain.ts';
import {endpointConflict} from '../src/flow-quality.ts';
import {pathDash, DASHED_UNKNOWN} from '../src/line-drawing.ts';
import {isCustomerTargetKV, customerTargetText} from './lib/customer-target.mjs';
import {latestIndex} from '../src/occto-time.ts';
import {reviewedTohokuDay} from '../src/tohoku-domain.ts';
import {reviewedHokkaidoDay} from '../src/hokkaido-domain.ts';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';
import {reviewedChubuDay} from '../src/chubu-domain.ts';
import {reviewedHokurikuDay} from '../src/hokuriku-domain.ts';
import {reviewedKansaiDay} from '../src/kansai-domain.ts';
import {reviewedChugokuDay} from '../src/chugoku-domain.ts';
import {reviewedShikokuDay} from '../src/shikoku-domain.ts';
import {reviewedKyushuDay} from '../src/kyushu-domain.ts';

const APP = path.resolve(import.meta.dirname, '..');
// 東北電力NW の空容量一覧（送電線）は携帯用ビルドだけ（data/private/、公開リポジトリにはない。2026-11-09 保留95 ⑤-b）。ないときは東北の端点の照合を飛ばし、1回だけ知らせる
let tohokuNetworkCache;
const tohokuNetwork = () => { if (tohokuNetworkCache === undefined) { const p = path.join(APP, 'data/private/network-capacity.json'); tohokuNetworkCache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).lines : []; if (!tohokuNetworkCache.length) console.warn('東北電力NW の表（data/private/network-capacity.json）がないため、東北の端点の照合を飛ばします'); } return tohokuNetworkCache; };
const AREAS = ['hokkaido', 'tohoku', 'tokyo', 'chubu', 'hokuriku', 'kansai', 'chugoku', 'shikoku', 'kyushu', 'tie'];
const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const area = arg('area') ?? 'all';
if (area !== 'all' && !AREAS.includes(area)) throw Error('--area は ' + [...AREAS, 'all'].join('|'));
const voltages = arg('voltage') ? arg('voltage').split(',').map(Number) : null;
if (voltages?.some(v => !Number.isFinite(v))) throw Error('--voltage は 500,275 のように指定');
const OUT = path.resolve(arg('out') ?? path.join(APP, '../reports/line-audit'));
// --data <dir>：線・設備・潮流のJSONを別の場所から読む（チェック自体の検証用の作業コピー。既定は public/data）
const DATA = path.resolve(arg('data') ?? path.join(APP, 'public/data'));
// 確認済みリスト（ID・項目・理由・出典・確認日）。該当する指摘は info に下げ、新しい指摘だけが warn/error に残る
const ALLOW = JSON.parse(fs.readFileSync(path.join(APP, 'tools/audit-allowlist.json'), 'utf8')).entries;
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8').replace(/^﻿/, ''));

// 地図に描く線・設備（カタログの *-trunk と同じファイル）。連系線（tie-）は両エリアに同じIDで置かれるので1本にまとめる
const GEO = [['tohoku', 'tohoku-trunk.json'], ['tohoku', 'tohoku-dc-osm.json'], ['hokkaido', 'hokkaido-hokuto.json'], ['tokyo', 'tokyo-trunk.json'], ['chubu', 'chubu-trunk.json'], ['hokuriku', 'hokuriku-trunk.json'], ['kansai', 'kansai-trunk.json'], ['chugoku', 'chugoku-trunk.json'], ['shikoku', 'shikoku-trunk.json'], ['kyushu', 'kyushu-trunk.json']];
const allLines = [], allFacilities = new Map(), geoByFile = new Map();
for (const [a, f] of GEO) {
  const g = read(f); geoByFile.set(f, g);
  // 複数エリアのデータにある線・設備はエリアを両方持つ（2026-10-10：佐久間発電所が東京だけと表示されていた）。表示は「chubu・tokyo」
  for (const l of g.lines) { const o = allLines.find(x => x.id === l.id); if (!o) allLines.push({...l, area: l.id.startsWith('tie-') ? 'tie' : a, areas: [l.id.startsWith('tie-') ? 'tie' : a], file: f}); else if (!o.areas.includes(a) && !l.id.startsWith('tie-')) { o.areas.push(a); o.area = o.areas.join('・'); } }
  for (const x of g.facilities ?? []) { const o = allFacilities.get(x.id); if (!o) allFacilities.set(x.id, {...x, area: a, areas: [a], file: f}); else if (!o.areas.includes(a)) { o.areas.push(a); o.area = o.areas.join('・'); } }
}
const inScope = x => (area === 'all' || (x.areas ?? [x.area]).includes(area));
const lineIn = l => inScope(l) && (!voltages || voltages.includes(l.voltageKV));
const facIn = f => inScope(f) && (!voltages || f.voltages?.some(v => voltages.includes(v)));
const lines = allLines.filter(lineIn), facilities = [...allFacilities.values()].filter(facIn);

const findings = [];
const add = (severity, check, x, message, extra = {}) => findings.push({severity, check, area: x?.area ?? null, id: x?.id ?? null, name: x?.name ?? null, voltageKV: x?.voltageKV ?? null, message, ...extra});
const key = p => p[0] + ',' + p[1];
const norm = s => String(s ?? '').normalize('NFKC').replace(/\s/g, '');
const baseName = s => norm(s).replace(/[（(][^）)]*[）)]/g, '');
const ends = l => l.paths.flatMap(p => p.length ? [key(p[0]), key(p.at(-1))] : []);

// ---- 線の個別指定（--line、2026-10-09） ----
const lineQueries = process.argv.flatMap((v, i) => v === '--line' ? [process.argv[i + 1] ?? ''] : []).flatMap(q => q.split(',')).map(q => q.trim()).filter(Boolean);
const detail = process.argv.includes('--detail');
let selected = null;
if (lineQueries.length) {
  selected = [];
  for (const q of lineQueries) {
    let hits = allLines.filter(l => l.id === q);
    if (!hits.length) { const part = allLines.filter(l => norm(l.name).includes(norm(q))), exact = part.filter(l => norm(l.name) === norm(q)); hits = exact.length === 1 ? exact : part; }
    if (!hits.length) { console.log(`「${q}」に当たる線がありません。`); process.exit(2); }
    if (hits.length > 1) { console.log(`「${q}」に当たる線が${hits.length}本あります。ID か、より詳しい名前で指定してください：`); for (const l of hits) console.log(`  ${l.id}　${l.name}　${l.voltageKV}kV　${l.area}`); process.exit(2); }
    if (!selected.includes(hits[0])) selected.push(hits[0]);
  }
}

// ---- 1. 端点未接続・交差の接続誤認 ----
const vertexLines = new Map(), endLines = new Map();
for (const l of allLines) {
  for (const p of l.paths) for (const q of p) { const k = key(q); if (!vertexLines.has(k)) vertexLines.set(k, new Set()); vertexLines.get(k).add(l.id); }
  for (const k of ends(l)) { if (!endLines.has(k)) endLines.set(k, new Set()); endLines.get(k).add(l.id); }
}
// 座標の桁が線ごとに違うことがあるので、1m以内を同じ点とみなす
const G = 0.0001, gk = p => Math.floor(p[0] / G) + ':' + Math.floor(p[1] / G);
const gridOf = m => { const g = new Map(); for (const [k, ids] of m) { const p = k.split(',').map(Number), c = gk(p); if (!g.has(c)) g.set(c, []); g.get(c).push([p, ids]); } return g; };
const vGrid = gridOf(vertexLines), eGrid = gridOf(endLines);
const within = (g, p) => { const [r, c] = gk(p).split(':').map(Number), out = new Set(); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [q, ids] of g.get((r + i) + ':' + (c + j)) ?? []) if (Math.hypot((q[0] - p[0]) * 110540, (q[1] - p[1]) * 111320 * Math.cos(p[0] * Math.PI / 180)) <= 1) for (const id of ids) out.add(id); return [...out]; };
const nearVertex = p => within(vGrid, p), nearEnd = p => within(eGrid, p);
let unresolved = 0;
for (const l of lines) for (const c of l.connections ?? []) {
  if (c.status === 'unresolved') { unresolved++; add('warn', '端点未接続', l, `端点が設備にも他線にも着いていない（unresolved）`, {position: c.position, node: c.node}); continue; }
  if (c.status !== 'shared-node') continue;
  const k = key(c.position), partners = nearVertex(c.position).filter(id => id !== l.id);
  if (!partners.length) { add('error', '端点未接続', l, '共有点（shared-node）に相手の線がない', {position: c.position, node: c.node}); continue; }
  const selfEnd = nearEnd(c.position).includes(l.id), partnerEnd = partners.some(id => nearEnd(c.position).includes(id));
  if (!selfEnd && !partnerEnd) add('warn', '交差を接続と誤認の疑い', l, `共有点が両線とも途中の点（相手：${partners.join('、')}）`, {position: c.position, node: c.node});
}

// ---- 2. 接続先ID不在 ----
// sourceAssetIds は置き換えた元の線の assetId（来歴）。元の線は tohoku-trunk-osm.json などの原データ側に残る
const assetIds = new Set([...read('asset-registry.json').assets.map(a => a.id), ...allLines.map(l => l.assetId), ...[...allFacilities.values()].map(f => f.assetId), ...read('tohoku-trunk-osm.json').lines.map(l => l.assetId)]);
const osmIdSet = new Set(allLines.flatMap(l => l.osmIds.map(Math.abs)));
for (const l of lines) {
  for (const c of l.connections ?? []) for (const f of c.facilities ?? []) if (f.id && !allFacilities.has(f.id)) add('error', '接続先ID不在', l, `接続先の設備ID ${f.id}（${f.name}）が設備一覧にない`);
  for (const id of l.sourceAssetIds ?? []) if (!assetIds.has(id)) add('error', '接続先ID不在', l, `sourceAssetIds の ${id} が、地図の線・設備・asset-registry・原データのどこにもない`);
  for (const id of l.connectedWayIds ?? []) if (!osmIdSet.has(Math.abs(id))) add('error', '接続先ID不在', l, `connectedWayIds の ${id} がどの線の osmIds にもない`);
}

// ---- 3. 同名・別名重複疑い（「線／幹線」・号数違いは別物として扱う） ----
const byName = new Map();
for (const l of lines) { const k = baseName(l.name) + '|' + l.voltageKV; if (!l.named || !baseName(l.name)) continue; byName.set(k, [...(byName.get(k) ?? []), l]); }
// 同じ線の区間分割（正規化名・電圧が一致し、端点（1m以内の点か同じ設備）で連続）は info、つながらない同名は warn
const facEnds = l => new Set((l.connections ?? []).flatMap(c => (c.facilities ?? []).map(f => f.id)));
const touches = (a, b) => facEnds(a).size && [...facEnds(a)].some(id => facEnds(b).has(id)) || a.paths.some(p => p.length && [p[0], p.at(-1)].some(q => nearEnd(q).includes(b.id)));
for (const group of byName.values()) if (group.length > 1) {
  const seen = new Set([group[0].id]), st = [group[0]];
  while (st.length) { const x = st.pop(); for (const y of group) if (!seen.has(y.id) && touches(x, y)) { seen.add(y.id); st.push(y); } }
  const chain = seen.size === group.length;
  add(chain ? 'info' : 'warn', '同名・別名重複疑い', group[0], `同じ名前・電圧の線が${group.length}本：${group.map(l => l.id).join('、')}${chain ? '（端点で連続＝同じ線の区間分割）' : '（端点でつながらない組がある）'}`, {ids: group.map(l => l.id)});
}
for (const l of lines) for (const n of l.flowNames ?? []) {
  const other = lines.filter(x => x.id !== l.id && x.voltageKV === l.voltageKV && baseName(x.name) === baseName(n));
  // 同じ線を区間に分けて潮流の別名を付けたもの（東京 北千葉線・港北線など）は、端点で連続していれば info
  if (other.length) { const chain = other.every(o => touches(l, o)); add(chain ? 'info' : 'warn', '同名・別名重複疑い', l, `潮流の別名「${n}」が別の線の名前と同じ：${other.map(x => x.id).join('、')}${chain ? '（端点で連続＝同じ線の区間分割）' : ''}`); }
}

// ---- 4. 並行回線重複（osmIds共有＝併架の可能性／経路の8割以上が30m以内で重なる） ----
const byWay = new Map();
for (const l of lines) for (const id of new Set(l.osmIds.filter(id => id > 0))) byWay.set(id, [...(byWay.get(id) ?? []), l]); // 負のIDは直線描画などの仮ID（OSMではない）
const sharedPairs = new Set();
for (const [way, ls] of byWay) if (ls.length > 1) for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) sharedPairs.add([ls[i].id, ls[j].id].sort().join('｜') + '｜' + way);
const pairWays = new Map();
for (const s of sharedPairs) { const [a, b, w] = s.split('｜'); pairWays.set(a + '｜' + b, [...(pairWays.get(a + '｜' + b) ?? []), w]); }
for (const [pair, ways] of pairWays) { const [a, b] = pair.split('｜'); add('info', '並行回線重複', lines.find(l => l.id === a), `OSM線分を共有（併架の可能性）：相手 ${b}、線分 ${ways.length}本（${ways.slice(0, 5).join(', ')}${ways.length > 5 ? '…' : ''}）`, {other: b}); }
const meters = (p, q) => { const x = (q[1] - p[1]) * Math.cos((p[0] + q[0]) / 2 * Math.PI / 180) * 111320, y = (q[0] - p[0]) * 110540; return Math.hypot(x, y); };
const segDist = (p, a, b) => { const kx = Math.cos(p[0] * Math.PI / 180) * 111320, ky = 110540; const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky, bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky; const dx = bx - ax, dy = by - ay, t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0; return Math.hypot(ax + t * dx, ay + t * dy); };
const CELL = 0.005, cellOf = p => Math.floor(p[0] / CELL) + ':' + Math.floor(p[1] / CELL);
const segGrid = new Map();
for (const l of lines) for (const p of l.paths) for (let i = 1; i < p.length; i++) {
  const a = p[i - 1], b = p[i], c = new Set([cellOf(a), cellOf(b), cellOf([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])]);
  for (const k of c) { if (!segGrid.has(k)) segGrid.set(k, []); segGrid.get(k).push([l, a, b]); }
}
const overlapDone = new Set();
for (const l of lines) {
  const pts = l.paths.flat(); if (pts.length < 3) continue;
  const near = new Map();
  for (const p of pts) { const hit = new Set(); const [r, c] = cellOf(p).split(':').map(Number); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) for (const [o, a, b] of segGrid.get((r + dr) + ':' + (c + dc)) ?? []) if (o.id !== l.id && o.voltageKV === l.voltageKV && !hit.has(o.id) && segDist(p, a, b) <= 30) hit.add(o.id); for (const id of hit) near.set(id, (near.get(id) ?? 0) + 1); }
  for (const [id, n] of near) { const pair = [l.id, id].sort().join('｜'); if (n / pts.length < 0.8 || overlapDone.has(pair) || pairWays.has(pair)) continue; overlapDone.add(pair); const o = lines.find(x => x.id === id), same = baseName(o.name) === baseName(l.name); add(same ? 'info' : 'warn', '並行回線重複', l, `経路の${Math.round(n / pts.length * 100)}%が${same ? '同名の' : '別名の'}線（${o.name}、${id}）から30m以内${same ? '' : '（同じ設備を別名で二重に描いている疑い）'}`, {other: id}); }
}

// ---- 5. 直流・FC・連系線の交流側接続欠落 ----
const acAt = new Map();
for (const l of allLines) if (l.currentType === 'ac') for (const c of l.connections ?? []) for (const f of c.facilities ?? []) acAt.set(f.id, [...(acAt.get(f.id) ?? []), l.id]);
for (const l of lines) {
  const special = l.currentType === 'dc' || l.id.startsWith('tie-');
  if (!special) continue;
  for (const c of l.connections ?? []) for (const f of c.facilities ?? []) {
    const fac = allFacilities.get(f.id); if (!fac) continue;
    if (l.currentType === 'dc' && fac.kind !== 'converter') continue;
    const ac = (acAt.get(f.id) ?? []).filter(id => id !== l.id);
    if (!ac.length) add('error', '直流/FC/連系線の交流側接続欠落', l, `端の${fac.name}に交流側の線が1本もつながっていない`, {facility: f.id});
  }
}
for (const f of facilities) if (f.kind === 'converter' && !(acAt.get(f.id) ?? []).length) add('error', '直流/FC/連系線の交流側接続欠落', f, '変換所・FCに交流側の線が1本もつながっていない', {voltageKV: f.voltages?.[0] ?? null});

// ---- 6. 出典欠落 ----
const SOURCE = /出典|根拠|資料/;
for (const l of lines) if (!(l.attributes ?? []).some(a => SOURCE.test(a.label) && String(a.value ?? '').trim())) add('error', '出典欠落', l, '属性に「出典」「根拠」の項目がない');
for (const f of facilities) if (!f.url && !(f.attributes ?? []).some(a => SOURCE.test(a.label) && String(a.value ?? '').trim())) add('warn', '出典欠落', f, '設備に url も「出典」「根拠」の項目もない', {voltageKV: f.voltages?.[0] ?? null});

// ---- 6b. 需要家（2026-10-11 オーナー指示、docs/CUSTOMER_FACILITIES.md） ----
// 名前の確認に使える一次資料の種類（需要家自身・一般送配電会社・OCCTO・行政・メーカー技報）。報道・OSM・Wikipedia等は補助資料
const CUSTOMER_PRIMARY = /需要家|一般送配電会社|OCCTO|行政|メーカー技報/;
// 対象電圧は地域ごとの基幹電圧（tools/lib/customer-target.mjs、docs/RULES.md 3節）
const customerTarget = (f, kv) => isCustomerTargetKV(f.areas ?? [f.area], kv);
for (const f of facilities) {
  const isCustomer = f.kind === 'customer' || (f.alsoKinds ?? []).includes('customer'); if (!isCustomer) continue;
  const c = f.customer, x = {...f, voltageKV: c?.receivingKV?.[0] ?? f.voltages?.[0] ?? null};
  if (!c) { add('error', '需要家', x, '需要家の情報（customer）がない'); continue; }
  const linked = allLines.some(l => (l.connections ?? []).some(e => (e.facilities ?? []).some(y => y.id === f.id)));
  if (!linked) add('error', '需要家', x, '需要家の設備がどの線にもつながっていない');
  if (!c.sources?.length) add('error', '需要家', x, '出典がない');
  else if (!c.sources.some(s => s.kind === 'primary' && s.namesFacility)) add('warn', '需要家', x, `補助資料のみ：設備を名指しする一次資料がない（${c.sources.filter(s => s.kind === 'auxiliary').map(s => s.category).join('・') || '補助資料なし'}）`);
  // 名前の公開ルール：実名表示（表示名が「需要家」以外）は、名指しする一次資料（上の種類）が出典にあること
  const realName = c.displayName !== '需要家' || f.name !== '需要家';
  const primaryNames = (c.sources ?? []).filter(s => s.kind === 'primary' && s.namesFacility && CUSTOMER_PRIMARY.test(s.category));
  if (realName && !primaryNames.length) add('error', '需要家', x, `実名表示（${f.name}）なのに、名前を確認した一次資料（需要家・一般送配電会社・OCCTO・行政・メーカー技報）が出典にない`);
  if (realName && c.nameStatus !== 'confirmed') add('error', '需要家', x, '実名表示なのに名前の確認状況が「確認済み」でない');
  if (!realName && c.nameStatus === 'confirmed') add('warn', '需要家', x, '名前は確認済みなのに表示名が「需要家」のまま');
  if (!(c.sources ?? []).some(s => s.kind === 'primary' && s.result)) add('error', '需要家', x, '一次資料の検索結果（見つかった／見つからない）が出典に記録されていない');
  if (f.name !== c.displayName) add('error', '需要家', x, `設備名（${f.name}）と表示名（${c.displayName}）が違う`);
  const kvs = c.receivingKV ?? [];
  if (!kvs.length || !kvs.some(kv => customerTarget(f, kv))) add('error', '需要家', x, `対象電圧外の需要家（受電 ${kvs.join('/') || '不明'}kV。対象は${customerTargetText}）`);
  for (const o of allFacilities.values()) if (o.id !== f.id && ['plant', 'substation', 'switchyard', 'converter'].includes(o.kind)) { const d = meters(f.position, o.position); if (d <= 300) add('warn', '需要家', x, `発電所・変電所と同一敷地の重複疑い：${o.name}（${o.id}）から約${Math.round(d)}m。同じ敷地なら1つの設備に種別を併記（alsoKinds）`, {other: o.id}); }
}
for (const l of lines) if (l.lineType === 'customer') {
  if (!l.customerLine?.owner) add('error', '需要家', l, '需要家線の所有者（customerLine.owner）がない');
  const ends = (l.connections ?? []).flatMap(c => c.facilities ?? []).map(y => allFacilities.get(y.id)).filter(Boolean);
  if (!ends.some(y => y.kind === 'customer' || (y.alsoKinds ?? []).includes('customer'))) add('error', '需要家', l, '需要家線なのに端に需要家の設備がない');
}

// ---- 7. status値不正 ----
const LINE_STATUS = new Set(['運用中', '建設中', '計画中']);
let lineNoStatus = 0, facNoStatus = 0;
for (const l of lines) {
  if (l.status === undefined) lineNoStatus++;
  else if (l.status === '廃止') add('error', 'status値不正', l, '線の status が「廃止」（廃止線は描かない）');
  else if (!LINE_STATUS.has(l.status)) add('error', 'status値不正', l, `線の status「${l.status}」は許容値（運用中／建設中／計画中）の外`);
  for (const c of l.connections ?? []) if (!['facility-area', 'shared-node', 'unresolved'].includes(c.status)) add('error', 'status値不正', l, `connections の status「${c.status}」は許容値の外`);
  if (l.referenceReview && !['section', 'partial'].includes(l.referenceReview.status)) add('error', 'status値不正', l, `referenceReview の status「${l.referenceReview.status}」は許容値の外`);
}
for (const f of facilities) {
  if (f.status === undefined) facNoStatus++;
  // 2026-10-09 仕様変更：廃止は発電所だけ許容（原子力以外も）。変電所・開閉所・変換所は運用中／建設中／計画中の3区分
  else if (f.status === '廃止') { if (f.kind !== 'plant') add('error', 'status値不正', f, '設備の status「廃止」は発電所だけ許容', {voltageKV: f.voltages?.[0] ?? null}); }
  else if (!LINE_STATUS.has(f.status)) add('error', 'status値不正', f, `設備の status「${f.status}」は許容値の外`, {voltageKV: f.voltages?.[0] ?? null});
}
add('info', 'status値不正', null, `status 未設定（運用中として扱う）：線 ${lineNoStatus}本、設備 ${facNoStatus}か所`);

// ---- 7b. 廃止発電所の電源線・現況未確認（線は消さず、運用状態「未確認」で表示。撤去・廃止の一次資料が見つかったら承認リストに登録して消す） ----
for (const l of lines) {
  const p = (l.connections ?? []).flatMap(c => c.facilities ?? []).map(x => allFacilities.get(x.id)).find(f => f?.kind === 'plant' && f.status === '廃止');
  // 公表区間（OCCTO・各社の表に行がある線）は電源線ではなく、運用状態は公表で確かめられる（scripts/retired-plants.mjs と同じ条件）
  const published = (l.attributes ?? []).some(at => /^公表区間|^公表の行|^公表の線名/.test(at.label));
  if (p && !l.id.startsWith('tie-') && !published) add('warn', '廃止発電所の電源線・現況未確認', l, `接続先の${p.name}は廃止${p.retiredAt ? '（' + p.retiredAt + '）' : ''}。線の撤去・転用・運用状態は一次資料で未確認${l.statusConfirmed === false ? '（画面は「運用状態 未確認」）' : '（画面の表示が未対応）'}`);
}

// ---- 8. OCCTO照合（旧 tmp-occto-gap.ts / tmp-ec.ts）と 9. 潮流値の分岐後区間への複製 ----
const FLOWS = [['tohoku', 'occto-tohoku.json', ['tohoku-trunk.json', 'tohoku-dc-osm.json'], reviewedTohokuDay], ['hokkaido', 'hokkaido-flow.json', ['hokkaido-hokuto.json'], reviewedHokkaidoDay], ['tokyo', 'tokyo-flow.json', ['tokyo-trunk.json'], reviewedTokyoDay], ['chubu', 'chubu-flow.json', ['chubu-trunk.json'], reviewedChubuDay], ['hokuriku', 'hokuriku-flow.json', ['hokuriku-trunk.json'], reviewedHokurikuDay], ['kansai', 'kansai-flow.json', ['kansai-trunk.json'], reviewedKansaiDay], ['chugoku', 'chugoku-flow.json', ['chugoku-trunk.json'], reviewedChugokuDay], ['shikoku', 'shikoku-flow.json', ['shikoku-trunk.json'], reviewedShikokuDay], ['kyushu', 'kyushu-flow.json', ['kyushu-trunk.json'], reviewedKyushuDay], ['tie', 'tie-flow.json', GEO.map(g => g[1]), d => d]];
const flowStats = {}, flowCtx = {}, rowLines = new Map();
for (const [a, file, geoFiles, review] of FLOWS) {
  if (area !== 'all' && area !== a) continue;
  const data = read(file), raw = data.days[0], day = review(raw);
  const geo = geoFiles.flatMap(f => geoByFile.get(f).lines);
  flowCtx[a] = {raw, day, geo};
  for (const r of day.actual.lines) rowLines.set(a + '|' + r.id, candidateGeometry(r, geo).map(g => g.id));
  const reviewed = new Set(day.actual.lines.map(l => l.id));
  const rows = day.actual.lines.filter(l => !voltages || voltages.includes(l.voltageKV));
  const st = flowStats[a] = {date: raw.date, rows: raw.actual.lines.length, reviewed: day.actual.lines.length, noPath: 0, branch: 0, branchTouch: 0, branchOverlap: 0};
  for (const l of raw.actual.lines) if (!reviewed.has(l.id) && (!voltages || voltages.includes(l.voltageKV))) add('info', 'OCCTO照合', {area: a, id: l.id, name: l.name, voltageKV: l.voltageKV}, `OCCTOの行が対応表にない（地図に出さない）：${l.from}→${l.to}`);
  const endIdx = new Map();
  for (const g of geo) for (const k of ends(g)) endIdx.set(k, [...(endIdx.get(k) ?? []), g]);
  for (const r of rows) {
    const p = referenceFlowPath(r, geo, false), x = {area: a, id: r.id, name: r.name, voltageKV: r.voltageKV};
    if (!p) { st.noPath++; add('warn', 'OCCTO照合', x, `地図上の経路が見つからない：${r.from}→${r.to}`); continue; }
    const matched = candidateGeometry(r, geo), mids = new Set(matched.map(g => g.id));
    // 分岐とした線ごとに、行の参照経路（両端を含む全頂点）と共有する頂点の数を数える。1点＝経路に1点で接する、2点以上＝経路が重なる（並行回線・共架・幹線に沿って描いた分岐線など。本当の分岐かは自動では決めない。2026-10-18 オーナー承認）
    const branches = new Map(), onPath = new Set(p.map(key));
    // 共架の線（coHungWith にこの行の線のIDがある線）は分岐に数えない。画面（src/flow-path.ts の flowBranches）と同じ扱い（2026-11-18 オーナー回答 保留130-8「推奨で」）
    for (const q of p.slice(1, -1)) for (const g of endIdx.get(key(q)) ?? []) if (!mids.has(g.id) && g.voltageKV === r.voltageKV && !g.coHungWith?.some(id => mids.has(id))) {
      const n = new Set(g.paths.flat().map(key).filter(k => onPath.has(k))).size, name = g.name || g.id;
      branches.set(name, Math.min(branches.get(name) ?? Infinity, n)); // 同じ名前の線（並行回線など）は少ない方を採り、1点で接するものを隠さない
    }
    if (branches.size) {
      st.branch++;
      if ([...branches.values()].some(n => n < 2)) st.branchTouch++; else st.branchOverlap++;
      // 画面（src/flow-path.ts の flowBranches）が同じ分岐を見つけていれば、詳細パネル・ツールチップに「行単位の値」の注記を出して表示済み＝info（2026-10-10 仕様変更）
      const shown = flowBranches(r, geo).length > 0;
      const names = [...branches].map(([name, n]) => `${name}：${n < 2 ? '1点で接する' : `経路が重なる（${n}点）`}`);
      add(shown ? 'info' : 'warn', '潮流値の分岐後区間への複製', x, `OCCTOの1行（${r.from}→${r.to}）の値が分岐（${names.join('、')}）をまたぐ${shown ? '：行単位の値として注記して表示（OCCTO公表の行単位の値・区間ごとの値ではない。行の経路全体を同じ使用率で色分け、2026-10-10）' : '：行単位の値の注記に未対応'}`);
    }
  }
  if (a === 'tohoku') { const nw = tohokuNetwork(); for (const r of rows) if (endpointConflict(r, nw)) add('warn', 'OCCTO照合', {area: a, id: r.id, name: r.name, voltageKV: r.voltageKV}, `OCCTOの端点（${r.from}→${r.to}）が公表表の向き（${nw.filter(x => norm(x.name) === norm(r.name)).map(x => x.direction).join(' / ')}）と食い違う`); }
}

// ---- 10. 未取得値の0埋め（取得時刻より後の値／原本では空欄なのに0） ----
const RAWDIR = {tohoku: d => `occto-${d}`, hokkaido: d => `occto-hokkaido-${d}`, tokyo: d => `occto-tokyo-${d}`, chubu: d => `occto-chubu-${d}`, hokuriku: d => `occto-hokuriku-${d}`, kansai: d => `occto-kansai-${d}`, chugoku: d => `occto-chugoku-${d}`, shikoku: d => `occto-shikoku-${d}`, kyushu: d => `occto-kyushu-${d}`};
const zeroStats = {};
for (const [a, file] of FLOWS) {
  if (area !== 'all' && area !== a) continue;
  const zs = zeroStats[a] = {days: 0, rawChecked: 0, rawMissing: 0};
  for (const d of read(file).days) {
    zs.days++;
    const cutoff = Date.parse(d.retrievedAt);
    let rawRows = null;
    const dir = RAWDIR[a] && path.join(APP, 'data/raw', RAWDIR[a](d.date));
    if (dir && fs.existsSync(path.join(dir, 'actual.json'))) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, 'actual.json'), 'utf8').replace(/^﻿/, ''));
        const h = j.root.bizRoot.header, cols = Object.keys(h).filter(k => /^colonLbl\d+$/.test(k)).sort((x, y) => h[x].label.localeCompare(h[y].label));
        if (cols.length === 48) rawRows = j.root.bizRoot.table.table1.table1.rows.map(r => ({name: norm(r.sdlNm?.value), kv: Number(String(r.daKv?.value ?? r.daKv1?.value ?? '').replace(/,/g, '')), blank: cols.map(k => String(r[k]?.value ?? '').trim() === '')}));
      } catch { rawRows = null; }
    }
    if (rawRows) zs.rawChecked++; else if (RAWDIR[a]) zs.rawMissing++;
    for (const l of d.actual.lines) {
      if (voltages && !voltages.includes(l.voltageKV)) continue;
      const x = {area: a, id: l.id, name: l.name, voltageKV: l.voltageKV};
      const late = l.values.map((v, i) => v !== null && Date.parse(d.actual.times[i] + '+09:00') > cutoff ? d.actual.times[i].slice(11, 16) : null).filter(Boolean);
      if (late.length) add('error', '未取得値の0埋め', x, `${d.date}：取得時刻（${d.retrievedAt}）より後の時刻に値がある（${late.slice(0, 6).join(', ')}${late.length > 6 ? '…' : ''}）`);
      if (!rawRows) continue;
      const cand = rawRows.filter(r => r.name === norm(l.name) && (!r.kv || r.kv === l.voltageKV));
      if (!cand.length) continue;
      const filled = l.values.map((v, i) => v === 0 && cand.every(r => r.blank[i]) ? d.actual.times[i].slice(11, 16) : null).filter(Boolean);
      if (filled.length) add('error', '未取得値の0埋め', x, `${d.date}：原本では空欄なのに0になっている（${filled.slice(0, 6).join(', ')}${filled.length > 6 ? '…' : ''}）`);
    }
  }
}

// ---- 10b. OCCTO行の表示漏れ（2026-10-10 オーナー指示：最新日のOCCTO原本の全行を、地図に出している行と突き合わせる。データは直さない） ----
// 表示＝対応表（reviewed*Day）を通り、名前・電圧で地図の線に当たる（candidateGeometry）行。対応表で区間に分けた行（関西の西大阪十字など、ID＝元ID-…）も元の行の表示とみなす。
// 表示しない行の理由：①対象範囲外の電圧（info）②対応表に未登録・名称不一致（warn）③対応する線が地図にない（warn）④フェンス・合計行（info）⑤その他（取り込み漏れ＝warn、OCCTOが空欄で公表＝info）
// 対象範囲は「11. 欠落」と同じ：500/275kV、北海道の187kV、直流、連系線
const GAP = '①対象範囲外の電圧', GAP2 = '②対応表に未登録（名称不一致）', GAP3 = '③対応する線が地図にない', GAP4 = '④フェンス・合計行', GAP5 = '⑤その他';
const coverage = {};
const facName = s => norm(s).replace(/(変電所|開閉所|発電所|変換所|連系所|分岐点?|火力|原子力)$/, '');
const lineStem = s => baseName(s).replace(/(\d+号)?(幹線|支線|線)$/, '');
// 名前違いの候補：同じ電圧で、名前の幹（「線／幹線」を除く）が一致・包含するか、両端の設備名が一致する線
const gapCandidates = (r, geo) => {
  const stem = lineStem(r.name), ends = [facName(r.from), facName(r.to)];
  return geo.filter(g => g.voltageKV === r.voltageKV && g.named !== false).filter(g => {
    const gs = [g.name, ...(g.flowNames ?? [])].map(lineStem).filter(Boolean);
    if (stem && gs.some(x => x === stem || (stem.length >= 2 && x.length >= 2 && (x.includes(stem) || stem.includes(x))))) return true;
    const fs_ = (g.connections ?? []).flatMap(c => (c.facilities ?? []).map(f => facName(f.name)));
    return ends.every(e => e && fs_.includes(e));
  });
};
const rawRowsOf = (a, date) => {
  const f = RAWDIR[a] && path.join(APP, 'data/raw', RAWDIR[a](date), 'actual.json');
  if (!f || !fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')).root.bizRoot.table.table1.table1.rows.map(r => ({name: r.sdlNm?.value ?? '', voltageKV: Number(String(r.daKv?.value ?? r.daKv1?.value ?? '').replace(/,/g, '')), section: String(r.flowHukuSeiHuku?.value ?? '').replace(/\s/g, '')})); } catch { return null; }
};
// 対象範囲の電圧（docs/RULES.md 3節「対象範囲」：全国 500/275kV、北海道・四国 187kV、中国・九州 220kV）。欠落の判定（inTarget）もこれを使う
const inTargetRow = (a, kv) => kv === 500 || kv === 275 || ((a === 'hokkaido' || a === 'shikoku') && kv === 187) || ((a === 'chugoku' || a === 'kyushu') && kv === 220);
const FENCE = /フェンス|合計|[+＋]|・.*線$/;
for (const [a] of FLOWS) {
  if (a === 'tie' || !flowCtx[a]) continue;
  const {raw, day, geo} = flowCtx[a];
  const cov = coverage[a] = {date: raw.date, source: 'OCCTO原本', byVoltage: {}};
  // 原本（data/raw）の行を、取り込み後の行（名前・電圧ごとに順番で対応）に当てる。原本がなければ取り込み後の行で数える
  let rawRows = rawRowsOf(a, raw.date);
  if (!rawRows) { cov.source = '取り込み後の行（原本なし）'; rawRows = raw.actual.lines.map(l => ({name: l.name, voltageKV: l.voltageKV, section: l.from + '→' + l.to})); }
  const pool = new Map();
  for (const l of raw.actual.lines) { const k = norm(l.name) + '|' + l.voltageKV; pool.set(k, [...(pool.get(k) ?? []), l]); }
  for (const rr of rawRows) {
    if (voltages && !voltages.includes(rr.voltageKV)) continue;
    const v = (cov.byVoltage[rr.voltageKV + 'kV'] ??= {rows: 0, shown: 0, [GAP]: 0, [GAP2]: 0, [GAP3]: 0, [GAP4]: 0, [GAP5]: 0});
    v.rows++;
    const l = pool.get(norm(rr.name) + '|' + rr.voltageKV)?.shift();
    const x = {area: a, id: l?.id ?? null, name: rr.name, voltageKV: rr.voltageKV};
    if (!l) { v[GAP5]++; add('warn', 'OCCTO行の表示漏れ', x, `${GAP5}：原本の行（${rr.section}）が取り込み後のデータ（${FLOWS.find(f => f[0] === a)[1]}）にない（取り込み漏れ）`, {reason: GAP5}); continue; }
    const reviewedRows = day.actual.lines.filter(r => r.id === l.id || r.id.startsWith(l.id + '-'));
    const hit = reviewedRows.flatMap(r => candidateGeometry(r, geo));
    if (hit.length) { v.shown++; continue; }
    const section = `${l.from}→${l.to}`;
    let reason, msg;
    if (!inTargetRow(a, l.voltageKV)) { reason = GAP; msg = `${l.voltageKV}kVは対象範囲外（${section}）`; }
    else if (FENCE.test(norm(l.name))) { reason = GAP4; msg = `フェンス・合計の行で1本の線に対応しない（${section}）`; }
    else {
      const probe = reviewedRows.length ? reviewedRows : [l], cands = [...new Map(probe.flatMap(r => gapCandidates(r, geo)).map(g => [g.id, g])).values()];
      reason = cands.length ? GAP2 : GAP3;
      msg = (reviewedRows.length ? `対応表にはある（${reviewedRows.map(r => r.name).join('・')}）が、名前・電圧の同じ線が地図にない` : '対応表にない') + `（${section}）` + (cands.length ? `。名前違いの候補：${cands.slice(0, 5).map(g => `${g.name}（${g.id}）`).join('、')}` : '。名前・両端の近い線も地図にない');
    }
    v[reason]++;
    add(reason === GAP2 || reason === GAP3 ? 'warn' : 'info', 'OCCTO行の表示漏れ', x, `${reason}：${msg}`, {reason});
  }
}
// 連系線：OCCTOの連系線潮流実績の項目（CSV 1つ＝1行）。最新日に取得した項目と、過去に取得した項目（空欄公表・フェンスで普段は取らないもの）を数える
if (flowCtx.tie) {
  const {raw, geo} = flowCtx.tie, rawDir = path.join(APP, 'data/raw');
  const tieDirs = fs.readdirSync(rawDir).filter(d => /^occto-tie-\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  const items = new Map(); // コード → {name, file, latest}
  for (const d of tieDirs) {
    let src; try { src = JSON.parse(fs.readFileSync(path.join(rawDir, d, 'source.json'), 'utf8')); } catch { continue; }
    for (const f of src.files ?? []) if (!items.has(f.code) && fs.existsSync(path.join(rawDir, d, f.code + '.csv'))) items.set(f.code, {name: String(f.name ?? '').match(/対象連系線:([^,]+)/)?.[1] ?? f.code, file: path.join(rawDir, d, f.code + '.csv'), date: d.slice(10), latest: d.slice(10) === raw.date});
  }
  const cov = coverage.tie = {date: raw.date, source: 'OCCTO連系線潮流実績（CSV）', byVoltage: {}};
  for (const [code, it] of [...items].sort()) {
    const shown = raw.actual.lines.filter(l => l.id.startsWith(`tie-${code}-`));
    const kv = shown[0]?.voltageKV ?? null, vk = kv ? kv + 'kV' : '電圧なし（フェンス・空欄）';
    if (voltages && kv && !voltages.includes(kv)) continue;
    const v = (cov.byVoltage[vk] ??= {rows: 0, shown: 0, [GAP]: 0, [GAP2]: 0, [GAP3]: 0, [GAP4]: 0, [GAP5]: 0});
    v.rows++;
    const x = {area: 'tie', id: 'occto-tie-' + code, name: it.name, voltageKV: kv};
    const hit = shown.filter(l => candidateGeometry(l, geo).length);
    // 潮流実績の列（14列目）が全時刻空欄＝OCCTOが個別の値を公表していない（中部・北陸・関西のループ系統）
    let blank = false; try { const rows = fs.readFileSync(it.file, 'utf8').trim().split(/\r?\n/).slice(1); blank = rows.length > 0 && rows.every(s => (s.split(',')[13] ?? '').trim() === ''); } catch {}
    const estimated = shown.length && shown.every(l => /^推定/.test(l.note ?? ''));
    if (hit.length && !estimated) { v.shown++; continue; }
    let reason, msg;
    if (/フェンス/.test(it.name)) { reason = GAP4; msg = `フェンス（複数の連系線の合計）で1本の線に対応しない${it.latest ? '' : `（最新日は取得していない。最後の取得 ${it.date}）`}`; }
    else if (blank) { reason = GAP5; msg = `OCCTOが個別の値を空欄で公表（${it.date} の原本で全時刻空欄）${estimated && hit.length ? `。地図は推定値で表示（${shown.map(l => l.name).join('・')}）` : '。地図に対応する線なし（値がないため表示対象外）'}`; }
    else if (estimated && hit.length) { reason = GAP5; msg = `地図は推定値で表示（${shown.map(l => l.name).join('・')}）。OCCTOの値はあるのに使っていない`; }
    else { const cands = shown.length ? [] : geo.filter(g => g.id.startsWith(`tie-${code}-`)); reason = shown.length || cands.length ? GAP2 : GAP3; msg = shown.length ? `連系線の潮流（tie-flow.json）にはあるが名前の同じ線が地図にない：${shown.map(l => l.name).join('・')}` : `連系線の潮流（tie-flow.json）に行がない${it.latest ? '' : `（最新日は取得していない。最後の取得 ${it.date}）`}`; }
    v[reason]++;
    const sev = reason === GAP2 || reason === GAP3 ? 'warn' : reason === GAP5 && !blank ? 'warn' : 'info';
    add(sev, 'OCCTO行の表示漏れ', x, `${reason}：${msg}`, {reason});
  }
}

// ---- 11. 欠落（旧 tmp-gap.mjs：OSMに名前のある線で地図にない／旧 tmp-jp.mjs：J-POWERの設備の描き漏れ） ----
const OSM = {tohoku: ['tohoku-osm', [500, 275]], hokkaido: ['hokkaido-holds-osm', [275, 187]], tokyo: ['tokyo-275', [500, 275]], chubu: ['chubu-osm', [500, 275]], hokuriku: ['hokuriku-osm', [500, 275]], kansai: ['kansai-osm', [500, 275]], chugoku: ['chugoku-osm', [500, 220]], shikoku: ['shikoku-osm', [500, 187]], kyushu: ['kyushu-osm', [500, 220]]};
const usedWays = new Set(allLines.flatMap(l => [...l.osmIds, ...(l.sourceOsmIds ?? []), ...(l.cableOsmIds ?? [])].map(Math.abs)));
const drawnNames = new Set(allLines.map(l => baseName(l.name)));
const elementsOf = dir => { const out = []; const p = path.join(APP, 'data/raw', dir); if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return out; for (const fn of fs.readdirSync(p)) { if (!fn.endsWith('.json') || fn === 'source.json') continue; try { out.push(...(JSON.parse(fs.readFileSync(path.join(p, fn), 'utf8').replace(/^﻿/, '')).elements ?? [])); } catch {} } return out; };
// 対象範囲（inTargetRow と直流）の欠落は warn、範囲外の電圧は info。J-POWER（a = null）は 500/275kV・直流だけ
const inTarget = (a, kvs, dc) => dc || kvs.some(v => inTargetRow(a, v));
// 同じ way がほかの地域の原本にもあるか（取得範囲の重なり。例：中国の原本に北九州の線が入る）。地域ごとに出す扱いは変えず、メッセージに書くだけ
const rawAreasOf = new Map(); for (const [a, [dir]] of Object.entries(OSM)) for (const w of elementsOf(dir)) if (w.type === 'way') { if (!rawAreasOf.has(w.id)) rawAreasOf.set(w.id, new Set()); rawAreasOf.get(w.id).add(a); }
for (const [a, [dir, kvs]] of Object.entries(OSM)) {
  if (area !== 'all' && area !== a) continue;
  const names = new Map(), waysOf = new Map();
  for (const w of elementsOf(dir)) {
    if (w.type !== 'way' || !/^(line|cable)$/.test(w.tags?.power ?? '')) continue;
    const v = String(w.tags.voltage ?? '').split(';').map(x => +x / 1000).filter(x => kvs.includes(x) && (!voltages || voltages.includes(x)));
    const n = (w.tags.name ?? '').trim();
    if (!v.length || !n || usedWays.has(w.id) || drawnNames.has(baseName(n))) continue;
    const k = n + '|' + v.join('/') + '|' + (w.tags.frequency === '0' ? 'dc' : ''); names.set(k, (names.get(k) ?? 0) + 1);
    if (!waysOf.has(k)) waysOf.set(k, new Set()); waysOf.get(k).add(w.id);
  }
  // 2026-10-11 需要家専用線を描かない規則を廃止（docs/CUSTOMER_FACILITIES.md）。需要家の線も対象範囲の電圧なら warn（個別追加の候補）
  // 2026-10-15：確認済みリストに載せられるよう、id を未使用の way の最小番号から作る（線名は使わない：需要家の補助資料上の名称を公開リポジトリに入れないため、docs/RULES.md 3節「需要家」）。ways は照合用（昇順）
  for (const [k, count] of names) { const [n, v, dc] = k.split('|'), kv = v.split('/').map(Number), customer = /カスタマー|需要家/.test(n), ways = [...waysOf.get(k)].sort((x, y) => x - y); add(inTarget(a, kv, !!dc) ? 'warn' : 'info', '欠落', {area: a, id: `gap:${a}:osm-way-${ways[0]}:${v}${dc ? ':dc' : ''}`, name: n, voltageKV: kv[0]}, `OSMに名前のある${v}kV${dc ? '（直流）' : ''}の線（${count}線分）が地図にない${customer ? '（需要家の線：個別追加の候補）' : inTarget(a, kv, !!dc) ? '' : '（対象範囲外の電圧）'}${(o => o.length ? `（同じ way が ${o.join('・')} の原本にもある：取得範囲の重なりで両方の地域に出る）` : '')([...new Set(ways.flatMap(w => [...(rawAreasOf.get(w) ?? [])]))].filter(x => x !== a))}`, {ways}); }
}
if (area === 'all') {
  const J = /電源開発|J-?POWER|Electric Power Development|JPOWER/i, have = new Set([...allFacilities.keys()].map(id => id.replace(/^osm-/, '').replace('-', '/')));
  const seen = new Set();
  for (const dir of fs.readdirSync(path.join(APP, 'data/raw'))) {
    if (/^occto/.test(dir)) continue;
    for (const e of elementsOf(dir)) {
      const t = e.tags; if (!t || !(J.test(t.operator ?? '') || J.test(t.owner ?? ''))) continue;
      const k = e.type + '/' + e.id; if (seen.has(k)) continue; seen.add(k);
      if (/^(line|cable)$/.test(t.power ?? '')) { const v = String(t.voltage ?? '').split(';').map(x => +x / 1000).filter(x => [500, 275, 250, 220, 187].includes(x)); if (v.length && !usedWays.has(e.id) && (!voltages || v.some(x => voltages.includes(x)))) { const dc = t.frequency === '0' || v.includes(250); add(inTarget(null, v, dc) ? 'warn' : 'info', '欠落', {area: null, id: k, name: t.name ?? '(無名)', voltageKV: v[0]}, `J-POWERの線（OSM ${k}、${v.join('/')}kV${dc ? '・直流' : ''}）が地図にない`); } }
      else if (/^(plant|substation)$/.test(t.power ?? '') && !have.has(k)) add(inTarget(null, String(t.voltage ?? '').split(';').map(x => +x / 1000), false) ? 'warn' : 'info', '欠落', {area: null, id: k, name: t.name ?? '(無名)', voltageKV: null}, `J-POWERの${t.power === 'plant' ? '発電所' : '変電所等'}（OSM ${k}）が地図にない`);
    }
  }
}

// ---- 12. エリア×電圧別サマリと前回レポートとの差分 ----
const summary = {};
for (const l of lines) { const s = (summary[l.area] ??= {}), k = l.voltageKV + 'kV'; (s[k] ??= {lines: 0, facilities: 0}).lines++; }
for (const f of facilities) { const s = (summary[f.area] ??= {}), k = f.voltages?.length ? Math.max(...f.voltages) + 'kV' : '電圧不明'; (s[k] ??= {lines: 0, facilities: 0}).facilities++; }
// ---- 経路の根拠（国土地理院、2026-10-24 オーナー指示。手順は docs/RULES.md 3節「未確定・低確度の線の確認手順」） ----
// 保存済みの照合結果（docs/research/gsi-route-check.json と gsi-route-check-straight.json、tools/prep/check-gsi-route.mjs が作る）とデータだけを読む。ネットから取得しない。すべて info。
// 経路不明の直線区間は画面と同じ判定（src/line-drawing.ts の pathDash が経路不明の破線を返す区間）で数える。
const GSI_ONLY = '国土地理院の送電線記号だけ'; // 記号だけが根拠の区間を示す属性の文言（builder の書き方に合わせる）
const pathM = p => { let m = 0; for (let i = 1; i < p.length; i++) m += meters(p[i - 1], p[i]); return m; };
// 照合結果は2つ：gsi-route-check.json（直線の線の照合。区間 part・長さ lengthM の記録がない旧形式なので、照合後の経路の変化は確かめない）と、gsi-route-check-straight.json（直線の区間ごとの照合。part・lengthM あり）。
// excluded（照合から外す線）は「照合の対象外」として分けて数え、id のないもの（未描画の区間）は数えない
const gsiChecks = ['gsi-route-check.json', 'gsi-route-check-straight.json'].map(file => { try { return {file, ...JSON.parse(fs.readFileSync(path.join(APP, 'docs/research', file), 'utf8'))}; } catch { return null; } }).filter(Boolean);
const gsiExcluded = new Set(gsiChecks.flatMap(c => (c.results ?? []).filter(r => r.id && r.kind === 'excluded').map(r => r.id)));
const gsiResults = new Map(); for (const c of gsiChecks) for (const r of c.results ?? []) if (r.id && r.kind !== 'excluded') { if (!gsiResults.has(r.id)) gsiResults.set(r.id, []); gsiResults.get(r.id).push({...r, check: c}); }
// 直線の区間の長さ：tools/prep/check-gsi-route.mjs（results の lengthM）と同じ式。tools/prep は公開リポジトリに入らないので書き写す
const gsiLenM = p => p.slice(1).reduce((s, q, i) => s + Math.hypot((q[0] - p[i][0]) * 111320, (q[1] - p[i][1]) * 111320 * Math.cos(q[0] * Math.PI / 180)), 0);
// 今の直線の区間（tools/prep/gsi-targets.mjs の straightParts と同じ決め方。地中は地理院の記号に描かれないので除く）
const straightPartsOf = l => [...(l.schematic && l.construction !== 'underground' ? [{part: 'whole', path: l.paths.flat()}] : []),
  ...(l.schematicParts ?? []).filter(sp => sp.construction !== 'underground').map(sp => ({part: l.osmIds.indexOf(sp.osmId), path: l.paths[l.osmIds.indexOf(sp.osmId)]})).filter(x => x.part >= 0 && x.path)];
// 直線の区間の照合結果が今のデータに当てはまるか：同じ区間が今も直線で、長さが照合時と2%以内。長さで判定するので、端点の位置だけの変化は検出しない
const gsiLegacy = r => r.kind !== 'straight' || r.part == null || r.lengthM == null; // 区間・長さの記録がない旧形式
const gsiFits = (sps, r) => { if (gsiLegacy(r)) return true; const p = sps.find(x => x.part === r.part)?.path; return !!p && Math.abs(gsiLenM(p) - r.lengthM) <= r.lengthM * 0.02; };
// 「直線の区間がなくなった」：前の照合結果はあるが、今のデータに直線の区間がない（OSM・地理院の記号の経路に描き直した線）。描き直した経路は照合していないので、照合済みとは数えない
const GSI_STATE = ['全区間を照合', '一部を照合', '照合済み（長さの記録なし）', '経路が変わった', '直線の区間がなくなった', '照合の対象外', '未照合'];
const routeBasis = new Map();
for (const l of lines) {
  let n = 0, m = 0; l.paths.forEach((p, i) => { if (pathDash(l, i) === DASHED_UNKNOWN) { n++; m += pathM(p); } });
  const gsiOnly = (l.attributes ?? []).some(a => String(a.value ?? '').includes(GSI_ONLY)), sps = straightPartsOf(l), rs = gsiResults.get(l.id) ?? [];
  const ok = rs.filter(r => gsiFits(sps, r)), stale = rs.filter(r => !gsiFits(sps, r));
  // 区間ごとの結果があれば、今の直線の区間をすべて覆うかで全区間／一部。旧形式の結果だけなら「長さの記録なし」
  const parted = ok.filter(r => !gsiLegacy(r));
  const gsi = parted.length ? (sps.every(sp => parted.some(r => r.part === sp.part)) ? GSI_STATE[0] : GSI_STATE[1]) : ok.length ? GSI_STATE[2] : stale.length ? (sps.length ? GSI_STATE[3] : GSI_STATE[4]) : gsiExcluded.has(l.id) ? GSI_STATE[5] : GSI_STATE[6];
  routeBasis.set(l.id, {n, m, gsiOnly, gsi, checkedAt: [...new Set(ok.map(r => r.checkedAt ?? r.check.checkedAt))].join('・')});
  if (n) add('info', '経路の根拠', l, `経路不明の直線区間 ${n}（約${Math.round(m)}m）`);
  if (gsiOnly) add('info', '経路の根拠', l, `国土地理院の送電線記号だけが根拠の区間あり（属性の文言「${GSI_ONLY}」で判定）`);
  for (const r of ok) add('info', '経路の根拠', l, r.kind === 'route' ? `地理院の記号との照合（${r.checkedAt ?? r.check.checkedAt}、ズーム${r.check.zoom}）：記号に乗る点の割合（onShare）${Math.round(r.onShare * 100)}%、最大の外れ約${r.maxOffM}m（判定の距離は照合結果の rule。長さの記録がないので照合後の経路の変化は検出しない）`
    : `地理院の記号との照合（${r.checkedAt ?? r.check.checkedAt}、ズーム${r.check.zoom}、直線${r.part == null ? 'の線' : r.part === 'whole' ? 'の線（全体）' : `の区間 ${r.part}`}）：両端を記号で${r.endsConnectedBySymbol ? 'つなげた' : 'つなげない'}、近くに記号がある点 ${Math.round(r.nearShare * 100)}%（地理院の記号に地中線はない${gsiLegacy(r) ? '。区間・長さの記録がないので照合後の経路の変化は検出しない' : ''}）`);
  for (const r of stale) add('info', '経路の根拠', l, `地理院の記号との照合（${r.checkedAt ?? r.check.checkedAt}、直線の区間 ${r.part}）：${sps.length ? '照合日より後に経路が変わった（照合結果は使わない。長さで判定し、位置だけの変化は検出しない）' : '今のデータに直線の区間がない（前の照合結果は使わない。今の経路は照合していない）'}`);
}
const options = {area, voltage: voltages, ...(selected ? {line: lineQueries, detail} : {})};
// --line：指定線・両端の設備・その設備につながる線に関係する指摘だけを残す
let related = null;
if (selected) {
  const facIds = new Set(selected.flatMap(l => (l.connections ?? []).flatMap(c => (c.facilities ?? []).map(f => f.id))));
  const near = allLines.filter(l => (l.connections ?? []).some(c => (c.facilities ?? []).some(f => facIds.has(f.id))));
  related = {lines: selected.map(l => l.id), facilities: [...facIds], connectedLines: near.map(l => l.id).filter(id => !selected.some(l => l.id === id))};
  const ids = new Set([...related.lines, ...related.facilities, ...related.connectedLines]);
  const keep = f => ids.has(f.id) || ids.has(f.other) || ids.has(f.facility) || (f.ids ?? []).some(x => ids.has(x)) || (rowLines.get(f.area + '|' + f.id) ?? []).some(x => ids.has(x));
  for (let i = findings.length - 1; i >= 0; i--) if (!keep(findings[i])) findings.splice(i, 1);
}
const OUTDIR = selected ? path.join(OUT, 'line') : OUT;
fs.mkdirSync(OUTDIR, {recursive: true});
const now = new Date(), stamp = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(now);
const suffix = (area === 'all' ? '' : '-' + area) + (voltages ? '-' + voltages.join('_') : '');
const slug = selected ? '-' + selected.map(l => l.name).join('_').normalize('NFKC').replace(/[\\/:*?"<>|\s（）()]/g, '').slice(0, 60) : '';
const base = `line-audit-${stamp}${suffix}${slug}`;
const prevFile = fs.readdirSync(OUT).filter(f => new RegExp(`^line-audit-\\d{4}-\\d{2}-\\d{2}${suffix.replace(/[-_]/g, '\\$&')}\\.json$`).test(f)).sort().at(-1);
const ids = {lines: lines.map(l => l.id).sort(), facilities: facilities.map(f => f.id).sort()};
let diff = null;
if (prevFile && !selected) {
  const prev = JSON.parse(fs.readFileSync(path.join(OUT, prevFile), 'utf8'));
  const d = k => ({added: ids[k].filter(id => !prev.ids[k].includes(id)), removed: prev.ids[k].filter(id => !ids[k].includes(id))});
  diff = {previous: prevFile, previousAt: prev.generatedAt, lines: d('lines'), facilities: d('facilities')};
  for (const k of ['lines', 'facilities']) for (const id of diff[k].removed) add('warn', '前回からの消失', {area: null, id, name: null, voltageKV: null}, `前回（${prevFile}）にあった${k === 'lines' ? '線' : '設備'}が消えた`);
}

// 確認済みリストの適用（ID と項目が一致した warn/error を info に下げる）
// 項目に ways（OSM way の番号）があるときは、指摘の ways と完全に一致するときだけ下げる（OSM の区画が増減したら warn に戻す、2026-10-15）
let allowlisted = 0;
const sameWays = (e, f) => !e.ways || (Array.isArray(f.ways) && e.ways.length === f.ways.length && [...e.ways].sort((x, y) => x - y).every((w, i) => w === f.ways[i]));
for (const f of findings) { const e = ALLOW.find(x => x.id === f.id && x.check === f.check && sameWays(x, f)); if (!e || f.severity === 'info') continue; f.allowlisted = {reason: e.reason, source: e.source, confirmedAt: e.confirmedAt, was: f.severity}; f.severity = 'info'; f.message = '確認済み（' + e.confirmedAt + '）：' + f.message; allowlisted++; }
// --detail：線ごとの情報カード（未取得は「未確認」）
const U = '未確認';
// 回線数は各社の系統空容量の表（data/private/line-capacity.json、手元の作業用。2026-10-11 public/ の外へ移した、docs/RULES.md 5節）を優先し、なければ線の属性
const LINE_CAP = path.join(APP, 'data/private/line-capacity.json');
const lineCapacity = fs.existsSync(LINE_CAP) ? JSON.parse(fs.readFileSync(LINE_CAP, 'utf8')).lines : {};
const card = l => {
  const tso = lineCapacity[l.id], attrCircuits = (l.attributes ?? []).map(a => /回線数/.test(a.label) ? a.value : (a.value.match(/(\d+)回線/) ?? [])[0]).find(Boolean);
  const circuits = tso?.circuits ? `${tso.circuits}回線（${tso.source ?? '各社の系統空容量の表'}）` : attrCircuits ? `${attrCircuits}（線の属性）` : null;
  const status = (l.status ?? '運用中') + (l.status ? '' : '（データに記載なし＝既定値）') + (l.statusConfirmed === false ? '・運用状態 未確認' : '') + (l.statusCheck ? '：' + l.statusCheck : '') + (l.statusSource ? '（根拠：' + l.statusSource.slice(0, 80) + '）' : '');
  const occto = [];
  for (const [a, ctx] of Object.entries(flowCtx)) for (const r of ctx.day.actual.lines) {
    if (!(rowLines.get(a + '|' + r.id) ?? []).includes(l.id)) continue;
    const i = latestIndex(ctx.raw), mw = i >= 0 ? r.values[i] ?? null : null, time = i >= 0 ? ctx.day.actual.times[i].replace('T', ' ').slice(0, 16) : null;
    const pathOk = !!referenceFlowPath(r, ctx.geo, false), br = flowBranches(r, ctx.geo);
    const dirFrom = mw !== null && mw < 0 ? r.to : r.from, dirTo = mw !== null && mw < 0 ? r.from : r.to;
    const cap = (ctx.day.capacities ?? []).filter(c => c.name === r.name && c.voltageKV === r.voltageKV && c.from === dirFrom && c.to === dirTo);
    const capMW = cap.length === 1 && cap[0].capacityMW !== null ? cap[0].capacityMW : null;
    // 画面と同じ照合で容量が当たらないとき、OCCTOの容量表の原本で名前（括弧書きを除く）と電圧が同じ行を参考に出す（分母には使わない）
    const sameName = capMW === null ? (ctx.raw.capacities ?? []).filter(c => baseName(c.name) === baseName(r.name) && c.voltageKV === r.voltageKV) : [];
    const conflict = a === 'tohoku' && endpointConflict(r, tohokuNetwork());
    occto.push({area: a, row: r.id, name: r.name, section: `${r.from}→${r.to}`, path: pathOk ? '地図上の経路あり' : '経路なし', endpointConflict: conflict ? '公表表の向きと食い違い' : null,
      flow: mw === null ? U : `${Math.abs(mw)} MW（${dirFrom}→${dirTo}、${time}）`, capacity: capMW === null ? U + (sameName.length ? `（画面の照合では当たらない。容量表の原本の近い行：${sameName.map(c => `${c.name} ${c.from}→${c.to} ${c.capacityMW ?? '—'}MW`).join('、')}）` : '（OCCTOの容量表に同名の行なし）') : `${capMW} MW（${dirFrom}→${dirTo}）`,
      denominator: br.length ? '使わない（分岐を含むため参考表示・容量比なし）' : capMW !== null && mw !== null ? `同日最大需要時の運用容量（OCCTO公表、方向別）→ 参考使用率 ${Math.round(Math.abs(mw) / capMW * 100)}%` : U + '（適用できる運用容量なし）',
      branch: br.length ? br.join('、') : 'なし'});
  }
  return {id: l.id, name: l.name, voltage: `${l.currentType === 'dc' ? '直流 ' : ''}${l.voltageKV}kV`, area: l.area,
    ends: (l.connections ?? []).map(c => `${c.status}：${(c.facilities ?? []).map(f => f.name).join('・') || (c.status === 'shared-node' ? '他の線と共有する点' : U)}`),
    circuits: circuits ?? U, status, route: (b => b ? `${b.n ? `経路不明の直線 約${Math.round(b.m)}m` : '経路不明の直線なし'}${b.gsiOnly ? '・国土地理院の送電線記号だけの区間あり' : ''}${`・地理院の記号${b.gsi === '照合の対象外' ? 'との' : 'と'}${b.gsi}`}${b.checkedAt ? `（${b.checkedAt}）` : ''}` : U)(routeBasis.get(l.id)), sources: (l.attributes ?? []).filter(a => /出典|根拠|資料/.test(a.label)).map(a => `${a.label}：${a.value.length > 140 ? a.value.slice(0, 139) + '…' : a.value}`), occto};
};
const cards = selected && detail ? selected.map(card) : null;
const order = {error: 0, warn: 1, info: 2};
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.check.localeCompare(b.check, 'ja') || String(a.area).localeCompare(String(b.area)) || String(a.id).localeCompare(String(b.id)));
const counts = {};
for (const f of findings) { const c = (counts[f.check] ??= {error: 0, warn: 0, info: 0}); c[f.severity]++; }
const report = {schemaVersion: 1, generatedAt: now.toISOString(), options, totals: {lines: lines.length, facilities: facilities.length, error: findings.filter(f => f.severity === 'error').length, warn: findings.filter(f => f.severity === 'warn').length, info: findings.filter(f => f.severity === 'info').length}, counts, summary, flow: flowStats, occtoCoverage: coverage, zeroFill: zeroStats, unresolvedEndpoints: unresolved, allowlisted, diff, ids, ...(selected ? {related, cards} : {}), findings};
fs.writeFileSync(path.join(OUTDIR, base + '.json'), JSON.stringify(report, null, 1) + '\n');

const T = [];
T.push(`送電線チェック ${stamp}（範囲：${area}${voltages ? '／' + voltages.join('・') + 'kV' : ''}${selected ? '／線の個別指定' : ''}）`, `${selected ? 'チェック対象（全体）' : ''}線 ${lines.length}本・設備 ${facilities.length}か所／${selected ? '関係する指摘 ' : ''}error ${report.totals.error}・warn ${report.totals.warn}・info ${report.totals.info}（確認済みリストで info にしたもの ${allowlisted}件）`, '');
if (selected) {
  T.push('■ 指定した線：' + selected.map(l => `${l.name}（${l.id}、${l.voltageKV}kV）`).join('、'));
  T.push(`  両端の設備：${related.facilities.map(id => allFacilities.get(id)?.name ?? id).join('、') || 'なし'}`, `  その設備につながる線：${related.connectedLines.length}本（${related.connectedLines.map(id => allLines.find(l => l.id === id)?.name ?? id).join('、')}）`, '  ※チェックは全体で実行し、ここに関係する指摘だけを出しています（前回差分は全体レポートだけ）', '');
  for (const c of cards ?? []) {
    T.push(`■ 情報カード：${c.name}`, `  ID：${c.id}`, `  電圧：${c.voltage}（${c.area}）`, `  両端：${c.ends.join(' ／ ') || U}`, `  回線数：${c.circuits}`, `  運用状態：${c.status}`);
    T.push(`  経路の根拠：${c.route}`);
    T.push(`  出典：${c.sources.length ? '' : U}`); for (const v of c.sources) T.push(`    - ${v}`);
    if (!c.occto.length) T.push(`  OCCTO照合：対応するOCCTOの行なし（${U}）`);
    for (const o of c.occto) T.push(`  OCCTO照合：${o.area} No.${o.row} ${o.name}（${o.section}）${o.path}${o.endpointConflict ? '・' + o.endpointConflict : ''}`, `    潮流：${o.flow}`, `    運用容量：${o.capacity}`, `    分母：${o.denominator}`, `    分岐：${o.branch}`);
    T.push('');
  }
}
T.push('■ 項目別の件数（error / warn / info）'); for (const [k, c] of Object.entries(counts)) {
  T.push(`  ${k}：${c.error} / ${c.warn} / ${c.info}`);
  if (k === '潮流値の分岐後区間への複製') { const fs = Object.values(flowStats); T.push(`    うち 1点で接する分岐を含む行 ${fs.reduce((n, s) => n + s.branchTouch, 0)}／経路が重なる線だけの行 ${fs.reduce((n, s) => n + s.branchOverlap, 0)}（共有する点は、行の参照経路の両端を含む全頂点と分岐とした線の頂点で数える。重なりは並行回線・共架・幹線に沿って描いた分岐線などで、本当の分岐かは未判定。1点で接するものも並行回線の可能性がある）`); }
}
if (!selected) {
T.push('', '■ エリア×電圧別（線 / 設備）'); for (const [a, s] of Object.entries(summary)) T.push(`  ${a.padEnd(9)} ` + Object.entries(s).sort((x, y) => (parseInt(y[0]) || 0) - (parseInt(x[0]) || 0)).map(([k, v]) => `${k} ${v.lines}/${v.facilities}`).join('  '));
T.push('', '■ OCCTO照合（最新日：OCCTO行 / 対応表あり / 経路なし / 分岐またぎ（1点で接する／経路の重なりだけ））'); for (const [a, s] of Object.entries(flowStats)) T.push(`  ${a.padEnd(9)} ${s.date}：${s.rows} / ${s.reviewed} / ${s.noPath} / ${s.branch}（${s.branchTouch}／${s.branchOverlap}）`);
T.push('', '■ OCCTO行の表示漏れ（最新日の原本の全行：行数 / 表示 / ①範囲外電圧 / ②対応表・名称 / ③線なし / ④フェンス・合計 / ⑤その他）'); for (const [a, c] of Object.entries(coverage)) for (const [k, v] of Object.entries(c.byVoltage).sort((x, y) => (parseInt(y[0]) || 0) - (parseInt(x[0]) || 0))) T.push(`  ${a.padEnd(9)} ${c.date} ${k.padEnd(6)}：${v.rows} / ${v.shown} / ${v[GAP]} / ${v[GAP2]} / ${v[GAP3]} / ${v[GAP4]} / ${v[GAP5]}${c.source === 'OCCTO原本' ? '' : '（' + c.source + '）'}`);
T.push('', '■ 0埋めチェック（日数 / 原本と照合できた日 / 原本なし）'); for (const [a, s] of Object.entries(zeroStats)) T.push(`  ${a.padEnd(9)} ${s.days} / ${s.rawChecked} / ${s.rawMissing}${a === 'tie' ? '（連系線は原本がCSVのため取得時刻の確認だけ）' : ''}`);
{ const rb = [...routeBasis.values()], un = rb.filter(b => b.n);
  T.push('', '■ 経路の根拠（国土地理院。docs/RULES.md 3節「未確定・低確度の線の確認手順」）',
    `  経路不明の直線区間を持つ線 ${un.length}本（${un.reduce((k, b) => k + b.n, 0)}区間、約${Math.round(un.reduce((k, b) => k + b.m, 0) / 1000)}km）`,
    `  国土地理院の送電線記号だけが根拠の区間を持つ線 ${rb.filter(b => b.gsiOnly).length}本（文言「${GSI_ONLY}」で判定）`,
    `  地理院の記号との照合：${gsiChecks.length ? `${gsiChecks.map(c => `${c.file}（${[...new Set((c.results ?? []).map(r => r.checkedAt ?? c.checkedAt))].sort().join('・')}・ズーム${c.zoom}）`).join('、')}。${GSI_STATE.map(k => `${k} ${rb.filter(b => b.gsi === k).length}本`).join('／')}（照合は tools/prep/check-gsi-route.mjs。直線の区間は長さが照合時と2%以内のときだけ照合結果を使う（位置だけの変化は検出しない）。旧形式の gsi-route-check.json は区間・長さの記録がないので長さの判定なし。地理院の記号に地中線はない。照合結果のうち未描画の区間の点は線に結び付かないので数えない）` : '照合結果なし'}`); }
T.push('', '■ 前回との差分'); if (!diff) T.push('  前回のレポートなし（初回）'); else { T.push(`  前回：${diff.previous}`); for (const k of ['lines', 'facilities']) T.push(`  ${k === 'lines' ? '線' : '設備'}：追加 ${diff[k].added.length}（${diff[k].added.join('、') || 'なし'}）／消失 ${diff[k].removed.length}（${diff[k].removed.join('、') || 'なし'}）`); }
}
for (const sev of ['error', 'warn', 'info']) {
  const list = findings.filter(f => f.severity === sev); if (!list.length) continue;
  T.push('', `■ ${sev}（${list.length}件）`);
  for (const f of list) T.push(`  [${f.check}] ${f.area ?? '-'} ${f.name ?? ''}${f.voltageKV ? ' ' + f.voltageKV + 'kV' : ''}${f.id ? '（' + f.id + '）' : ''}：${f.message}`);
}
fs.writeFileSync(path.join(OUTDIR, base + '.txt'), T.join('\n') + '\n');
{ const cut = T.findIndex(s => /^■ (error|warn|info)（/.test(s)); console.log((cut < 0 ? T : T.slice(0, cut)).join('\n')); }
console.log(`\n出力：${path.join(OUTDIR, base)}.json / .txt`);
process.exitCode = report.totals.error ? 1 : 0;
