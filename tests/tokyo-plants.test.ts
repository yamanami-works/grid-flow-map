import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
import {rawSkip} from './raw-data.mjs';
const c=read('docs/research/tokyo-500-plants-adopted.json');
test('C-tier plant lines carry a caution attribute; partial ends are unresolved',()=>{
 assert.equal(c.tier,'C');
 for(const l of c.lines)assert.equal(l.attributes[0].label,'要注意（C区分）');
 for(const l of c.lines.filter((l:any)=>l.referenceReview.status==='partial'))assert.ok(l.connections.some((e:any)=>e.status==='unresolved'||e.status==='shared-node'));
});
// 原本（data/raw）を使う部分は別のテストに分け、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('C-tier plant lines follow acquired 500kV nodes',{skip:rawSkip('data/raw/tokyo-500/north.json','data/raw/tokyo-500/south.json','data/raw/tokyo-500-support/lines.json')},()=>{
 const raw=[...read('data/raw/tokyo-500/north.json').elements,...read('data/raw/tokyo-500/south.json').elements,...read('data/raw/tokyo-500-support/lines.json').elements],nodes=new Map(raw.filter(e=>e.type==='node').map(n=>[n.id,[n.lat,n.lon]]));
 const edges=new Set(raw.filter(w=>w.type==='way'&&['line','cable'].includes(w.tags?.power)&&String(w.tags.voltage).split(';').includes('500000')).flatMap(w=>w.nodes.slice(1).map((n:number,i:number)=>JSON.stringify([nodes.get(w.nodes[i]),nodes.get(n)].sort()))));
 for(const l of c.lines)for(const p of l.paths)for(let i=1;i<p.length;i++)assert.ok(edges.has(JSON.stringify([p[i-1],p[i]].sort())),l.name);
});
test('plants are plant facilities without output used as capacity; only 新豊洲線 gets OCCTO flow',()=>{
 for(const f of c.facilities.filter((f:any)=>f.kind==='plant'))assert.ok(f.attributes.some((a:any)=>a.label==='OSM登録'&&a.value.includes('送電容量として扱わない')),f.name);
 const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));
 const flowIds=c.lines.filter((l:any)=>day.actual.lines.some(a=>referenceFlowPath(a,c.lines,false)&&a.name===l.name)).map((l:any)=>l.id);
 assert.deepEqual(flowIds,c.flowLines);
 const a=day.actual.lines.find(a=>a.name==='新豊洲線')!;assert.equal(a.from,'新京葉変電所');assert.equal(a.to,'新豊洲変電所');
});
// 2026-10-24 オーナー承認（保留11）：奥清津第二発電所は奥清津発電所と同じ敷地。位置はオーナー指定、奥清津発電所に直接つながるとみなす（推測）。既存の奥清津発電所は変えない
test('奥清津第二発電所 is a separate estimated plant next to 奥清津発電所',()=>{
 const d=read('public/data/tokyo-trunk.json');
 const pl=d.facilities.find((f:any)=>f.id==='tokyo-place-奥清津第二発電所');assert.equal(pl.kind,'plant');assert.deepEqual(pl.position,[36.847503,138.766436]);assert.equal(pl.plantType.label,'水力（揚水）');
 assert.ok(pl.attributes.some((a:any)=>a.label==='要注意（位置推定）'));assert.ok(pl.attributes.some((a:any)=>a.label==='系統との接続'&&/推測/.test(a.value)));
 const ok=d.facilities.find((f:any)=>f.id==='osm-relation-13413356');assert.equal(ok.name,'奥清津発電所');
 assert.deepEqual(d.lines.find((l:any)=>l.id==='tokyo-section-69').connections[0].facilities.map((x:any)=>x.id),['osm-relation-13413356']);
});
// 2026-10-24 オーナー指示（保留12）：奥清津発電所の印は指定の座標（36°50'43.7"N 138°45'59.4"E）。連系線（No.69）の端は区画の中の点のまま
test('奥清津発電所 marker is at the owner-specified position',()=>{
 const d=read('public/data/tokyo-trunk.json');const ok=d.facilities.find((f:any)=>f.id==='osm-relation-13413356');
 assert.deepEqual(ok.position,[36.845472,138.7665]);assert.ok(ok.attributes.some((a:any)=>a.label==='位置の根拠'&&/本アプリの調査/.test(a.value)));
 assert.deepEqual(d.lines.find((l:any)=>l.id==='tokyo-section-69').connections[0].position,[36.8458972,138.7668437]);
});
