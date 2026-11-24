import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {reviewedKansaiDay} from '../src/kansai-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const d=read('public/data/kansai-trunk.json'),flow=read('public/data/kansai-flow.json');
const latest=typicalDay(flow);
// 2026-10-06 オーナー指示：西大阪小曽根線＋北豊中線は関西電力送配電の系統図のとおり十字の4区間で描き、OCCTOの合計を西大阪～分岐点に、分岐後は予想潮流の比で按分した推定値を流す
test('all 54 OCCTO Kansai rows map to a drawn route; the 3-substation row is split over the cross (trunk + 3 estimated branches)',()=>{
 const day=reviewedKansaiDay(latest);const rows=day.actual.lines;assert.equal(rows.length,57);
 assert.equal(rows.filter((r:any)=>r.voltageKV===500).length,25);
 for(const r of rows)assert.ok(referenceFlowPath(r,d.lines,false),r.name);
 const cross=d.lines.filter((l:any)=>l.id.startsWith('kansai-275-西大阪十字-'));assert.equal(cross.length,4);for(const l of cross){assert.ok(l.schematic);assert.ok(l.attributes.some((a:any)=>a.label==='分岐点の推定'));}
 const trunk=rows.find((r:any)=>r.name==='北豊中線・西大阪小曽根線')!,branches=rows.filter((r:any)=>['西大阪小曽根線・小曽根支線','北豊中線','下穂積支線'].includes(r.name));assert.equal(branches.length,3);
 const i=trunk.values.findIndex((v:any)=>v!=null);for(const b of branches)assert.match(b.note,/推定値/);
 assert.ok(Math.abs(branches.reduce((s:number,b:any)=>s+(b.values[i]??0),0)-trunk.values[i])<=2);
});
test('full-width parentheses in OCCTO names (若狭幹線（山）) still match the pair table',()=>{
 const day=reviewedKansaiDay(latest);for(const n of ['若狭幹線（山）','若狭幹線（里）','北神線（北摂～４２Ｔ）'])assert.ok(day.actual.lines.some((r:any)=>r.name.normalize('NFKC')===n.normalize('NFKC')),n);
});
test('tower-number ends (42T・17T・109T) are branch points without a facility, with the evidence recorded',()=>{
 for(const n of ['西神支線','西大阪東支線','泉南東大阪線（東大阪～１０９T）']){const l=d.lines.find((x:any)=>x.name===n);assert.ok(l.connections.some((c:any)=>c.status==='shared-node'&&!c.facilities.length),n);assert.ok(l.attributes.some((a:any)=>a.label==='注記'),n);}
});
test('approval pins the dataset; 大河内開閉所 and 大河内発電所 (estimated position); Kansai plants (大飯・高浜・舞鶴…) with feeder lines without OCCTO flow',()=>{
 const a=read('config/kansai-approval.json');assert.equal(createHash('sha256').update(readFileSync('public/data/kansai-trunk.json')).digest('hex'),a.sha256);
 // 2026-10-20 オーナー判断 D：OSM の区画は大河内開閉所（名前を改め、旧名は別名）。発電所は別の設備で推定位置、開閉所に直接つながるとみなす（推測）
 const sw=d.facilities.find((f:any)=>f.id==='osm-way-962796302');assert.equal(sw.name,'大河内開閉所');assert.equal(sw.kind,'switchyard');// 2026-11-17 保留128 K3：印を開閉所に
 assert.ok(sw.attributes.some((x:any)=>x.label==='位置の根拠'));assert.ok(sw.attributes.some((x:any)=>x.label==='位置の確認'&&/開閉所の名称の確認ではない/.test(x.value)));assert.ok(sw.attributes.some((x:any)=>x.label==='別名'&&/大河内発電所/.test(x.value)));
 for(const n of ['大河内線','播磨北線'])assert.ok(d.lines.find((l:any)=>l.name===n).connections.some((c:any)=>c.facilities.some((x:any)=>x.id==='osm-way-962796302'&&x.name==='大河内開閉所')),n);
 const pl=d.facilities.find((f:any)=>f.id==='kansai-place-大河内発電所');assert.equal(pl.kind,'plant');assert.equal(pl.plantType.label,'水力（揚水）');
 assert.ok(pl.attributes.some((x:any)=>x.label==='要注意（位置推定）'));assert.ok(pl.attributes.some((x:any)=>x.label==='系統との接続'&&/推測/.test(x.value)));
 for(const n of ['大飯原子力発電所','高浜原子力発電所','舞鶴火力発電所'])assert.ok(d.facilities.some((f:any)=>f.name===n&&f.kind==='plant'),n);
 const day=reviewedKansaiDay(latest);for(const l of d.lines.filter((l:any)=>l.id.includes('-plant-')))assert.ok(!day.actual.lines.some((r:any)=>r.name.normalize('NFKC')===l.name.normalize('NFKC')&&r.voltageKV===l.voltageKV),l.name);
});
// 2026-10-16 オーナー判断（推測）：熊野幹線（No.88）は系統図のとおり DJ（新宮）の手前の発電所で終わるとし、その発電所を池原発電所とみなして OSM の経路だけで描く。新宮変電所は収録しない
test('熊野幹線 ends at 池原発電所 over OSM ways only (inferred, C tier); 新宮変電所 is gone; 池原 is the same as in 中部 and shares no point with the 中部 line',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');
 const l=d.lines.find((x:any)=>x.id==='ledger-kansai-275-566231021');
 assert.deepEqual(l.connections.map((c:any)=>c.facilities.map((f:any)=>f.id)),[['osm-way-217390429'],[]]);
 assert.equal(l.connections[1].status,'shared-node');
 assert.deepEqual(l.osmIds,[566231021,566231022,963634008,963637644]);
 assert.ok(l.osmIds.every((x:number)=>x>0)&&!l.schematicParts,'直線（ルート不明）の区間がない');
 const e=evidenceOf(l);assert.equal(e.tier,'C');assert.ok(e.inferred.length&&/池原発電所とみなした/.test(e.inferred[0].basis));
 assert.ok(l.attributes.some((a:any)=>a.label==='容量の注記'&&/DJ→BO/.test(a.value)));
 assert.ok(!d.facilities.some((f:any)=>f.id==='osm-way-562412411'||f.name==='新宮変電所'));
 const chubu=read('public/data/chubu-trunk.json'),pk=d.facilities.find((f:any)=>f.id==='osm-way-217390429');
 assert.deepEqual(pk,chubu.facilities.find((f:any)=>f.id==='osm-way-217390429'));
 // 池原につながる線：関西は熊野幹線だけ、中部は電発の線だけ（池原の構内で同じ母線かは未確認。地域間の連系線にはしない）
 assert.deepEqual(d.lines.filter((x:any)=>x.connections.some((c:any)=>c.facilities.some((f:any)=>f.id===pk.id))).map((x:any)=>x.id),[l.id]);
 assert.ok(!chubu.lines.some((x:any)=>x.id===l.id||x.id.startsWith('tie-')&&x.connections.some((c:any)=>c.facilities.some((f:any)=>f.id===pk.id))));
 const cl=chubu.lines.find((x:any)=>x.id==='jpower-275-way-217390429'),pts=new Set(cl.paths.flat().map((p:number[])=>p.join(',')));
 assert.ok(!l.paths.flat().some((p:number[])=>pts.has(p.join(','))),'熊野幹線と中部の池原の線は点を共有しない');
});
// 2026-10-17 多奈川変電所と多奈川変電所―泉南変電所の送電線（OCCTO 関西の運用容量の行、線名は匿名）。泉南側は泉南東大阪線と同じ4回線の鉄塔の区間を含む1本の経路
test('多奈川変電所 links to 泉南変電所 as one C path (no inferred end, no OCCTO flow) without splitting the 泉南東大阪線 rows',async()=>{
 const {evidenceOf,facilityTierOf}=await import('../src/evidence.ts');const {flowBranches}=await import('../src/flow-path.ts');const {candidateGeometry}=await import('../src/real-domain.ts');
 const l=d.lines.find((x:any)=>x.id==='kansai-osm-275-191880850');assert.ok(l);assert.deepEqual(l.connections.map((c:any)=>c.facilities.map((f:any)=>f.id)),[['osm-way-191880853'],['osm-way-1344336054']]);
 assert.deepEqual(l.osmIds.filter((i:number)=>i>0),[191880850]);assert.ok(l.sourceOsmIds.includes(191880845));assert.equal(l.paths.length,2);
 assert.ok(l.attributes.some((a:any)=>a.label==='照合の根拠'&&/OCCTO の運用容量の行で確定/.test(a.value)));
 const e=evidenceOf(l);assert.equal(e.tier,'C');assert.equal(e.inferred.length,0);const f=d.facilities.find((x:any)=>x.id==='osm-way-1344336054');assert.ok(f);assert.notEqual(facilityTierOf(f),'D');
 const day=reviewedKansaiDay(latest);assert.equal(day.actual.lines.some((r:any)=>candidateGeometry(r,d.lines).some((g:any)=>g.id===l.id)),false);
 for(const r of day.actual.lines.filter((r:any)=>/泉南東大阪線/.test(r.name)))assert.equal(flowBranches(r,d.lines).includes(l.name),false,r.name);
});
// 2026-10-17 紀の川線は紀の川⇒多奈川（OCCTO 関西の運用容量）。以前「紀の川線（推定）」だった紀の川―海南港の線は、ID・経路を変えず匿名の送電線に直した
test('紀の川線 runs 紀の川―多奈川 and the former 紀の川線（推定） is the anonymous 紀の川―海南港 line, both C without inferred ends or OCCTO flow',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const {candidateGeometry}=await import('../src/real-domain.ts');const day=reviewedKansaiDay(latest);
 const k=d.lines.find((x:any)=>x.id==='kansai-osm-275-630117950'),h=d.lines.find((x:any)=>x.id==='ledger-infer-kansai-275-291678113');assert.ok(k&&h);
 assert.equal(k.name,'紀の川線');assert.deepEqual(k.connections.map((c:any)=>c.facilities[0].id),['osm-way-291678103','osm-way-1344336054']);
 assert.equal(h.name,'紀の川変電所―海南港変電所の送電線');assert.equal(h.named,false);assert.deepEqual(h.osmIds,[291678113,483206731]);assert.deepEqual(h.connections.map((c:any)=>c.facilities[0].id),['osm-way-291678103','osm-way-1328548241']);
 for(const l of [k,h]){const e=evidenceOf(l);assert.equal(e.tier,'C',l.name);assert.equal(e.inferred.length,0,l.name);assert.equal(day.actual.lines.some((r:any)=>candidateGeometry(r,d.lines).some((g:any)=>g.id===l.id)),false,l.name);}
 for(const l of [k,h])assert.ok(l.attributes.some((a:any)=>a.label==='照合の根拠'&&/OCCTO の運用容量の行で確定/.test(a.value))&&!l.attributes.some((a:any)=>/端点を公表資料と照合できない|一次資料で区間・端点を確定できず/.test(a.value)),l.name);
 assert.ok(k.attributes.some((a:any)=>/No.81/.test(a.value)));assert.ok(!h.attributes.some((a:any)=>a.label==='公表の行'&&/No.81/.test(a.value)));assert.equal(d.lines.filter((x:any)=>x.name==='紀の川線').length,1);
});
// 2026-10-18 空容量一覧 No.57 宮津線（発電所→AS、AS は読み解けない）を、宮津エネルギー研究所から出る275kVの唯一の線に推定で対応付けた。ID・経路・接続は不変
test('宮津線 is the only 275kV line out of 宮津エネルギー研究所, matched to capacity-list No.57 as C with 推測',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');const l=d.lines.find((x:any)=>x.id==='kansai-plant-275-way-1029051469');assert.ok(l);
 assert.equal(l.name,'宮津線');assert.deepEqual(l.osmIds,[320444666,324539811]);assert.deepEqual(l.connections.map((c:any)=>c.facilities[0]?.id),['osm-way-1029051469','osm-relation-11529637']);
 const e=evidenceOf(l);assert.equal(e.tier,'C');assert.ok(e.inferred.length>0);assert.equal(l.statusCheck,undefined);
 assert.ok(l.attributes.some((a:any)=>a.label==='公表の行'&&/No\.57/.test(a.value)&&/実績ではない/.test(a.value)));
 assert.ok(!read('public/data/undrawn-sections.json').rows.some((r:any)=>r.region==='kansai'&&r.no==='57'));
});
