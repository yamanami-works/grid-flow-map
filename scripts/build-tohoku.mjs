// 東北の作り直し（2026-10-04）：他のエリアと同じ1区間＝1本のデータ public/data/tohoku-trunk.json と承認ファイルを作る。
// 入力：docs/research/tohoku-adopted.json（tools/prep/adopt-tohoku-all.mjs）、docs/research/tohoku-plants-adopted.json（tools/prep/adopt-plants.mjs REGION=tohoku）、
//       東京データの連系線（相馬双葉幹線）。旧データ public/data/tohoku-trunk-osm.json（OSMの線のまとまり）は置き換える。
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyTiers} from './assign-tiers.mjs';
import {mergeJpower,annotateJpower} from './jpower.mjs';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const adopted=read('docs/research/tohoku-adopted.json');
const source=read('data/raw/tohoku-osm/source.json');
const lines=[...adopted.lines],facilities=adopted.facilities.map(f=>({...f}));
// 基幹系統に接続する発電所（tools/prep/adopt-plants.mjs）
let plants=null;try{plants=read('docs/research/tohoku-plants-adopted.json');}catch{}
if(plants){for(const f of plants.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...plants.lines);
 for(const e of plants.enriched){const f=facilities.find(x=>x.id===e.id);if(f)f.attributes=[...(f.attributes??[]).filter(a=>!e.attributes.some(b=>b.label===a.label)),...e.attributes];}}
// 公表区間のない電源線のうち、発電所の採用（adopt-plants）で線が作られなかったものを作り直し前のデータから引き継ぐ（線のIDと永続IDはそのまま）
// 2026-10-10 オーナー判断「案A」：新仙台火力線（osm-103671668-275）は0129線と同じ鉄塔（OSMでは0129線の東側と同じ「新仙台火力線」の名）なので描かない。
// その経路は0129線の直線の補完に置き換える（docs/research/tohoku-0129-fix.json、tools/fix-tohoku-0129.mjs）。引き継ぐ線はなくなったが、仕組みは残す
const FIX_0129=read('docs/research/tohoku-0129-fix.json');
{const old=read('public/data/tohoku-trunk-osm.json');for(const id of ['osm-103671668-275'].filter(id=>!FIX_0129.dropLineIds.includes(id))){const l=old.lines.find(x=>x.id===id);if(!l||lines.some(x=>x.id===id))continue;
 const conns=l.connections.filter(c=>c.facilities.every(f=>facilities.some(x=>x.id===f.id))).filter(c=>c.facilities.length);
 // 2026-10-10 オーナー承認：connectedWayIds の 829088724・829088725（仙台変電所の構内に入る約100mの275kV線分）は地図のどの線にもないので外す（audit-lines の「接続先ID不在」）
 lines.push({...l,connections:conns,...(l.connectedWayIds?{connectedWayIds:l.connectedWayIds.filter(id=>![829088724,829088725].includes(id))}:{}),attributes:[{label:'要注意（C区分）',value:'公表区間のない電源線。OSMの地理登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},{label:'経路の引き継ぎ',value:`作り直し前のデータの線（${id}）を引き継いだ。東北電力NWの基幹系統の公表区間・OCCTOの行はない。`},...(l.attributes??[]).filter(a=>!/^要注意|^照合区分/.test(a.label))]});}}
// 0129線の経路の付け替え（2026-10-10 オーナー判断「案A」）：仙台変電所までの約8.6kmの直線を、OSMの way 103671668・829088724 と途切れた約240mの直線に置き換える
{const l=lines.find(x=>x.id===FIX_0129.lineId),i=l?.osmIds.indexOf(FIX_0129.replaceOsmId)??-1;if(i<0)throw Error('0129線の直線（-9301）が見つからない');
 l.osmIds=[...l.osmIds.slice(0,i),...FIX_0129.paths.map(p=>p.osmId),...l.osmIds.slice(i+1)];
 l.paths=[...l.paths.slice(0,i),...FIX_0129.paths.map(p=>p.path),...l.paths.slice(i+1)];
 l.connections=l.connections.map(c=>c.facilities.some(f=>f.name==='仙台変電所')?{...c,node:FIX_0129.end.node,position:FIX_0129.end.position}:c);
 const m=FIX_0129.meters,note=(label,value)=>{l.attributes=[...l.attributes.filter(a=>a.label!==label),{label,value}];};
 note('照合の根拠',`OSMの途切れ（約${m.gap}m）を直線で補完。仙台変電所側はOSMで「新仙台火力線」（275kV/154kV・4回線）の名で登録された線分で、0129線の東側と同じ名前・同じ鉄塔とみなした（2026-10-10 オーナー判断）。経路はOSMだけによる（補助資料のみ）。`);
 note('末端の直線',`OSMの275kV線は東仙台変電所から約6.1km進んだ所で約${m.gap}m途切れる。その先は OSM way 103671668（約${(m.way103671668/1000).toFixed(1)}km）と仙台変電所の構内に入る way 829088724（約${m.way829088724}m）。途切れた約${m.gap}mだけ直線（ルート不明）で補完（2026-10-10 に約8.6kmの直線から付け替え）。`);
 note('地理参照',`OSM 5線分（103746659・1052190116・103746719・103671668・829088724）＋直線約${m.gap}m。OSMではどの線分も「新仙台火力線」の名。個別回線・母線は未確認。`);
 note('経路の引き継ぎ','作り直し前のデータの線形（tohoku-section-0129）を引き継ぎ、2026-10-10 に仙台変電所側の直線をOSMの線分に付け替えた（docs/research/tohoku-0129-fix.json）。別に描いていた新仙台火力線（osm-103671668-275）は同じ鉄塔とみなして描かない。');}
// 北海道・本州間電力連系設備（北本）の本州側：電源開発の上北変換所と上北変電所を結ぶ275kV線（2026-10-04 オーナー指摘「上北変換所から上北変電所までのルート」）。
// 東北電力NWの公表区間・OCCTOの行はなく、作り直しで外れていた。作り直し前のデータの線（OSM way 244367606、資産ID）を引き継ぐ。変換所は直流のデータ（tohoku-dc-osm.json）と同じ設備
{const old=read('public/data/tohoku-trunk-osm.json'),dc=read('public/data/tohoku-dc-osm.json'),l=old.lines.find(x=>x.id==='osm-244367606-275'),cv=dc.facilities.find(f=>f.id==='osm-way-714627766'),ss=facilities.find(f=>f.id==='osm-way-714627759');
 if(!l||!cv||!ss)throw Error('上北変換所の連系線の元データがない');
 if(!facilities.some(f=>f.id===cv.id))facilities.push({...cv});
 if(!lines.some(x=>x.id===l.id)){const p=l.paths.flat(),a=p[0],b=p.at(-1),aCv=Math.hypot(a[0]-cv.position[0],a[1]-cv.position[1])<Math.hypot(b[0]-cv.position[0],b[1]-cv.position[1]);
  const km=l.paths.reduce((s,q)=>s+q.slice(1).reduce((t,x,i)=>t+Math.hypot(x[0]-q[i][0],(x[1]-q[i][1])*Math.cos(x[0]*Math.PI/180))*111,0),0);
  lines.push({id:l.id,assetId:l.assetId,name:'上北変換所の連系線',named:false,voltageKV:275,currentType:'ac',osmIds:l.osmIds,paths:l.paths,
   connections:[{node:null,position:aCv?a:b,status:'facility-area',facilities:[{id:cv.id,name:cv.name}],neighborWays:[]},{node:null,position:aCv?b:a,status:'facility-area',facilities:[{id:ss.id,name:ss.name}],neighborWays:[]}],
   referenceReview:{status:'partial',endpoints:'上北変換所―上北変電所'},
   attributes:[{label:'要注意（C区分）',value:'一次資料で区間を確定できず、OSMの地理登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},
    {label:'区分',value:'北海道・本州間電力連系設備（北本、電源開発）の本州側の交流の接続。東北電力NWの基幹系統の公表区間・OCCTOの地内実績の行はない（潮流なし。北本直流幹線の潮流は連系線として表示）。'},
    {label:'地理参照',value:`OSM way 244367606（275kV、6条＝2回線、線名なし、約${km.toFixed(1)}km）。上北変換所の区画の近くから上北変電所の区画まで1本の線分。線名は一次資料で未確認。`},
    {label:'経路の引き継ぎ',value:'作り直し前のデータの線（osm-244367606-275）と資産IDを引き継いだ（2026-10-04）。'},
    {label:'出典',value:'J-POWER送変電 送変電事業地図（上北（交直変換）、https://www.jpower.co.jp/tn/business/map.html 、2026-10-04確認）。地理はOSM（data/raw/tohoku-osm）。'}]});}}
// 地域間連系線：東北東京間の相馬双葉幹線（東京データと同じID）。北海道本州間の直流は tohoku-dc-osm.json のまま
{const tk=read('public/data/tokyo-trunk.json');for(const l of tk.lines.filter(l=>l.id.startsWith('tie-'))){lines.push(l);for(const c of l.connections)for(const x of c.facilities)if(!facilities.some(f=>f.id===x.id)){const f=tk.facilities.find(f=>f.id===x.id)??read('public/data/tohoku-trunk-osm.json').facilities.find(f=>f.id===x.id);if(f)facilities.push({...f});}}}
// 南いわき開閉所は、相馬双葉幹線の接続先から外れた（2026-11-05 保留78）あとも東北のデータに設備として残す（回帰テストの設備ID。線のない設備を除く処理からも外す）
{const tk=read('public/data/tokyo-trunk.json'),f=tk.facilities.find(f=>f.id==='osm-way-253566674');if(!f)throw Error('南いわき開閉所が東京データにない');if(!facilities.some(x=>x.id===f.id))facilities.push({...f});}
// 運用状態（2026-10-03 docs/ASSET_STATUS.md：東北はアプリ側の対応表から、作り直しを機にデータ側へ移す）
const STATUS={
 'osm-way-341478004':{status:'廃止',statusSource:'東北電力：秋田火力発電所は2024年7月1日をもって全設備廃止（public/data/plant-profiles.json の出典）。'},
 'osm-way-103783431':{status:'廃止',retiredAt:'2014-01-31',retiredAtNote:'全号機の廃止日',statusSource:'東京電力ホールディングス：福島第一原子力発電所は2014年1月31日までに全号機廃止（public/data/plant-profiles.json の出典）。'},
 'osm-way-104409614':{status:'廃止',statusSource:'東京電力ホールディングス：福島第二原子力発電所は2019年7月31日に1〜4号機の廃止を決定（public/data/plant-profiles.json の出典）。'},
};
// 廃止の発電所は、線がなくても設備として残す（旧福島第一：作り直し前のデータから引き継ぐ。福島第二は東京データにある）
{const old=read('public/data/tohoku-trunk-osm.json'),tk=read('public/data/tokyo-trunk.json');for(const id of Object.keys(STATUS))if(!facilities.some(f=>f.id===id)&&!tk.facilities.some(f=>f.id===id)){const f=old.facilities.find(f=>f.id===id);if(f)facilities.push({...f});}}
for(const f of facilities)if(STATUS[f.id])Object.assign(f,STATUS[f.id],{statusConfirmed:true});
for(const l of lines)if(l.connections?.some(c=>c.facilities.some(x=>STATUS[x.id]?.status==='廃止'))&&!l.id.startsWith('tie-'))l.statusCheck=`接続先の${l.connections.flatMap(c=>c.facilities).find(x=>STATUS[x.id])?.name}は全号機廃止（設備の「状態の根拠」）。この線の撤去・転用・運用状態は一次資料で確認できていない（OSMの登録のまま表示）。`;
// 照合区分（A〜E）を他のエリアと同じ規則で付ける
// 電源開発の設備（scripts/jpower.mjs、2026-10-04）
mergeJpower('tohoku',lines,facilities);annotateJpower('tohoku',lines,facilities);{const {applyEndFixes}=await import('./end-fixes.mjs');applyEndFixes('tohoku',lines,facilities);}
// 新地火力発電所の印の位置（2026-11-10 オーナー指示「もう少し東側の発電所設備上に」、保留109の113 approver 自動承認）：
// OSM の relation 9626992 の点は石炭置き場の西の川の上だったので、空中写真のボイラー・タービン建屋の中心へ移す。名前は地理院の注記なので RULES 3節「設備の位置」により位置確認済み（属性「位置の確認」。確度 B→A）。線の端（0007線の新地側 node 1912368774）は変えない
{const f=facilities.find(x=>x.id==='osm-relation-9626992');if(!f)throw Error('新地火力発電所がない');
 f.position=[37.8430,140.9452];
 f.attributes=[...(f.attributes??[]).filter(a=>a.label!=='位置の確認'),{label:'位置の確認',value:'国土地理院 シームレス空中写真（撮影年未確認、2026-11-10取得）のボイラー・タービン建屋の中心。名前は国土地理院の地図注記「新地発電所」（北緯37.84396・東経140.94177、開閉所の付近で建屋の中心から約300m 西）。OSM の点（北緯37.84500・東経140.94016）から約450m 東へ移した（2026-11-10 オーナー指示）。送電線の端（0007線の新地側）は変えていないため、線の端は印から約430m 西の開閉所にある。'}];}
// 公表区間の追加（2026-11-10 オーナー回答「記載の通りでOK」、保留114・116）。経路は OSM（data/raw/tohoku-osm、2026-09-30時点）の way の節点そのまま
const OSM_T={};{for(const f of ['lines-500','lines-275','facilities-2']){const d=read(`data/raw/tohoku-osm/${f}.json`);for(const e of d.elements){if(e.type==='node')OSM_T['n'+e.id]=[e.lat,e.lon];else if(e.type==='way')OSM_T['w'+e.id]=e;}}}
const wayPath=id=>{const w=OSM_T['w'+id];if(!w)throw Error('OSM way がない '+id);return w.geometry?w.geometry.map(g=>[g.lat,g.lon]):w.nodes.map(n=>{const p=OSM_T['n'+n];if(!p)throw Error('OSM node がない '+n);return p;});};
const NW='東北電力NW 系統空き容量（基幹系統）2026-07版（sys_capa_kikan01_line_202607_02.csv、2026年7月31日作成）';
// 保留114：0009線。今の「福島ガス発電所の連系線」（OSM way 901872434 の最後の約0.4km だけで、端が新地火力発電所の区画に入り、福島ガス―新地火力をつなぐ形だった）を、
// ID を残して 0009線（0007線の分岐→福島ガス発電所）に直す。分岐点は 0007線（way 180769724）と共有する node 6703565366（新地側から2本目の鉄塔）
{const l=lines.find(x=>x.id==='tohoku-plant-500-way-929016336'),gas=facilities.find(x=>x.id==='osm-way-929016336'),w=OSM_T.w901872434;
 if(!l||!gas||!w||w.nodes[0]!==6703565366||w.nodes.at(-1)!==8377534035)throw Error('0009線の元データが想定と違う');
 const p=wayPath(901872434);
 Object.assign(l,{name:'0009線',named:true,osmIds:[901872434],paths:[p],
  connections:[{node:6703565366,position:p[0],status:'shared-node',facilities:[],neighborWays:[180769724]},{node:8377534035,position:p.at(-1),status:'facility-area',facilities:[{id:gas.id,name:gas.name}],neighborWays:[]}],
  referenceReview:{status:'section',endpoints:'0007線分岐―福島ガス発電所'},
  attributes:[{label:'公表区間',value:NW+' No.0009：0009線（500kV）、2回線、0007線分岐→発電所。OCCTOに行なし（潮流なし）'},
   {label:'端点の根拠',value:'分岐点は、0007線（OSM way 180769724）と共有する OSM node 6703565366（新地側から2本目の鉄塔）とみなした（推定）。終点の発電所は公表資料に名前がなく、OSM の線（way 901872434、500kV・2回線）が入る福島ガス発電所とみなした（推定。HJKS の福島天然ガス発電所 590MW×2。2026-11-10 オーナー承認）。'},
   {label:'地理参照',value:'OSM 1線分（way 901872434、計約2.9km、500kV・2回線）。個別回線・母線は未確認。'},
   {label:'経路の付け替え',value:'2026-11-10 保留114：以前は「福島ガス発電所の連系線」（同じ way の最後の約0.4km、福島ガス発電所―新地火力発電所）として描いていた。端が新地火力発電所の区画に入っていたのは誤りで、公表の 0009線に直した（線のIDと永続IDは引き継ぐ）。'},
   {label:'出典',value:NW+'。地理はOSM（2026-09-30取得 data/raw/tohoku-osm）。'}]});
 gas.attributes=gas.attributes.map(a=>a.label==='系統との接続'?{label:a.label,value:'0009線（500kV、0007線の分岐から。公表の終点「発電所」をこの発電所とみなした・推定）で接続。'}:a).filter(a=>!a.label.startsWith('要注意（C区分）'));}
// 保留116：東福島変電所と東福島支線。変電所は OSM の無名の 275kV の送電用変電所の区画（way 835186162、substation=transmission）。
// 相福幹線の途中の 275kV の変電所はここだけで、相福幹線から2回線の線（way 835186163）が分かれて入るので、公表の「東福島変電所」とみなした（推定）
{const sw=OSM_T.w835186162,g=sw.geometry.map(x=>[x.lat,x.lon]);const pos=[g.reduce((s,x)=>s+x[0],0)/g.length,g.reduce((s,x)=>s+x[1],0)/g.length].map(v=>Math.round(v*1e7)/1e7);
 if(facilities.some(x=>x.id==='osm-way-835186162'))throw Error('東福島変電所は登録済み');
 facilities.push({id:'osm-way-835186162',assetId:'tohoku-fac-way-835186162',name:'東福島変電所',kind:'substation',position:pos,voltages:[275],url:'https://www.openstreetmap.org/way/835186162',scopeConnected:true,
  attributes:[{label:'名称・位置の根拠',value:'OSM の無名の 275kV の送電用変電所の区画（way 835186162、substation=transmission）。'+NW+'の 0137 東福島支線（相福幹線分岐→東福島変電所）と、東北電力NW 系統空容量（基幹系統・変電所、sys_capa_kikan01_tr_202607_02.csv）の「東福島 275/154kV」に、相福幹線から2回線の線が分かれて入る相福幹線沿いでただ一つの 275kV 変電所であることから当てた（推定。国土地理院の地図注記に名前はない。空中写真（撮影年未確認、2026-11-10取得）で変電所と引込の鉄塔を確認。2026-11-10 オーナー承認）。'},
   {label:'運営者',value:'未確認（OSM の登録なし）'}]});
 const sf=lines.find(x=>x.id==='tohoku-section-0136'),p=wayPath(835186163);if(!sf||OSM_T.w835186163.nodes[0]!==1934619405)throw Error('東福島支線の元データが想定と違う');
 if(!sf.paths.flat().some(q=>Math.abs(q[0]-p[0][0])<1e-7&&Math.abs(q[1]-p[0][1])<1e-7))throw Error('東福島支線の分岐点が相福幹線の経路にない');
 // OSM の線は区画の約115m 手前の鉄塔（node 7795851798）で終わる。区画のいちばん近い角まで直線でつなぐ（推定）
 const end=p.at(-1),near=g.reduce((b,x)=>Math.hypot(x[0]-end[0],x[1]-end[1])<Math.hypot(b[0]-end[0],b[1]-end[1])?x:b);
 lines.push({id:'tohoku-275-東福島支線',assetId:'tohoku-275-東福島支線',name:'東福島支線',named:true,voltageKV:275,currentType:'ac',osmIds:[835186163,-8351861631],paths:[p,[end,near]],schematicParts:[{osmId:-8351861631,construction:'unknown'}],
  connections:[{node:1934619405,position:p[0],status:'shared-node',facilities:[],neighborWays:[]},{node:null,position:near,status:'facility-area',facilities:[{id:'osm-way-835186162',name:'東福島変電所'}],neighborWays:[]}],
  referenceReview:{status:'section',endpoints:'相福幹線分岐―東福島変電所'},
  attributes:[{label:'公表区間',value:NW+' No.0137：東福島支線（275kV）、2回線、相福幹線分岐→東福島変電所。OCCTOに行なし（潮流なし）'},
   {label:'端点の根拠',value:'分岐点は、相福幹線の OSM の線と共有する node 1934619405 とみなした（推定）。終点は東福島変電所とみなした OSM の区画（推定、変電所の名称・位置の根拠を参照）。'},
   {label:'地理参照',value:'OSM 1線分（way 835186163、約0.19km、275kV・2回線）＋ OSM の線の端の鉄塔から変電所の区画までの直線 約0.1km（OSM に線がない。空中写真で引込の鉄塔は見える）。個別回線・母線は未確認。'},
   {label:'出典',value:NW+'。地理はOSM（2026-09-30取得 data/raw/tohoku-osm）、国土地理院 空中写真（2026-11-10取得）。'}]});}
const tiers=applyTiers('tohoku',lines,facilities);console.log('tohoku tiers',JSON.stringify(tiers));
// 保留115：アマテラス白石ソーラーパークと電源線（2026-11-10 オーナー指示・回答。一次資料なし＝E区分、照合区分の付け直しのあとに足す）。
// 電源線は蔵王幹線の鉄塔（OSM node 3135722139）からオーナー指定の端点（北緯38.051951・東経140.587374）までの直線（OSM に線がない、推定）。
// 発電所の印はオーナー指示で近くの太陽光パネルの区画の中心（国土地理院 空中写真）に置く
{const zao=lines.find(x=>x.id==='tohoku-section-0126'),br=[38.0536015,140.5877614],tip=[38.051951,140.587374];
 if(!zao?.paths.flat().some(q=>q[0]===br[0]&&q[1]===br[1]))throw Error('蔵王幹線の分岐の鉄塔が経路にない');
 const E_NOTE='この電源線は一次資料（各社の公表資料・HJKS・行政の資料）で確認できていない。電源線の端点はオーナー指示（2026-11-10）。発電所の名前は 2026-11-18 に変更、発電所の種別は行政の資料で確認、出力はオーナー説明。';
 facilities.push({id:'tohoku-place-アマテラス白石ソーラーパーク',assetId:'tohoku-place-アマテラス白石ソーラーパーク',name:'アマテラス白石ソーラーファーム',kind:'plant',plantType:{label:'太陽光',note:'宮城県の事業と同じとみなしたのは推定',source:'宮城県 準備書に係る答申（令和元年7月11日）／知事意見（令和元年8月1日）'},position:[38.0505,140.5939],voltages:[275],url:'',scopeConnected:true,evidenceTier:'E',
  attributes:[{label:'要注意（E区分）',value:'出力（オーナー説明）・電源線の端点・位置はオーナー指示で、一次資料（各社の公表資料・HJKS）で確認できていない。種別（太陽光）は行政の資料（宮城県の答申・知事意見、2026-11-18確認）で確かめた。行政の資料（宮城県の環境影響評価、2026-11-17確認）の「(仮称)アマテラス白石ソーラーファーム建設事業」と、旧名「アマテラス白石ソーラーパーク」が近く所在地（白石市）が同じなので同じ事業とみなした（推定。名前を事業名に合わせたことは同じ事業である根拠ではない）。名前は 2026-11-18 オーナー指示で宮城県の事業名に合わせた（「アマテラス白石ソーラーファーム」。県の事業名は「(仮称)」付きで、正式名は未確認）。'},{label:'位置の根拠',value:'国土地理院 シームレス空中写真（撮影年未確認、2026-11-10取得）の太陽光パネルの区画の中心（2026-11-10 オーナー指示「近くの太陽光パネルの部分に」）。区画の範囲・発電所の境界は未確認。'},
   {label:'系統との接続',value:'蔵王幹線から分岐する電源線（推定）で接続するとみなした。電源線の端点（オーナー指定）とこの印は約0.6km 離れている（その間の線は未確認のため描いていない）。'},
   {label:'設備出力（本アプリの調査による値）',value:'162MW。オーナーの説明（2026-11-10 指示、2026-11-18 回答「Cは162MWと記載。理由は事業者のYoutubeやニュースで等で確認できるため。」、保留129-C）。根拠の種類：事業者の動画・報道（資料名・日付は未記録）。一次資料未確認。直流（パネル容量）・交流（連系出力）の別は未確認。宮城県の答申・知事意見・議事録（2026-11-18確認）には出力の記載がない。報道（2020年）では着工、運転開始は未確認。'},
   {label:'運転状態',value:'未確認（宮城県の資料は 2019年の計画段階、報道は 2020年の着工まで）。'},
   {label:'発電方式（一次資料）',value:'太陽光（事業の計画段階の記述。この発電所と県の事業を同じとみなしたのは推定）'},
   {label:'出典（発電方式）',value:'宮城県「(仮称)アマテラス白石ソーラーファーム建設事業 環境影響評価準備書に係る答申」（令和元年7月11日、「太陽光発電所を建設する事業」、https://www.pref.miyagi.jp/documents/42955/jourei-huuryoku6-jyunbi-tousin.pdf ）／同「準備書に対する意見」（知事意見、令和元年8月1日、「大規模太陽光発電事業」、https://www.pref.miyagi.jp/documents/42955/jourei-huuryoku6-jyunbi.pdf ）、2026-11-18確認'},
   // 保留128-7（2026-11-17 オーナー指示「アマテラス白石ソーラーパークの発電所情報を追加して。」、回答「推奨どおり」で www.pref.miyagi.jp の取得を今回だけ許可）：行政の資料で事業者・所在地・規模を確かめた。原本は data/raw/miyagi-amaterasu
   {label:'事業の確認（行政の資料）',value:'宮城県「(仮称)アマテラス白石ソーラーファーム建設事業」（環境影響評価のページ、ページの掲載日 2023-06-27、評価書の公告日 2019-10-11（令和元年10月11日）、https://www.pref.miyagi.jp/soshiki/kankyo-t/assess-list/jourei-koujou-2.html 、2026-11-17確認）：事業者 アマテラス・ソーラー合同会社、所在地 白石市、事業の種類 工場・事業場用地造成事業、規模（事業区域の面積）401.8ha。発電出力・運転開始・接続する送電線の記載はない。この発電所と同じ事業とみなしたのは推定（名前が近く所在地が同じ）。'},
   {label:'事業者（環境影響評価の時点）',value:'アマテラス・ソーラー合同会社（宮城県の環境影響評価の手続 2017〜2019年の時点。いまの運営者は未確認。同じ事業とみなしたのは推定）'},
   {label:'別名',value:'アマテラス白石ソーラーパーク（2026-11-18 までの名前）、(仮称)アマテラス白石ソーラーファーム（宮城県の環境影響評価の事業名）'}]});
 lines.push({id:'tohoku-275-白石ソーラーパーク電源線',assetId:'tohoku-275-白石ソーラーパーク電源線',name:'アマテラス白石ソーラーファームの電源線（推定）',named:false,voltageKV:275,currentType:'ac',osmIds:[-1261],paths:[[br,tip]],schematic:true,
  connections:[{node:3135722139,position:br,status:'shared-node',facilities:[],neighborWays:[659138212]},{node:null,position:tip,status:'facility-area',facilities:[{id:'tohoku-place-アマテラス白石ソーラーパーク',name:'アマテラス白石ソーラーファーム'}],neighborWays:[]}],
  attributes:[{label:'要注意（E区分）',value:E_NOTE+' OSM にも線がない。'},{label:'照合区分',value:'E区分'},
   {label:'端点の根拠',value:'分岐点は蔵王幹線の鉄塔（OSM node 3135722139）、終点はオーナー指定の座標（北緯38.051951・東経140.587374）とみなした（推定）。空中写真では終点は森の中で、太陽光パネルの区画は南東約0.6km。'},
   {label:'地理参照',value:'直線 約0.19km（経路不明）。電圧は分岐元の蔵王幹線（275kV）とみなした（推定）。'},
   {label:'出典',value:'オーナー指示（2026-11-10）。分岐元の位置は OSM（2026-09-30取得 data/raw/tohoku-osm）。'}]});}
for(const l of lines)for(const c of l.connections)for(const f of c.facilities)if(!facilities.some(x=>x.id===f.id))throw Error('Unknown Tohoku facility '+f.id);
const ids=[...lines,...facilities].map(x=>x.assetId);if(new Set(ids).size!==ids.length)throw Error('Duplicate Tohoku asset IDs');
for(let i=facilities.length-1;i>=0;i--){const f=facilities[i];if(f.kind!=='plant'&&f.id!=='osm-way-253566674'&&!lines.some(l=>l.connections.some(c=>c.facilities.some(x=>x.id===f.id))))facilities.splice(i,1);}
// builder で個別に描いた公表区間（2026-11-10 保留114・116：0009線・0137 東福島支線）も数える
const BUILDER_SECTIONS=['0009','0137'];
if(BUILDER_SECTIONS.some(no=>!adopted.held.some(h=>String(h.section)===no)))throw Error('東北：未収録の一覧に 0009・0137 がない（数え方を確かめる）');
const sections=adopted.lines.length+BUILDER_SECTIONS.length,heldCount=adopted.held.length-BUILDER_SECTIONS.filter(no=>adopted.held.some(h=>String(h.section)===no)).length;
const data={schemaVersion:1,datasetId:'tohoku-trunk-v2',rights:'pending',
 coverage:`東北（新潟含む）500kV・275kV・${lines.length}路線${facilities.length}設備（東北電力NW 系統空き容量・基幹系統の公表67区間のうち${sections}区間、OCCTO東北の全34区間を含む。地理はOSM。番号だけの線名で端点が匿名の${heldCount}区間は未収録）。`,
 retrievedAt:source.requests.map(r=>r.retrievedAt).sort().at(-1),osmTimestamp:source.requests.map(r=>r.osmBase).filter(Boolean).sort().join(' – '),
 license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',sourceUrl:'https://overpass-api.de/api/interpreter',sources:source.requests.map(({name,endpoint,retrievedAt,sha256})=>({file:name,url:endpoint,retrievedAt,sha256})),
 lines,facilities,changePlans:[]};
data.coverage+='照合区分 A'+tiers.A+'・B'+tiers.B+'・C'+tiers.C+(tiers.D?'・D'+tiers.D:'')+'（A・Bは公表区間の両端にOSMの線で到達したもの。要注意はC・Dのみ）。';
const text=JSON.stringify(publicWording(data,'tohoku-trunk.json'),null,2)+'\n';writeFileSync('public/data/tohoku-trunk.json',text);
writeFileSync('config/tohoku-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(text).digest('hex'),lineIds:lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(lines.map(l=>[l.assetId,l.voltageKV])),lineCurrentTypes:Object.fromEntries(lines.filter(l=>l.currentType!=='ac').map(l=>[l.assetId,l.currentType])),facilityIds:facilities.map(f=>f.assetId)},null,2)+'\n');
// OCCTO→地図の対応表を画面用モジュールへ書き出す（src/tohoku-pairs.ts）
const pairs=read('docs/research/tohoku-occto-pairs.json').pairs;
// 端点の個別修正（scripts/end-fixes.mjs、2026-10-11）で線の端が公表の端点の設備につながったら、対応表の地図側の「分岐点」をその設備名にする（常磐北幹線の西仙台変電所・常磐南幹線の南相馬変電所）
for(const p of pairs)for(const [i,j] of [[5,3],[6,4]])if(p[i]==='分岐点'){const l=lines.find(x=>x.name===p[1]&&x.voltageKV===p[2]);if(l?.connections.some(c=>c.status==='facility-area'&&c.facilities.some(x=>x.name===p[j])))p[i]=p[j];}
const header='// 生成ファイル（scripts/build-tohoku.mjs）。元は docs/research/tohoku-occto-pairs.json（tools/prep/adopt-tohoku-all.mjs）。手で編集しない。\n// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]\n';
writeFileSync('src/tohoku-pairs.ts',header+'export const pairs=[\n'+pairs.map(p=>' '+JSON.stringify(p).replaceAll('"',"'")).join(',\n')+',\n] as const;\n');
console.log('Tohoku dataset',lines.length,'lines',facilities.length,'facilities');
