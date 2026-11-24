// Builds the Chubu validation dataset (public/data/chubu-trunk.json) and its pinned approval from the adopted sections
// (docs/research/chubu-adopted.json, produced by tools/prep/adopt-chubu.mjs). All lines are C tier (OSM routes only, 要注意).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyTiers} from './assign-tiers.mjs';
import {mergeJpower,annotateJpower} from './jpower.mjs';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const adopted=read('docs/research/chubu-adopted.json');
const source=read('data/raw/chubu-osm/source.json');
const lines=[...adopted.lines],facilities=adopted.facilities.map(f=>({...f}));
// 基幹系統に接続する発電所（tools/prep/adopt-plants.mjs、2026-10-02）：追加の発電所・OCCTO公表外の電源線と、既存の発電所へのOSM登録値
let plants=null;try{plants=read('docs/research/chubu-plants-adopted.json');}catch{}
if(plants){for(const f of plants.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...plants.lines);
 for(const e of plants.enriched){const f=facilities.find(x=>x.id===e.id);if(f&&f.assetId?.startsWith('chubu-'))f.attributes=[...(f.attributes??[]).filter(a=>!e.attributes.some(b=>b.label===a.label)),...e.attributes];}}
// 地域間連系線（tools/prep/adopt-ties.mjs、2026-10-03）：このエリアが端になる線を同じIDで入れる。端の設備は自エリアのものを優先し、相手側はそのエリアの設備を使う。潮流は未反映。
let ties=null;try{ties=read('docs/research/ties-adopted.json');}catch{}
if(ties)for(const l of ties.lines.filter(l=>l.regions.includes('chubu'))){const {regions,...line}=l;lines.push(line);for(const c of l.connections)for(const x of c.facilities)if(!facilities.some(f=>f.id===x.id)){const {region,...f}=ties.facilities.find(f=>f.id===x.id);facilities.push(f);}}
// 馬瀬川第一発電所：位置の根拠をWikipediaから国土地理院の注記へ（2026-10-03「出典」）。発電所自体の位置は一次資料未確認のため要注意
{const f=facilities.find(x=>x.id==='chubu-place-馬瀬川第一発電所');if(f){f.attributes=[{label:'要注意（位置推定）',value:'発電所の位置を一次資料で確認できていない（一次資料未確認）。'},...(f.attributes??[]).filter(a=>a.label!=='位置の根拠'&&!a.label.startsWith('要注意')),
 {label:'位置の根拠',value:'岩屋ダム（下呂市金山町）の直下にある中部電力の揚水発電所（最大288,000kW）。置いた位置は国土地理院の地図注記「岩屋ダム」（北緯35.76325・東経137.15713、experimental_anno z15）から約250m。発電所自体の注記はなく、中部電力の公表所在地も町名まで（一次資料未確認）。OSMの取得範囲に発電所の登録なし。'}];}}
// 設備の重複の解消（2026-10-03 指摘4a）：東北のデータにある同じOSM区画（新北信変電所 way 199544541）は東北の資産IDと位置を使い、全国表示で1つにする
{const tohoku=read('public/data/tohoku-trunk-osm.json').facilities;
 for(const f of facilities){const t=tohoku.find(x=>x.id===f.id);if(t&&t.assetId!==f.assetId){f.assetId=t.assetId;f.position=t.position;f.attributes=[...(f.attributes??[]).filter(a=>a.label!=='同じ設備'),{label:'同じ設備',value:'東北のデータと同じOSM区画のため、東北の資産ID・位置を使う（全国表示で重複させない）。'}];}}}
// 照合区分（A/B/C）を東京と同じ規則で付け直す（scripts/assign-tiers.mjs、2026-10-03）
// 上越火力発電所と新北信変電所への275kV線（2026-10-04 オーナー指示）。東北の作り直しで消えた旧データの設備・線（資産ID）を中部のデータで引き継ぐ。
// OSMの way 199544553（275kV、6条、事業者：中部電力パワーグリッド、線名なし）は上越火力発電所の区画から新北信変電所の区画まで1本でつながる。OCCTO中部に行はない（潮流なし）。
{const old=read('public/data/tohoku-trunk-osm.json'),pf=old.facilities.find(f=>f.id==='osm-way-618344823'),pl=old.lines.find(l=>l.id==='osm-199544553-275'),sk=facilities.find(f=>f.id==='osm-way-199544541');
 if(!pf||!pl||!sk)throw Error('上越火力の旧データまたは新北信変電所がない');
 if(!facilities.some(f=>f.id===pf.id))facilities.push({...pf,kind:'plant',scopeConnected:true,voltages:[275],attributes:[{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},{label:'OSM登録',value:'名称：上越火力発電所、英語名：Joetsu Power Plant、事業者：中部電力株式会社、発電設備出力：2380 MW（登録値）、発電方式：ガス、運用開始：2012（登録値）'},{label:'出力の扱い',value:'発電所の出力は送電線の容量・潮流として扱わない。運転状態・号機構成・現在の事業者は未照合。'},{label:'資産IDの引き継ぎ',value:'作り直し前の東北のデータ（tohoku-trunk-osm.json）の設備。2026-10-04に中部のデータへ移した。'}]});
 if(!lines.some(l=>l.id===pl.id)){const p=pl.paths.flat(),a=p[0],b=p.at(-1),toPlant=Math.hypot(a[0]-37.2047,a[1]-138.2745)<Math.hypot(b[0]-37.2047,b[1]-138.2745);
  const km=pl.paths.reduce((s,q)=>s+q.slice(1).reduce((t,x,i)=>t+Math.hypot(x[0]-q[i][0],(x[1]-q[i][1])*Math.cos(x[0]*Math.PI/180))*111,0),0);
  lines.push({id:pl.id,assetId:pl.assetId,name:'上越火力発電所の連系線',named:false,voltageKV:275,currentType:'ac',osmIds:pl.osmIds,paths:pl.paths,
   connections:[{node:null,position:toPlant?a:b,status:'facility-area',facilities:[{id:pf.id,name:pf.name}],neighborWays:[]},{node:null,position:toPlant?b:a,status:'facility-area',facilities:[{id:sk.id,name:sk.name}],neighborWays:[]}],
   referenceReview:{status:'partial',endpoints:'上越火力発電所―新北信変電所'},
   attributes:[{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},{label:'区分',value:'OCCTOの公表区間ではない電源線（OCCTO中部に行なし、潮流なし）'},
    {label:'地理参照',value:`OSM way 199544553（275kV、6条、事業者：中部電力パワーグリッド、線名なし、約${km.toFixed(1)}km）。上越火力発電所の区画から新北信変電所の区画まで1本の線分。線名は一次資料で未確認。`},
    {label:'資産IDの引き継ぎ',value:'作り直し前の東北のデータの線（osm-199544553-275）。2026-10-04に中部のデータへ移した。'},{label:'出典',value:'地理はOSM（data/raw/chubu-osm ほか、2026-09-30〜10-02取得）。'}]});}}
// 新豊根東栄線（電源開発、275kV、2026-10-17 オーナー承認）：送電線チェックの欠落から。J-POWER送変電「2026年度供給計画の概要」に、今ある線の東栄側
// （No.20～東栄変電所、約3km）を2027年4月に廃止し、No.20～佐久間東栄線No.22（0.1km）を2027年9月に使用開始（工事中）とある。OCCTO中部に行はない（潮流なし）。
// OSM：新豊根発電所側の名前のない線分 way 134374951 から way 502513998「新豊根東栄線」が東栄変電所の区画の中まで続く。発電所側の端は発電所の区画の外（OSM の無名の変電設備の区画
// way 618344828＝地上の開閉設備とみられる（推定）の外側）。発電所の代表点までの直線は描かず、OSM の線の端のまま線名から新豊根発電所につなぐ（2026-11-07 オーナー指示 保留86）。
// 新豊根発電所は東京のデータと同じ設備（同じID・資産ID）を置く
{const raw=read('data/raw/chubu-osm/lines-275.json'),els=raw.elements,pos=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const W=(id,from,to)=>{const w=els.find(e=>e.type==='way'&&e.id===id);if(!w||w.nodes[0]!==from||w.nodes.at(-1)!==to)throw Error('新豊根東栄線 way '+id+' が変わった');const p=w.nodes.map(n=>pos.get(n));if(p.some(x=>!x))throw Error('新豊根東栄線 nodes '+id);return p;};
 const a=W(134374951,1477544913,1477544918),b=W(502513998,1477544918,4929720749),route=[...a,...b.slice(1)];
 const tf=read('public/data/tokyo-trunk.json').facilities.find(f=>f.id==='osm-way-1193242939'),toei=facilities.find(f=>f.id==='osm-way-116559939');
 if(!tf||tf.name!=='新豊根発電所'||!toei||toei.name!=='東栄変電所')throw Error('新豊根発電所（東京のデータ）または東栄変電所がない');
 if(!facilities.some(f=>f.id===tf.id))facilities.push(structuredClone(tf));
 const km=p=>p.slice(1).reduce((s,q,i)=>s+Math.hypot((q[0]-p[i][0])*110.54,(q[1]-p[i][1])*111.32*Math.cos(q[0]*Math.PI/180)),0);
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10)??source.requests.find(r=>r.name==='lines-275.json')?.osmBase?.slice(0,10);if(!osmAt)throw Error('新豊根東栄線：OSMの取得時点が分からない');
 const PLAN='J-POWER送変電「2026年度供給計画の概要」（PDF作成 2026-02-25、https://www.jpower.co.jp/tn/news/pdf/oshirase260227-2.pdf 、2026-10-17確認）';
 const METI='資源エネルギー庁「『重要送電設備等』の指定をしました」（2019-07-23、https://www.enecho.meti.go.jp/category/electricity_and_gas/electric/important_transmission/ 、2026-10-17確認）';
 // 発電所側の端が OSM の無名の変電設備の区画（way 618344828、地上の開閉設備とみられる）の外側100m以内にあることを確かめ、距離を属性に書く（2026-11-07 保留86）
 const sw=read('data/raw/chubu-osm/facilities-2.json').elements,sww=sw.find(e=>e.type==='way'&&e.id===618344828);if(!sww)throw Error('新豊根東栄線：区画 way 618344828 がない');
 const swPos=new Map(sw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]])),ring=sww.geometry?sww.geometry.map(q=>[q.lat,q.lon]):sww.nodes.map(n=>swPos.get(n));
 const p0=route[0],xy=q=>[(q[1]-p0[1])*111320*Math.cos(p0[0]*Math.PI/180),(q[0]-p0[0])*110540];let inArea=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[yi,xi]=ring[i],[yj,xj]=ring[j];if((yi>p0[0])!=(yj>p0[0])&&p0[1]<(xj-xi)*(p0[0]-yi)/(yj-yi)+xi)inArea=!inArea;}
 const swM=Math.round(Math.min(...ring.slice(1).map((q,i)=>{const[ax,ay]=xy(ring[i]),[bx,by]=xy(q),dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));return Math.hypot(ax+t*dx,ay+t*dy);})));
 if(inArea||swM>100)throw Error('新豊根東栄線：発電所側の端が区画 way 618344828 のすぐ外にない '+swM);
 const m=Math.round(Math.hypot((route[0][0]-tf.position[0])*110540,(route[0][1]-tf.position[1])*111320*Math.cos(route[0][0]*Math.PI/180)));
 lines.push({id:'chubu-jpower-275-502513998',assetId:'chubu-jpower-275-502513998',name:'新豊根東栄線',named:true,voltageKV:275,currentType:'ac',osmIds:[502513998],sourceOsmIds:[134374951,502513998],paths:[route],
  connections:[{node:1477544913,position:route[0],status:'facility-area',facilities:[{id:tf.id,name:tf.name}],neighborWays:[]},{node:4929720749,position:route.at(-1),status:'facility-area',facilities:[{id:toei.id,name:toei.name}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'新豊根発電所―東栄変電所'},
  attributes:[{label:'要注意（C区分）',value:'公表区間（OCCTO中部）に行がない電源開発の線。線名と東栄側の区間は電源開発の資料で確認したが、経路はOSMの登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},
   {label:'区分',value:'電源開発の送電線（新豊根発電所―東栄変電所）。OCCTO中部の公表区間ではない（潮流なし）。'},
   {label:'計画（一部廃止・つなぎ替え）',value:`${PLAN}：新豊根東栄線 No.20～中部電力パワーグリッド東栄変電所（275kV、約3km）を2027年4月に廃止。新豊根東栄線 No.20～佐久間東栄線 No.22（275kV、0.1km）は工事中で2027年9月使用開始予定。あわせて佐久間東栄線 No.22～東栄変電所（2km）が工事中（2027年9月）。地図の線は今の経路（東栄変電所まで）のまま。No.20 の位置は未確認。`},
   {label:'以前の計画値',value:`${METI}：新豊根東栄線 275kV、こう長約1km、回線数は1、令和9年度運用開始予定（東京中部間連系設備の増強の一部）。上の電源開発の2026年の資料より古い値（回線数・こう長は今の線のものではない）。`},
   {label:'地理参照',value:`OSM 2線分（計約${km(route).toFixed(1)}km、275kV）：新豊根発電所側の名前のない線分（way 134374951）と「新豊根東栄線」（way 502513998、事業者・回線数の登録なし）。名前のない線分は、新豊根東栄線と端の点（node 1477544918）を共有することから同じ線とみなした。南の端は東栄変電所の区画の内側。`},
   {label:'末端',value:`新豊根発電所側は、OSMの線の端（node 1477544913、発電所の代表点から約${m}m）までを表示。端は発電所の区画に届かず、OSM の無名の変電設備の区画（way 618344828。発電所の地上の開閉設備とみられる、推定）の外側約${swM}mにある。新豊根発電所への接続は線名「新豊根東栄線」から判断した。発電所の代表点までの直線は表示しない（2026-11-07 オーナー指示）。構内の結線は未確認。東京の新豊根佐久間線（No.145）と同じ扱い。`},
   {label:'出典',value:`${PLAN}。${METI}。地理はOSM（data/raw/chubu-osm/lines-275.json、${osmAt}時点）。`}]});}
// 奥矢作第一発電所と東部変電所への 275kV 線（2026-10-23 オーナー承認 保留5）：中部PGの系統予想潮流・空容量マッピング（data/raw/chubu-gridmap/okuyahagi.json）に、
// 名前のない 275kV の発電所の記号と、東部変電所へ向かう名前のない 275kV の線がある。OSM の無名の 275kV 区画 way 210661976（power=substation）を、記号の位置と所在地から
// 奥矢作第一発電所（地上の開閉設備の区画）とみなし（推定）、OSM の無名の 275kV 線（way 180368217＋180368235）で東部変電所とつなぐ（C区分）。開閉所は記載しない（オーナー指示）。
// 発電方式の一次資料は docs/research/plant-primary-sources.json。jpower.mjs の取り込み（plant-primary の反映）より前に足す
const OKUYAHAGI_SRC='中部電力「奥矢作第一・第二水力発電所」（https://www.chuden.co.jp/energy/renew/ren_setsubi/water/wat_chuden/okuyahagi/ 、2026-10-23確認）・中部電力 設備概要（水力発電所、2026年3月末現在、https://www.chuden.co.jp/corporate/company/officelist/com_setsubi/ 、2026-10-23確認）';
const gridmap=read('data/raw/chubu-gridmap/okuyahagi.json');
const GRIDMAP_SRC=`中部電力パワーグリッド 系統予想潮流・空容量マッピング（${gridmap.mapAsOf}、${gridmap.url} 、${gridmap.retrievedAt}取得）`;
{const raw=read('data/raw/chubu-osm/lines-275.json'),fac=read('data/raw/chubu-osm/facilities-2.json');
 const at=raw.osm3s?.timestamp_osm_base?.slice(0,10)??source.requests.find(r=>r.name==='lines-275.json')?.osmBase?.slice(0,10),fat=fac.osm3s?.timestamp_osm_base?.slice(0,10)??source.requests.find(r=>r.name==='facilities-2.json')?.osmBase?.slice(0,10);
 if(!at||!fat)throw Error('奥矢作：OSMの取得時点が分からない');
 const node=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const way=id=>{const w=raw.elements.find(e=>e.type==='way'&&e.id===id);if(!w||w.tags?.power!=='line'||w.tags?.voltage!=='275000'||w.tags?.name)throw Error('奥矢作：OSMの線 '+id+' のタグが変わった');return w;};
 const sw=fac.elements.find(e=>e.type==='way'&&e.id===210661976);if(!sw||sw.tags?.power!=='substation'||sw.tags?.voltage!=='275000'||sw.tags?.name)throw Error('奥矢作：OSMの区画のタグが変わった');
 const ring=sw.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 const tobu=facilities.find(f=>f.id==='osm-way-169122898');if(tobu?.name!=='東部変電所')throw Error('奥矢作：東部変電所がない');
 if(facilities.some(f=>f.id==='osm-way-210661976'||/奥矢作/.test(f.name))||lines.some(l=>/奥矢作/.test(l.name)))throw Error('奥矢作：重複');
 const tobuRing=read('data/raw/chubu-osm/facilities-1.json').elements.concat(fac.elements,read('data/raw/chubu-osm/facilities-3.json').elements,read('data/raw/chubu-osm/facilities-4.json').elements).find(e=>e.type==='way'&&e.id===169122898)?.geometry?.map(q=>[q.lat,q.lon]);
 if(!tobuRing)throw Error('奥矢作：東部変電所の区画がない');
 facilities.push({id:'osm-way-210661976',assetId:'chubu-fac-way-210661976',name:'奥矢作第一発電所',kind:'plant',position:pos,voltages:[275],scopeConnected:true,url:'https://www.openstreetmap.org/way/210661976',
  attributes:[{label:'要注意（名称推定）',value:'OSM の無名の区画に、所在地と中部PGのマッピングの記号の位置から名前を当てた（推定）。中部電力の所在地（豊田市小田木町）と区画の町名（国土地理院の逆ジオコーダーでは黒田町）が一致しない。'},
   {label:'OSM登録',value:'名称なし、power=substation（substation=transmission、屋外）、電圧：275kV'},
   {label:'名称・位置の根拠',value:`OSM の無名の 275kV の区画。${GRIDMAP_SRC}の名前のない 275kV の発電所の記号がこの区画の位置にあり、富永調整池（奥矢作第一の下池、国土地理院の地図注記）の南にあることから、奥矢作第一発電所の地上の開閉設備の区画とみなし、発電所として扱った（推定）。地下の発電所本体の所在地は豊田市小田木町大水別（中部電力）。`},
   {label:'事業者',value:'中部電力'},
   {label:'出力の扱い',value:'発電所の出力は送電線の容量・潮流として扱わない。運転状態・号機構成は未照合。'},
   {label:'出典',value:`地理はOSM（${fat}時点 data/raw/chubu-osm）。名称は${OKUYAHAGI_SRC}、記号の位置は${GRIDMAP_SRC}。`}]});
 // 東部変電所の区画から奥矢作第一の区画へ（線分の向きをそろえる）
 const a=way(180368217),b=way(180368235);if(a.nodes[0]!==b.nodes[0]||raw.elements.some(e=>e.type==='way'&&e.id!==a.id&&e.id!==b.id&&e.nodes?.includes(a.nodes[0])))throw Error('奥矢作：線分の接合点が変わった');
 const pa=[...a.nodes].reverse().map(n=>node.get(n)),pb=b.nodes.map(n=>node.get(n));
 if(!inside(pa[0],tobuRing)||!inside(pb.at(-1),ring))throw Error('奥矢作：線①の両端が設備の区画に届かない');
 {const areas=[...read('data/raw/chubu-osm/facilities-1.json').elements,...fac.elements,...read('data/raw/chubu-osm/facilities-3.json').elements,...read('data/raw/chubu-osm/facilities-4.json').elements].filter(e=>e.type==='way'&&e.geometry&&/^(substation|plant|switchgear)$/.test(e.tags?.power??'')&&e.id!==210661976&&e.id!==169122898).map(e=>e.geometry.map(q=>[q.lat,q.lon]));
  for(const p of [...pa,...pb])if(areas.some(R=>inside(p,R)))throw Error('奥矢作：線①が途中で別の設備の区画を通る');}
 const t=Math.PI/180,len=p=>p.slice(1).reduce((s,q,i)=>s+6371*Math.hypot((q[1]-p[i][1])*t*Math.cos(q[0]*t),(q[0]-p[i][0])*t),0);
 lines.push({id:'chubu-275-奥矢作第一発電所の連系線',assetId:'chubu-275-奥矢作第一発電所の連系線',name:'奥矢作第一発電所の連系線',named:false,voltageKV:275,currentType:'ac',osmIds:[180368217,180368235],paths:[pa,pb],
  connections:[{node:a.nodes.at(-1),position:pa[0],status:'facility-area',facilities:[{id:tobu.id,name:tobu.name}],neighborWays:[]},{node:b.nodes.at(-1),position:pb.at(-1),status:'facility-area',facilities:[{id:'osm-way-210661976',name:'奥矢作第一発電所'}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'東部変電所―奥矢作第一発電所'},
  attributes:[{label:'区分',value:'OCCTOの公表区間ではない電源線（OCCTO中部に行なし、潮流なし）。'},
   {label:'根拠',value:`${GRIDMAP_SRC}に、名前のない 275kV の線が東部変電所と名前のない 275kV の発電所の記号の間にある（線名・発電所名は伏せられている）。経路は OSM の無名の 275kV の線でたどった（線の節点が両端以外の設備の区画に入らないことを確かめた）。`},
   {label:'端点の根拠',value:'OSM の無名の 275kV の区画を、所在地と記号の位置から奥矢作第一発電所の端点とみなした（推定）。'},
   {label:'地理参照',value:`OSM 2線分（約${len([...pa,...pb.slice(1)]).toFixed(1)}km、275kV）：way 180368217（2回線・6条）と way 180368235（回線数の登録なし）。線名の登録なし。個別回線は未確認。`},
   {label:'出典',value:`${GRIDMAP_SRC}。地理はOSM（${at}時点 data/raw/chubu-osm）。2026-10-23 オーナー承認（保留5）。`}]});}
// 電源開発の設備（scripts/jpower.mjs、2026-10-04）
mergeJpower('chubu',lines,facilities);annotateJpower('chubu',lines,facilities);
// 奥矢作第一―第二の 275kV 線（2026-10-23 オーナー承認 保留5、案A）：中部PGのマッピングの名前のない 275kV の線の線形をそのまま使う（publishedRoute。2026-10-02 オーナー判断C の変更）。
// 奥矢作第二発電所（地下式、chubu-place-奥矢作第二発電所）は plant-primary-sources の addFacilities で、オーナー指定の座標に足してある
{const I=facilities.find(f=>f.id==='osm-way-210661976'),II=facilities.find(f=>f.id==='chubu-place-奥矢作第二発電所');if(!I||!II)throw Error('奥矢作：第一・第二の発電所がない');
 const routes=gridmap.features.filter(f=>f.geometry.type==='LineString');const r=routes.find(f=>{const c=f.geometry.coordinates;return Math.hypot((c[0][1]-II.position[0])*111,(c[0][0]-II.position[1])*91)<0.05;});
 if(!r)throw Error('奥矢作：マッピングの線②の端が奥矢作第二の位置にない');
 const path=r.geometry.coordinates.map(([lon,lat])=>[lat,lon]),ring=read('data/raw/chubu-osm/facilities-2.json').elements.find(e=>e.id===210661976).geometry.map(q=>[q.lat,q.lon]);
 {let c=false;const p=path.at(-1);for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[yi,xi]=ring[i],[yj,xj]=ring[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}if(!c)throw Error('奥矢作：線②の端が奥矢作第一の区画に入らない');}
 const t=Math.PI/180,km=path.slice(1).reduce((s,q,i)=>s+6371*Math.hypot((q[1]-path[i][1])*t*Math.cos(q[0]*t),(q[0]-path[i][0])*t),0);
 lines.push({id:'chubu-275-奥矢作第一第二連絡線',assetId:'chubu-275-奥矢作第一第二連絡線',name:'奥矢作第一・第二発電所の連絡線',named:false,voltageKV:275,currentType:'ac',osmIds:[-2106619762],paths:[path],
  publishedRoute:{label:GRIDMAP_SRC,url:gridmap.url,retrievedAt:gridmap.retrievedAt,mapAsOf:gridmap.mapAsOf,featureNames:['名前のない 275kV の線（奥矢作付近）']},
  connections:[{node:null,position:path[0],status:'facility-area',facilities:[{id:II.id,name:II.name}],neighborWays:[]},{node:null,position:path.at(-1),status:'facility-area',facilities:[{id:I.id,name:I.name}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'奥矢作第二発電所―奥矢作第一発電所'},
  attributes:[{label:'区分',value:'OCCTOの公表区間ではない電源線（OCCTO中部に行なし、潮流なし）。'},
   {label:'根拠',value:`${GRIDMAP_SRC}の名前のない 275kV の線。経路はこの公表図の線形をそのまま使った（OSM に対応する線はない。2026-10-23 オーナー承認）。`},
   {label:'端点の根拠',value:'両端の名前のない発電所の記号を、所在地から奥矢作第二発電所・奥矢作第一発電所の端点とみなした（推定）。'},
   {label:'地理参照',value:`公表図の線形（${path.length}点、約${km.toFixed(1)}km）。地中・架空の別は資料にない（実線は公表図の線形を示すもので、架空とは限らない）。個別回線は未確認。`},
   {label:'出典',value:`${GRIDMAP_SRC}（data/raw/chubu-gridmap/okuyahagi.json）。${OKUYAHAGI_SRC}。2026-10-23 オーナー承認（保留5）。`}]});}
// 名古屋都市部の直線（D区分）6本：中部PG の公表マップ（一次資料）で経路は分かるが、利用規約上、許諾なしに線形を使えないため直線のまま（2026-10-02 オーナー判断C）。
// 理由を属性「経路の扱い」で分かるようにする（2026-10-24 オーナー指示「除いて、わかるようにしておいて」）。地理院の照合の道具（tools/prep/gsi-targets.mjs）はこの属性を見て対象から外す
for(const n of ['東海下広井線','東海松ヶ枝線','梅森金山線','下広井南武平町線','金山松ヶ枝線','南武平町松ヶ枝線']){const l=lines.find(x=>x.id==='chubu-275-'+n);if(!l||!l.schematic)throw Error('名古屋の直線：線がない '+n);
 l.attributes=[...l.attributes.filter(a=>a.label!=='経路の扱い'),{label:'経路の扱い',value:'中部電力パワーグリッドの系統空容量・予想潮流マッピング（一次資料）で経路は分かるが、利用規約上、許諾なしに線形を使えないため直線で表示（2026-10-02 オーナー判断C）。'}];}
// 地理参照の「うち名称なし約0.0km」を直す（2026-11-04 オーナー指示 保留75、scripts/km-text.mjs）。docs/research/chubu-adopted.json は古い文のまま。
// 名前のない線分の長さは原本（data/raw/chubu-osm）で測り直す。reports の候補ファイルの path.lengthM.unnamed と一致（18本 0m、北部西濃線 44m）。対象の ID と件数を固定し、食い違えば止める
{const {osmIndexDirs}=await import('./assign-tiers.mjs');const {unnamedText}=await import('./km-text.mjs');const idx=osmIndexDirs(['data/raw/chubu-osm']);
 const UNNAMED_SHORT=new Set(['chubu-275-北部西濃線']),IDS=['chubu-500-駿遠幹線','chubu-500-新三河幹線','chubu-500-西部幹線','chubu-500-南信幹線','chubu-500-豊根幹線','chubu-275-伊勢幹線','chubu-275-伊勢中勢線','chubu-275-額田幸田線','chubu-275-湖西三河線','chubu-275-幸田新三河線','chubu-275-三河遠江線','chubu-275-西濃西部線','chubu-275-中勢亀山線','chubu-275-田原湖西線','chubu-275-東浦北豊田線','chubu-275-東部額田線','chubu-275-浜岡駿遠線','chubu-275-北部西濃線','chubu-275-鈴鹿幹線'];
 const d=(a,b)=>{const t=Math.PI/180,x=(b[1]-a[1])*t*Math.cos((a[0]+b[0])/2*t),y=(b[0]-a[0])*t;return 6371000*Math.hypot(x,y);};
 const hits=lines.filter(l=>(l.attributes??[]).some(a=>a.label==='地理参照'&&a.value.includes('、うち名称なし約0.0km')));
 if(hits.map(l=>l.id).sort().join()!==[...IDS].sort().join())throw Error('地理参照の約0.0km：対象の線が想定と違う '+hits.map(l=>l.id).join(','));
 for(const l of hits){let m=0;l.osmIds.forEach((id,i)=>{const w=idx.ways.get(id);if(!w)throw Error('地理参照の約0.0km：原本にない線分 '+l.id+' '+id);if(!w.tags.name)for(let k=1;k<l.paths[i].length;k++)m+=d(l.paths[i][k-1],l.paths[i][k]);});
  if(UNNAMED_SHORT.has(l.id)?!(m>0&&m<50):m!==0)throw Error('地理参照の約0.0km：名前のない区間の長さが想定と違う '+l.id+' '+m);
  for(const a of l.attributes)if(a.label==='地理参照')a.value=a.value.replace('、うち名称なし約0.0km','、'+unnamedText(m));}}
// 2026-11-16 一次資料との点検（保留119a・121a・121b、オーナー回答「推奨どおり」）。中部PG 系統空容量マッピング（系統マップ）は線名・範囲・端点の照合だけに使い、
// 描く座標は OSM の線分から取る（2026-10-02 判断C）。図は reports/figures/chubu-lines-2026-11-16.html
{const MAP_NOTE='中部電力パワーグリッド 系統空容量・予想潮流マッピング（2026-09-29取得、照合だけに使用。線形は使っていない）';
 const osmL=Object.fromEntries(['lines-275','lines-500'].map(f=>[f,read(`data/raw/chubu-osm/${f}.json`).elements]));
 const way=(f,id)=>{const els=osmL[f],w=els.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('中部の点検：OSM way がない '+id);const N=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));return {nodes:w.nodes,path:w.nodes.map(n=>{const p=N.get(n);if(!p)throw Error('中部の点検：node がない '+n);return p;})};};
 const note=(x,label,value)=>{x.attributes=[...(x.attributes??[]).filter(a=>a.label!==label),{label,value}];};
 // 119a 三好分岐線：「東名古屋分岐線（推定）」は、中部PG の一覧の No.612 三好分岐線（275kV）と系統マップの範囲・形が一致する（OSM の線名タグ「612」は補助資料）。
 // ID を残して線名を直す。本当の No.490 東名古屋分岐線は地図の「東名分岐線」（OCCTO の略称、保留119b）。分岐側の端（東名古屋東部線との共有ノード）は推定のまま
 {const l=lines.find(x=>x.id==='ledger-infer-chubu-275-253586148');if(!l||l.name!=='東名古屋分岐線（推定）')throw Error('三好分岐線：元の線が想定と違う');
  l.name='三好分岐線';l.referenceReview={status:'section',endpoints:'東名古屋東部線との分岐点（推定）―三好変電所'};
  l.attributes=(l.attributes??[]).filter(a=>!/^(要注意（C区分・推定）|推定の内容|根拠|公表の行|区分|照合区分|照合の根拠|要注意（C区分）)$/.test(a.label));
  note(l,'公表区間',`中部電力パワーグリッド 一覧 No.612：三好分岐線（275kV）。端点は一覧にないため、${MAP_NOTE}で確かめた範囲（東名古屋東部線からの分岐〜三好変電所、約0.9km）。OCCTOに行なし（潮流は公表対象外）。`);
  note(l,'端点の根拠','分岐点は東名古屋東部線と共有する OSM node 2202187421 とみなした（推定）。三好変電所側は OSM の区画。');
  note(l,'出典',`${MAP_NOTE}（範囲・端点の照合）。中部電力パワーグリッドの一覧（No.612、線名・電圧）。地理はOSM（data/raw/chubu-osm、2026-10-02時点）。`);
  note(l,'名称の訂正','2026-11-16：以前は「東名古屋分岐線（推定）」（線名の「東名古屋」から推定）。一覧 No.612 三好分岐線と系統マップで範囲・形が一致するので直した（OSM の線名タグ「612」も一致。補助資料）。');}
 // 121a 安倍分岐線と安倍変電所：系統マップの安倍分岐線（駿遠駿河線から安倍変電所）に OSM の名前のない 275kV の線 way 155375869 が重なる。
 // 安倍変電所は地理院の注記がないので、空中写真（撮影年未確認、2026-11-16取得）の変電設備の区画の中心に置く（位置推定。系統マップの点の座標は使わない）
 {if(facilities.some(f=>f.id==='chubu-place-安倍変電所')||lines.some(l=>l.id==='chubu-275-安倍分岐線'))throw Error('安倍：登録済み');
  const sr=lines.find(x=>x.name==='駿遠駿河線'),w=way('lines-275',155375869),br=w.path.at(-1),tip=w.path[0];
  if(!sr||!sr.paths.flat().some(q=>q[0]===br[0]&&q[1]===br[1]))throw Error('安倍：分岐点が駿遠駿河線の経路にない');
  facilities.push({id:'chubu-place-安倍変電所',assetId:'chubu-place-安倍変電所',name:'安倍変電所',kind:'substation',position:[34.9941,138.2862],voltages:[275],url:'',scopeConnected:true,
   attributes:[{label:'要注意（位置推定）',value:'国土地理院の地図注記に名前がないため、位置は空中写真で見た変電設備の区画の中心（推定）。'},
    {label:'位置の根拠',value:'国土地理院 シームレス空中写真（撮影年未確認、2026-11-16取得）の変電設備の区画の中心。OSM の 275kV の線（way 155375869）の端がこの区画の西の縁に入る。'},
    {label:'名称・位置の根拠',value:`名前は中部電力パワーグリッドの変電所の一覧（275kV、2026-10-02取得）と${MAP_NOTE}の「安倍変電所」。系統マップで安倍分岐線の終点にあることから、この区画に当てた（推定）。`}]});
  const sp=[...w.path].reverse(),km=sp.slice(1).reduce((s,q,i)=>s+6371*Math.hypot((q[1]-sp[i][1])*Math.PI/180*Math.cos(q[0]*Math.PI/180),(q[0]-sp[i][0])*Math.PI/180),0);
  lines.push({id:'chubu-275-安倍分岐線',assetId:'chubu-275-安倍分岐線',name:'安倍分岐線',named:true,voltageKV:275,currentType:'ac',osmIds:[155375869],paths:[sp],
   connections:[{node:w.nodes.at(-1),position:br,status:'shared-node',facilities:[],neighborWays:[]},{node:w.nodes[0],position:tip,status:'facility-area',facilities:[{id:'chubu-place-安倍変電所',name:'安倍変電所'}],neighborWays:[]}],
   referenceReview:{status:'section',endpoints:'駿遠駿河線との分岐点（推定）―安倍変電所'},
   attributes:[{label:'公表区間',value:`中部電力パワーグリッド 一覧 No.752：安倍分岐線（275kV）。端点は一覧にないため、${MAP_NOTE}で確かめた範囲（駿遠駿河線からの分岐〜安倍変電所）。OCCTOに行なし（潮流は公表対象外）。`},
    {label:'端点の根拠',value:'分岐点は駿遠駿河線と共有する OSM node 1677836245 とみなした（推定）。終点は安倍変電所とみなした区画（推定、設備の名称・位置の根拠を参照）。'},
    {label:'地理参照',value:`OSM 1線分（way 155375869、約${km.toFixed(1)}km、275kV、線名なし）。個別回線・母線は未確認。`},
    {label:'出典',value:`${MAP_NOTE}。地理はOSM（data/raw/chubu-osm、2026-10-02時点）、国土地理院 空中写真（2026-11-16取得）。`}]});}
 // 121b 岐北開閉所と岐北分岐：「奥美濃発電所の連系線」は岐北開閉所の構内を通り抜けて西部幹線まで描いていた。系統マップの「岐北分岐」（500kV、一覧に番号なし）はその南側
 // （岐北開閉所→西部幹線、OSM way 190769045）。岐北開閉所は国土地理院の注記と空中写真で位置を確認。連系線の端を岐北開閉所にし、南側を岐北分岐として分ける
 {const ok=lines.find(x=>x.id==='chubu-plant-500-way-832823488'),i=ok?.osmIds.indexOf(190769045);if(!ok||i!==ok.osmIds.length-1)throw Error('岐北：奥美濃の連系線の末尾が想定と違う');
  if(facilities.some(f=>f.id==='chubu-place-岐北開閉所'))throw Error('岐北：登録済み');
  const w=way('lines-500',190769045);if(w.nodes[0]!==7774753792||w.nodes.at(-1)!==1817080785)throw Error('岐北：way 190769045 の端が想定と違う');
  facilities.push({id:'chubu-place-岐北開閉所',assetId:'chubu-place-岐北開閉所',name:'岐北開閉所',kind:'switchyard',position:[35.58352,136.72362],voltages:[500],url:'',scopeConnected:true,
   attributes:[{label:'位置の確認',value:'国土地理院の地図注記「岐北開閉所」（北緯35.58352・東経136.72362、2026-11-16取得）。国土地理院 シームレス空中写真（撮影年未確認、2026-11-16取得）で同じ位置に開閉設備が見える。'},
    {label:'名称の根拠',value:`中部電力パワーグリッドの一覧と${MAP_NOTE}の「岐北開閉所」（500kV）。`}]});
  const south=ok.paths.pop();ok.osmIds.pop();
  if(south[0][0]!==w.path[0][0]||south[0][1]!==w.path[0][1]||south.at(-1)[0]!==w.path.at(-1)[0])throw Error('岐北：連系線の末尾の向き・座標が way 190769045 と違う');
  const end=ok.connections.find(c=>c.node===1817080785);if(!end)throw Error('岐北：連系線の南の端がない');Object.assign(end,{node:7774753792,position:south[0],status:'facility-area',facilities:[{id:'chubu-place-岐北開閉所',name:'岐北開閉所'}],neighborWays:[]});
  ok.referenceReview={status:'partial',endpoints:'奥美濃発電所―岐北開閉所'};
  note(ok,'端の修正（2026-11-16）','以前は岐北開閉所の構内を通り抜けて西部幹線との共有ノードまで描いていた。岐北開閉所を端にし、南側（OSM way 190769045）は「岐北分岐」として分けた（保留121b）。');
  {const km=ok.paths.reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+6371*Math.hypot((q[1]-p[i][1])*Math.PI/180*Math.cos(q[0]*Math.PI/180),(q[0]-p[i][0])*Math.PI/180),0),0);const g=ok.attributes.find(a=>a.label==='地理参照');
   if(!g||!/OSM 11線分（計約[\d.]+km）/.test(g.value))throw Error('岐北：連系線の地理参照の文が想定と違う');g.value=g.value.replace(/OSM 11線分（計約[\d.]+km）/,`OSM 10線分（計約${km.toFixed(1)}km）`);}
  lines.push({id:'chubu-500-岐北分岐',assetId:'chubu-500-岐北分岐',name:'岐北分岐',named:true,voltageKV:500,currentType:'ac',osmIds:[190769045],paths:[south],
   connections:[{node:7774753792,position:south[0],status:'facility-area',facilities:[{id:'chubu-place-岐北開閉所',name:'岐北開閉所'}],neighborWays:[]},{node:1817080785,position:south.at(-1),status:'shared-node',facilities:[],neighborWays:[]}],
   referenceReview:{status:'partial',endpoints:'岐北開閉所―西部幹線との分岐点（推定）'},
   attributes:[{label:'公表の線名',value:`${MAP_NOTE}の「岐北分岐」（500kV）。一覧に番号・端点はない。OCCTOに行なし（潮流は公表対象外）。`},
    {label:'端点の根拠',value:'西部幹線との分岐点は、西部幹線と共有する OSM node 1817080785 とみなした（推定）。西部幹線の OCCTO の区間が岐北で分かれているか（引き込みか分岐か）は未確認。'},
    {label:'地理参照',value:'OSM 1線分（way 190769045、500kV・2回線、線名なし）。もとは奥美濃発電所の連系線の一部として描いていた区間。個別回線は未確認。'},
    {label:'出典',value:`${MAP_NOTE}。国土地理院の地図注記「岐北開閉所」。地理はOSM（data/raw/chubu-osm、2026-10-02時点）。`}]});}
 const km=p=>p.slice(1).reduce((s,q,i)=>s+6371*Math.hypot((q[1]-p[i][1])*Math.PI/180*Math.cos(q[0]*Math.PI/180),(q[0]-p[i][0])*Math.PI/180),0);
 // 121c 関開閉所と関分岐（2026-11-16 オーナー回答「C-1以外は推奨どおり」）：電源開発の「御母衣幹線」は関開閉所（OSM way 161946848）を通り抜けて
 // 中濃犬山線との共有ノードまで描いていた。関開閉所（関西のデータに丸山幹線の端として収録済み。同じ設備IDで中部にも載せる）を足し、御母衣幹線の端を関開閉所に、その南（OSM way 209447575）を系統マップの「関分岐」（275kV、一覧に番号なし）にする。
 // 御母衣幹線の元の経路は tools/prep/adopt-jpower.mjs・docs/research/jpower-adopted.json（2026-10-04）で、ここで分ける
 {const om=lines.find(x=>x.id==='jpower-275-way-440218167');if(!om||om.name!=='御母衣幹線'||om.osmIds.join()!=='212039849,-1,209447575')throw Error('関分岐：御母衣幹線が想定と違う');
  if(facilities.some(f=>f.id==='osm-way-161946848'))throw Error('関分岐：関開閉所は登録済み');
  const F=[1,2,3,4].flatMap(i=>read(`data/raw/chubu-osm/facilities-${i}.json`).elements),fa=F.find(e=>e.type==='way'&&e.id===161946848);if(fa?.tags?.name!=='関開閉所')throw Error('関分岐：OSM の関開閉所の区画がない');
  const R=fa.geometry.map(q=>[q.lat,q.lon]),inside=p=>{let k=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)k=!k;}return k;};
  const pos=[R.reduce((s,p)=>s+p[0],0)/R.length,R.reduce((s,p)=>s+p[1],0)/R.length].map(v=>Math.round(v*1e7)/1e7);
  const w=way('lines-275',209447575),south=om.paths[2],ci=lines.find(x=>x.id==='chubu-275-中濃犬山線');
  const at=n=>w.path[w.nodes.indexOf(n)],sk=at(2196645586),br=at(1815155950);
  if(!sk||!br||south[0].join()!==sk.join()||south.at(-1).join()!==br.join()||!inside(sk)||!ci?.paths.flat().some(q=>q.join()===br.join()))throw Error('関分岐：way 209447575 の端が想定と違う');
  facilities.push({id:'osm-way-161946848',assetId:'ledger-fac-way-161946848',name:'関開閉所',kind:'switchyard',position:pos,voltages:[275],scopeConnected:true,url:'https://www.openstreetmap.org/way/161946848',
   attributes:[]});
  om.paths.pop();om.osmIds.pop();
  const e=om.connections.find(c=>c.node===1815155950);if(!e)throw Error('関分岐：御母衣幹線の南の端がない');Object.assign(e,{node:2196645586,position:sk,status:'facility-area',facilities:[{id:'osm-way-161946848',name:'関開閉所'}],neighborWays:[]});
  om.referenceReview={...(om.referenceReview??{}),endpoints:'御母衣発電所―関開閉所'};
  {const g=om.attributes.find(a=>a.label==='地理参照');if(!g||!/^OSM 2線分（計約[\d.]+km）/.test(g.value))throw Error('関分岐：御母衣幹線の地理参照の文が想定と違う');
   g.value=g.value.replace(/^OSM 2線分（計約[\d.]+km）/,`OSM 1線分と途切れの直線（計約${om.paths.reduce((s,p)=>s+km(p),0).toFixed(1)}km）`);}
  {const b=om.attributes.find(a=>a.label==='線名の根拠');if(!b||!b.value.includes('OSMの線は途中で関開閉所（OSM way/161946848、収録外）を通り犬山変電所に入る。'))throw Error('関分岐：御母衣幹線の線名の根拠の文が想定と違う');
   b.value=b.value.replace('OSMの線は途中で関開閉所（OSM way/161946848、収録外）を通り犬山変電所に入る。','OSMの線は関開閉所（OSM way/161946848）に入り、その先は中部の「関分岐」で中濃犬山線につながる。');}
  note(om,'端の修正（2026-11-16）','以前は関開閉所の構内を通り抜けて中濃犬山線との共有ノードまで描いていた。関開閉所を端にし、南側（OSM way 209447575）は「関分岐」として分けた（保留121c）。');
  lines.push({id:'chubu-275-関分岐',assetId:'chubu-275-関分岐',name:'関分岐',named:true,voltageKV:275,currentType:'ac',osmIds:[209447575],paths:[south],
   connections:[{node:2196645586,position:sk,status:'facility-area',facilities:[{id:'osm-way-161946848',name:'関開閉所'}],neighborWays:[]},{node:1815155950,position:br,status:'shared-node',facilities:[],neighborWays:[341030012]}],
   referenceReview:{status:'partial',endpoints:'関開閉所―中濃犬山線との分岐点（推定）'},
   attributes:[{label:'公表の線名',value:`${MAP_NOTE}の「関分岐」（275kV）。一覧に番号・端点はない。OCCTOに行なし（潮流は公表対象外）。`},
    {label:'端点の根拠',value:'中濃犬山線との分岐点は、中濃犬山線と共有する OSM node 1815155950 とみなした（推定）。関開閉所側は OSM の区画。'},
    {label:'持ち主',value:'未確認（OSM のタグの運営者は中部電力パワーグリッド。補助資料）。'},
    {label:'地理参照',value:`OSM 1線分（way 209447575、約${km(south).toFixed(1)}km、275kV、線名なし）。もとは電源開発の御母衣幹線の一部として描いていた区間。個別回線は未確認。`},
    {label:'出典',value:`${MAP_NOTE}。国土地理院の地図注記「関開閉所」。地理はOSM（data/raw/chubu-osm、2026-10-02時点）。`}]});}
 // 分岐線を「変電所～分岐元の線上の分岐点」にする（2026-11-16 オーナー指示「静岡東分岐線は駿遠駿河線と同じ線路区間になっているが途中から分岐する分のみ。他の分岐線の名称のものは同様」）。
 // 九州の「～分岐線」（scripts/end-fixes.mjs の branchCut、2026-10-25）と同じ扱い。分岐元の線と重ねて描いていた区間を外し、分岐元の線と共有する OSM のノードを分岐点（推定）にする。
 // OCCTO の行（例：駿河→静岡）の分岐元の側の端は分岐点と読み替え、潮流はこの線（分岐点～変電所）だけに表示する（照合表の端を「分岐点」にする。下の BRANCH_PAIRS）
 const BRANCH_CUT=[
  {id:'chubu-275-静岡東分岐線',parent:'chubu-275-駿遠駿河線',node:1816607978,sub:'静岡変電所',from:'駿河',told:'2026-11-16 オーナーの説明「静岡東分岐線は駿遠駿河線と同じ線路区間になっているが途中から分岐する分のみ」'},
  {id:'chubu-275-静岡西分岐線',parent:'chubu-275-遠江駿遠線',node:1816607682,sub:'静岡変電所',from:'駿遠',note:'駿遠変電所から分岐点までは遠江駿遠線と同じ線（OSM way 170503687）を通り'},
  {id:'chubu-275-愛知分岐線',parent:'chubu-275-佐久間西幹里線',node:2202487880,sub:'愛知変電所',from:'電名'},
  {id:'chubu-500-飛騨分岐線',parent:'chubu-500-越美幹線',node:7742566942,sub:'飛騨変換所',from:'岐阜',note:'岐阜開閉所から飛騨信濃の分岐点までは越美幹線と同じ鉄塔（2回線のうち1回線）を通り'}];
 for(const c of BRANCH_CUT){const l=lines.find(x=>x.id===c.id),p=lines.find(x=>x.id===c.parent);if(!l||!p)throw Error('分岐線：線がない '+c.id);
  const si=l.connections.findIndex(e=>e.facilities.some(f=>f.name===c.sub));if(si<0||l.connections.length!==2)throw Error('分岐線：変電所の端がない '+c.id);
  const oldKm=l.paths.reduce((s,q)=>s+km(q),0),PS=new Set(p.paths.flat().map(q=>q.join()));
  // 変電所の側からたどり、分岐元の線に初めて載る点で切る
  const ways=l.paths.map((q,i)=>({id:l.osmIds[i],path:q}));if(si===1){ways.reverse();for(const w of ways)w.path=[...w.path].reverse();}
  const keep=[];let cut=null;
  for(const w of ways){const k=w.path.findIndex((q,j)=>(keep.length||j>0)&&PS.has(q.join()));if(k<0){keep.push(w);continue;}keep.push({id:w.id,path:w.path.slice(0,k+1)});cut=w.path[k];break;}
  if(!cut)throw Error('分岐線：分岐元の線に載る点がない '+c.id);
  const dropped=l.osmIds.filter(o=>!keep.some(w=>w.id===o));if(dropped.some(o=>!p.osmIds.includes(o)))throw Error('分岐線：外す線分が分岐元の線にない '+c.id+' '+dropped);
  // 分岐点の OSM ノード：残す線分の原本で座標が一致するもの
  const src=keep.at(-1).id>0?way(l.voltageKV===500?'lines-500':'lines-275',keep.at(-1).id):null,ni=src?src.path.findIndex(q=>q.join()===cut.join()):-1,node=ni>=0?src.nodes[ni]:null;
  if(!node||node!==c.node)throw Error('分岐線：分岐点のノードが想定と違う '+c.id+' '+node);
  if(si===1){keep.reverse();for(const w of keep)w.path=[...w.path].reverse();}
  l.paths=keep.map(w=>w.path);l.osmIds=keep.map(w=>w.id);
  const newKm=l.paths.reduce((s,q)=>s+km(q),0),brc={node,position:cut,status:'shared-node',facilities:[],neighborWays:p.osmIds.filter((o,i)=>o>0&&p.paths[i].some(q=>q.join()===cut.join()))};
  const sub=l.connections[si];l.connections=si===0?[sub,brc]:[brc,sub];
  const bn='分岐点（'+p.name+'）';l.referenceReview={status:l.referenceReview?.status??'section',endpoints:si===0?c.sub+'―'+bn:bn+'―'+c.sub};
  // 元の「注記」（分岐元の線と同じ鉄塔・線を通る、という記録）は中身を確かめ、言い換えて「分岐元との関係」に残す（2026-11-16 変更レビューの要修正1）
  {const n=l.attributes.filter(a=>a.label==='注記');if(c.note?(n.length!==1||!n[0].value.startsWith(c.note)):n.length)throw Error('分岐線：元の注記が想定と違う '+c.id);
   l.attributes=l.attributes.filter(a=>a.label!=='注記');
   note(l,'分岐元との関係',`${c.from}側から分岐点までは${p.name}と同じ鉄塔（線路）を${c.note?'通る（以前の記録：'+c.note.replace(/通り$/,'通る')+'）':c.told?'通る（'+c.told+'）':'通るとみられる（OSM で分岐元の線と同じ線分だったことによる推定）'}。地図ではこの区間を${p.name}として描き、分岐線は分岐点から先だけを描く（2026-11-16 オーナー指示）。分岐点で電気的につながるのか、同じ鉄塔に載る別の回線なのかは一次資料では未確認。`);}
  const part=keep.filter(w=>p.osmIds.includes(w.id)).map(w=>w.id);
  note(l,'地理参照',`OSM ${l.osmIds.length}線分（way ${l.osmIds.join('・')}、計約${newKm.toFixed(1)}km${part.length?'。way '+part.join('・')+' は一部だけ（残りは'+p.name+'）':''}）。分岐元の線（${p.name}）と重ねていた区間は外した。個別回線は未確認。`);
  note(l,'分岐点の推定',`${p.name}との分岐点は、OSM で${p.name}と共有するノード（node ${node}）とみなした（推定）。一次資料では未確認。`);
  note(l,'潮流の読み替え',`OCCTOの行（${l.name}、${c.from}側の端）を${p.name}との分岐点と読み替え、この線（分岐点～${c.sub}）だけに潮流を表示する。行の値は行単位の値（区間ごとの値ではない）で、分岐線の区間の値かは未確認。${p.name}の区間には当てない。`);
  note(l,'経路の訂正（2026-11-16）',`${c.from}側の端を${p.name}との分岐点に変え、${p.name}と同じ OSM の線分として重ねて描いていた部分（約${(oldKm-newKm).toFixed(1)}km）を外した（計約${oldKm.toFixed(1)}km→約${newKm.toFixed(1)}km）。オーナー指示（2026-11-16）。`);}
}
const tiers=applyTiers('chubu',lines,facilities);console.log('chubu tiers',JSON.stringify(tiers));
// 関開閉所の属性を関西のデータとそろえる（scripts/seki-switchyard.mjs、2026-11-16）
{const {applySekiAttributes}=await import('./seki-switchyard.mjs');applySekiAttributes(facilities);}
// 保留133（2026-11-19 回答「いずれも推奨で承認」）：長野発電所と関開閉所への電源線（推定）、小坂川発電所（scripts/chubu-133.mjs）
{const {applyChubu133,applyChubu134}=await import('./chubu-133.mjs');applyChubu133(lines,facilities);applyChubu134(lines,facilities);}
// 三好分岐線（保留119a）の C の理由を書き直す：判定の「別名の線を経由（612）」の 612 は同じ線の線番号で、別の線ではない。B には上げない（安全側）
{const l=lines.find(x=>x.id==='ledger-infer-chubu-275-253586148'),a=l?.attributes.find(a=>a.label==='照合の根拠');if(!a||a.value!=='別名の線を経由（612）。')throw Error('三好分岐線：照合の根拠が想定と違う '+a?.value);
 a.value='OSM の線名タグが線番号「612」で正式名（三好分岐線）と一致しないため、機械の判定では別名の線の扱いで C（612 は同じ線の線番号）。分岐点も推定。';}
// 公表図の線形で描いた線は、C区分の注記（OSMの地理登録だけで描いた）を書き換える
for(const l of lines)if(l.publishedRoute)for(const a of l.attributes)if(a.label==='要注意（C区分）')a.value='線の存在と電圧は中部PGの公表マップで確認したが、線名・端点は伏せられていて所在地から当てた（推定）。経路は公表マップの線形をそのまま使った参考表示。';
// 保留130-6（2026-11-18）：御母衣幹線（→御母衣北幹線）と御母衣発電所を関西のデータへ移す（scripts/move-to-kansai-130.mjs）。関西の builder より先に実行する
{const {moveToKansai130}=await import('./move-to-kansai-130.mjs');moveToKansai130('chubu',lines,facilities);}
for(const l of lines)for(const c of l.connections)for(const f of c.facilities)if(!facilities.some(x=>x.id===f.id))throw Error('Unknown Chubu facility '+f.id);
const ids=[...lines,...facilities].map(x=>x.assetId);if(new Set(ids).size!==ids.length)throw Error('Duplicate Chubu asset IDs');
const data={schemaVersion:1,datasetId:'chubu-500-v1',rights:'pending',
 coverage:'中部500kV・275kV・'+lines.length+'路線'+facilities.length+'設備の限定検証（OCCTO中部の500kV全17区間と275kV全64区間。地理はOSM）。名古屋都市部などOSMに経路のない275kV '+lines.filter(l=>l.schematic).length+'区間は両端を結ぶ直線（D区分）。',
 retrievedAt:source.requests.map(r=>r.retrievedAt).sort().at(-1),osmTimestamp:source.requests.map(r=>r.osmBase).filter(Boolean).sort().join(' – '),
 license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',sourceUrl:'https://overpass-api.de/api/interpreter',sources:source.requests.map(({name,endpoint,retrievedAt,sha256})=>({file:name,url:endpoint,retrievedAt,sha256})),
 lines,facilities,changePlans:[]};
{const n=lines.filter(l=>l.publishedRoute).length;if(n)data.coverage+='中部PGの公表マップの線形で描いた電源線 '+n+'区間（奥矢作）。';}
data.coverage+='照合区分 A'+tiers.A+'・B'+tiers.B+'・C'+tiers.C+(tiers.D?'・D'+tiers.D:'')+'（A・Bは公表区間の両端にOSMの線で到達したもの。要注意はC・Dのみ）。';
const text=JSON.stringify(publicWording(data,'chubu-trunk.json'),null,2)+'\n';writeFileSync('public/data/chubu-trunk.json',text);
writeFileSync('config/chubu-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(text).digest('hex'),lineIds:lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(lines.map(l=>[l.assetId,l.voltageKV])),lineCurrentTypes:Object.fromEntries(lines.filter(l=>l.currentType!=='ac').map(l=>[l.assetId,l.currentType])),facilityIds:facilities.map(f=>f.assetId)},null,2)+'\n');
// OCCTO→地図の対応表を画面用モジュールへ書き出す（src/chubu-pairs.ts）
// 分岐線（上の BRANCH_CUT）は、分岐元の側の端の設備を「分岐点」にする（2026-11-16 オーナー指示）。元の docs/research/chubu-occto-pairs.json は変えない
const BRANCH_PAIRS={'静岡東分岐線':['駿河変電所',5],'静岡西分岐線':['駿遠変電所',5],'愛知分岐線':['電源名古屋',6],'飛騨分岐線':['岐阜開閉所',5]};
const pairs=read('docs/research/chubu-occto-pairs.json').pairs.map(p=>{const b=BRANCH_PAIRS[p[0]];if(!b)return p;if(p[b[1]]!==b[0])throw Error('分岐線の照合表：元の端が想定と違う '+p[0]);const q=[...p];q[b[1]]='分岐点';return q;});
if(Object.keys(BRANCH_PAIRS).some(n=>!pairs.some(p=>p[0]===n&&p.includes('分岐点'))))throw Error('分岐線の照合表：行がない');
const header='// 生成ファイル（scripts/build-chubu.mjs）。元は docs/research/chubu-occto-pairs.json（tools/prep/adopt-chubu.mjs）。手で編集しない。\n// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]\n';
writeFileSync('src/chubu-pairs.ts',header+'export const pairs=[\n'+pairs.map(p=>' '+JSON.stringify(p).replaceAll('"',"'")).join(',\n')+',\n] as const;\n');
console.log('Chubu dataset',lines.length,'lines',facilities.length,'facilities');
