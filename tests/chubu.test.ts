import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {reviewedChubuDay} from '../src/chubu-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';import {evidenceOf} from '../src/evidence.ts';import {capacityReferenceUsage,capacityUsageInfo} from '../src/occto-domain.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const d=read('public/data/chubu-trunk.json'),flow=read('public/data/chubu-flow.json');
const latest=typicalDay(flow);
test('every OCCTO Chubu 500kV row maps to a drawn route between its two facilities',()=>{
 const day=reviewedChubuDay(latest);const rows=day.actual.lines.filter((r:any)=>r.voltageKV===500);assert.equal(rows.length,17);
 for(const r of rows){const p=referenceFlowPath(r,d.lines,false);assert.ok(p,r.name);}
 const ids=new Set(d.facilities.map((f:any)=>f.id));for(const l of d.lines){assert.ok(l.attributes.some((a:any)=>(l.schematic?a.label==='要注意（D区分）':a.label==='照合区分')),l.name);for(const c of l.connections)for(const f of c.facilities)assert.ok(ids.has(f.id),l.name);}
});
test('capacity rows use the same direction only (岐阜連絡線 spelling in the capacity table is aligned)',()=>{
 const day=reviewedChubuDay(latest);assert.equal(day.capacities.filter((c:any)=>c.voltageKV===500).length,15);const r=day.actual.lines.find((x:any)=>x.name==='岐阜連絡')!;const c=day.capacities.find((x:any)=>x.name==='岐阜連絡')!;assert.ok(c);
 const sign=c.from===r.from?1:-1,same=capacityUsageInfo(r,sign*100,day.capacities),rev=capacityUsageInfo(r,-sign*100,day.capacities);
 assert.equal(same.reverse,false);assert.equal(rev.reverse,true);assert.deepEqual([same.from,same.to],[c.from,c.to]);assert.deepEqual([rev.from,rev.to],[c.to,c.from]);
 // 運用容量は自動更新の最新日の値で、OCCTO が負の値で公表する日がある（岐阜連絡 -3784、2026-10-17・18）。負なら絶対値で使用率を出す（2026-11-04 オーナー指示 保留76）ことを確かめる
 if(c.capacityMW!=null&&c.capacityMW>0){assert.ok(capacityReferenceUsage(r,sign*100,day.capacities));assert.equal(capacityReferenceUsage(r,-sign*100,day.capacities),null);}
 else if(c.capacityMW!=null&&c.capacityMW<0){assert.equal(same.capacityState,'negative');assert.ok(same.capacityMW!<0);assert.equal(same.usage,100/Math.abs(same.capacityMW!)*100);}
 else{assert.equal(same.usage,null);assert.ok(same.capacityState==='zero'||same.capacityState==='none',same.capacityState);}
 // 正の容量の試験用の行（実データの岐阜連絡の容量行を写して +3784 にしたもの）で、同じ向きだけ使用率が出ることを確かめる
 const caps=[{...c,capacityMW:3784,capacityValues:undefined}];assert.ok(capacityReferenceUsage(r,sign*100,caps));assert.equal(capacityReferenceUsage(r,-sign*100,caps),null);
});
test('approval pins the dataset bytes, IDs and voltages; 飛騨変換所 is the Tokyo dataset facility',()=>{
 const a=read('config/chubu-approval.json');assert.equal(createHash('sha256').update(readFileSync('public/data/chubu-trunk.json')).digest('hex'),a.sha256);
 assert.deepEqual(a.lineIds,d.lines.map((l:any)=>l.assetId));for(const l of d.lines)assert.equal(a.lineVoltages[l.assetId],l.voltageKV);
 const hida=d.facilities.find((f:any)=>f.name==='飛騨変換所');assert.ok(read('public/data/tokyo-trunk.json').facilities.some((f:any)=>f.id===hida.id&&f.assetId===hida.assetId));
});
test('the ten 275kV sections around the frequency converters (Tokyo-side connections) carry OCCTO flows',()=>{
 const day=reviewedChubuDay(latest);const names=['佐久間西幹山線','佐久間西幹里線','佐久間川根線','駿河東清水線','静岡東分岐線','駿遠駿河線','信濃中信線','信濃東信線','佐久幹線','高根中信線'];
 for(const n of names){const r=day.actual.lines.find((x:any)=>x.name===n&&x.voltageKV===275);assert.ok(r,n);assert.ok(referenceFlowPath(r,d.lines,false),n);}
 assert.equal(d.facilities.filter((f:any)=>f.name==='駿遠変電所').length,1);
});
test('all 64 OCCTO 275kV rows map to a drawn route; the 20 former holds use OSM routes or straight lines only (owner decision C: no TSO map geometry/positions)',()=>{
 const day=reviewedChubuDay(latest);const rows=day.actual.lines.filter((r:any)=>r.voltageKV===275);assert.equal(rows.length,64);
 for(const r of rows)assert.ok(referenceFlowPath(r,d.lines,false),r.name);
 // 公表区間ではない電源線（電源開発の線・上越火力の連系線、2026-10-04）は数えない
 assert.equal(d.lines.filter((l:any)=>l.voltageKV===275&&!l.id.includes('-plant-')&&!l.id.startsWith('ledger-')&&!l.attributes?.some((a:any)=>a.label==='区分'&&/公表区間ではない/.test(a.value))
  // 一覧・系統マップにあって OCCTO に行のない線（2026-11-16 保留121a 安倍分岐線・121c 関分岐）も数えない
  &&!['chubu-275-安倍分岐線','chubu-275-関分岐'].includes(l.id)).length,64);
 // 2026-11-16 保留121b：奥美濃発電所の連系線の端は岐北開閉所、その南の way 190769045 は岐北分岐だけが使う
 assert.ok(d.lines.find((l:any)=>l.id==='chubu-plant-500-way-832823488').connections.some((c:any)=>c.facilities.some((f:any)=>f.id==='chubu-place-岐北開閉所')));
 assert.deepEqual(d.lines.filter((l:any)=>l.osmIds.includes(190769045)).map((l:any)=>l.id),['chubu-500-岐北分岐']);
 // 中部PGの公表マップの線形・記号位置はデータに入れない（確認のみ）。例外は 2026-10-23 オーナー承認（保留5・案A）の奥矢作第一・第二の連絡線だけ
 assert.deepEqual(d.lines.filter((l:any)=>l.publishedRoute).map((l:any)=>l.id),['chubu-275-奥矢作第一第二連絡線']);assert.ok(d.facilities.every((f:any)=>!String(f.url).includes('gridmap')&&!f.id.startsWith('chubu-gridmap')));
 // 名古屋都市部の地中線などOSMにない区間は直線（D区分）。地中の根拠は海部松ヶ枝線（古河電工時報）の3区間だけ
 const straight=d.lines.filter((l:any)=>l.schematic);assert.ok(straight.length>=10);
 assert.deepEqual(straight.filter((l:any)=>l.construction==='underground').map((l:any)=>l.name).sort(),['名城松ヶ枝線','海部牛島町線','牛島町名城線'].sort());
 for(const n of ['名城変電所','松ヶ枝変電所','牛島町変電所','下広井変電所','金山変電所'])assert.ok(d.facilities.some((f:any)=>f.name===n&&f.attributes.some((a:any)=>a.label==='位置の根拠')),n);
 const r=day.actual.lines.find((x:any)=>x.name==='東名分岐線')!;assert.equal(r.from==='分岐点'||r.to==='分岐点',true);
});
test('plants on the trunk grid: OSM-only (C tier), feeder lines carry no OCCTO flow, other utilities excluded',()=>{
 const day=reviewedChubuDay(latest);const plants=read('docs/research/chubu-plants-adopted.json');
 for(const n of ['新名古屋火力発電所','渥美火力発電所','奥美濃発電所','高根第一水力発電所'])assert.ok(d.facilities.some((f:any)=>f.name===n&&f.kind==='plant'),n);
 for(const l of d.lines.filter((l:any)=>l.id.includes('-plant-'))){assert.ok(l.attributes.some((a:any)=>a.label==='要注意（C区分）'));assert.ok(!day.actual.lines.some((r:any)=>r.name===l.name&&r.voltageKV===l.voltageKV),l.name);}
 assert.ok(!d.facilities.some((f:any)=>/黒部川|安曇|水殿/.test(f.name)));
 const hekinan=d.facilities.find((f:any)=>f.name==='碧南火力発電所');assert.ok(hekinan.attributes.some((a:any)=>a.label==='発電設備出力（OSM登録値）'));
 assert.ok(plants.skipped.some((s:any)=>s.name==='御母衣水力発電所'));
});
// 2026-10-17 新豊根東栄線（電源開発）：J-POWER送変電の2026年度供給計画で今ある線（東栄側の約3kmを2027年4月に廃止、2027年9月につなぎ替え）
test('新豊根東栄線 (J-POWER) runs 新豊根発電所―東栄変電所 as C without inferred ends or OCCTO flow; the plant is the Tokyo dataset facility',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const {candidateGeometry}=await import('../src/real-domain.ts');const l=d.lines.find((x:any)=>x.id==='chubu-jpower-275-502513998');assert.ok(l);
 assert.equal(l.name,'新豊根東栄線');assert.equal(l.status,undefined);assert.deepEqual(l.connections.map((c:any)=>c.facilities.map((f:any)=>f.id)),[['osm-way-1193242939'],['osm-way-116559939']]);
 const e=evidenceOf(l);assert.equal(e.tier,'C');assert.equal(e.inferred.length,0);
 // 2026-11-07（保留86）：発電所の代表点までの直線を描かず、OSM の線の端（node 1477544913）で終える
 assert.ok(!l.osmIds.some((x:number)=>x<0));assert.ok(!l.schematicParts?.length);assert.equal(l.connections[0].node,1477544913);assert.deepEqual(l.connections[0].position,l.paths[0][0]);assert.ok(!l.attributes.some((a:any)=>a.label==='末端の直線'));
 const t=read('public/data/tokyo-trunk.json');const a=d.facilities.find((f:any)=>f.id==='osm-way-1193242939'),b=t.facilities.find((f:any)=>f.id==='osm-way-1193242939');assert.equal(a.assetId,b.assetId);assert.deepEqual(a.position,b.position);
 assert.equal(d.lines.filter((x:any)=>x.name==='新豊根東栄線').length,1);assert.equal(t.lines.some((x:any)=>x.name==='新豊根東栄線'),false);
 const day=reviewedChubuDay(latest);assert.equal(day.actual.lines.some((r:any)=>candidateGeometry(r,d.lines).some((g:any)=>g.id===l.id)),false);
 assert.ok(t.changePlans.some((p:any)=>p.id==='jpower-plan-shintoyone-toei'&&p.regions.includes('chubu')&&p.targets[0].assetIds[0]===l.assetId));
});
// 2026-10-23 オーナー承認（保留5）：中部PGのマッピングの名前のない 275kV の発電所の記号・線から、OSM の無名の区画を奥矢作第一発電所とみなし（推定、開閉所は記載しない）、
// 東部変電所と OSM の無名の 275kV 線でつなぐ（C区分）。奥矢作第二発電所はオーナー指定の座標に足し、第一とはマッピングの線形（publishedRoute）でつなぐ（C区分）
test('奥矢作第一・第二: plants named from location (C), feeder via OSM to 東部変電所 and the published-map route between them',()=>{
 const I=d.facilities.find((f:any)=>f.id==='osm-way-210661976'),II=d.facilities.find((f:any)=>f.id==='chubu-place-奥矢作第二発電所');
 for(const f of [I,II]){assert.equal(f.kind,'plant');assert.equal(f.plantType.label,'水力（揚水）');assert.deepEqual(f.voltages,[275]);}
 assert.equal(I.name,'奥矢作第一発電所');assert.ok(I.attributes.some((a:any)=>a.label==='名称・位置の根拠'&&/推定/.test(a.value)));assert.ok(I.attributes.some((a:any)=>a.label==='OSM登録'&&/substation/.test(a.value)));
 assert.deepEqual(II.position,[35.228833,137.446278]);assert.ok(II.attributes.some((a:any)=>a.label==='位置の根拠'&&/本アプリの調査/.test(a.value)));
 assert.ok(!d.facilities.some((f:any)=>/奥矢作.*開閉所/.test(f.name)));
 const a=d.lines.find((l:any)=>l.id==='chubu-275-奥矢作第一発電所の連系線'),b=d.lines.find((l:any)=>l.id==='chubu-275-奥矢作第一第二連絡線');
 assert.deepEqual(a.connections.map((c:any)=>c.facilities[0].name),['東部変電所','奥矢作第一発電所']);assert.deepEqual(a.osmIds,[180368217,180368235]);assert.ok(!a.publishedRoute);
 assert.deepEqual(b.connections.map((c:any)=>c.facilities[0].name),['奥矢作第二発電所','奥矢作第一発電所']);assert.ok(b.publishedRoute&&b.osmIds.every((i:number)=>i<0));
 for(const l of [a,b]){assert.equal(l.voltageKV,275);assert.equal(l.attributes.find((x:any)=>x.label==='照合区分').value,'C区分');assert.ok(evidenceOf(l).inferred.length>0,l.name+' は推定の端点を持つ');}
 assert.ok(!/OSMの地理登録だけ/.test(b.attributes.find((x:any)=>x.label==='要注意（C区分）').value));
});

// 2026-11-16 オーナー指示「静岡東分岐線は駿遠駿河線と同じ線路区間になっているが途中から分岐する分のみ。他の分岐線の名称のものは同様」：
// 分岐線は変電所～分岐元の線上の分岐点（共有ノード）。分岐元の線と同じ線分を持たず、OCCTO の行は分岐元の側の端を「分岐点」と読み替える
test('分岐線は分岐点から先だけを描き、分岐元の線と重ならない',async()=>{
 const {pairs}=await import('../src/chubu-pairs.ts');
 const d=JSON.parse(readFileSync('public/data/chubu-trunk.json','utf8'));
 const seg=(l:any)=>new Set(l.paths.flatMap((p:any)=>p.slice(1).map((q:any,i:number)=>[p[i].join(),q.join()].sort().join('|'))));
 for(const [id,parent] of [['chubu-275-静岡東分岐線','chubu-275-駿遠駿河線'],['chubu-275-静岡西分岐線','chubu-275-遠江駿遠線'],['chubu-275-愛知分岐線','chubu-275-佐久間西幹里線'],['chubu-500-飛騨分岐線','chubu-500-越美幹線']]){
  const l=d.lines.find((x:any)=>x.id===id),p=d.lines.find((x:any)=>x.id===parent);assert.ok(l&&p,id);
  const ps=seg(p);assert.ok(![...seg(l)].some(s=>ps.has(s)),id+' が分岐元と重なる');
  const br=l.connections.find((c:any)=>c.status==='shared-node');assert.ok(br&&!br.facilities.length,id);
  assert.ok(p.paths.flat().some((q:any)=>q.join()===br.position.join()),id+' の分岐点が分岐元の線にない');
  assert.ok(l.attributes.some((a:any)=>a.label==='分岐点の推定'),id);
  assert.ok(pairs.some((r:any)=>r[1]===l.name&&r.includes('分岐点')),id+' の照合表');}
});
// 関開閉所は関西と中部のデータに同じ設備IDで載る。属性は scripts/seki-switchyard.mjs の共通の組で、両方の写しが同じ（2026-11-16 保留121c）
test('関開閉所の中部と関西の写しは同じ設備ID・同じ属性',()=>{
 const k=read('public/data/kansai-trunk.json').facilities.find((f:any)=>f.id==='osm-way-161946848'),c=d.facilities.find((f:any)=>f.id==='osm-way-161946848');
 assert.ok(k&&c);assert.equal(c.assetId,k.assetId);assert.deepEqual(c.attributes,k.attributes);
});
