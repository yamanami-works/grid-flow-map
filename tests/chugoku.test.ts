import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {reviewedChugokuDay} from '../src/chugoku-domain.ts';import {evidenceOf} from '../src/evidence.ts';import {referenceFlowPath,flowBranches} from '../src/flow-path.ts';import {pathDash,DOTTED} from '../src/line-drawing.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const d=read('public/data/chugoku-trunk.json'),flow=read('public/data/chugoku-flow.json');
const latest=typicalDay(flow);
test('all 29 OCCTO Chugoku rows (500kV 11, 220kV 18) map to a drawn route, including the former holds 広島中央・北尾道・松江',()=>{
 const day=reviewedChugokuDay(latest);const rows=day.actual.lines;assert.equal(rows.length,29);
 assert.equal(rows.filter((r:any)=>r.voltageKV===500).length,11);assert.equal(rows.filter((r:any)=>r.voltageKV===220).length,18);
 for(const r of rows)assert.ok(referenceFlowPath(r,d.lines,false),r.name);
 for(const n of ['広島中央線','北尾道連絡線','松江連絡線'])assert.ok(rows.some((r:any)=>r.name===n),n);
 const by=(n:string)=>d.lines.find((l:any)=>l.name===n);assert.ok(by('広島中央線').schematic);assert.ok(!by('北尾道連絡線').schematicParts);/* 2026-10-25（保留16）：御調開閉所から北尾道変電所まで OSM でたどれるので直線の補いはなくなった */
 assert.ok(d.facilities.find((f:any)=>f.name==='松江変電所').attributes.some((a:any)=>a.label==='名称・位置の根拠'&&/八雲町/.test(a.value)));
});
test('line-name end (山口幹線→南山口) is a branch point with the estimate recorded',()=>{
 for(const n of ['南山口支線']){const l=d.lines.find((x:any)=>x.name===n);assert.ok(l.connections.some((c:any)=>c.status==='shared-node'&&!c.facilities.length),n);assert.ok(l.attributes.some((a:any)=>a.label==='分岐点の推定'),n);}
});
// 2026-11-09 オーナー承認（保留97）：新岩国連絡線は新西広島変電所～新岩国変電所の1本（OCCTO運用容量の表・中国電力ネットワーク 系統空容量 No.基L21 の両端）
test('新岩国連絡線 runs 新西広島→新岩国 with flow and capacity, no branch, no guess; the duplicates are gone',()=>{
 const l=d.lines.find((x:any)=>x.name==='新岩国連絡線');
 assert.deepEqual(l.connections.map((c:any)=>c.facilities.map((f:any)=>f.name).join()),['新西広島変電所','新岩国変電所']);
 assert.ok(l.connections.every((c:any)=>c.status==='facility-area'));
 assert.ok(!d.lines.some((x:any)=>x.id==='chugoku-220-新西広島岩国線'||x.id==='chugoku-plant-220-way-605420903'));
 assert.ok(d.facilities.some((f:any)=>f.id==='osm-way-605420903'),'岩国火力発電所の点は残す');
 assert.equal(evidenceOf(l).inferred.length,0);
 assert.ok(l.attributes.some((a:any)=>a.label==='注記'&&/新徳山幹線/.test(a.value)));
 const day=reviewedChugokuDay(latest);
 const row=day.actual.lines.find((r:any)=>r.name==='新岩国連絡線');assert.equal(row.from,'新西広島変電所');assert.equal(row.to,'新岩国変電所');
 const path=referenceFlowPath(row,d.lines,false);assert.ok(path&&path.length>10);
 assert.ok(day.capacities.some((c:any)=>c.name==='新岩国連絡線'&&c.from==='新西広島変電所'&&c.to==='新岩国変電所'),'運用容量の行が照合される');
 assert.deepEqual(flowBranches(row,d.lines),[]);
 // 2026-11-09（保留98）：経路は国土地理院の送電線記号でなぞった1区間（直線の区間なし）。オーナー指示の分岐（二ッ野上付近）と南西への折れ目を通る
 assert.ok(!l.schematicParts?.length&&!l.schematic);assert.deepEqual(l.tracedParts?.map((t:any)=>t.basis),['国土地理院の送電線記号']);
 const near=(p:number[])=>l.paths.flat().some((q:number[])=>Math.hypot((q[0]-p[0])*111,(q[1]-p[1])*92)<0.05);
 assert.ok(near([34.2784,132.1038]),'二ッ野上付近の分岐');assert.ok(near([34.12785,132.18329]),'南西への折れ目');
});
// 2026-11-09 オーナー指示・承認（保留99）：柳井火力連絡線（中国電力ネットワーク 系統空容量 No.基L19、東山口（変）→柳井火力（変））
test('柳井火力連絡線 runs 柳井火力発電所→東山口変電所 on OSM way 243471277 without the 新徳山 detour',()=>{
 const l=d.lines.find((x:any)=>x.id==='chugoku-plant-220-way-605420904');
 assert.equal(l.name,'柳井火力連絡線');assert.equal(l.named,true);
 assert.deepEqual(l.connections.map((c:any)=>c.facilities.map((f:any)=>f.name).join()),['柳井火力発電所','東山口変電所']);
 assert.deepEqual(l.osmIds,[243471277,318564809]);assert.ok(!d.lines.some((x:any)=>x.osmIds.includes(243710574)||x.osmIds.includes(318564824)));
 // 終点は東山口変電所の区画（OSM way 242253500 の範囲 34.19862–34.20198, 131.82435–131.82770）の内側
 const [la,lo]=l.paths.at(-1).at(-1);assert.ok(la>34.19862&&la<34.20198&&lo>131.82435&&lo<131.8277,String([la,lo]));
 // 始点は柳井火力発電所の区画（OSM way 605420904 の範囲 33.94737–33.95562, 132.12226–132.12919）の内側
 const [sa,so]=l.paths[0][0];assert.ok(sa>33.94737&&sa<33.95562&&so>132.12226&&so<132.12919,String([sa,so]));
 assert.ok(d.lines.some((x:any)=>x!==l&&x.connections.some((c:any)=>c.facilities.some((f:any)=>f.name==='新徳山変電所'))),'新徳山変電所に線が残る');
 assert.equal(evidenceOf(l).inferred.length,0);
});
test('approval pins the dataset; unconnected facilities of held rows are not listed; 220kV is drawn at the 275kV width',async()=>{
 const a=read('config/chugoku-approval.json');assert.equal(createHash('sha256').update(readFileSync('public/data/chugoku-trunk.json')).digest('hex'),a.sha256);
 // 2026-11-10（保留103）：高宮開閉所は線の端ではなく、山陰幹線が区画の中を通る（builder が区画を通ることを確かめて足す）
 for(const f of d.facilities.filter((f:any)=>f.kind!=='plant'&&f.id!=='osm-way-1427454285'))assert.ok(d.lines.some((l:any)=>l.connections.some((c:any)=>c.facilities.some((x:any)=>x.id===f.id))),f.name);
 const {lineWidth}=await import('../src/line-style.ts');assert.equal(lineWidth(220),lineWidth(275));
});
test('Chugoku plants (島根原子力・下松火力…) with feeder lines; the duplicate OSM registration of 大崎 is skipped',()=>{
 for(const n of ['島根原子力発電所','大崎火力発電所'])assert.ok(d.facilities.some((f:any)=>f.name===n&&f.kind==='plant'),n);
 assert.ok(!d.facilities.some((f:any)=>/Osaki/.test(f.name)));
});
test('山陰幹線は広島変電所～松江変電所、高宮開閉所の区画を通り、作木支線の始点は変えない（保留103）',()=>{
 const san=d.lines.find((l:any)=>l.id==='ledger-chugoku-220-317991389'),sk=d.lines.find((l:any)=>l.id==='chugoku-220-作木支線'),tk=d.facilities.find((f:any)=>f.id==='osm-way-1427454285');
 assert.equal(tk?.name,'高宮開閉所');assert.equal(tk.kind,'switchyard');
 assert.ok(san.osmIds.includes(178115896)&&san.osmIds.includes(1427454283));assert.ok(san.connections.every((c:any)=>c.status==='facility-area'));
 assert.ok(san.attributes.some((a:any)=>a.label==='注記（経路）'&&/系統切箇所/.test(a.value)));
 assert.equal(sk.connections[0].status,'shared-node');
 const near=(p:number[],q:number[])=>Math.hypot((p[0]-q[0])*110540,(p[1]-q[1])*91000)<60;assert.ok(san.paths.some((p:number[][])=>p.some(q=>near(q,tk.position))),'山陰幹線が高宮開閉所の区画を通る');
});
test('新成羽川発電所の電源線は発電所～新倉敷連絡線の分岐点（保留104で推測を外した）、新小野田の2線は新小野田変電所へ（保留100・102）',()=>{
 const l=d.lines.find((x:any)=>x.id==='chugoku-220-新成羽川発電所の電源線'),k=d.lines.find((x:any)=>x.id==='ledger-infer-chugoku-220-242159192');
 assert.equal(l.connections[0].facilities[0].name,'新成羽川発電所');assert.equal(l.connections[1].status,'shared-node');assert.equal(l.connections[1].node,8918793756);
 assert.equal(evidenceOf(l).inferred.length,0,'推測なし');assert.ok(!l.schematicParts,'直線なし');
 const e=l.paths.at(-1).at(-1);assert.ok(k.paths.some((p:number[][])=>p.some(q=>q[0]===e[0]&&q[1]===e[1])),'分岐点が新倉敷連絡線の上');
 assert.equal(k.name,'新倉敷連絡線');assert.deepEqual(k.connections.map((c:any)=>c.facilities[0]?.name),['新岡山変電所','新倉敷変電所']);
 for(const id of ['chugoku-220-新小野田火力連絡線','chugoku-220-新小野田火力山口線']){const x=d.lines.find((y:any)=>y.id===id);assert.equal(x.connections[1].facilities[0].name,'新小野田変電所',id);assert.equal(evidenceOf(x).tier,'C',id);}
});
// 2026-11-10 オーナー指示・承認（保留104）：新岡山変電所の南東で、井原連絡線と新倉敷連絡線は国土地理院の送電線記号どおり交差しない
test('井原連絡線と新倉敷連絡線は新岡山変電所の南東で交差しない（保留104）',()=>{
 const a=d.lines.find((x:any)=>x.id==='chugoku-220-井原連絡線'),b=d.lines.find((x:any)=>x.id==='ledger-infer-chugoku-220-242159192');
 assert.deepEqual(a.connections.map((c:any)=>c.facilities[0]?.name),['井原開閉所','新岡山変電所']);
 const segs=(l:any)=>l.paths.flatMap((p:number[][])=>p.slice(1).map((q,i)=>[p[i],q])).filter(([p]:number[][])=>p[0]>34.76&&p[0]<34.81&&p[1]>133.38&&p[1]<133.43);
 const cross=(p:number[],q:number[],r:number[],s:number[])=>{const o=(a:number[],b:number[],c:number[])=>Math.sign((b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]));return o(p,q,r)*o(p,q,s)<0&&o(r,s,p)*o(r,s,q)<0;};
 for(const [p,q] of segs(a))for(const [r,s] of segs(b))assert.ok(!cross(p,q,r,s),'交差 '+p+' '+r);
 assert.ok(a.osmIds.includes(-9730022)&&b.osmIds.includes(-9730021));
});
// 2026-10-20 オーナー承認（保留3-A）：系統空容量の基L39 俣野川線・基L40 新鳥取線を OSM の無名の 220kV の線で描き、端の区画は所在地から俣野川開閉所とみなした（C区分）。
// 発電所は地下式で、地理院の注記の位置（推定）に別の設備として足し、開閉所に直接つながるとみなす（推測）
test('俣野川線・新鳥取線 reach 俣野川開閉所 (C, named from location) and 俣野川発電所 is an estimated, inferred plant',()=>{
 const d=JSON.parse(readFileSync('public/data/chugoku-trunk.json','utf8'));
 const sw=d.facilities.find((f:any)=>f.id==='osm-way-1417209902');assert.equal(sw.name,'俣野川開閉所');assert.equal(sw.kind,'switchyard');assert.ok(sw.attributes.some((a:any)=>a.label==='名称・位置の根拠'&&/推定/.test(a.value)));
 for(const [n,from] of [['俣野川線','日野変電所'],['新鳥取線','新鳥取変電所']]){const l=d.lines.find((x:any)=>x.name===n);assert.ok(l,n);
  assert.deepEqual(l.connections.map((c:any)=>c.facilities[0].name),[from,'俣野川開閉所']);assert.equal(l.voltageKV,220);
  assert.equal(l.attributes.find((a:any)=>a.label==='照合区分').value,'C区分');assert.ok(evidenceOf(l).inferred.length>0,n+' は推測の端点を持つ');assert.ok(l.attributes.some((a:any)=>a.label==='公表の行'));}
 const pl=d.facilities.find((f:any)=>f.id==='chugoku-place-俣野川発電所');assert.equal(pl.kind,'plant');assert.equal(pl.plantType.label,'水力（揚水）');
 assert.ok(pl.attributes.some((a:any)=>a.label==='要注意（位置推定）'));assert.ok(pl.attributes.some((a:any)=>a.label==='系統との接続'&&/推測/.test(a.value)));
 const und=JSON.parse(readFileSync('public/data/undrawn-sections.json','utf8')).rows;for(const no of ['基L39','基L40'])assert.ok(!und.some((r:any)=>r.region==='chugoku'&&r.no===no),no);
});
// 2026-10-24 オーナー承認（保留10）：南原発電所（純揚水）は系統空容量の一覧に行がない。OSM の無名の 220kV 区画を開閉所とみなし（名前は推定）、
// 山陰幹線の共有ノードから連系線で、開閉所から北へ約1kmの電源線で発電所（地理院の発電所記号の位置、推定）につなぐ（どちらも C区分・推測の端点）。既存の山陰幹線は変えない
test('南原発電所 joins 山陰幹線 through an estimated switchyard (C, inferred ends) without changing 山陰幹線',()=>{
 const d=JSON.parse(readFileSync('public/data/chugoku-trunk.json','utf8'));
 const sw=d.facilities.find((f:any)=>f.id==='osm-way-317980479');assert.equal(sw.name,'南原発電所の開閉所（推定）');assert.equal(sw.kind,'switchyard');assert.ok(sw.attributes.some((a:any)=>a.label==='名称・位置の根拠'&&/推定/.test(a.value)));
 const pl=d.facilities.find((f:any)=>f.id==='chugoku-place-南原発電所');assert.equal(pl.kind,'plant');assert.equal(pl.plantType.label,'水力（揚水）');assert.ok(pl.attributes.some((a:any)=>a.label==='要注意（位置推定）'));
 const tie=d.lines.find((l:any)=>l.id==='chugoku-plant-220-way-317980484'),feed=d.lines.find((l:any)=>l.id==='chugoku-plant-220-way-1427454298');
 assert.deepEqual(tie.connections.map((c:any)=>[c.status,c.facilities[0]?.id??null]),[['shared-node',null],['facility-area','osm-way-317980479']]);
 assert.deepEqual(feed.connections.map((c:any)=>c.facilities[0].id),['osm-way-317980479','chugoku-place-南原発電所']);
 for(const l of [tie,feed]){assert.equal(l.voltageKV,220);assert.equal(l.attributes.find((a:any)=>a.label==='照合区分').value,'C区分');assert.ok(evidenceOf(l).inferred.length>0,l.name+' は推測の端点を持つ');}
 const san=d.lines.find((l:any)=>l.id==='ledger-chugoku-220-317991389');assert.ok(tie.paths[0][0][0]===tie.connections[0].position[0]&&san.paths.some((p:any)=>p.some((q:any)=>q[0]===tie.paths[0][0][0]&&q[1]===tie.paths[0][0][1])),'分岐点は山陰幹線の上');
 // 2026-11-10（保留103）：山陰幹線を松江変電所まで延ばした（南原の分岐点は変えない）
 assert.deepEqual(san.connections.map((c:any)=>c.facilities[0]?.name??null),['広島変電所','松江変電所']);
 // 区間と OSM の ID は1対1。電源線の北端の直線（地中と推定）だけ点線、ほかは実線（架空）
 for(const l of [tie,feed])assert.equal(l.paths.length,l.osmIds.length,l.name);
 assert.deepEqual(feed.paths.map((_:any,i:number)=>pathDash(feed,i)),['','',DOTTED]);
 assert.deepEqual(tie.paths.map((_:any,i:number)=>pathDash(tie,i)),['','']);
});
// 2026-10-25 オーナー承認（保留16 案v4）：広島東幹線は御調～三原の廃止（2026年4月、中国電力NW・OCCTO の資料、区間はオーナー判断）を反映して2本に分ける。
// 北尾道連絡線は御調開閉所（OSM の区画）から北尾道変電所へ。御調・三原の開閉所は運用中のまま廃止予定を属性に書く
test('広島東幹線 is split at the abolished 御調～三原 section and 北尾道連絡線 starts at 御調開閉所',()=>{
 const d=JSON.parse(readFileSync('public/data/chugoku-trunk.json','utf8'));
 const L=(n:string)=>d.lines.find((l:any)=>l.name===n);const ends=(l:any)=>l.connections.map((c:any)=>c.facilities[0]?.name);
 assert.deepEqual(ends(L('広島東幹線')),['井原開閉所','御調開閉所']);assert.deepEqual(ends(L('広島東幹線（新広島～三原開閉所）')),['新広島変電所','三原開閉所']);assert.deepEqual(ends(L('北尾道連絡線')),['御調開閉所','北尾道変電所']);
 for(const n of ['広島東幹線','広島東幹線（新広島～三原開閉所）'])assert.ok(L(n).attributes.some((a:any)=>a.label==='区間の扱い'&&/誤記/.test(a.value)&&/描かない/.test(a.value)),n);
 for(const n of ['御調開閉所','三原開閉所']){const f=d.facilities.find((x:any)=>x.name===n);assert.equal(f.kind,'switchyard');assert.ok(!f.status||f.status!=='廃止',n+' は運用中');assert.ok(f.attributes.some((a:any)=>a.label==='計画（廃止予定）'),n);}
 assert.ok(d.facilities.find((x:any)=>x.name==='三原開閉所').attributes.some((a:any)=>a.label==='要注意（位置推定）'));
 for(const n of ['広島東幹線','広島東幹線（新広島～三原開閉所）','北尾道連絡線'])assert.equal(L(n).paths.length,L(n).osmIds.length,n);
 const at=(l:any,lab:string)=>l.attributes.find((x:any)=>x.label===lab)?.value??'';
 for(const n of ['広島東幹線','広島東幹線（新広島～三原開閉所）'])assert.match(at(L(n),'区間の扱い'),/31ページ（図4-1/,n);
 assert.match(at(L('広島東幹線'),'公表区間'),/の一部（井原側）/);assert.match(at(L('広島東幹線（新広島～三原開閉所）'),'経路の根拠'),/国土地理院の送電線記号だけ/);
 const m=d.facilities.find((x:any)=>x.name==='御調開閉所').position,near=(p:number[])=>Math.hypot((p[0]-m[0])*111000,(p[1]-m[1])*91000)<150;
 assert.ok(near(L('広島東幹線').paths.at(-1).at(-1))&&near(L('北尾道連絡線').paths[0][0]),'御調の引込は区画の近く');
});
