import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {reviewedTokyoDay,withoutTokyoOverlap} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';import {capacityReferenceUsage} from '../src/occto-domain.ts';import {uniqueAssets,combineRegionDays} from '../src/regions.ts';import {plansForRegion} from '../src/change-plans.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
// 2026-10-16 京浜線3・4L・東京南線3・4L の経路の差し替え（と京浜線1・2L の線分の入れ替え）：OSMの原本（data/raw/tokyo-275/lines-south.json）から直接作った線分。原本との照合は下の個別のテスト
const REROUTED_34L=new Set(['tokyo-section-102','tokyo-section-103','tokyo-section-104']),REROUTED_WAYS=new Set([161967895,161967897,156415470,91828740,1383900536,161967889,161967890,161967893]);
// 2026-10-17 No.31 を千葉火力線3・4L（way 704195151、held-cables.json）へ移した。元の採用表（tokyo-275-adopted.json）の辺にはないので同じく除く
const REROUTED_31=new Set([704195151]);
// 2026-11-17 保留124：梓川線の安曇側（way 315662803、以前の安曇水力発電所の電源線）と、川崎高輪線（直線）に池上線の中間の分岐点（推定）を足したもの（高輪→分岐点→川崎火力）
const REWIRED_1117=new Set(['tokyo-section-77|315662803','tokyo-section-129|-129',
 // 2026-11-17 保留127 K1：No.15 を常陸那珂火力線（OSM から描いていた plant- の線の経路）に替えた
 'tokyo-section-15|1035283349','tokyo-section-15|589359191','tokyo-section-15|103827618']);
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const d=read('public/data/tokyo-trunk.json'),base=read('public/data/tohoku-trunk-osm.json');const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));
test('Tokyo sections (incl. the 相馬双葉幹線 tie and the 東清水線 under construction) reuse existing facility IDs and continuous source edges',()=>{
 // 2026-10-04 電源開発の奥只見・田子倉（線2・設備2、jpower-）、公表台帳の線（ledger-）を追加
 assert.equal(d.lines.filter((l:any)=>!l.id.startsWith('ledger-')&&!l.id.startsWith('owner-')&&!l.id.startsWith('plant-')&&!l.id.startsWith('tokyo-feeder-')).length,146);// 2026-11-17 保留127 K7〜K9：No.32・106・142 を追加（143→146）// 2026-10-17 城北線（建設中、tokyo-plan-城北線）を追加// 2026-10-11 tokyo-feeder-（個別に描いた発電所の連系線、OSMは data/raw/nakatokyo-osm）は数えない// 2026-10-10 奥只見線の発電所側の重複（jpower-275-way-232998815）を除いた// 公表台帳の線の端の設備には、旧東北データの資産IDを引き継いだもの（ledger- で始まらない）がある
 assert.ok(d.facilities.filter((f:any)=>!String(f.assetId).startsWith('ledger-')).length>=137);// 2026-11-17 保留127：品川火力・JFE扇島火力の削除で139→137（今の件数）。// 2026-11-17 保留126：3か所の削除で下限を140→139（今の件数。減った分は承認済み削除リストに登録）。// 2026-10-07 JR東日本の水力3か所を削除（鉄道用の系統）for(const f of d.facilities){const prior=base.facilities.find((x:any)=>x.id===f.id);if(prior)assert.equal(prior.assetId,f.assetId);}
 const extra=read('docs/research/tokyo-500-north-adopted.json');const source=new Set([...base.lines,...extra.lines,...read('docs/research/tokyo-500-west-adopted.json').lines,...read('docs/research/tokyo-500-east-adopted.json').lines,...read('docs/research/tokyo-500-remaining-adopted.json').lines,...read('docs/research/tokyo-500-plants-adopted.json').lines,...read('docs/research/tokyo-500-fc-adopted.json').lines,...read('docs/research/tokyo-275-adopted.json').lines,...read('docs/research/tokyo-275-schematic.json').lines,...read('docs/research/tokyo-275-takase.json').lines,...read('docs/research/tokyo-higashishimizu-154.json').lines].flatMap((l:any)=>l.paths.flatMap((p:any)=>p.slice(1).map((q:any,i:number)=>l.voltageKV+'|'+[p[i].join(','),q.join(',')].sort().join('|')))));
 for(const l of d.lines.filter((l:any)=>!l.id.startsWith('tie-')&&!l.id.startsWith('tokyo-plan-')&&!l.id.startsWith('jpower-')&&!l.id.startsWith('ledger-')&&!l.id.startsWith('owner-')&&!l.id.startsWith('plant-')&&!l.id.startsWith('tokyo-feeder-')))for(const [k,p] of l.paths.entries())if(!(l.osmIds[k]<0&&(l.schematicParts?.some((x:any)=>x.osmId===l.osmIds[k])||l.tracedParts?.some((x:any)=>x.osmId===l.osmIds[k])))&&!(REROUTED_34L.has(l.id)&&REROUTED_WAYS.has(l.osmIds[k]))&&!(l.id==='tokyo-section-31'&&REROUTED_31.has(l.osmIds[k]))&&!REWIRED_1117.has(l.id+'|'+l.osmIds[k]))for(let i=1;i<p.length;i++)assert.ok(source.has(l.voltageKV+'|'+[p[i-1].join(','),p[i].join(',')].sort().join('|')));
 // 2026-10-05 京浜線1/2L・東京南線1/2L・3/4L（OCCTOの端点を推定で地図の設備に対応）、千葉印西線（オーナー提供の位置）を追加
 assert.equal(day.actual.lines.length,88);for(const r of day.actual.lines){assert.ok(referenceFlowPath(r,d.lines,false),r.name);assert.equal(r.id.startsWith('tk-'),true);}
});
test('Tokyo direction-specific capacity never substitutes reverse capacity',()=>{
 const r=day.actual.lines.find((r:any)=>r.name==='川内線')!;assert.equal(r.from,'南いわき開閉所');assert.equal(capacityReferenceUsage(r,100,day.capacities),null);assert.ok(capacityReferenceUsage(r,-100,day.capacities)!>0);
 const unknown={...r,to:'未確認'};assert.equal(reviewedTokyoDay({...day,actual:{...day.actual,lines:[unknown]}}).actual.lines.length,0);
});
test('national removes identical Tokyo edges, preserves base input and shared facility identity',()=>{
 const copy=JSON.stringify(base),remaining=withoutTokyoOverlap(base.lines,d.lines);const key=(l:any)=>l.paths.flatMap((p:any)=>p.slice(1).map((q:any,i:number)=>l.voltageKV+'|'+[p[i].join(','),q.join(',')].sort().join('|')));const edges=new Set(d.lines.flatMap(key));assert.ok(remaining.flatMap(key).every(e=>!edges.has(e)));assert.equal(JSON.stringify(base),copy);assert.equal(uniqueAssets([...base.facilities,...d.facilities.filter((f:any)=>!String(f.assetId).startsWith('owner-')&&!String(f.assetId).startsWith('plant-fac-'))]).length,base.facilities.length+117);// 2026-11-17 保留127 K10：日本製鉄鹿島火力・鹿島共同火力を追加（115→117）。// 2026-11-17 保留127 K9：JFE千葉を追加（114→115）。// 2026-11-17 保留127：品川火力・JFE扇島火力を削除（116→114）。// 2026-11-17 保留126：城山水力・中津川第一・秋元を削除（119→116）。// 2026-11-17 保留125：袖ケ浦・横浜・川崎の発電所8か所を削除（127→119）。// 2026-11-17 保留124：発電所7か所を削除、大鳥・大津岐・南多摩・中相模・墨東・南横須賀を追加（128→127）。// 2026-10-24 奥清津第二発電所（tokyo-place-奥清津第二発電所）を追加（保留11）。2026-10-18 逗子変電所（osm-way-327974991）を追加。// 2026-10-17 筑波南変電所（osm-way-211356757）を追加。// 2026-10-17 常総変電所（osm-way-340365829）を追加。// 2026-10-17 沼原電力所（osm-way-1016436036）を追加。// 2026-10-17 五井火力発電所（osm-way-605327351）を追加。// 2026-10-07 JR東日本の水力3か所（千手・小千谷・小千谷第二）を削除。2026-10-10 廃止措置中の東海発電所（japc-tokai-1）を追加。2026-10-10 矢木沢発電所（osm-node-1210028290）・信濃川変電所（推定、tokyo-est-信濃川変電所）を追加。2026-10-11 需要家（osm-way-848771201）を追加、小千谷第二発電所（osm-way-658690610）を復元
 const merged=combineRegionDays([[day],[{...day,actual:{...day.actual,lines:day.actual.lines.map((l:any)=>({...l,id:'other-'+l.id,values:l.values.map(()=>null)}))}}]]);assert.ok(merged[0].actual.lines.slice(day.actual.lines.length).every(l=>l.values.every(v=>v===null)));
});
test('Tokyo plans are distinct, original month precision and unchecked progress survive',()=>{
 const hk=read('public/data/hokkaido-hokuto.json').changePlans;const all=[...hk,...d.changePlans];assert.equal(new Set(all.map(p=>p.id)).size,all.length);assert.equal(plansForRegion(all,'tokyo').length,7);/* 2026-11-05 相馬双葉幹線の接続変更（tohoku-tokyo-somafutaba-2026、保留78。運用開始の確認日あり） */assert.equal(plansForRegion(d.changePlans,'chubu').length,3);/* 2026-10-17 新豊根東栄線の一部廃止・つなぎ替え（jpower-plan-shintoyone-toei） */assert.ok(d.changePlans.filter((p:any)=>p.regions.includes('tokyo')&&p.id!=='tokyo-plan-shin-sakuma-higashi'&&p.id!=='tohoku-tokyo-somafutaba-2026').every((p:any)=>p.latestProgressReview.checkedAt===null&&p.revisions[0].timing.every((t:any)=>t.precision==='month')));
});

test('OCCTO rows that span two sections, end at a substation on the line, or cover both circuits now carry flow (2026-10-03)',()=>{
 const rows=day.actual.lines;const by=(n:string)=>rows.find((r:any)=>r.name===n);
 for(const n of ['北千葉線','港北線','西南川越線','江東線','鹿島線','河北線1・2L','中沢線1・2L','京浜線3・4L'])assert.ok(by(n)&&referenceFlowPath(by(n),d.lines,false),n);
 assert.match(by('河北線1・2L').note,/容量は回線別のため割り当てない/);
 assert.ok(d.lines.find((l:any)=>l.name==='江東線').flowTaps[0].name==='葛南変電所');
 // 2026-10-05 オーナー指示「OCCTOで公開している潮流で反映していないもの」：端点がずれる3行は推定で対応（注記あり）、千葉印西線は位置をもらって直線（D区分）で描いた
 for(const n of ['京浜線1・2L','東京南線1・2L','東京南線3・4L'])assert.ok(by(n)&&referenceFlowPath(by(n),d.lines,false)&&/推定/.test(by(n).note),n);
 assert.ok(by('千葉印西線')&&referenceFlowPath(by('千葉印西線'),d.lines,false));
});

// 2026-10-16 オーナー承認：京浜線3・4L・東京南線3・4Lは1・2Lと別のOSM経路（3,4号線）で描く。ID・公表区間・OCCTOの対応・向きは同じ
test('京浜線3・4L and 東京南線3・4L follow their own OSM 3,4号線 routes, sharing no OSM way with 1・2L; ends and flow direction unchanged',()=>{
 const l=(id:string)=>d.lines.find((x:any)=>x.id===id);
 for(const [a,b] of [['tokyo-section-103','tokyo-section-104'],['tokyo-section-101','tokyo-section-102']]){const ids=new Set(l(a).osmIds.filter((x:number)=>x>0));assert.ok(!l(b).osmIds.some((x:number)=>ids.has(x)),a+' / '+b);}
 assert.deepEqual(l('tokyo-section-104').osmIds,[161967895,161967897,156415470,91828740,1383900536]);
 assert.deepEqual(l('tokyo-section-102').osmIds,[161967889,161967890,-1021]);
 assert.deepEqual(l('tokyo-section-103').osmIds,[1385329375,91829530,161967893,161967892]);
 assert.deepEqual(l('tokyo-section-104').connections.map((c:any)=>c.facilities[0].name),['京浜変電所','西東京変電所']);
 assert.deepEqual(l('tokyo-section-102').connections.map((c:any)=>c.facilities[0].name),['京浜変電所','JERA 横須賀火力発電所']);
 assert.ok(l('tokyo-section-102').attributes.some((a:any)=>a.label==='末端の直線'&&/推定/.test(a.value)));
 // 線分が途切れない（前の線分の終点＝次の線分の始点。原本がない環境でも確かめる）
 for(const id of REROUTED_34L){const ps=l(id).paths;for(let k=1;k<ps.length;k++)assert.deepEqual(ps[k][0],ps[k-1].at(-1),id+' '+k);}
 // 潮流の向きはOCCTOの行の起点→終点（線分の並びではない）
 for(const n of ['京浜線3・4L','東京南線3・4L']){const r=day.actual.lines.find((x:any)=>x.name===n),p=referenceFlowPath(r,d.lines,false)!;const f=(name:string)=>d.facilities.find((x:any)=>x.name===name).position;
  const near=(q:number[],c:number[])=>Math.hypot((q[0]-c[0])*111000,(q[1]-c[1])*91000)<1500;assert.ok(near(p[0],f(r.from))&&near(p.at(-1)!,f(r.to)),n);}
 // 線分の点がOSMの原本と一致する（原本がない環境では確かめない）
 const rawFile='data/raw/tokyo-275/lines-south.json';if(!existsSync(rawFile))return;
 const raw=read(rawFile).elements,pos=new Map(raw.filter((e:any)=>e.type==='node').map((e:any)=>[e.id,e.lat+','+e.lon]));
 for(const id of REROUTED_34L){const x=l(id);x.paths.forEach((p:number[][],k:number)=>{if(x.osmIds[k]<0)return;const w=raw.find((e:any)=>e.type==='way'&&e.id===x.osmIds[k]);const pts=new Set(w.nodes.map((n:number)=>pos.get(n)));assert.ok(p.every((q:number[])=>pts.has(q.join(','))),id+' '+x.osmIds[k]);});}
});

// 2026-10-16 オーナー判断：鹿島の No.40・43・44 は同じOSM経路（鹿島第二火力線）のまま。行き先の発電所は推定（東京PGの系統構成図では番号で匿名）。
// No.40 を鹿島火力線に差し替えたのは取り消した（東京PGの整備計画で鹿島火力線は 2024-12 廃止の計画）
test('鹿島 No.40・43・44 stay on the 鹿島第二火力線 route, keep their ends and tier C, and carry an inferred end; 鹿島火力線 is not used',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const l=(id:string)=>d.lines.find((x:any)=>x.id===id);
 for(const id of ['tokyo-section-40','tokyo-section-43','tokyo-section-44']){const x=l(id);assert.deepEqual(x.osmIds,[1081105727,754089911,300345935,1081102468],id);
  assert.deepEqual(x.connections.map((c:any)=>c.facilities[0].name),['鹿島変電所','鹿島火力発電所'],id);
  const e=evidenceOf(x);assert.equal(e.tier,'C',id);assert.ok(e.inferred.length>=1,id);}
 assert.ok(!d.lines.some((x:any)=>x.osmIds.includes(300345937)),'鹿島火力線（2024-12 廃止の計画）は描かない');
 assert.ok(/廃止/.test(l('tokyo-section-40').attributes.find((a:any)=>a.label==='端点の根拠').value));
});
// 2026-10-16 オーナー承認：鹿島地区の神栖火力線（E区分、鹿島火力側の端は推定）と鹿島海浜線（C区分、南の端は未確認）。OCCTO・容量表の行には対応させない
test('鹿島 神栖火力線 (E, inferred end) and 鹿島海浜線 (C, unresolved south end) are drawn from the OSM ways',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const l=(id:string)=>d.lines.find((x:any)=>x.id===id);
 const k=l('tokyo-feeder-275-1081326554'),h=l('tokyo-feeder-275-249766416');
 assert.deepEqual(k.connections.map((c:any)=>c.facilities[0]?.name),['神栖火力発電所','鹿島火力発電所']);
 assert.equal(evidenceOf(k).tier,'E');assert.ok(evidenceOf(k).inferred.length>=1);assert.ok(k.attributes.some((a:any)=>a.label==='要注意（E区分）'));
 assert.ok(!d.lines.some((x:any)=>x.osmIds.some((id:number)=>[1081085306,1081085307,1081097241,1081097242].includes(id))),'両端の名前のない短い線分は描かない');
 assert.deepEqual(h.connections.map((c:any)=>[c.status,c.facilities[0]?.name??null]),[['facility-area','鹿島火力発電所'],['unresolved',null]]);
 assert.equal(evidenceOf(h).tier,'C');assert.equal(evidenceOf(h).inferred.length,0);
 for(const x of [k,h]){assert.equal(x.tsoSection,null);assert.equal(x.voltageKV,275);assert.deepEqual(x.paths[0][0],x.connections[0].position);assert.deepEqual(x.paths.at(-1).at(-1),x.connections[1].position);}
 const rawFile='data/raw/tokyo-275/lines-north1.json';if(!existsSync(rawFile))return;
 const raw=read(rawFile).elements,pos=new Map(raw.filter((e:any)=>e.type==='node').map((e:any)=>[e.id,e.lat+','+e.lon]));
 for(const x of [k,h]){const w=raw.find((e:any)=>e.type==='way'&&e.id===x.osmIds[0]);assert.deepEqual(x.paths[0].map((q:number[])=>q.join(',')),w.nodes.map((n:number)=>pos.get(n)),x.name);}
});
// 2026-10-16 オーナー判断：鹿島変電所から北への線（名称未確認）。北の端は未確認。OSMの線名（需要家候補）は配信データに出さない
// 2026-11-17 保留127 K10：No.40 の分岐の残る一方と推定（オーナーの説明、一次資料未確認）。名前「送電線No.40（推定・分かれ先）」、C区分＋推測。照合表には対応させない
test('鹿島変電所から北への線 = No.40 (inferred branch, C, unresolved north end) is drawn from the OSM ways without the auxiliary name',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const l=d.lines.find((x:any)=>x.id==='tokyo-feeder-275-300345941');
 assert.deepEqual(l.connections.map((c:any)=>[c.status,c.facilities[0]?.name??null]),[['facility-area','鹿島変電所'],['unresolved',null]]);
 const e=evidenceOf(l);assert.equal(l.name,'送電線No.40（推定・分かれ先）');assert.ok(!JSON.stringify(d.lines.find((x:any)=>x.id==='plant-tokyo-275-1082612595')).includes('日本製鉄鹿島火力発電所'),'鹿島パワー線に旧名を残さない');assert.equal(e.tier,'C');assert.ok(e.inferred.length>=1);assert.equal(l.tsoSection,null);assert.equal(l.named,false);
 assert.ok(!/住友|金属/.test(JSON.stringify(l)),'会社名を出さない');
 for(let k=1;k<l.paths.length;k++)assert.deepEqual(l.paths[k][0],l.paths[k-1].at(-1),String(k));
 assert.ok(d.lines.find((x:any)=>x.id==='plant-tokyo-275-1082612595').osmIds.includes(1082612598)&&l.osmIds.includes(1082612598),'鹿島パワー線と併架の区間を共有');
 const rawFile='data/raw/tokyo-275/lines-north1.json';if(!existsSync(rawFile))return;
 const raw=read(rawFile).elements,pos=new Map(raw.filter((x:any)=>x.type==='node').map((x:any)=>[x.id,x.lat+','+x.lon]));
 l.paths.forEach((p:number[][],k:number)=>{const w=raw.find((x:any)=>x.type==='way'&&x.id===l.osmIds[k]);const pts=new Set(w.nodes.map((n:number)=>pos.get(n)));assert.ok(p.every((q:number[])=>pts.has(q.join(','))),String(l.osmIds[k]));});
});
// 2026-10-16 オーナー指示：広野火力発電所の代表点は区画の内側に置き、広野火力線は構内の直線を描かない（OSMの線の末端が区画の内側に届く）
test('広野火力線 ends at its OSM line end inside the plant area without a straight part, and the plant point is inside its area',()=>{
 const l=d.lines.find((x:any)=>x.id==='tokyo-section-9'),f=d.facilities.find((x:any)=>x.id==='osm-way-103812542');
 assert.deepEqual(l.osmIds,[897932369,105432590]);assert.ok(!l.schematicParts?.length);
 assert.deepEqual(l.connections.at(-1).facilities.map((x:any)=>x.id),['osm-way-103812542']);assert.equal(l.connections.at(-1).node,1461010236);
 assert.deepEqual(l.paths.at(-1).at(-1),l.connections.at(-1).position);assert.ok(!l.attributes.some((a:any)=>a.label==='末端の直線'));
 assert.deepEqual(f.position,[37.2365084,141.0122789]);assert.ok(f.attributes.some((a:any)=>a.label==='代表点の取り方'));
 const rawFile='data/raw/osm-trunk-expanded.json';if(!existsSync(rawFile))return;
 const w=read(rawFile).elements.find((e:any)=>e.type==='way'&&e.id===103812542),ring=w.geometry.map((q:any)=>[q.lat,q.lon]);
 const inside=(p:number[])=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[yi,xi]=ring[i],[yj,xj]=ring[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 assert.ok(inside(f.position)&&inside(l.connections.at(-1).position));
});
// 2026-10-17 オーナー承認：No.31 を千葉火力線3・4L（way 704195151）へ移し、No.30 と重ねない。どちらの番号がどちらの線かは推測（両方に推測）
test('No.30 stays on 千葉火力線1・2L and No.31 runs on 千葉火力線3・4L; both are marked as inferred',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const d=read('public/data/tokyo-trunk.json'),l=(id:string)=>d.lines.find((x:any)=>x.id===id);const a=l('tokyo-section-30'),b=l('tokyo-section-31');
 assert.deepEqual(a.osmIds,[156332175,-301]);assert.deepEqual(b.osmIds,[704195151,-311]);assert.deepEqual(b.schematicParts,[{osmId:-311,construction:'unknown'}]);
 assert.deepEqual(b.connections.map((c:any)=>[c.node,c.status,c.facilities[0].id]),[[6612138707,'facility-area','osm-way-211241774'],[6612138710,'facility-area','osm-way-605327355']]);
 assert.deepEqual(b.paths[1][0],b.paths[0].at(-1));assert.deepEqual(b.paths[1][1],d.facilities.find((f:any)=>f.id==='osm-way-605327355').position);
 for(const x of [a,b]){const e=evidenceOf(x);assert.equal(e.tier,'C');assert.ok(e.inferred.length>=1,x.id);}
 assert.ok(/3・4Lに対応付けたのは推定/.test(b.attributes.find((x:any)=>x.label==='公表区間との対応').value));assert.ok(/1・2Lに対応付けたのは推定/.test(a.attributes.find((x:any)=>x.label==='公表区間との対応').value));
 if(existsSync('data/raw/tokyo-275/held-cables.json')){const raw=read('data/raw/tokyo-275/held-cables.json').elements,pos=new Map(raw.filter((e:any)=>e.type==='node').map((e:any)=>[e.id,[e.lat,e.lon].join(',')]));
  const w=raw.find((e:any)=>e.type==='way'&&e.id===704195151);assert.deepEqual(b.paths[0].map((p:number[])=>p.join(',')),[...w.nodes].reverse().map((n:number)=>pos.get(n)));}
 if(existsSync('data/raw/tokyo-275/substations.json')){const sub=read('data/raw/tokyo-275/substations.json').elements.find((e:any)=>e.type==='way'&&e.id===211241774);assert.ok(sub,'千葉中央変電所の区画が原本にない');const ring=sub.geometry.map((g:any)=>[g.lat,g.lon]),p=b.paths[0][0];let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[yi,xi]=ring[i],[yj,xj]=ring[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)inside=!inside;}assert.ok(inside,'No.31 の東の端は千葉中央変電所の区画の内側');}
 // 画面の推測の根拠は最初の1件：番号と線の対応付けの推測が先に出ること
 assert.equal(evidenceOf(b).inferred[0].basis.startsWith('系統構成図(30)(31)'),true);
});
// 2026-10-17 オーナー承認：五井火力発電所（OSMは建設中の登録のまま。運転は一次資料・HJKS）と五井火力線。五井火力線は同日のオーナー承認で No.29 に対応（C区分＋推測）。
// tsoSection は null のまま：OCCTO の実績に No.29 の行がなく、東京PGの容量表にも No.29 の行がない（No.30 と同じ）
test('五井火力発電所 is operating per the operator and 五井火力線 (No.29, C + inferred) links 房総変電所 to it without flow',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const d=read('public/data/tokyo-trunk.json');const f=d.facilities.find((x:any)=>x.id==='osm-way-605327351'),l=d.lines.find((x:any)=>x.id==='tokyo-feeder-275-168782022');
 assert.equal(f.name,'五井火力発電所');assert.equal(f.kind,'plant');assert.equal(f.status,'運用中');assert.equal(f.statusConfirmed,true);assert.match(f.statusSource,/2025-03-01/);
 assert.equal(d.facilities.filter((x:any)=>x.name==='五井火力発電所').length,1);assert.equal(f.capacityMW,undefined);assert.equal(f.outputMW,undefined);// OSMの出力0MWを値として持たない
 assert.equal(f.plantType.label,'LNG（コンバインドサイクル）');// 2026-10-19 オーナー承認：既存の出典の「コンバインドサイクル発電方式・LNG」から
 assert.deepEqual(l.osmIds,[1247083092,168782022]);assert.equal(l.tsoSection,null);assert.equal(l.status,undefined);
 assert.deepEqual(l.connections.map((c:any)=>[c.node,c.status,c.facilities[0].id]),[[1799966645,'facility-area','osm-way-151379730'],[1799967479,'facility-area','osm-way-605327351']]);
 assert.deepEqual(l.paths[1][0],l.paths[0].at(-1));const e=evidenceOf(l);assert.equal(e.tier,'C');assert.ok(e.inferred.length>=1);assert.ok(e.inferred[0].basis.startsWith('系統構成図(29)'));
 assert.equal(l.attributes.find((a:any)=>a.label==='公表区間').value,'東京PG 基幹275kV No.29：端点匿名（2回線）');
 assert.ok(!read('public/data/undrawn-sections.json').rows.some((r:any)=>r.region==='tokyo'&&r.no==='29'),'No.29 は未描画の一覧から外れる');
 assert.equal(read('docs/research/tokyo-275-progress.json').sections.find((x:any)=>x.section===29).research,'reviewed');
 const u=read('public/data/plant-units.json').plants['osm-way-605327351'].units.filter((x:any)=>x.status==='運転中');assert.deepEqual(u.map((x:any)=>[x.mw,x.start]),[[780,'2024-08-01'],[780,'2024-11-14'],[780,'2025-03-01']]);
 assert.ok(!d.lines.some((x:any)=>x.id!==l.id&&x.osmIds.some((i:number)=>i===168782022||i===1247083092)),'同じ線分を別の線で描かない');
 assert.ok(!l.osmIds.includes(1133622352),'北五井火力線（休止中）は含めない');
 assert.match(l.attributes.find((a:any)=>a.label==='電圧の根拠').value,/推定/);
 assert.ok(!JSON.stringify(read('public/data/tokyo-flow.json')).includes('tokyo-feeder-275-168782022'),'潮流データにこの線はない');assert.equal(l.flowNames,undefined);assert.equal(l.flowTaps,undefined);
});

// 2026-10-17 オーナー判断：沼原線の端を沼原電力所とみなした（推定）。推測の表示が消えたら止める
test('沼原線 ends at 沼原電力所 with an inferred endpoint (C)',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const d=read('public/data/tokyo-trunk.json');const l=d.lines.find((x:any)=>x.id==='tokyo-section-22');
 assert.equal(l.connections.at(-1).facilities[0].id,'osm-way-1016436036');assert.equal(d.facilities.find((x:any)=>x.id==='osm-way-1016436036').kind,'switchyard');
 const e=evidenceOf(l);assert.equal(e.tier,'C');assert.ok(e.inferred.length>=1);
});
// 2026-10-17 城北線（建設中）：東京PGの整備計画で工事中（新座～豊島、2033-10 使用開始）。経路は被災前のOFケーブルのOSM（新座側は北武蔵野線と共用の線分）
test('城北線 is drawn as under construction between 新座 and 豊島 (C, no inferred end, no OCCTO flow)',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const l=d.lines.find((x:any)=>x.id==='tokyo-plan-城北線');assert.ok(l);
 assert.equal(l.status,'建設中');assert.equal(l.plannedStart,'2033年10月');assert.deepEqual(l.osmIds,[1556050857]);assert.deepEqual(l.sourceOsmIds,[1556050856,1556050857]);assert.equal(l.paths.length,1);
 assert.deepEqual(l.connections.map((c:any)=>c.facilities.map((f:any)=>f.id)),[['osm-way-136298957'],['osm-node-14154037836']]);
 const e=evidenceOf(l);assert.equal(e.tier,'C');assert.equal(e.inferred.length,0);
 assert.equal(day.actual.lines.some((r:any)=>/城北/.test(r.name)),false);const {candidateGeometry}=await import('../src/real-domain.ts');assert.equal(day.actual.lines.some((r:any)=>candidateGeometry(r,d.lines).some((g:any)=>g.id===l.id)),false);
 assert.ok(d.lines.find((x:any)=>x.id==='tokyo-section-112').osmIds.includes(1556050856));const {flowBranches}=await import('../src/flow-path.ts');const r112=day.actual.lines.find((r:any)=>r.name==='北武蔵野線');assert.deepEqual(flowBranches(r112,d.lines),[]);
 assert.ok(d.changePlans.some((p:any)=>p.id==='tokyo-plan-johoku-2026'&&p.targets[0].assetIds[0]==='tokyo-plan-城北線'));
});
// 2026-10-17 常総変電所と、鹿島線から常総変電所への線：東京PGの系統構成図で常総は鹿島線（45）上の275/66kV変電所。分かれ目は No.45 の線分の途中の共有点（推測）
test('常総変電所 hangs off No.45 at a shared OSM node (C + inferred); the branch carries no OCCTO flow and the 鹿島→筑波南 row is not split by it',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const {candidateGeometry}=await import('../src/real-domain.ts');const {flowBranches}=await import('../src/flow-path.ts');
 const l=d.lines.find((x:any)=>x.id==='tokyo-feeder-275-340659460'),l45=d.lines.find((x:any)=>x.id==='tokyo-section-45');assert.ok(l&&l45);
 assert.equal(l.connections[0].status,'shared-node');assert.equal(l.connections[0].node,3479085769);assert.deepEqual(l.connections[1].facilities.map((f:any)=>f.id),['osm-way-340365829']);
 if(existsSync('data/raw/tokyo-275/held-cables.json')){const raw=read('data/raw/tokyo-275/held-cables.json').elements;const w=(id:number)=>raw.find((e:any)=>e.type==='way'&&e.id===id);
 assert.ok(w(1077611345).nodes.slice(1,-1).includes(3479085769));assert.equal(w(195981776).nodes[0],3479085769);}
 assert.ok(l45.paths.some((p:any)=>p.slice(1,-1).some((q:any)=>q[0]===l.paths[0][0][0]&&q[1]===l.paths[0][0][1])));
 const e=evidenceOf(l);assert.equal(e.tier,'C');assert.ok(e.inferred.length>=1);assert.equal(d.facilities.filter((f:any)=>f.name==='常総変電所').length,1);const {facilityTierOf}=await import('../src/evidence.ts');assert.equal(facilityTierOf(d.facilities.find((f:any)=>f.name==='常総変電所')),'B');
 assert.equal(day.actual.lines.some((r:any)=>candidateGeometry(r,d.lines).some((g:any)=>g.id===l.id)),false);
 const r45=day.actual.lines.find((r:any)=>r.name==='鹿島線');assert.equal(r45.to,'筑波南変電所');assert.equal(flowBranches(r45,d.lines).includes(l.name),false);
});
// 2026-10-17 筑波南変電所：東京PGの系統構成図で鹿島線（45）上の変電所。No.45 の途中の接続（経路の順：新野田・筑波南・鹿島）。潮流の区切りの位置は変えない
test('筑波南変電所 is a mid connection of No.45 in route order; the 鹿島→筑波南 flow path ends at the same point as before',async()=>{
 const {facilityTierOf,evidenceOf}=await import('../src/evidence.ts');const {referenceFlowPath,flowBranches}=await import('../src/flow-path.ts');
 const l=d.lines.find((x:any)=>x.id==='tokyo-section-45');assert.deepEqual(l.connections.map((c:any)=>c.facilities.map((f:any)=>f.name)),[['新野田変電所'],['筑波南変電所'],['鹿島変電所']]);
 const f=d.facilities.find((x:any)=>x.id==='osm-way-211356757');assert.ok(f);assert.equal(facilityTierOf(f),'B');assert.equal(d.facilities.filter((x:any)=>x.name==='筑波南変電所').length,1);
 assert.deepEqual(l.connections[1].position,[35.9725927,140.2504229]);assert.deepEqual(l.flowTaps,[{name:'筑波南変電所',position:[35.9725927,140.2504229]}]);
 const r=day.actual.lines.find((x:any)=>x.name==='鹿島線');const p=referenceFlowPath(r,d.lines,false)!;assert.deepEqual(p.at(-1),[35.9725927,140.2504229]);assert.deepEqual(p[0],[35.8974463,140.6560469]);assert.deepEqual(flowBranches(r,d.lines),[]);
 assert.equal(evidenceOf(l).inferred.length,0);assert.ok(!l.attributes.some((a:any)=>/推定しない/.test(a.value)));
});
// 2026-10-18 逗子変電所と、東京南線から逗子への線：OSMでは東京南線3・4L（No.102）の途中から分かれる（どちらの線につながるかは一次資料で未確認＝推測）
test('逗子変電所 hangs off No.102 at a shared OSM node (C + inferred); only the 東京南線3・4L row gains a branch and the 1・2L row does not',async()=>{
 const {evidenceOf,facilityTierOf}=await import('../src/evidence.ts');const {candidateGeometry}=await import('../src/real-domain.ts');const {flowBranches}=await import('../src/flow-path.ts');
 const l=d.lines.find((x:any)=>x.id==='tokyo-feeder-275-328143017');assert.ok(l);assert.equal(l.connections[0].status,'shared-node');assert.equal(l.connections[0].node,1609521184);assert.deepEqual(l.connections[1].facilities.map((f:any)=>f.id),['osm-way-327974991']);
 assert.ok(d.lines.find((x:any)=>x.id==='tokyo-section-102').paths.some((p:any)=>p.slice(1,-1).some((q:any)=>q[0]===l.paths[0][0][0]&&q[1]===l.paths[0][0][1])));
 const e=evidenceOf(l);assert.equal(e.tier,'C');assert.ok(e.inferred.length>=1);assert.equal(facilityTierOf(d.facilities.find((f:any)=>f.id==='osm-way-327974991')),'B');assert.equal(d.facilities.some((f:any)=>f.id==='osm-way-200887286'),false);
 assert.equal(day.actual.lines.some((r:any)=>candidateGeometry(r,d.lines).some((g:any)=>g.id===l.id)),false);
 const r34=day.actual.lines.find((r:any)=>r.name==='東京南線3・4L'),r12=day.actual.lines.find((r:any)=>r.name==='東京南線1・2L');assert.deepEqual(flowBranches(r34,d.lines),[l.name]);assert.deepEqual(flowBranches(r12,d.lines),[]);
});
