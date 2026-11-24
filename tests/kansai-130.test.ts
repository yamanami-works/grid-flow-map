// 保留130（2026-11-18 オーナー回答「3は関西だけ」「5はOk」「1は姫路周り以外は実施してよい」）：関西の北側の線（scripts/kansai-130.mjs）
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';
const read=(f:string)=>JSON.parse(readFileSync('public/data/'+f,'utf8'));
test('富南変電所はなく、新北陸幹線は城端開閉所まで、もう1本は共有ノードで止まる',()=>{
 const k=read('kansai-trunk.json');assert.ok(!k.facilities.some((f:any)=>f.id==='osm-way-324055341'));
 const l=k.lines.find((x:any)=>x.id==='ledger-kansai-275-320560150');assert.deepEqual(l.connections.map((c:any)=>c.facilities[0]?.name).sort(),['城端開閉所','新愛本変電所']);
 const m=k.lines.find((x:any)=>x.id==='ledger-kansai-275-320560153');assert.deepEqual(m.connections.map((c:any)=>c.status).sort(),['facility-area','shared-node']);
});
test('推定の端点の線には推測の印が付く（原則2）',()=>{
 const k=read('kansai-trunk.json');
 for(const id of ['ledger-kansai-275-320560153','kansai-275-way-256682326','plant-hokuriku-275-1028287103','jpower-275-way-440218167']){
  const l=k.lines.find((x:any)=>x.id===id);assert.ok(l,id);assert.ok(evidenceOf(l).inferred.length>0,id+' に推測の印がない');assert.equal(evidenceOf(l).tier,'C',id);}
});
test('移した2本は関西だけにあり、名前と属性が一覧に合う',()=>{
 const k=read('kansai-trunk.json'),h=read('hokuriku-trunk.json'),c=read('chubu-trunk.json');
 const a=k.lines.find((x:any)=>x.id==='plant-hokuriku-275-1028287103'),b=k.lines.find((x:any)=>x.id==='jpower-275-way-440218167');
 assert.equal(a.name,'新北陸幹線（成出～城端）');assert.equal(b.name,'御母衣北幹線');
 assert.ok(!h.lines.some((x:any)=>x.id===a.id)&&!c.lines.some((x:any)=>x.id===b.id));
 // 移した設備（新成出水力発電所・御母衣発電所）は関西だけ。城端開閉所は北陸と関西の両方（関開閉所と同じ扱い）
 assert.ok(!h.facilities.some((x:any)=>x.id==='osm-way-440225776')&&!c.facilities.some((x:any)=>x.id==='osm-way-440218167'));
 for(const id of ['osm-way-440225776','osm-way-440218167','osm-way-315757225'])assert.ok(k.facilities.some((x:any)=>x.id===id),id);
 assert.ok(h.facilities.some((x:any)=>x.id==='osm-way-315757225'));
 for(const l of [a,b]){const at=(n:string)=>l.attributes.find((x:any)=>x.label===n)?.value??'';
  assert.match(at('出典'),/154kV以上の系統図/);assert.doesNotMatch(at('照合の根拠'),/公表区間なし/);assert.match(at('収録の地域（2026-11-18）'),/関西のデータに移した/);}
 assert.equal(k.lines.filter((x:any)=>x.name==='大黒部幹線').length,1);
});
// 2026-11-18 オーナー回答「130-2＋7は案aでokだが選択すると分岐した各々の回線含めた全体が選択されるようにして(2回線の新北陸幹線の纏まりとする)」
test('新北陸幹線（No.214）の2本は同じ選択のまとまりで、選ぶと2本を一緒に強調する',()=>{
 const all=['kansai','hokuriku','chubu','tokyo','tohoku','kyushu','shikoku','chugoku'].flatMap(r=>read(r+'-trunk.json').lines);
 const g=all.filter((x:any)=>x.selectGroup);assert.deepEqual(g.map((x:any)=>x.id).sort(),['ledger-kansai-275-320560150','ledger-kansai-275-320560153']);
 assert.equal(new Set(g.map((x:any)=>x.selectGroup)).size,1);
 const src=readFileSync('src/real.ts','utf8');assert.match(src,/l\.selectGroup === selected\.selectGroup/);
});
// 2026-11-18 オーナー指示「城端開閉所～新愛本変電所の新北陸幹線なので、新愛本変電所から黒部第四発電所までの送電線は一緒に選択されないようにして」
test('選択のまとまりの新北陸幹線に黒四側の線分を含めない',()=>{
 const k=read('kansai-trunk.json'),K=[618344814,1239288599,1239288600,761185974,572566517];
 for(const id of ['ledger-kansai-275-320560150','ledger-kansai-275-320560153']){const l=k.lines.find((x:any)=>x.id===id);assert.ok(!l.osmIds.some((o:number)=>K.includes(Math.abs(o))),id);}
 const kuro=k.lines.find((x:any)=>x.id==='extra-kansai-275-572566514');assert.ok(K.every(o=>kuro.osmIds.map(Math.abs).includes(o)));assert.ok(!kuro.selectGroup);
 assert.deepEqual(kuro.connections.map((c:any)=>c.facilities[0]?.name??c.status),['黒部川第四発電所','shared-node']);
});
// 2026-11-18 保留130-10（回答「4はOK」「No210はNo208新北陸幹線の分岐として描いて。下小鳥の線は推奨でOK」）
test('No.208・No.210（分岐）と御母衣第二・鳩谷・下小鳥の発電所と電源線',()=>{
 const k=read('kansai-trunk.json'),L=(id:string)=>k.lines.find((x:any)=>x.id===id),F=(id:string)=>k.facilities.find((x:any)=>x.id===id);
 const ends=(l:any)=>l.connections.map((c:any)=>c.facilities[0]?.name??c.status);
 assert.deepEqual(ends(L('kansai-275-way-1028287090')),['御母衣発電所','新成出水力発電所']);assert.equal(L('kansai-275-way-1028287090').name,'新北陸幹線（御母衣～成出）');
 const b=L('kansai-275-way-1028287067');assert.deepEqual(ends(b),['鳩谷発電所','shared-node']);
 // 分岐点は No.208 の経路の上の点
 const cut=b.connections[1].position;assert.ok(L('kansai-275-way-1028287090').paths.some((p:any)=>p.some((q:any)=>q[0]===cut[0]&&q[1]===cut[1])));
 assert.deepEqual(ends(L('kansai-plant-275-way-829531888')),['下小鳥発電所','鳩谷発電所']);
 assert.deepEqual(ends(L('kansai-plant-275-way-1028287092')),['御母衣第二発電所','御母衣発電所']);
 for(const id of ['kansai-275-way-1028287090','kansai-275-way-1028287067','kansai-plant-275-way-829531888','kansai-plant-275-way-1028287092']){const l=L(id);assert.equal(evidenceOf(l).tier,'C',id);assert.ok(evidenceOf(l).inferred.length>0,id+' に推測の印がない');}
 for(const id of ['kansai-place-御母衣第二発電所','kansai-place-下小鳥発電所']){const f=F(id);assert.ok(f.attributes.some((a:any)=>a.label==='要注意（位置推定）'));assert.doesNotMatch(f.attributes.find((a:any)=>a.label==='位置の根拠').value,/\d+m/);}
 // 種別は一次資料で未確認なので出さない
 for(const id of ['osm-way-1028287061','kansai-place-下小鳥発電所'])assert.ok(!F(id).plantType,id);
 // 御母衣第二は J-POWER 水力発電所一覧（2026年7月1日現在）で種別・出力を確認（2026-11-18 オーナー指示「御母衣第二の種別と出力を記載して」）
 assert.equal(F('kansai-place-御母衣第二発電所').plantType.label,'水力（ダム水路式）');
 assert.equal(JSON.parse(readFileSync('public/data/plant-profiles.json','utf8')).records.find((p:any)=>p.id==='kansai-place-御母衣第二発電所').capacityMW,59.2);
});
// 2026-11-18 保留131（回答「131-1は描く。持ち主は関西電力でOK」「131-2は案a」）
test('No.204 と新祖山線・祖山の電源線',()=>{
 const k=read('kansai-trunk.json'),L=(id:string)=>k.lines.find((x:any)=>x.id===id),ends=(l:any)=>l.connections.map((c:any)=>c.facilities[0]?.name??c.status);
 assert.deepEqual(ends(L('kansai-275-way-1257806203')),['御母衣発電所','栗東変電所']);assert.match(L('kansai-275-way-1257806203').attributes.find((a:any)=>a.label==='持ち主').value,/^関西電力/);
 assert.equal(L('kansai-275-way-1257806203').schematicParts?.length,1);
 assert.deepEqual(ends(L('kansai-275-way-618344831')),['新祖山発電所','城端開閉所']);
 assert.deepEqual(ends(L('kansai-plant-275-way-1028287114')),['祖山発電所','新祖山発電所']);
 // 祖山・新祖山の種別と出力（関西電力 水力発電所一覧、2026-11-18確認）
 const F=(id:string)=>k.facilities.find((x:any)=>x.id===id),prof=JSON.parse(readFileSync('public/data/plant-profiles.json','utf8')).records;
 assert.equal(F('osm-way-1028287115').plantType.label,'水力（ダム水路式）');assert.equal(F('osm-way-1028287111').plantType.label,'水力（ダム水路式）');
 assert.equal(prof.find((p:any)=>p.id==='osm-way-1028287115').capacityMW,68);assert.equal(prof.find((p:any)=>p.id==='osm-way-1028287111').capacityMW,54.3);
 for(const id of ['kansai-275-way-1257806203','kansai-275-way-618344831','kansai-plant-275-way-1028287114']){const l=L(id);assert.equal(evidenceOf(l).tier,'C',id);assert.ok(evidenceOf(l).inferred.length>0,id);}
});
// 2026-11-18 保留132（回答「推奨どおり」）：丸山・新丸山発電所と新丸山の電源線
test('丸山・新丸山発電所と新丸山発電所の電源線',()=>{
 const k=read('kansai-trunk.json'),L=(id:string)=>k.lines.find((x:any)=>x.id===id),F=(id:string)=>k.facilities.find((x:any)=>x.id===id);
 const l=L('kansai-plant-275-way-192745037');assert.deepEqual(l.connections.map((c:any)=>c.facilities[0]?.name),['新丸山発電所',F('osm-way-192745005').name]);
 assert.equal(evidenceOf(l).tier,'C');assert.ok(evidenceOf(l).inferred.length>0);
 const m=F('kansai-place-丸山発電所');assert.deepEqual(m.voltages,[]);assert.match(m.attributes.find((a:any)=>a.label==='系統との接続').value,/推測/);
 for(const id of ['kansai-place-丸山発電所','kansai-place-新丸山発電所']){assert.equal(F(id).plantType.label,'水力（ダム水路式）');assert.ok(F(id).attributes.some((a:any)=>a.label==='要注意（位置推定）'));}
 const prof=JSON.parse(readFileSync('public/data/plant-profiles.json','utf8')).records;
 assert.equal(prof.find((p:any)=>p.id==='kansai-place-丸山発電所').capacityMW,141);assert.equal(prof.find((p:any)=>p.id==='kansai-place-新丸山発電所').capacityMW,63.7);
});
