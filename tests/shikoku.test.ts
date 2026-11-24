import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {reviewedShikokuDay} from '../src/shikoku-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';import {lineWidth,lineWidthProfile} from '../src/line-style.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const d=read('public/data/shikoku-trunk.json'),flow=read('public/data/shikoku-flow.json');
const latest=typicalDay(flow);
test('all 25 OCCTO Shikoku rows (500kV 4, 187kV 21) map to a drawn route',()=>{
 const day=reviewedShikokuDay(latest);const rows=day.actual.lines;assert.equal(rows.length,25);
 assert.equal(rows.filter((r:any)=>r.voltageKV===500).length,4);
 for(const r of rows)assert.ok(referenceFlowPath(r,d.lines,false),r.name);
});
test('OSM areas with misleading names are renamed with evidence (川内変電所・阿南変換所)',()=>{
 for(const n of ['川内変電所','阿南変換所']){const f=d.facilities.find((x:any)=>x.name===n);assert.ok(f,n);assert.ok(f.attributes.some((a:any)=>a.label==='名称・位置の根拠'),n);}
 assert.ok(!d.facilities.some((f:any)=>/周波数変換所|川内発電所/.test(f.name)));
});
test('Shikoku 187kV is drawn as the second trunk tier (same as Hokkaido 187kV), other 187kV stays default',()=>{
 const l=d.lines.find((x:any)=>x.voltageKV===187);assert.equal(lineWidthProfile(l,[],d.lines),'shikoku');
 assert.equal(lineWidth(187,'shikoku','ac'),3.5);assert.equal(lineWidth(187,'default','ac'),2.8);
});
test('approval pins the dataset; plants (伊方原子力・橘湾…) with feeder lines and no OCCTO flow; 新居浜西 named from its English name',()=>{
 const a=read('config/shikoku-approval.json');assert.equal(createHash('sha256').update(readFileSync('public/data/shikoku-trunk.json')).digest('hex'),a.sha256);
 for(const n of ['伊方原子力発電所','橘湾火力発電所','新居浜西火力発電所'])assert.ok(d.facilities.some((f:any)=>f.name===n&&f.kind==='plant'),n);
 const day=reviewedShikokuDay(latest);for(const l of d.lines.filter((l:any)=>l.id.includes('-plant-')))assert.ok(!day.actual.lines.some((r:any)=>r.name===l.name&&r.voltageKV===l.voltageKV),l.name);
});
// 2026-10-18 空容量一覧の伏せ字（変8＝国府・変10＝阿南・変12＝井川）を読み解き、No.37 阿南火力線・No.38 阿南幹線・No.36 蔭平線を推定で対応付けた。
// 以前の「阿南火力線（推定）」は ID を残して阿南幹線に直した（経路は way 463775144 の全体）。蔭平線とは交点でつながない
test('阿南火力線・阿南幹線・蔭平線 follow the capacity-list rows (ends confirmed by the system map) as C without OCCTO flow; 蔭平線 reaches 蔭平変電所 along the GSI line',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const {candidateGeometry}=await import('../src/real-domain.ts');const day=reviewedShikokuDay(latest);
 const by=(id:string)=>d.lines.find((x:any)=>x.id===id);const kar=by('shikoku-plant-187-way-605689959'),kan=by('ledger-infer-shikoku-187-463775144'),kg=by('shikoku-osm-187-722648701');assert.ok(kar&&kan&&kg);
 assert.equal(kar.name,'阿南火力線');assert.deepEqual(kar.connections.map((c:any)=>c.facilities[0]?.id),['osm-way-605689959','osm-way-309044203']);
 assert.equal(kan.name,'阿南幹線');assert.deepEqual(kan.osmIds,[463775144]);assert.deepEqual(kan.connections.map((c:any)=>c.facilities[0]?.id),['osm-way-492707500','osm-way-1037463547']);
 assert.equal(kg.name,'蔭平線');assert.deepEqual(kg.osmIds,[-7226487011,722648701,1023600792,844748245,1023830421,1023600789]);assert.deepEqual(kg.schematicParts,[{osmId:-7226487011,construction:'unknown'}]);
 assert.deepEqual(kg.connections.map((c:any)=>[c.status,c.facilities[0]?.id]),[['facility-area','osm-way-1037463543'],['facility-area','osm-way-309044203']]);
 // 2026-10-18 オーナー指示：国府変電所の手前からは阿南火力線と共架（OSM way 1023830421 は3回線＝2回線＋1回線）
 assert.deepEqual(kg.paths.slice(-2),kar.paths.slice(-2));assert.equal(kg.connections[1].node,kar.connections[1].node);
 for(const w of [1023830421,1023600789])assert.deepEqual(d.lines.filter((x:any)=>x.osmIds.map(Math.abs).includes(w)).map((x:any)=>x.id).sort(),[kar.id,kg.id].sort(),"共架の way "+w+" を使うのは阿南火力線と蔭平線だけ");
 const kgf=d.facilities.find((f:any)=>f.id==='osm-way-1037463543');assert.equal(kgf.name,'蔭平変電所');assert.equal(kgf.kind,'substation');assert.deepEqual(kgf.voltages,[187,66]);
 // 南の約3.3kmは国土地理院の送電線記号をなぞった点（OSM の way 722648701 の南側は使わない）
 assert.ok(kg.paths[1].some((p:any)=>p[0]===33.8099534&&p[1]===134.2934002));assert.ok(!kg.paths.flat().some((p:any)=>p[0]===33.8126495&&p[1]===134.2940004));
 for(const l of [kan,kg])assert.ok(!l.connections.some((c:any)=>c.node===9430205014),l.name);
 // 推測は、阿南火力線（阿南側の端が阿南火力変電所の区画に着いていない）だけ。阿南幹線・蔭平線は両端が一次資料の変電所
 for(const [l,no,guess] of [[kar,'No.37',true],[kan,'No.38',false],[kg,'No.36',false]] as const){const e=evidenceOf(l);assert.equal(e.tier,'C',l.name);assert.equal(e.inferred.length>0,guess,l.name);
  assert.ok(l.attributes.some((a:any)=>a.label==='公表の行'&&a.value.includes(no)),l.name);assert.equal(l.statusCheck,undefined,l.name);
  assert.equal(day.actual.lines.some((r:any)=>candidateGeometry(r,d.lines).some((g:any)=>g.id===l.id)),false,l.name);}
 assert.ok(!d.lines.some((l:any)=>l.name==='阿南火力線（推定）'));assert.ok(!d.facilities.some((f:any)=>f.kind==='converter'&&kan.connections.some((c:any)=>c.facilities[0]?.id===f.id)));
 const und=read('public/data/undrawn-sections.json').rows;for(const no of ['36','37','38'])assert.ok(!und.some((r:any)=>r.region==='shikoku'&&r.no===no),no);
});
// 2026-10-23 オーナー判断（保留3-C）：本川発電所（地下式）は地理院の注記の位置（推定）に、本川変電所とは別の設備として足し、変電所に直接つながるとみなす（推測）
test('本川発電所 is a separate underground plant next to 本川変電所 (estimated position, inferred connection)',()=>{
 const s=JSON.parse(readFileSync('public/data/shikoku-trunk.json','utf8'));
 const pl=s.facilities.find((f:any)=>f.id==='shikoku-place-本川発電所');assert.equal(pl.kind,'plant');assert.equal(pl.plantType.label,'水力（揚水）');
 assert.ok(pl.attributes.some((a:any)=>a.label==='要注意（位置推定）'));assert.ok(pl.attributes.some((a:any)=>a.label==='系統との接続'&&/推測/.test(a.value)));
 assert.equal(s.facilities.find((f:any)=>f.id==='osm-way-1037463614').name,'本川変電所');
 const u=JSON.parse(readFileSync('public/data/plant-units.json','utf8')).plants['shikoku-place-本川発電所'];assert.equal(u.units.length,2);
});
