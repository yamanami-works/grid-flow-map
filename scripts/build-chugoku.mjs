// Builds the Chugoku validation dataset (public/data/chugoku-trunk.json) and its pinned approval from the adopted sections
// (docs/research/chugoku-adopted.json, produced by tools/prep/adopt-chugoku.mjs). All lines are C tier (OSM routes only, 要注意).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyTiers} from './assign-tiers.mjs';
import {mergeJpower,annotateJpower} from './jpower.mjs';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const adopted=read('docs/research/chugoku-adopted.json');
const source=read('data/raw/chugoku-osm/source.json');
const lines=[...adopted.lines],facilities=adopted.facilities.map(f=>({...f}));
// 基幹系統に接続する発電所（tools/prep/adopt-plants.mjs、2026-10-02）：追加の発電所・OCCTO公表外の電源線と、既存の発電所へのOSM登録値
let plants=null;try{plants=read('docs/research/chugoku-plants-adopted.json');}catch{}
if(plants){for(const f of plants.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...plants.lines);
 for(const e of plants.enriched){const f=facilities.find(x=>x.id===e.id);if(f&&f.assetId?.startsWith('chugoku-'))f.attributes=[...(f.attributes??[]).filter(a=>!e.attributes.some(b=>b.label===a.label)),...e.attributes];}}
// 地域間連系線（tools/prep/adopt-ties.mjs、2026-10-03）：このエリアが端になる線を同じIDで入れる。端の設備は自エリアのものを優先し、相手側はそのエリアの設備を使う。潮流は未反映。
let ties=null;try{ties=read('docs/research/ties-adopted.json');}catch{}
if(ties)for(const l of ties.lines.filter(l=>l.regions.includes('chugoku'))){const {regions,...line}=l;lines.push(line);for(const c of l.connections)for(const x of c.facilities)if(!facilities.some(f=>f.id===x.id)){const {region,...f}=ties.facilities.find(f=>f.id===x.id);facilities.push(f);}}
// 保留区間（tools/prep/adopt-holds-west.mjs、2026-10-03「保留分を進めて」）
let holds=null;try{holds=read('docs/research/holds-west-adopted.json')['chugoku'];}catch{}
if(holds){for(const f of holds.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...holds.lines);}
// 照合区分（A/B/C）を東京と同じ規則で付け直す（scripts/assign-tiers.mjs、2026-10-03）
// 電源開発・公表台帳の線（scripts/jpower.mjs、2026-10-04）
// 御調開閉所・三原開閉所（2026-10-25 オーナー承認 保留16 案v4）：中国電力ネットワーク「中国エリアの送変電設備形成計画の概要」別紙と OCCTO「2026年度供給計画の取りまとめ」（どちらも2026-03-30）に名前と廃止の予定がある。
// 今日（2026-10-25）は運用中なので状態は変えず、属性「計画（廃止予定）」に書く。御調は OSM の名前のない区画（オーナー確認）、三原は OSM に区画がなく国土地理院の変電所の地図記号の位置（推定）
{const fac=read('data/raw/chugoku-osm/facilities.json');const sw=fac.elements.find(e=>e.type==='way'&&e.id===541009058);if(!sw||sw.tags?.power!=='substation'||sw.tags?.name)throw Error('御調：OSMの区画のタグが変わった');
 if(facilities.some(f=>/御調|三原開閉所/.test(f.name)||f.id==='osm-way-541009058'))throw Error('御調・三原：重複');
 const v=sw.geometry.map(q=>[q.lat,q.lon]).slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const PLAN='中国電力ネットワーク「中国エリアの送変電設備形成計画の概要」別紙（2026-03-30、https://www.energia.co.jp/nw/press/assets/2025/np20260330-1a.pdf ）・電力広域的運営推進機関「2026年度供給計画の取りまとめ」（2026-03-30、https://www.occto.or.jp/assets/hyougiinkai/002734/2025_4_1.pdf ）（どちらも2026-10-25確認）';
 facilities.push({id:'osm-way-541009058',assetId:'chugoku-fac-way-541009058',name:'御調開閉所',kind:'switchyard',position:pos,voltages:[220],scopeConnected:true,url:'https://www.openstreetmap.org/way/541009058',
  attributes:[{label:'OSM登録',value:'名称なし（無名の区画、power=substation）'},
   {label:'名称・位置の根拠',value:'名前は'+PLAN+'の「御調開閉所」。この区画が御調開閉所であることはオーナーの確認（2026-10-25）。広島東幹線（井原側）と北尾道連絡線が、ともに OSM の線でこの区画に入る。'},
   {label:'計画（廃止予定）',value:PLAN+'：御調開閉所廃止（220kV、2026年11月）。広島東幹線 22万V △15km は2026年4月に廃止（中国電力ネットワークの別紙の区間の記載は御調開閉所～井原開閉所。OCCTO の資料の31ページ（図4-1）には御調～三原の廃止が示されている（オーナー確認）ので、オーナー判断で御調～三原とした）。'},
   {label:'出典',value:'地理はOSM（2026-10-02時点 data/raw/chugoku-osm）。'+PLAN+'。'}]});
 facilities.push({id:'chugoku-place-三原開閉所',assetId:'chugoku-place-三原開閉所',name:'三原開閉所',kind:'switchyard',position:[34.55414,133.04076],voltages:[220],scopeConnected:true,
  attributes:[{label:'要注意（位置推定）',value:'OSM に区画がなく、一次資料に位置の記載がない。国土地理院の変電所の地図記号の位置に置いた（名前の注記なし）。'},
   {label:'位置の根拠',value:'国土地理院 ベクトルタイル（試験公開、ズーム14、2026-10-24〜25取得）の変電所の地図記号（北緯34.55414・東経133.04076）。新広島変電所から国土地理院の送電線記号で約32.4km（資料の新広島～三原 28km とは約4km 違う）。オーナー確認（2026-10-25）：御調開閉所の西側の開閉所。'},
   {label:'系統との接続',value:'広島東幹線（新広島～三原開閉所）の端。資料にある「三原開閉所～A線（名称をマスキング）」の線は描いていない（線名・経路が分からない）。'},
   {label:'計画（廃止予定）',value:PLAN+'：三原開閉所廃止（220kV、2028年12月）。広島東幹線一部増強（新広島変電所～三原開閉所、28km）・A線一部増強・新三原支線新設・新三原変電所新設（いずれも2028年12月）。'},
   {label:'出典',value:PLAN+'。位置は国土地理院（2026-10-24〜25取得）。'}]});}
// 新小野田変電所（2026-11-10 オーナー承認 保留100）：中国電力ネットワーク 系統空容量 No.基L12・基L14 の端点「新小野田（変）」。OSM に区画がないので、
// 新山口・山口の側から来る OSM の線名なしの 220kV・2回線の線（way 318438197）の端（node 3248383174）に置く（位置推定）。新小野田発電所は plant-primary-sources.json の addFacilities で足す
{const raw=read('data/raw/chugoku-osm/lines-220.json');const w=raw.elements.find(e=>e.type==='way'&&e.id===318438197);
 if(!w||w.tags?.power!=='line'||w.tags?.voltage!=='220000'||w.tags?.name||w.nodes.at(-1)!==3248383174)throw Error('新小野田：OSMの線 318438197 が変わった');
 const n=raw.elements.find(e=>e.type==='node'&&e.id===3248383174);if(facilities.some(f=>/新小野田/.test(f.name)))throw Error('新小野田変電所：重複');
 const SRC='中国電力ネットワーク 系統空容量（220kV以上・送電線、2026-09-28更新、data/raw/tso-lines 2026-10-09取得）No.基L12・基L14、同 系統空容量マップ（220kV以上、ページの更新 2026-10-28、2026-11-09確認）の基S6';
 facilities.push({id:'chugoku-place-新小野田変電所',assetId:'chugoku-place-新小野田変電所',name:'新小野田変電所',kind:'substation',position:[n.lat,n.lon],voltages:[220],scopeConnected:true,
  attributes:[{label:'要注意（位置推定）',value:'OSM に区画がなく、一次資料に位置の記載がない。新山口・山口の側から来る OSM の線名なしの 220kV の線の端に置いた。国土地理院の発電所等の地図記号（約120m 北西）とも、地図注記「新小野田発電所」（約400m 北西）とも位置が一致しない。'},
   {label:'名称・位置の根拠',value:'名前は一次資料の端点「新小野田（変）」。位置は OSM の線名なしの 220kV・2回線の線（way 318438197）の端（node 3248383174、'+raw.osm3s.timestamp_osm_base.slice(0,10)+'時点）。国土地理院 ベクトルタイル（試験公開、ズーム14、2026-11-10取得）の発電所等の地図記号（北緯33.96867・東経131.16615）と、地図注記（2026-11-09取得）の「新小野田発電所」（北緯33.96983・東経131.16354）が近くにある。'},
   {label:'系統との接続',value:'新小野田火力連絡線（新山口変電所から）と新小野田火力山口線（山口変電所から）の端。新小野田発電所はこの変電所に直接つながるとみなした（推測）。'},
   {label:'出典',value:SRC+'。地理はOSM（data/raw/chugoku-osm）。2026-11-10 オーナー承認（保留100）。'}]});}
mergeJpower('chugoku',lines,facilities);annotateJpower('chugoku',lines,facilities);{const {applyEndFixes}=await import('./end-fixes.mjs');applyEndFixes('chugoku',lines,facilities);}
// 柳井火力発電所（2026-11-09 オーナー承認 保留99）：電源線を柳井火力連絡線（東山口変電所へ、中国電力ネットワーク 系統空容量 No.基L19）にしたので、「系統との接続」を書き換える
{const p=facilities.find(f=>f.id==='osm-way-605420904');if(!p||p.name!=='柳井火力発電所')throw Error('柳井火力発電所がない');
 p.attributes=p.attributes.map(a=>a.label==='系統との接続'?{...a,value:'柳井火力連絡線（220kV）で東山口変電所へ（中国電力ネットワーク 系統空容量 No.基L19。経路はOSM）。OCCTOの公表区間ではない。'}:a);}
// 岩国火力発電所の連系線（2026-11-09 オーナー承認 保留97「削除する」）：OSM の4回線の線 way 641638469 の東側（node 6042171191～6042171189）を
// 発電所への電源線として描いていたが、東端は新岩国変電所の区画の西約25mで、新岩国連絡線（終点を新岩国変電所にした）と同じ区間になる（重複の禁止）。
// 発電所は2020-06-30に廃止。線は承認済み削除リストに載せ、発電所の点は残す
{const i=lines.findIndex(l=>l.id==='chugoku-plant-220-way-605420903');if(i<0||lines[i].name!=='岩国火力発電所の連系線')throw Error('岩国火力発電所の連系線がない');lines.splice(i,1);
 const p=facilities.find(f=>f.id==='osm-way-605420903');if(!p)throw Error('岩国火力発電所がない');
 p.attributes=p.attributes.map(a=>a.label==='系統との接続'?{...a,value:'OSMでは新岩国変電所の東隣。以前は新岩国変電所の脇まで延びるOSMの220kVの線を電源線として描いていたが、その区間は新岩国連絡線（新岩国変電所への引込）と同じで、電源線としては収録しない（2026-11-09 オーナー承認）。OCCTOの公表区間ではない。'}:a);}
// 俣野川開閉所と俣野川線・新鳥取線（2026-10-20 オーナー承認 保留3-A）：中国電力ネットワークの系統空容量（220kV以上・送電線）の
// 基L39「俣野川線 日野(変)→俣野川(開)」・基L40「新鳥取線 新鳥取(変)→俣野川(開)」は、OSM の線が無名で未描画だった。
// OSM の無名の 220kV の区画 way 1417209902 から、無名の 220kV・2回線の線で日野変電所・新鳥取変電所の両方にたどり着く。区画の名前は所在地から当てた（C区分）。
// 発電所（地下式、chugoku-place-俣野川発電所）は docs/research/plant-primary-sources.json の addFacilities で足す
{const raw=read('data/raw/chugoku-osm/lines-220.json'),fac=read('data/raw/chugoku-osm/facilities.json');
 const at=raw.osm3s?.timestamp_osm_base?.slice(0,10),fat=fac.osm3s?.timestamp_osm_base?.slice(0,10);if(!at||!fat)throw Error('俣野川：OSMの取得時点が原本にない');
 const node=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const way=id=>{const w=raw.elements.find(e=>e.type==='way'&&e.id===id);if(!w||w.tags?.power!=='line'||w.tags?.voltage!=='220000'||w.tags?.name||w.tags?.circuits!=='2')throw Error('俣野川：OSMの線 '+id+' のタグが変わった');return w;};
 const sw=fac.elements.find(e=>e.type==='way'&&e.id===1417209902);if(!sw||sw.tags?.power!=='substation'||sw.tags?.voltage!=='220000'||sw.tags?.name)throw Error('俣野川：OSMの区画のタグが変わった');
 const ring=sw.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const near=(p,poly,m)=>poly.some(q=>{const t=Math.PI/180;return 6371000*Math.hypot((q[1]-p[1])*t*Math.cos(p[0]*t),(q[0]-p[0])*t)<m;});
 const facPoly=id=>{const e=fac.elements.find(x=>x.type==='way'&&x.id===id);if(!e)throw Error('俣野川：OSMの設備 '+id+' がない');return e.geometry.map(q=>[q.lat,q.lon]);};
 const hino=facilities.find(f=>f.id==='osm-way-242103481'),tottori=facilities.find(f=>f.id==='osm-way-641527416');if(hino?.name!=='日野変電所'||tottori?.name!=='新鳥取変電所')throw Error('俣野川：日野・新鳥取の変電所がない');
 if(facilities.some(f=>f.id==='osm-way-1417209902'||/俣野川開閉所/.test(f.name)))throw Error('俣野川開閉所：重複');
 const SRC='中国電力ネットワーク 系統空容量（220kV以上・送電線）（data/raw/tso-lines ほか、2026-10-04取得）';
 facilities.push({id:'osm-way-1417209902',assetId:'chugoku-fac-way-1417209902',name:'俣野川開閉所',kind:'switchyard',position:pos,voltages:[220],scopeConnected:true,url:'https://www.openstreetmap.org/way/1417209902',
  attributes:[{label:'OSM登録',value:'名称なし（無名の区画）、電圧：220kV'},
   {label:'名称・位置の根拠',value:'OSMの無名の 220kV の区画。'+SRC+'の「俣野川(開)」（俣野川線・新鳥取線の端点）に、所在地（俣野川ダムの近く、鳥取県日野郡江府町）と、日野変電所・新鳥取変電所の両方に OSM の 220kV の線でたどり着くことから当てた（推定）。国土地理院の地図注記「俣野川地下発電所」が約958m 南。'},
   {label:'出典',value:'地理はOSM（'+fat+'時点 data/raw/chugoku-osm）。名称は'+SRC+'。'}]});
 // 線分をつないだ順の [{id, nodes}]（向きをそろえる）
 const segsOf=ids=>{const out=[];for(const id of ids){let n=[...way(id).nodes];if(out.length){const last=out.at(-1).nodes;
   if(n[0]===last.at(-1)){}else if(n.at(-1)===last.at(-1))n.reverse();else if(out.length===1&&(n[0]===last[0]||n.at(-1)===last[0])){last.reverse();if(n[0]!==last.at(-1))n.reverse();}else throw Error('俣野川：線分 '+id+' がつながらない');}
   out.push({id,nodes:n});}return out;};
 const mk=(name,no,from,ids,dir)=>{let segs=segsOf(ids);const fp=facPoly(Number(from.id.split('-').pop()));
  if(!near(node.get(segs[0].nodes[0]),fp,200)){segs=segs.reverse().map(x=>({id:x.id,nodes:[...x.nodes].reverse()}));}
  const first=segs[0].nodes[0],last=segs.at(-1).nodes.at(-1);
  if(!near(node.get(first),fp,200)||!near(node.get(last),ring,200))throw Error(name+'：両端が設備に届かない');
  {const areas=fac.elements.filter(e=>e.type==='way'&&e.geometry&&/^(substation|plant|switchgear)$/.test(e.tags?.power??'')&&e.id!==1417209902&&e.id!==Number(from.id.split('-').pop())).map(e=>e.geometry.map(q=>[q.lat,q.lon]));
   const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
   for(const x of segs)for(const n of x.nodes){const p=node.get(n);if(areas.some(R=>inside(p,R)))throw Error(name+'：途中で別の設備の区画を通る');}}
  const paths=segs.map(x=>x.nodes.map(n=>node.get(n)));const t=Math.PI/180;
  const km=paths.flatMap(p=>p.slice(1).map((q,i)=>6371*Math.hypot((q[1]-p[i][1])*t*Math.cos(q[0]*t),(q[0]-p[i][0])*t))).reduce((a,c)=>a+c,0).toFixed(1);
  lines.push({id:'chugoku-220-'+name,assetId:'chugoku-220-'+name,name,named:false,voltageKV:220,currentType:'ac',osmIds:segs.map(x=>x.id),paths,
   connections:[{node:first,position:node.get(first),status:'facility-area',facilities:[{id:from.id,name:from.name}],neighborWays:[]},{node:last,position:node.get(last),status:'facility-area',facilities:[{id:'osm-way-1417209902',name:'俣野川開閉所'}],neighborWays:[]}],
   referenceReview:{status:'partial',endpoints:from.name+'―俣野川開閉所'},
   attributes:[{label:'公表の行',value:'中国電力ネットワーク 系統空容量（220kV以上・送電線） No.'+no+'：'+name+'（220kV）、2回線、'+dir},
    {label:'根拠',value:'端点：公表の端点「'+dir.split('→')[0]+'」（OSMの'+from.name+'）と「俣野川(開)」（OSMの無名の 220kV の区画、所在地から俣野川開閉所とみなした）。経路：両端の間を OSM の無名の 220kV・2回線の線でたどった（線の節点が両端以外の設備の区画に入らないことを確かめた）。'},
    {label:'端点の根拠',value:'端点「俣野川(開)」は、OSM の無名の 220kV の区画とみなした（所在地から当てた推定。この区画を俣野川開閉所とした）。'},
    {label:'区分',value:'各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。'},
    {label:'地理参照',value:'OSM '+segs.length+'線分（約'+km+'km）、OSMの線名：なし、回線数 2（OSM・空容量一覧とも2回線）。個別回線は未確認。'},
    {label:'出典',value:SRC+'。地理はOSM（'+at+'時点 data/raw/chugoku-osm）。2026-10-20 オーナー承認（未描画の区間から描画）。'}]});};
 mk('俣野川線','基L39',hino,[317525038],'日野(変)→俣野川(開)');
 mk('新鳥取線','基L40',tottori,[431858530,317525046],'新鳥取(変)→俣野川(開)');}
// 南原発電所の開閉所と2本の線（2026-10-24 オーナー承認 保留10）：南原発電所（純揚水、日立評論 1976-12「山陰幹線上」）は系統空容量の一覧に行がない（電源線）。
// OSM の無名の 220kV 区画 way 317980479（substation=generation）を開閉所とみなし（名前は推定）、山陰幹線の共有ノード node 3243211862 から無名の 220kV・2回線の線でつなぐ（分岐点は推測）。
// 開閉所から北へ約1kmの無名の 220kV・2回線の線（架空）の北端から、国土地理院の発電所記号の位置（chugoku-place-南原発電所、plant-primary-sources.json の addFacilities）まで約48mを直線で補う（接続は推測）。
// OSM の2本の経路は国土地理院の送電線記号（2026-10-24取得）と全区間で約8m以内に重なる（照合は docs/TIERS_WEST.md「南原」）
{const raw=read('data/raw/chugoku-osm/lines-220.json'),fac=read('data/raw/chugoku-osm/facilities.json');
 const at=raw.osm3s?.timestamp_osm_base?.slice(0,10),fat=fac.osm3s?.timestamp_osm_base?.slice(0,10);if(!at||!fat)throw Error('南原：OSMの取得時点が原本にない');
 const node=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const way=(id,two)=>{const w=raw.elements.find(e=>e.type==='way'&&e.id===id);if(!w||w.tags?.power!=='line'||w.tags?.voltage!=='220000'||w.tags?.name||(two&&w.tags?.circuits!=='2'))throw Error('南原：OSMの線 '+id+' のタグが変わった');return w.nodes;};
 const sw=fac.elements.find(e=>e.type==='way'&&e.id===317980479);if(!sw||sw.tags?.power!=='substation'||sw.tags?.substation!=='generation'||sw.tags?.voltage!=='220000'||sw.tags?.name)throw Error('南原：OSMの区画のタグが変わった');
 const ring=sw.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 const dm=(a,b)=>{const t=Math.PI/180;return 6371000*Math.hypot((b[1]-a[1])*t*Math.cos(a[0]*t),(b[0]-a[0])*t);};
 const km=p=>(p.slice(1).reduce((s,q,i)=>s+dm(p[i],q),0)/1000).toFixed(1);
 if(facilities.some(f=>f.id==='osm-way-317980479'||/南原/.test(f.name)&&f.kind!=='plant'))throw Error('南原の開閉所：重複');
 const plant=facilities.find(f=>f.id==='chugoku-place-南原発電所');if(!plant||plant.kind!=='plant')throw Error('南原：発電所（plant-primary-sources.json）がない');
 const san=lines.find(l=>l.id==='ledger-chugoku-220-317991389'),J=3243211862;if(san?.name!=='山陰幹線'||!san.osmIds.includes(317991389)||!san.osmIds.includes(153168442))throw Error('南原：山陰幹線が想定と違う');
 if(!san.paths.some(p=>p.some(q=>q[0]===node.get(J)[0]&&q[1]===node.get(J)[1])))throw Error('南原：分岐点が山陰幹線の上にない');
 const SW={id:'osm-way-317980479',name:'南原発電所の開閉所（推定）'};
 facilities.push({id:SW.id,assetId:'chugoku-fac-way-317980479',name:SW.name,kind:'switchyard',position:pos,voltages:[220],scopeConnected:true,url:'https://www.openstreetmap.org/way/317980479',
  attributes:[{label:'OSM登録',value:'名称なし（無名の区画）、電圧：220kV、substation=generation'},
   {label:'名称・位置の根拠',value:'OSMの無名の 220kV の区画。一次資料に名前がないため、南原発電所（広島市安佐北区、中国電力のお知らせ 2024-03-31）の近くにあり、発電所と山陰幹線の両方に OSM の 220kV の線でたどり着くことから、南原発電所の開閉所とみなした（推定）。国土地理院の空中写真（2026-10-24取得）で南原ダムの直下に屋外の開閉設備が見え、国土地理院の地図注記「南原ダム」が約470m 北。'},
   {label:'注意',value:'区画の南の端に国土地理院の発電所記号があるが、どの発電所か（種別・名前）は確かめられていない（発電所としては足さない）。'},
   {label:'出典',value:'地理はOSM（'+fat+'時点 data/raw/chugoku-osm）。国土地理院 地図注記・シームレス空中写真（2026-10-24取得）。2026-10-24 オーナー承認。'}]});
 const pts=ids=>ids.map(n=>{const p=node.get(n);if(!p)throw Error('南原：節点 '+n+' がない');return p;});
 const areas=fac.elements.filter(e=>e.type==='way'&&e.geometry&&/^(substation|plant|switchgear)$/.test(e.tags?.power??'')&&e.id!==317980479).map(e=>e.geometry.map(q=>[q.lat,q.lon]));
 const noOther=(name,p)=>{if(p.some(q=>areas.some(R=>inside(q,R))))throw Error(name+'：途中で別の設備の区画を通る');};
 // 線1：分岐点 → 開閉所（way 317980484 は区画の東の node 3243211764 から分岐点へ向かうので逆にたどり、way 1427454290 で区画の中へ）
 const n1=way(317980484,true),n1b=way(1427454290);if(n1[0]!==3243211764||n1.at(-1)!==J||n1b[0]!==3243211764)throw Error('南原：線1の線分がつながらない');
 const p1a=pts([...n1].reverse()),p1b=pts(n1b),p1=[...p1a,...p1b.slice(1)];if(!inside(p1.at(-1),ring))throw Error('南原：線1が区画に届かない');noOther('南原：線1',p1);
 // 線2：開閉所 → 北端（way 1427454288 で区画の中から出て、way 1427454298 で北へ）→ 発電所記号の位置
 const n2a=way(1427454288),n2=way(1427454298,true);if(n2a[0]!==n2[0]||!inside(node.get(n2a.at(-1)),ring))throw Error('南原：線2の線分がつながらない');
 const p2a=pts([...n2a].reverse()),p2b=pts(n2),p2=[...p2a,...p2b.slice(1)];const tail=dm(p2.at(-1),plant.position);if(tail>60)throw Error('南原：線2の北端と発電所の位置が離れすぎ');noOther('南原：線2',p2);
 const SRC='中国電力 お知らせ「南原発電所からの漏油について」（2024-03-31、揚水式・広島市安佐北区）。日立評論 Vol.58 No.12（1976-12、資料の作成日。2026-10-24確認）：「島根原子力発電所と広島地区とを結ぶ山陰幹線上」の純揚水発電所';
 const GSI='国土地理院 ベクトルタイル（試験公開、experimental_bvmap ズーム16、送電線 ftCode 8202、2026-10-24取得）';
 lines.push({id:'chugoku-plant-220-way-317980484',assetId:'chugoku-plant-220-way-317980484',name:'南原発電所の連系線',named:false,voltageKV:220,currentType:'ac',osmIds:[317980484,1427454290],paths:[p1a,p1b],
  connections:[{node:J,position:node.get(J),status:'shared-node',facilities:[],neighborWays:[]},{node:n1b.at(-1),position:p1.at(-1),status:'facility-area',facilities:[SW],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'山陰幹線の分岐点―'+SW.name},
  attributes:[{label:'区分',value:'系統空容量の一覧（中国電力ネットワーク、2026-09-28更新）にない電源線。OCCTOの地内実績に行がないため潮流なし。'},
   {label:'端点の根拠',value:'山陰幹線側の端は分岐点とみなした（推測）。分岐点は、OSMの山陰幹線 way 317991389 と広島変電所へ向かう線 way 153168442 の共有ノード node 3243211862。'+SRC+'から山陰幹線につながるとしたが、π（引き込み）かT（分岐）かは一次資料で分からない。現在の接続は系統空容量の一覧に行がなく未確認。既存の山陰幹線の端点は変えない。'},
   {label:'経路の根拠',value:'OSM の無名の 220kV・2回線の線（way 317980484）と区画への引込（way 1427454290）。'+GSI+'と全区間で約8m以内に重なる。'},
   {label:'地理参照',value:'OSM 2線分（約'+km(p1)+'km）、OSMの線名：なし、回線数 2。個別回線は未確認。'},
   {label:'出典',value:SRC+'。地理はOSM（'+at+'時点 data/raw/chugoku-osm）。経路は'+GSI+'で確認。2026-10-24 オーナー承認（照合区分 C）。'}]});
 lines.push({id:'chugoku-plant-220-way-1427454298',assetId:'chugoku-plant-220-way-1427454298',name:'南原発電所の電源線',named:false,voltageKV:220,currentType:'ac',osmIds:[1427454288,1427454298,-14274542981],paths:[p2a,p2b,[p2.at(-1),plant.position]],schematicParts:[{osmId:-14274542981,construction:'underground'}],
  connections:[{node:n2a.at(-1),position:p2[0],status:'facility-area',facilities:[SW],neighborWays:[]},{node:null,position:plant.position,status:'facility-area',facilities:[{id:plant.id,name:plant.name}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:SW.name+'―南原発電所'},
  attributes:[{label:'区分',value:'系統空容量の一覧にない電源線（開閉所と発電所の間）。潮流なし。'},
   {label:'端点の根拠',value:'北端は、OSMの線の末端（node '+n2.at(-1)+'。国土地理院の空中写真で、碍子のようなものが6つ並ぶ小さな屋外設備が見える）から、国土地理院の発電所記号の位置まで約'+Math.round(tail)+'mを直線で補い、南原発電所に接続するとみなした（推測）。屋外設備は架空線と地下の発電所へのケーブルのつなぎ目とみられる（推定）。'},
   {label:'線種',value:'架空（実線）。2026-10-24 オーナーが国土地理院の空中写真で架空と確認。北端の約'+Math.round(tail)+'mの直線は、地下の発電所へのケーブルと推定して点線（経路は不明）。'},
   {label:'経路の根拠',value:'OSM の無名の 220kV・2回線の線（way 1427454298）と区画からの引出（way 1427454288）。'+GSI+'と全区間で約8m以内に重なる。'},
   {label:'地理参照',value:'OSM 2線分（約'+km(p2)+'km）と北端の直線 約'+Math.round(tail)+'m、OSMの線名：なし、回線数 2。個別回線は未確認。'},
   {label:'出典',value:SRC+'。地理はOSM（'+at+'時点 data/raw/chugoku-osm）。経路・北端は'+GSI+'と国土地理院 シームレス空中写真（撮影年未確認、2026-10-24取得）。2026-10-24 オーナー承認。'}]});}
// 三隅火力発電所の電源線（2026-11-10 オーナー承認 保留101）：OSM の電圧のタグは 275kV だが、中国電力ネットワークの系統空容量マップ（220kV以上）と系統構成（2025年度）で
// 三隅の発電所の記号と西島根（基S23）を結ぶ線は 22万V の線種（系統構成では基L50）。電圧を 220kV にし、両端は図で確かめられたので（推定）を外す。ID は変えない
{const l=lines.find(x=>x.id==='plant-chugoku-275-320724305'),p=facilities.find(f=>f.id==='osm-way-605433849');
 if(l?.name!=='三隅火力発電所の電源線（推定）'||l.voltageKV!==275||p?.name!=='三隅火力発電所')throw Error('三隅：電源線・発電所が想定と違う');
 const SRC='中国電力ネットワーク 系統空容量マップ（220kV以上、https://www.energia.co.jp/nw/service/retailer/keitou/access/pdf/mapping.pdf 、ページの更新 2026-10-28、2026-11-09確認）・系統構成（2025年度、keitoukousei2025.pdf、ページの更新 2026-04-24、2026-11-09確認）';
 l.voltageKV=220;l.name='三隅火力発電所の電源線';
 l.attributes=l.attributes.filter(a=>!['要注意（C区分・推定）','推定の内容','地理参照','出典'].includes(a.label));
 l.attributes.push({label:'端点の根拠',value:SRC+'で、三隅の発電所の記号と西島根（基S23）を線が結ぶ（系統構成では基L50、線名の記載なし）。'},
  {label:'電圧の根拠',value:'220kV は一次資料の図の凡例（50万V＝太線、22万V＝細線）の線種による。OSM の電圧のタグは 275kV（食い違い）。'},
  {label:'地理参照',value:'三隅火力発電所の区画の近くから OSM の線名なしの線（電圧のタグ 275kV）を共有ノードでたどり、西島根変電所に着くまで（OSM 2線分、約10.2km）。個別回線は未確認。'},
  {label:'出典',value:SRC+'。地理はOSM（app/data/raw の全取得、2026-09-20～10-06取得）。2026-11-10 オーナー承認（保留101）。'});
 p.voltages=[220];p.attributes=p.attributes.map(a=>a.label==='系統との接続'?{...a,value:'三隅火力発電所の電源線（220kV）で西島根変電所へ（'+SRC+'）。OCCTOの公表区間ではない。'}:a);
 if(!p.attributes.some(a=>a.label==='系統との接続'))p.attributes.push({label:'系統との接続',value:'三隅火力発電所の電源線（220kV）で西島根変電所へ（中国電力ネットワーク 系統空容量マップ・系統構成（2025年度））。OCCTOの公表区間ではない。'});}
const tiers=applyTiers('chugoku',lines,facilities);console.log('chugoku tiers',JSON.stringify(tiers));
// 三隅火力発電所の電源線（保留101）：両端は一次資料の図で確かめたので、要注意の文を置き換える
{const l=lines.find(x=>x.id==='plant-chugoku-275-320724305'),a=l?.attributes.find(x=>x.label==='要注意（C区分）');if(!a)throw Error('三隅：要注意（C区分）がない');a.value='両端は一次資料（中国電力ネットワークの系統空容量マップ・系統構成の図）。経路はOSMだけが根拠で、電圧は図の線種による（OSM は 275kV）。';}
// 区分付けの決まった文を end-fixes の tierNote（要注意）・tierWhy（照合の根拠）で置き換える（新岩国連絡線 2026-11-09 保留98：経路は国土地理院の送電線記号だけが根拠。柳井火力連絡線 保留99：両端は No.基L19）
{const {tierNoteFor,tierWhyFor}=await import('./end-fixes.mjs');for(const l of lines){const v=tierNoteFor('chugoku',l.id);if(v){const a=l.attributes.find(x=>x.label==='要注意（C区分）');if(!a)throw Error('要注意（C区分）がない '+l.id);a.value=v;}
 const w=tierWhyFor('chugoku',l.id);if(w){const a=l.attributes.find(x=>x.label==='照合の根拠');if(!a)throw Error('照合の根拠がない '+l.id);a.value=w;}}}
for(const l of lines)for(const c of l.connections)for(const f of c.facilities)if(!facilities.some(x=>x.id===f.id))throw Error('Unknown Chugoku facility '+f.id);
const ids=[...lines,...facilities].map(x=>x.assetId);if(new Set(ids).size!==ids.length)throw Error('Duplicate Chugoku asset IDs');
// 線のない設備（端点を確認できず保留した区間の設備：広島中央・北尾道など）は載せない。発電所は電源線がなくても隣接設備に直接つながるものを残す
for(let i=facilities.length-1;i>=0;i--){const f=facilities[i];if(f.kind!=='plant'&&!lines.some(l=>l.connections.some(c=>c.facilities.some(x=>x.id===f.id))))facilities.splice(i,1);}
// 高宮開閉所（2026-11-10 オーナー承認 保留103）：OSM の名前のない 220kV の区画 way 1427454285（オーナー指定の点 34.818147, 132.641993 の約50m 西）。
// 名前は OCCTO の地内制約要因一覧（中国電力ネットワーク）の系統図の「高宮」（開閉所の記号）。山陰幹線が区画の中を通る（線の端ではないので、線のない設備を外す処理のあとに足す）
{const fac=read('data/raw/chugoku-osm/facilities.json');const sw=fac.elements.find(e=>e.type==='way'&&e.id===1427454285);
 if(!sw||sw.tags?.power!=='substation'||sw.tags?.voltage!=='220000'||sw.tags?.name)throw Error('高宮：OSMの区画のタグが変わった');
 if(facilities.some(f=>f.id==='osm-way-1427454285'||/高宮/.test(f.name)))throw Error('高宮開閉所：重複');
 const ring=sw.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 const san=lines.find(l=>l.id==='ledger-chugoku-220-317991389');if(!san?.paths.some(p=>p.some(q=>inside(q,ring))))throw Error('高宮：山陰幹線が区画を通らない');
 facilities.push({id:'osm-way-1427454285',assetId:'chugoku-fac-way-1427454285',name:'高宮開閉所',kind:'switchyard',position:pos,voltages:[220],scopeConnected:true,url:'https://www.openstreetmap.org/way/1427454285',
  attributes:[{label:'OSM登録',value:'名称なし（無名の区画）、電圧：220kV、substation=transmission'},
   {label:'名称・位置の根拠',value:'OSMの無名の 220kV の区画。名前は電力広域的運営推進機関 第2回将来の運用容量等の在り方に関する作業会 参考資料8「地内制約要因一覧（中国電力ネットワーク株式会社）」の系統図の「高宮」（開閉所の記号、作木支線の分かれ目）。中国電力ネットワークの系統空容量マップ（220kV以上）でも山陰幹線と作木支線の分かれ目に開閉所の記号がある。オーナー指定の点（北緯34.818147・東経132.641993、2026-11-09）の約50m 西で、山陰幹線の OSM の線が区画の中を通る。'},
   {label:'系統との接続',value:'山陰幹線が区画の中を通る。作木支線の始点（OSM の共有ノード、区画の南約80m）は変えていない。系統空容量マップでは北側（松江方面）に系統切箇所（×）がある。'},
   {label:'出典',value:'地理はOSM（'+fac.osm3s.timestamp_osm_base.slice(0,10)+'時点 data/raw/chugoku-osm）。電力広域的運営推進機関 参考資料8（https://www.occto.or.jp/assets/iinkai/chouseiryoku/jukyuchousei/2024/files/unyouyouryousagyoukai_2_sankou_08.pdf 、2026-11-09確認）。中国電力ネットワーク 系統空容量マップ（220kV以上、2026-11-09確認）。2026-11-10 オーナー承認（保留103）。'}]});}
const data={schemaVersion:1,datasetId:'chugoku-trunk-v1',rights:'pending',
 coverage:'中国500kV・220kV・'+lines.length+'路線'+facilities.length+'設備の限定検証（OCCTO中国の500kV全11区間と220kV全18区間。地理はOSM）。広島中央線は分岐点を推定した直線（D区分）、広島東幹線は御調～三原の廃止（2026年4月）を反映して井原～御調と新広島～三原（国土地理院の送電線記号でなぞった）の2本に分けた、松江変電所は島根県資料の所在地で名称を当てた。',
 retrievedAt:source.requests.map(r=>r.retrievedAt).sort().at(-1),osmTimestamp:source.requests.map(r=>r.osmBase).filter(Boolean).sort().join(' – '),
 license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',sourceUrl:'https://overpass-api.de/api/interpreter',sources:source.requests.map(({name,endpoint,retrievedAt,sha256})=>({file:name,url:endpoint,retrievedAt,sha256})),
 lines,facilities,changePlans:[]};
data.coverage+='照合区分 A'+tiers.A+'・B'+tiers.B+'・C'+tiers.C+(tiers.D?'・D'+tiers.D:'')+'（A・Bは公表区間の両端にOSMの線で到達したもの。要注意はC・Dのみ）。';
const text=JSON.stringify(publicWording(data,'chugoku-trunk.json'),null,2)+'\n';writeFileSync('public/data/chugoku-trunk.json',text);
writeFileSync('config/chugoku-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(text).digest('hex'),lineIds:lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(lines.map(l=>[l.assetId,l.voltageKV])),lineCurrentTypes:Object.fromEntries(lines.filter(l=>l.currentType!=='ac').map(l=>[l.assetId,l.currentType])),facilityIds:facilities.map(f=>f.assetId)},null,2)+'\n');
// OCCTO→地図の対応表を画面用モジュールへ書き出す（src/chugoku-pairs.ts）
// 2026-10-25（保留16）：北尾道連絡線の起点を共有ノード（分岐点）から御調開閉所の区画にしたので、照合表の地図の起点名も御調開閉所にする
// 2026-11-09（保留97）：新岩国連絡線の起点を共有ノード（分岐点）から新西広島変電所の区画にしたので、照合表の地図の起点名も新西広島変電所にする
const pairs=[...read('docs/research/chugoku-occto-pairs.json').pairs,...(holds?.pairs??[])].map(p=>p[0]==='北尾道連絡線'&&p[5]==='分岐点'?[...p.slice(0,5),'御調開閉所',...p.slice(6)]:p[0]==='新岩国連絡線'&&p[5]==='分岐点'?[...p.slice(0,5),'新西広島変電所',...p.slice(6)]:p);
const header='// 生成ファイル（scripts/build-chugoku.mjs）。元は docs/research/chugoku-occto-pairs.json（tools/prep/adopt-chugoku.mjs）。手で編集しない。\n// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]\n';
writeFileSync('src/chugoku-pairs.ts',header+'export const pairs=[\n'+pairs.map(p=>' '+JSON.stringify(p).replaceAll('"',"'")).join(',\n')+',\n] as const;\n');
console.log('Chugoku dataset',lines.length,'lines',facilities.length,'facilities');
