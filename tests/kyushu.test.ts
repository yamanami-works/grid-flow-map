import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {reviewedKyushuDay} from '../src/kyushu-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const d=read('public/data/kyushu-trunk.json'),flow=read('public/data/kyushu-flow.json');
const latest=typicalDay(flow);
test('all 71 OCCTO Kyushu rows (500kV 12, 220kV 59) map to a drawn route, including names with full-width spaces (海　崎　線)',()=>{
 const day=reviewedKyushuDay(latest);const rows=day.actual.lines;assert.equal(rows.length,71);
 assert.equal(rows.filter((r:any)=>r.voltageKV===500).length,12);
 for(const r of rows)assert.ok(referenceFlowPath(r,d.lines,false),r.name);
 assert.ok(rows.some((r:any)=>r.name.replace(/[\s　]/g,'')==='海崎線'));
});
test('facilities named from location or a misspelled OSM name carry their evidence (速見・川薩・川内・西佐世保・一ツ瀬・大平)',()=>{
 for(const n of ['速見変電所','川薩開閉所','川内変電所','西佐世保変電所','一ツ瀬変電所','大平開閉所']){const f=d.facilities.find((x:any)=>x.name===n);assert.ok(f,n);assert.ok(f.attributes.some((a:any)=>a.label==='名称・位置の根拠'),n);}
});
test('approval pins the dataset; plants (玄海原子力・川内原子力・松浦火力…) with feeder lines and no OCCTO flow',()=>{
 const a=read('config/kyushu-approval.json');assert.equal(createHash('sha256').update(readFileSync('public/data/kyushu-trunk.json')).digest('hex'),a.sha256);
 for(const n of ['玄海原子力発電所','川内原子力発電所','松浦火力発電所'])assert.ok(d.facilities.some((f:any)=>f.name===n&&f.kind==='plant'),n);
 const day=reviewedKyushuDay(latest);for(const l of d.lines.filter((l:any)=>l.id.includes('-plant-')))assert.ok(!day.actual.lines.some((r:any)=>r.name===l.name&&r.voltageKV===l.voltageKV),l.name);
});
// 2026-10-10 オーナー承認：川薩は系統開閉所（九州電力送配電 基幹系統 系統構成「川薩SWS」）、OSMの「川内電力所」は川内変電所。川薩南九州線・川内分岐線を追加
test('川薩開閉所・川内変電所・川薩南九州線（一次資料：九州電力送配電 27 川内・出水地区）',()=>{
 const sws=d.facilities.find((f:any)=>f.name==='川薩開閉所');assert.equal(sws?.kind,'switchyard');
 assert.equal(d.facilities.find((f:any)=>f.id==='osm-way-237476160').name,'川内変電所');assert.ok(!d.facilities.some((f:any)=>f.name==='川薩変電所'));
 const ends=(n:string)=>d.lines.find((l:any)=>l.name===n).connections.map((c:any)=>c.facilities.map((f:any)=>f.name).join('')||'分岐');
 assert.deepEqual(ends('新鹿児島線'),['新鹿児島変電所','川内原子力発電所']);assert.deepEqual(ends('川内原子力連絡線'),['川薩開閉所','川内原子力発電所']);assert.deepEqual(ends('川薩南九州線'),['川薩開閉所','南九州変電所']);
 assert.deepEqual(ends('川内分岐線'),['分岐','川内変電所']);assert.deepEqual(ends('出水分岐線'),['分岐','出水変電所']);
 const sk=d.lines.find((l:any)=>l.name==='新鹿児島線');assert.ok(!sk.osmIds.some((id:number)=>[700628500,215443524,237475856,609317321].includes(id)));
 assert.ok(!d.lines.some((l:any)=>l.id==='kyushu-plant-220-way-365487155'));
});
// 2026-10-23 オーナー判断（保留3-B「別の設備に分ける」）：大平発電所は大平変電所（OSM の区画「大平水力発電所」）とは別の設備。位置は区画から約130m ずらした推定、変電所に直接つながるとみなす（推測）
test('大平発電所 is a separate plant next to 大平開閉所 (estimated position, inferred connection)',()=>{
 const pl=d.facilities.find((f:any)=>f.id==='kyushu-place-大平発電所');assert.equal(pl.kind,'plant');assert.equal(pl.plantType.label,'水力（揚水）');
 assert.ok(pl.attributes.some((a:any)=>a.label==='要注意（位置推定）'));assert.ok(pl.attributes.some((a:any)=>a.label==='系統との接続'&&/推測/.test(a.value)));
 const sub=d.facilities.find((f:any)=>f.id==='osm-way-216499699');assert.equal(sub.name,'大平開閉所');assert.equal(sub.kind,'switchyard');
 assert.ok(!sub.attributes.some((a:any)=>a.label==='発電設備出力（OSM登録値）'||a.label==='出力の扱い'));assert.ok(pl.attributes.some((a:any)=>a.label==='発電設備出力（OSM登録値）'));
 const t=Math.PI/180,m=6371000*Math.hypot((pl.position[1]-sub.position[1])*t*Math.cos(sub.position[0]*t),(pl.position[0]-sub.position[0])*t);assert.ok(m>100&&m<160,'約130m ずらす：'+m);
});
// 2026-10-24 オーナー承認（保留11）：小丸川発電所（揚水・地下）は OSM の区画の位置（推定）に足し、ひむか変電所に直接つながるとみなす（推測。線は描かない）
test('小丸川発電所 is an estimated plant assumed to connect directly to ひむか変電所',()=>{
 const d=JSON.parse(readFileSync('public/data/kyushu-trunk.json','utf8'));
 const pl=d.facilities.find((f:any)=>f.id==='osm-way-756358390');assert.equal(pl.name,'小丸川発電所');assert.equal(pl.kind,'plant');assert.equal(pl.plantType.label,'水力（揚水）');
 assert.ok(pl.attributes.some((a:any)=>a.label==='要注意（位置推定）'));assert.ok(pl.attributes.some((a:any)=>a.label==='系統との接続'&&/ひむか変電所/.test(a.value)&&/推測/.test(a.value)));
 assert.ok(d.facilities.some((f:any)=>f.id==='osm-way-216953915'&&f.name==='ひむか変電所'));
 assert.ok(!d.lines.some((l:any)=>l.connections.some((c:any)=>c.facilities.some((x:any)=>x.id==='osm-way-756358390'))),'線は描かない');
});
// 2026-10-24 オーナー承認（保留13）：日向幹線は OSM の無名の 500kV way 704876994 と、南の途切れを国土地理院の送電線記号でなぞった経路で描く（以前は約467kmの回り道）。
// 送電線（ひむか～宮崎）は直線から OSM の way 216953913（OSMの線名「小丸川幹線」）に置き換える。端の設備・照合表は変えない
test('日向幹線 runs along the east coast and ひむか～宮崎 follows OSM way 216953913',()=>{
 const d=JSON.parse(readFileSync('public/data/kyushu-trunk.json','utf8'));
 const km=(l:any)=>l.paths.reduce((s:number,p:any)=>s+p.slice(1).reduce((t:number,q:any,i:number)=>t+Math.hypot((q[0]-p[i][0])*111.2,(q[1]-p[i][1])*111.2*Math.cos(q[0]*Math.PI/180)),0),0);
 const hy=d.lines.find((l:any)=>l.id==='kyushu-500-日向幹線'),hm=d.lines.find((l:any)=>l.id==='ledger-infer-kyushu-500-s-osm-way-216953915-osm-way-216956620');
 assert.ok(km(hy)<200,'日向幹線 '+km(hy).toFixed(0)+'km');assert.ok(hy.osmIds.includes(704876994)&&!hy.osmIds.includes(216953913));assert.equal(hy.paths.length,hy.osmIds.length);
 assert.deepEqual(hy.connections.map((c:any)=>c.facilities[0].id),['osm-way-216778426','osm-way-216953915']);
 const near=d.lines.find((l:any)=>l.name==='ひむか新日向線');const pts=new Set(near.paths.flat().map((q:any)=>q.join(',')));assert.ok(!hy.paths.flat().some((q:any)=>pts.has(q.join(','))),'ひむか新日向線と共有点なし');
 const dm=(a:any,b:any)=>6371000*Math.hypot((b[1]-a[1])*Math.PI/180*Math.cos(a[0]*Math.PI/180),(b[0]-a[0])*Math.PI/180);const osmEnd=hy.paths[1].at(-1);assert.ok(near.paths.flat().every((q:any)=>dm(q,osmEnd)>300),'OSMの線の南端はひむか新日向線から300m以上');
 assert.ok(!d.lines.find((l:any)=>l.id==='plant-kyushu-500-213736246').attributes.some((a:any)=>/日向幹線/.test(a.value)),'苓北火力線の説明に日向幹線が残らない');
 assert.deepEqual(hm.osmIds,[216953913]);assert.ok(!hm.schematic);assert.equal(hm.attributes.find((a:any)=>a.label==='照合区分').value,'C区分');assert.ok(!hm.attributes.some((a:any)=>a.label.startsWith('要注意（D区分')));
 assert.deepEqual(hm.connections.map((c:any)=>c.facilities[0].id),['osm-way-216953915','osm-way-216956620']);assert.equal(hm.name,'送電線（ひむか変電所～宮崎変電所）');
});
// 2026-10-25 オーナー指示（保留22）：新鹿児島線は新鹿児島変電所～川内原子力発電所、川内原子力連絡線は発電所～川薩開閉所の別の線。
// OCCTOの行（新鹿児島ss→川薩ss）は終点を発電所と読み替えて新鹿児島線だけに当てる。発電所から東の2本は国土地理院の記号の位置で、点を共有しない
test('新鹿児島線と川内原子力連絡線は別の線で、潮流は新鹿児島線だけに当たる',()=>{
 const sk=d.lines.find((l:any)=>l.id==='kyushu-220-新鹿児島線'),rl=d.lines.find((l:any)=>l.id==='kyushu-plant-220-川内原子力連絡線');
 assert.ok(sk&&rl);assert.ok(!('flowVia' in sk));
 const row=reviewedKyushuDay(latest).actual.lines.find((r:any)=>r.name==='新鹿児島線');assert.equal(row.to,'川内原子力発電所');
 const p=referenceFlowPath(row,d.lines,false)!;assert.ok(p,'参照経路がある');
 const k=(q:number[])=>q.join(',');assert.deepEqual([k(p[0]),k(p.at(-1)!)].sort(),[sk.connections[0].position,sk.connections[1].position].map(k).sort());
 assert.ok(!reviewedKyushuDay(latest).actual.lines.some((r:any)=>referenceFlowPath(r,[rl],false)),'連絡線には潮流を当てない');
 const sp=new Set(sk.paths.flat().map(k));assert.ok(!rl.paths.flat().some((q:number[])=>sp.has(k(q))),'2本は点を共有しない');
 for(const l of [sk,rl])assert.equal(l.attributes.find((a:any)=>a.label==='照合区分').value,'C区分');
 assert.ok(sk.attributes.some((a:any)=>a.label==='潮流の読み替え'));assert.ok(rl.attributes.some((a:any)=>a.label==='名称・経路の照合'&&/推定/.test(a.value)));
 const plant=d.facilities.find((f:any)=>f.name==='川内原子力発電所');assert.ok(plant.attributes.some((a:any)=>a.label==='接続する220kVの線'));
});
// 2026-10-25 オーナー指示：諫早分岐線は諫早変電所～長崎幹線との分岐点（武雄変電所ではない）。潮流は分岐線の区間だけ、長崎幹線には当てない。大平は開閉所
test('諫早分岐線は諫早変電所から長崎幹線との分岐点までで、潮流は分岐線の区間だけ',()=>{
 const l=d.lines.find((x:any)=>x.id==='kyushu-220-諫早分岐線'),nk=d.lines.find((x:any)=>x.name.replace(/[\s　]/g,'')==='長崎幹線');
 assert.equal(l.connections[0].facilities[0].name,'諫早変電所');assert.equal(l.connections[1].status,'shared-node');assert.equal(l.connections[1].facilities.length,0);
 assert.ok(nk.paths.flat().some((q:number[])=>q.join()===l.connections[1].position.join()),'分岐点は長崎幹線の頂点');
 assert.ok(!l.osmIds.some((id:number)=>nk.osmIds.includes(id)),'長崎幹線と重ねない');
 assert.equal(l.attributes.find((a:any)=>a.label==='照合区分').value,'C区分');assert.ok(l.attributes.some((a:any)=>a.label==='分岐点の推定'));
 const row=reviewedKyushuDay(latest).actual.lines.find((r:any)=>r.name==='諫早分岐線');const p=referenceFlowPath(row,d.lines,false)!;assert.ok(p);
 const k=(q:number[])=>q.join(),own=new Set(l.paths.flat().map(k));assert.ok(p.every(q=>own.has(k(q))),'参照経路は分岐線の点だけ');
 assert.ok(!JSON.stringify(d).includes('大平変電所')||[...JSON.stringify(d).matchAll(/大平変電所/g)].length===(JSON.stringify(d.facilities.find((x:any)=>x.id==='osm-way-216499699').attributes.find((a:any)=>a.label==='名称の根拠'))?.match(/大平変電所/g)?.length??0),'旧名は名称の根拠だけ');
 const ty=d.facilities.find((x:any)=>x.id==='osm-way-216499699');assert.equal(ty.name,'大平開閉所');assert.equal(ty.kind,'switchyard');
});
// 2026-10-25 オーナー指示④（保留25）：九州の「～分岐線」11本は、片方の端が分岐元の線上の分岐点（共有ノード）。潮流は分岐線の区間だけ（宮崎分岐線は起点側が分岐点）
test('九州の分岐線11本は変電所～分岐元の線上の分岐点で、潮流は分岐線の区間だけ',()=>{
 const names=['苅田分岐線','久留米分岐線','宮崎分岐線','弓削分岐線','速見分岐線','北熊本分岐線','霧島分岐線','古賀分岐線','東佐世保分岐線','北長崎分岐線','八代分岐線'];
 const day=reviewedKyushuDay(latest).actual.lines,k=(q:number[])=>q.join();
 for(const n of names){const l=d.lines.find((x:any)=>x.name===n);assert.ok(l,n);
  const br=l.connections.filter((c:any)=>c.status==='shared-node'&&!c.facilities.length);assert.equal(br.length,1,n+'：分岐点は1つ');
  const pn=l.attributes.find((a:any)=>a.label==='分岐点の推定').value.match(/^(.+?)との分岐点/)[1],par=d.lines.find((x:any)=>x.name.replace(/[\s　]/g,'')===pn);
  assert.ok(par&&par.paths.flat().some((q:number[])=>k(q)===k(br[0].position)),n+'：分岐点は分岐元の線（'+pn+'）の頂点');
  if(n==='宮崎分岐線')assert.equal(l.connections[0].status,'shared-node');
  assert.equal(l.attributes.find((a:any)=>a.label==='照合区分').value,'C区分',n);assert.ok(l.attributes.some((a:any)=>a.label==='分岐点の推定'),n);
  const row=day.find((r:any)=>r.name.replace(/[\s　]/g,'')===n);assert.ok(row,n+'：OCCTOの行');const p=referenceFlowPath(row,d.lines,false);assert.ok(p,n+'：参照経路');
  const own=new Set(l.paths.flat().map(k));assert.ok(p!.every(q=>own.has(k(q))),n+'：参照経路は分岐線の点だけ');}
});
// 2026-10-25 オーナー指示・承認（保留30）：東九州変電所では、日向幹線（南西から）と東九州幹線（北西から）が国土地理院の送電線記号どおり変電所の中の枠の別々の角に入り、2本はつながらない
test('日向幹線と東九州幹線は東九州変電所の中の別々の角に入り、点を共有しない',()=>{
 const hy=d.lines.find((l:any)=>l.id==='kyushu-500-日向幹線'),ek=d.lines.find((l:any)=>l.id==='kyushu-500-東九州幹線');
 const SW=[33.134452,131.728477],NW=[33.134887,131.728595];
 for(const l of [hy,ek]){assert.equal(l.connections[0].facilities[0].id,'osm-way-216778426',l.name);assert.equal(l.paths.length,l.osmIds.length,l.name);}
 assert.deepEqual(hy.connections[0].position,SW);assert.deepEqual(ek.connections[0].position,NW);
 assert.ok(!(hy.schematicParts??[]).some((p:any)=>p.osmId===-9900011),'日向幹線の東九州側の引き込みは実線');
 const pts=new Set(hy.paths.flat().map((q:any)=>q.join(',')));assert.ok(!ek.paths.flat().some((q:any)=>pts.has(q.join(','))),'点を共有しない');
 const rows=reviewedKyushuDay(latest).actual.lines;
 for(const [name,corner] of [['日向幹線',SW],['東九州幹線',NW]] as const){const r=rows.find((x:any)=>x.name===name);const p=referenceFlowPath(r,d.lines,false)!;assert.ok(p,name);
  assert.ok([p[0],p.at(-1)].some((q:any)=>q[0]===corner[0]&&q[1]===corner[1]),name+'の参照経路の東九州側の端');}
});
// 2026-10-25 オーナー指示・承認（保留31）：送電線（新大分変電所～東大分変電所）（直線）は新大分連絡線と重複するので外し、新大分連絡線を新大分変電所の区画の中まで延ばす
test('新大分～東大分の直線の線はなく、新大分連絡線が新大分変電所と東大分変電所をつなぐ',()=>{
 assert.ok(!d.lines.some((l:any)=>l.id==='ledger-infer-kyushu-220-s-osm-way-1199776835-osm-way-1199776830'),'直線の線は外した');
 const l=d.lines.find((x:any)=>x.id==='kyushu-plant-220-way-216781917');
 assert.deepEqual(l.connections.map((c:any)=>c.facilities[0].id),['osm-way-1199776835','osm-way-1199776830']);
 assert.equal(l.paths.length,l.osmIds.length);assert.ok(l.attributes.some((a:any)=>a.label==='公表の行との対応（推定）'));
 assert.ok(d.facilities.some((f:any)=>f.id==='osm-way-1199776835'),'新大分変電所は残る');
 const p=d.facilities.find((f:any)=>f.id==='osm-way-216781917');assert.ok(p,'新大分発電所は残る');assert.match(p.attributes.find((a:any)=>a.label==='系統との接続').value,/新大分変電所.*直接つながるとみなした（推測）/);
});
// 2026-10-25 オーナー指示・承認（保留31 案B1）：東大分線の東大分変電所側は OSM の東大分線の線分で区画の中の建屋まで
test('東大分線の東大分変電所側は区画の中の建屋（node 13854906705）まで延び、新大分連絡線と点を共有しない',()=>{
 const e=d.lines.find((l:any)=>l.id==='kyushu-220-東大分　線'),k=d.lines.find((l:any)=>l.id==='kyushu-plant-220-way-216781917');
 assert.equal(e.connections[0].node,13854906705);assert.equal(e.connections[0].facilities[0].id,'osm-way-1199776830');assert.equal(e.paths.length,e.osmIds.length);
 const pts=new Set(k.paths.flat().map((q:any)=>q.join(',')));assert.ok(!e.paths.flat().some((q:any)=>pts.has(q.join(','))));
 const r=reviewedKyushuDay(latest).actual.lines.find((x:any)=>x.name.replace(/[\s　]/g,'')==='東大分線');assert.ok(r&&referenceFlowPath(r,d.lines,false));
});
// 区画の座標は OSM way 1199776830「東大分変電所」（data/raw/kyushu-osm/facilities.json、2026-10-02時点）
test('東大分線の東大分変電所側の端は区画の中',()=>{
 const e=d.lines.find((l:any)=>l.id==='kyushu-220-東大分　線'),[y,x]=e.connections[0].position;
 const poly=[[33.263508,131.690175],[33.263594,131.6905],[33.263588,131.690649],[33.261723,131.691334],[33.261586,131.690854]];
 const inside=poly.reduce((b:boolean,[y1,x1],i)=>{const [y2,x2]=poly[(i+1)%poly.length];return ((y1>y)!==(y2>y))&&x<(x2-x1)*(y-y1)/(y2-y1)+x1?!b:b;},false);assert.ok(inside);
});
// 2026-10-26 オーナー指示：新小倉火力発電所の連系線は、到津変電所から北へ東に曲がる所まで地中（点線）
test('新小倉火力発電所の連系線の到津側3線分は地中（点線）',()=>{
 const l=d.lines.find((x:any)=>x.id==='kyushu-plant-220-way-605420902');
 assert.deepEqual([...l.cableOsmIds].sort(),[1517852070,1517856236,1517856237]);assert.ok(l.attributes.some((a:any)=>a.label==='地中区間'));
});
// 2026-10-26 オーナー判断：一ツ瀬発電所・大分共同発電所・戸畑共同発電所は発電所だけを置き、送電線は描かない
test('一ツ瀬・大分共同・戸畑共同の発電所があり、つながる線はない',()=>{
 for(const id of ['kyushu-place-一ツ瀬発電所','osm-way-744431833','osm-way-605420901']){const p=d.facilities.find((f:any)=>f.id===id);assert.ok(p&&p.kind==='plant',id);
  assert.ok(!d.lines.some((l:any)=>l.connections.some((c:any)=>c.facilities.some((x:any)=>x.id===id))),id);assert.match(p.attributes.find((a:any)=>a.label==='系統との接続').value,/送電線は描かない/);
  assert.ok(!JSON.stringify(p).match(/製鉄|新日鉄|東田/),id+'：需要家の実名を出さない');}
 const sub=d.facilities.find((f:any)=>f.id==='osm-way-231759891');assert.equal(sub.kind,'substation');assert.ok(!sub.attributes.some((a:any)=>a.label==='発電設備出力（OSM登録値）'));
 const l=d.lines.find((x:any)=>x.id==='kyushu-plant-220-way-605420902');assert.ok(!l.cableOsmIds.includes(1517852073),'東の区間は架空');
});
