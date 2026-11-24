// Builds the Kansai validation dataset (public/data/kansai-trunk.json) and its pinned approval from the adopted sections
// (docs/research/kansai-adopted.json, produced by tools/prep/adopt-kansai.mjs). All lines are C tier (OSM routes only, 要注意).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyTiers} from './assign-tiers.mjs';
import {mergeJpower,annotateJpower} from './jpower.mjs';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const adopted=read('docs/research/kansai-adopted.json');
const source=read('data/raw/kansai-osm/source.json');
const lines=[...adopted.lines],facilities=adopted.facilities.map(f=>({...f}));
// 基幹系統に接続する発電所（tools/prep/adopt-plants.mjs、2026-10-02）：追加の発電所・OCCTO公表外の電源線と、既存の発電所へのOSM登録値
let plants=null;try{plants=read('docs/research/kansai-plants-adopted.json');}catch{}
if(plants){for(const f of plants.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...plants.lines);
 for(const e of plants.enriched){const f=facilities.find(x=>x.id===e.id);if(f&&f.assetId?.startsWith('kansai-'))f.attributes=[...(f.attributes??[]).filter(a=>!e.attributes.some(b=>b.label===a.label)),...e.attributes];}}
// 地域間連系線（tools/prep/adopt-ties.mjs、2026-10-03）：このエリアが端になる線を同じIDで入れる。端の設備は自エリアのものを優先し、相手側はそのエリアの設備を使う。潮流は未反映。
let ties=null;try{ties=read('docs/research/ties-adopted.json');}catch{}
if(ties)for(const l of ties.lines.filter(l=>l.regions.includes('kansai'))){const {regions,...line}=l;lines.push(line);for(const c of l.connections)for(const x of c.facilities)if(!facilities.some(f=>f.id===x.id)){const {region,...f}=ties.facilities.find(f=>f.id===x.id);facilities.push(f);}}
// 保留区間（tools/prep/adopt-holds-west.mjs、2026-10-03「保留分を進めて」）
let holds=null;try{holds=read('docs/research/holds-west-adopted.json')['kansai'];}catch{}
if(holds){for(const f of holds.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...holds.lines);}
// 発電所の2本目以降の電源線と既存の線の経路の差し替え（tools/prep/adopt-plant-extra-lines.mjs、2026-10-15）：大飯幹線（大飯→能勢）を足し、
// 大飯幹線・新綾部線の接続先の入れ替え（原子力規制委員会の資料）に合わせて新綾部線の経路を差し替える（ID・OCCTO の対応・向きは変えない）
let extra=null;try{extra=read('docs/research/plant-extra-lines.json');}catch{}
if(extra){for(const x of extra.lines.filter(x=>x.region==='kansai'))lines.push(x.line);
 for(const o of (extra.overrides??[]).filter(o=>o.region==='kansai')){const l=lines.find(x=>x.id===o.id);if(!l)throw Error('Unknown Kansai override '+o.id);
  Object.assign(l,{osmIds:o.osmIds,paths:o.paths,connections:o.connections});if(o.schematicParts?.length)l.schematicParts=o.schematicParts;else delete l.schematicParts;
  l.attributes=[...(l.attributes??[]).filter(a=>!o.removeLabels.includes(a.label)),...o.attributes];}
 // 属性だけの置き換え（経路・ID・接続は変えない、2026-10-16）：第二大飯幹線の一次資料、大飯原子力発電所の「系統との接続」
 for(const a of (extra.annotations??[]).filter(a=>a.region==='kansai')){const x=(a.kind==='line'?lines:facilities).find(y=>y.id===a.id);if(!x)throw Error('Unknown Kansai annotation '+a.id);
  // 外した項目の元の位置に差し込む（詳細パネルの表示順を保つ）
  const at=(x.attributes??[]).findIndex(b=>a.removeLabels.includes(b.label)),rest=(x.attributes??[]).filter(b=>!a.removeLabels.includes(b.label)),i=at<0?rest.length:(x.attributes??[]).slice(0,at).filter(b=>!a.removeLabels.includes(b.label)).length;
  x.attributes=[...rest.slice(0,i),...a.attributes,...rest.slice(i)];}}
// 照合区分（A/B/C）を東京と同じ規則で付け直す（scripts/assign-tiers.mjs、2026-10-03）
// 電源開発の設備（scripts/jpower.mjs、2026-10-04）
mergeJpower('kansai',lines,facilities);annotateJpower('kansai',lines,facilities);
// 大河内開閉所（2026-10-20 オーナー判断 D）：OSM の区画（名称「開閉所」）は大河内発電所（地下式揚水）の開閉所。OCCTO の運用容量の表の呼び名「大河内開閉所」に改め、
// 発電所は別の設備 kansai-place-大河内発電所（docs/research/plant-primary-sources.json の addFacilities、推定位置）として足す。線の接続先の名前も合わせる
{const f=facilities.find(x=>x.id==='osm-way-962796302');if(!f)throw Error('大河内の開閉所がない');const old=f.name;f.name='大河内開閉所';
 // 2026-11-17 オーナー指示「大河内開閉所のマークが変電所マークになっている」（保留128 K3）：種別を開閉所に（名前の根拠は下の OCCTO の端点名）
 f.kind='switchyard';
 // 「位置の確認」の地理院の注記は約1km 先の発電所のもの（開閉所の名称の確認ではない）。「名称・位置の根拠」は「位置の根拠」に改める（照合区分は変わらない：scripts/assign-tiers.mjs の C 区分を避ける条件は「名称・位置の根拠があり位置の確認がない」ときだけ働き、変更前も「位置の確認」があって働いていなかった。名称の根拠は OCCTO の表）
 f.attributes=(f.attributes??[]).map(a=>a.label==='名称・位置の根拠'?{label:'位置の根拠',value:a.value}:a);
 f.attributes=[...(f.attributes??[]).filter(a=>a.label!=='別名'&&a.label!=='名称の根拠'),{label:'別名',value:old+'（2026-10-20 までの登録名）'},{label:'名称の根拠',value:'OCCTO 系統情報サービス（関西）の運用容量の表の端点名「大河内開閉所」（播磨北線・大河内線）。潮流の表の端点名は「大河内発電所」。発電所は別の設備（kansai-place-大河内発電所）。'}];
 for(const l of lines)for(const c of l.connections??[])for(const x of c.facilities??[])if(x.id===f.id)x.name=f.name;}
// 池原発電所（電源開発、中部のデータの設備）：熊野幹線の終点（2026-10-16 オーナー判断・推測）。地域をまたぐ設備は同じID・同じ内容で入れる（中部のビルドの出力から写す）
{const f=read('public/data/chubu-trunk.json').facilities.find(x=>x.id==='osm-way-217390429');if(!f)throw Error('池原発電所が中部のデータにない');if(!facilities.some(x=>x.id===f.id))facilities.push(structuredClone(f));}
// 多奈川変電所と、多奈川変電所―泉南変電所の送電線（2026-10-17 オーナー承認）：送電線チェックの欠落（OSM「多奈二火力線」way 191880850）から。
// OCCTO 関西の運用容量に「送電線 275kV 多奈川変電所⇒泉南変電所」（線名は匿名）と「紀の川線 紀の川変電所⇒多奈川変電所」がある。実績の行はない（潮流なし）。
// 泉南側の約2kmは泉南東大阪線と同じ4回線の鉄塔（way 191880845）とみられる。3つの線分を1本の経路にまとめる（分けると、分かれ目が泉南東大阪線の経路の途中の点になり、
// 泉南東大阪線の行が分岐を含む行と扱われるため。城北線と同じ）。osmIds は自分の線分（191880850・1037516213）だけ、共用の区間は sourceOsmIds に入れる
{const raw=read('data/raw/kansai-osm/lines-275.json'),fac=read('data/raw/kansai-osm/facilities.json');
 const sub=fac.elements.find(e=>e.type==='way'&&e.id===1344336054);if(!sub||sub.tags?.name!=='多奈川変電所'||sub.tags?.power!=='substation'||sub.tags?.voltage!=='275000')throw Error('多奈川変電所：OSMの区画のタグ・名前が変わった');
 const ring=sub.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 if(!inside(pos,ring))throw Error('多奈川変電所：代表点が区画の外');if(facilities.some(f=>f.id==='osm-way-1344336054'||f.name==='多奈川変電所'))throw Error('多奈川変電所：重複');
 const sennan=facilities.find(f=>f.id==='osm-way-191880853');if(!sennan||sennan.name!=='泉南変電所')throw Error('多奈川：泉南変電所がない');
 const OCCTO='OCCTO 系統情報サービス（関西）の運用容量（https://www.occto.or.jp/institution/keitoujouhou/index.html 、2026-10-17の取得分で確認）';
 const RETIRE='OCCTO 理事会 第3号議案「リプレース対象廃止計画のリプレース該当性判断について」（PDF作成 2020-06-11、https://www.occto.or.jp/assets/soukaihoka/rijikai/2020/files/rijikai_248_gijiroku_3.pdf 、確認日 2026-10-17）';
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10),facAt=fac.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt||!facAt)throw Error('多奈川：OSMの取得時点が原本にない');
 const tanna={id:'osm-way-1344336054',assetId:'kansai-fac-substation-1344336054',name:'多奈川変電所',kind:'substation',position:pos,voltages:[275],scopeConnected:true,url:'https://www.openstreetmap.org/way/1344336054',
  attributes:[{label:'公表設備対応',value:`${OCCTO}に「送電線 275kV 多奈川変電所⇒泉南変電所」「紀の川線 275kV 紀の川変電所⇒多奈川変電所」の行がある。`},
   {label:'OSM登録',value:`OSMの区画（way 1344336054、power=substation、275kV、屋内、事業者の登録なし、${facAt}時点）。`},{label:'代表点の取り方',value:'OSMの区画の頂点の平均（区画の内側にあることを確認）。'},
   {label:'近くの発電所',value:`多奈川第二発電所1・2号機（関西電力、120万kW）は2020年3月に廃止（${RETIRE}。届出日 2020-02-28）。発電所は地図に描かない（OSMに区画がない）。`}]};
 facilities.push(tanna);
 const els=raw.elements,np=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const W=(id,from,to)=>{const x=els.find(e=>e.type==='way'&&e.id===id);if(!x||x.nodes[0]!==from||x.nodes.at(-1)!==to)throw Error('多奈川の線 way '+id+' が変わった');const p=x.nodes.map(n=>np.get(n));if(p.some(q=>!q))throw Error('多奈川の線 nodes '+id);return p;};
 const shared=W(191880845,9557554409,2024443603),main=W(191880850,6784518891,2024443603).reverse(),tail=W(1037516213,6784518889,6784518891).reverse();
 const route=[...shared,...main.slice(1),...tail.slice(1)];
 const se=lines.find(l=>l.id==='kansai-275-泉南東大阪線（１０９T～泉南変電所）');if(!se||!se.connections.some(c=>c.node===9557554409&&c.facilities.some(f=>f.id===sennan.id)))throw Error('多奈川：泉南東大阪線の泉南側の端が想定と違う');
 if(inside(route.at(-1),ring))throw Error('多奈川：西の端が区画の内側になった（直線を見直す）');
 const dm=(x,y)=>Math.hypot((x[0]-y[0])*110540,(x[1]-y[1])*111320*Math.cos(x[0]*Math.PI/180)),km=route.slice(1).reduce((t,q,i)=>t+dm(route[i],q),0)/1000,m=Math.round(dm(route.at(-1),pos));
 lines.push({id:'kansai-osm-275-191880850',assetId:'kansai-osm-275-191880850',name:'多奈川変電所―泉南変電所の送電線',named:false,voltageKV:275,currentType:'ac',osmIds:[191880850,-1918808501],sourceOsmIds:[191880845,191880850,1037516213],
  paths:[route,[route.at(-1),pos]],schematicParts:[{osmId:-1918808501,construction:'unknown'}],
  connections:[{node:9557554409,position:route[0],status:'facility-area',facilities:[{id:sennan.id,name:sennan.name}],neighborWays:[]},{node:null,position:pos,status:'facility-area',facilities:[{id:tanna.id,name:tanna.name}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'泉南変電所―多奈川変電所'},
  attributes:[{label:'照合区分',value:'C区分'},{label:'要注意（C区分）',value:'両端（多奈川⇒泉南）は OCCTO の運用容量の行で分かっているが、経路は泉南東大阪線と共用とみられる4回線の区間（OSM way 191880845）と、OSMの線名「多奈二火力線」の線分を通り、多奈川側の末端は直線で補った参考表示。'},
   {label:'公表の行',value:`${OCCTO}：「送電線 275kV 多奈川変電所⇒泉南変電所」、運用容量 1,049MW（決定要因：熱容量、2026-10-17 の値）。線名は匿名で、実績の行はない（潮流なし）。`},
   {label:'区分',value:'多奈川変電所と泉南変電所を結ぶ275kVの線。表示名は区間の説明（OCCTO では線名が匿名のため）。'},
   {label:'地理参照',value:`OSM 3線分（計約${km.toFixed(1)}km）＋多奈川側の末端の直線（約${m}m）。泉南変電所から way 191880845「泉南東大阪線」（275kV、OSMの回線数は4。泉南東大阪線と同じ鉄塔とみられる）、way 191880850「多奈二火力線」（275kV・2回線）、名前のない way 1037516213（2回線）。OSMの線名「多奈二火力線」は、多奈川第二発電所（2020年3月廃止）の電源線だったときの名前とみられる。`},
   {label:'末端の直線',value:'多奈川変電所側は、OSMの線の端から変電所の代表点まで、ルート不明のため直線で表示（地中・架空の別は不明・破線）。根拠：OCCTO の行の端（多奈川変電所）。多奈川変電所はOSMで屋内の変電所。'},
   {label:'出典',value:`${OCCTO}。${RETIRE}。地理はOSM（data/raw/kansai-osm/lines-275.json ${osmAt}時点、facilities.json ${facAt}時点）。`}]});}
// 紀の川線（紀の川変電所⇒多奈川変電所）と、紀の川変電所―海南港変電所の送電線（2026-10-17 オーナー承認）：OCCTO 関西の運用容量に「紀の川線 紀の川⇒多奈川」と
// 「送電線（匿名） 紀の川⇒海南港」がある。以前「紀の川線（推定）」として推定で描いた紀の川―海南港の線（ledger-infer-kansai-275-291678113）は、ID・経路・接続を変えず、
// 名前と属性を匿名の送電線（紀の川―海南港）に直す（IDの頭の ledger-infer は以前の推定の名残）。紀の川線は、OSMの名前のない275kVの線分（分岐なし）を1本の経路にして新しく足す
{const raw=read('data/raw/kansai-osm/lines-275.json'),els=raw.elements,np=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const fac=read('data/raw/kansai-osm/facilities.json').elements;
 const ringOf=id=>{const w=fac.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('紀の川線：区画 '+id+' がない');return w.geometry.map(q=>[q.lat,q.lon]);};
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 const kino=facilities.find(f=>f.id==='osm-way-291678103'),tanna=facilities.find(f=>f.id==='osm-way-1344336054'),kainan=facilities.find(f=>f.id==='osm-way-1328548241');
 if(kino?.name!=='紀の川変電所'||tanna?.name!=='多奈川変電所'||kainan?.name!=='海南港変電所')throw Error('紀の川線：設備がない');
 // [way, 経路の向きの始点, 終点]（紀の川側の引込 → 多奈川側の引込）
 const chain=[[1037516228,9557565432,5950524421],[630117950,5950524421,5950524418],[390449695,5950524418,3936018760],[1543006365,3936018760,3935936096],[1543006363,3935936096,3935906672],[390436827,3935906672,7763511753],[1037516225,7763511753,7763511799],[1037516222,7763511799,9557565429]];
 const all275=els.filter(e=>e.type==='way'&&/line|cable/.test(e.tags?.power??'')&&String(e.tags?.voltage??'').split(';').includes('275000'));
 const route=[];for(const [k,[id,from,to]] of chain.entries()){const w=els.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('紀の川線 way '+id);
  const ids=w.nodes[0]===from&&w.nodes.at(-1)===to?w.nodes:w.nodes[0]===to&&w.nodes.at(-1)===from?[...w.nodes].reverse():null;if(!ids)throw Error('紀の川線 way '+id+' の端が変わった');
  const p=ids.map(n=>np.get(n));if(p.some(q=>!q))throw Error('紀の川線 nodes '+id);route.push(...(route.length?p.slice(1):p));}
 {const routeIds=chain.flatMap(([id])=>els.find(e=>e.type==='way'&&e.id===id).nodes),mine=new Set(chain.map(c=>c[0])),allow={5950524421:[1037516229],7763511799:[1037516223]};
  for(const n of new Set(routeIds)){const other=all275.filter(x=>!mine.has(x.id)&&x.nodes.includes(n)).map(x=>x.id);if(other.some(x=>!(allow[n]??[]).includes(x)))throw Error('紀の川線：経路の点 '+n+' に別の275kVの線分がある（'+other.join(',')+'）');}}
 const rk=ringOf(291678103),rt=ringOf(1344336054);const inK=inside(route[0],rk),inT=inside(route.at(-1),rt);
 const paths=[...(inK?[]:[[kino.position,route[0]]]),route,...(inT?[]:[[route.at(-1),tanna.position]])];
 const osmIds=[...(inK?[]:[-6301179501]),630117950,...(inT?[]:[-6301179502])],schematicParts=[...(inK?[]:[{osmId:-6301179501,construction:'unknown'}]),...(inT?[]:[{osmId:-6301179502,construction:'unknown'}])];
 const dm=(x,y)=>Math.hypot((x[0]-y[0])*110540,(x[1]-y[1])*111320*Math.cos(x[0]*Math.PI/180)),km=route.slice(1).reduce((t,q,i)=>t+dm(route[i],q),0)/1000;
 const OCCTO='OCCTO 系統情報サービス（関西）の運用容量（https://www.occto.or.jp/institution/keitoujouhou/index.html 、2026-10-17の取得分で確認）';
 const LEDGER='関西電力送配電 空容量一覧（154kV以上・送電線）No.81「紀の川線（275kV）、2回線、BR→BT」（端点は記号で匿名）';
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt)throw Error('紀の川線：OSMの取得時点が原本にない');
 const ends=[];if(!inK)ends.push('紀の川変電所側');if(!inT)ends.push('多奈川変電所側');
 lines.push({id:'kansai-osm-275-630117950',assetId:'kansai-osm-275-630117950',name:'紀の川線',named:true,voltageKV:275,currentType:'ac',osmIds,sourceOsmIds:chain.map(c=>c[0]),paths,...(schematicParts.length?{schematicParts}:{}),
  connections:[{node:inK?9557565432:null,position:paths[0][0],status:'facility-area',facilities:[{id:kino.id,name:kino.name}],neighborWays:[]},{node:inT?9557565429:null,position:paths.at(-1).at(-1),status:'facility-area',facilities:[{id:tanna.id,name:tanna.name}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'紀の川変電所―多奈川変電所'},
  attributes:[{label:'照合区分',value:'C区分'},{label:'要注意（C区分）',value:'両端は OCCTO の運用容量の行で分かっているが、経路はOSMの名前のない線分だけで描いた参考表示。'},
   {label:'公表の行',value:`${OCCTO}：「紀の川線 275kV 紀の川変電所⇒多奈川変電所」、運用容量 1,742MW（決定要因：熱容量、2026-10-17 の値）。実績の行はない（潮流なし）。${LEDGER}は、線名・回線数がこの線と合う。`},
   {label:'区分',value:'紀の川変電所と多奈川変電所を結ぶ275kVの線。'},
   {label:'地理参照',value:`OSM ${chain.length}線分（計約${km.toFixed(1)}km、275kV、OSMに線名なし）：紀の川変電所側の引込（way 1037516228、1回線）から way 630117950・390449695・1543006365・1543006363・390436827・1037516225 を通り、多奈川変電所側の引込（way 1037516222、1回線）まで。経路の点には、両端の引込のつなぎ目に並ぶ引込（way 1037516229・1037516223）のほか、別の275kVの線分は付いていない（分かれない）。way 390449695・1037516225 はOSMで275kV;77kVの登録（77kVとの共架とみられる）。回線数はOSMで1〜6と混じるため表示しない。並ぶ引込の way 1037516229・1037516223 は描かない。${ends.length?ends.join('・')+'の末端は、区画の外のため代表点まで直線で表示（ルート不明・破線）。':'両端とも区画の内側。'}`},
   {label:'出典',value:`${OCCTO}。${LEDGER}。地理はOSM（data/raw/kansai-osm/lines-275.json ${osmAt}時点）。`}]});
 // 紀の川―海南港の線：ID・経路・接続はそのまま、名前と属性を直す
 const old=lines.find(l=>l.id==='ledger-infer-kansai-275-291678113');if(!old||old.name!=='紀の川線（推定）'||old.connections.map(c=>c.facilities[0]?.id).join()!=='osm-way-291678103,osm-way-1328548241')throw Error('紀の川―海南港：以前の線が想定と違う');
 const okm=old.paths.reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+dm(p[i],q),0),0)/1000;
 old.name='紀の川変電所―海南港変電所の送電線';old.named=false;old.referenceReview={status:'partial',endpoints:'紀の川変電所―海南港変電所'};
 old.attributes=[{label:'照合区分',value:'C区分'},{label:'要注意（C区分）',value:'両端は OCCTO の運用容量の行で分かっているが、経路はOSMの名前のない線分だけで描いた参考表示。'},
  {label:'公表の行',value:`${OCCTO}：「送電線 275kV 紀の川変電所⇒海南港変電所」、運用容量 2,220MW（決定要因：熱容量、2026-10-17 の値）。線名は匿名で、実績の行はない（潮流なし）。`},
  {label:'区分',value:'紀の川変電所と海南港変電所を結ぶ275kVの線。表示名は区間の説明（OCCTO では線名が匿名のため）。'},
  {label:'名前の訂正（2026-10-17）',value:`以前は「紀の川線（推定）」として、${LEDGER}に対応させていた。OCCTO の運用容量で紀の川線は紀の川⇒多奈川と分かったので、この線は匿名の送電線（紀の川⇒海南港）に直し、No.81 の対応は紀の川線（kansai-osm-275-630117950）に移した。ID・経路・接続は変えていない（IDの頭の ledger-infer は以前の推定の名残）。`},
  {label:'地理参照',value:`OSM 2線分（way 291678113・483206731、計約${okm.toFixed(1)}km、275kV、OSMに線名なし）。両端は紀の川変電所・海南港変電所の区画。`},
  {label:'出典',value:`${OCCTO}。地理はOSM（data/raw/kansai-osm/lines-275.json ${osmAt}時点）。`}];
 const note=(f,label,value)=>{f.attributes=[...(f.attributes??[]).filter(a=>a.label!==label),{label,value}];};
 note(kino,'公表設備対応（OCCTO）',`${OCCTO}に「紀の川線 紀の川変電所⇒多奈川変電所」「送電線 紀の川変電所⇒海南港変電所」の行がある。`);
 note(kainan,'公表設備対応（OCCTO）',`${OCCTO}に「送電線 紀の川変電所⇒海南港変電所」の行がある。`);}
// 宮津線（2026-10-18 オーナー承認）：関西電力送配電 空容量一覧 No.57「宮津線 275kV 2回線 発電所→AS」を、宮津エネルギー研究所から出る275kVの線に推定で対応付ける。
// 「AS」は一覧に1回しか出ず読み解けない。根拠は、発電所の区画から出る275kVのOSMの線がこの1本だけであること。ID・経路・接続は変えない
const MIYAZU='kansai-plant-275-way-1029051469';
{const raw=read('data/raw/kansai-osm/lines-275.json'),els=raw.elements,np=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const l=lines.find(x=>x.id===MIYAZU);
 if(!l||l.name!=='宮津エネルギー研究所発電所の連系線'||l.osmIds.join()!=='320444666,324539811'||l.connections.map(c=>c.facilities[0]?.id).join()!=='osm-way-1029051469,osm-relation-11529637')throw Error('宮津線：以前の線が想定と違う');
 const dm=(x,y)=>Math.hypot((x[0]-y[0])*110540,(x[1]-y[1])*111320*Math.cos(x[0]*Math.PI/180)),end=l.connections[0].position;
 const near=els.filter(e=>e.type==='way'&&/line|cable/.test(e.tags?.power??'')&&String(e.tags?.voltage??'').split(';').includes('275000')&&(e.nodes??[]).some(n=>{const p=np.get(n);return p&&dm(p,end)<1500;})).map(e=>e.id);
 if(near.join()!=='320444666')throw Error('宮津線：発電所から1.5km以内の275kVの線が1本でない（'+near.join(',')+'）');
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt)throw Error('宮津線：OSMの取得時点が原本にない');
 const geo=l.attributes.find(a=>a.label==='地理参照');if(!geo)throw Error('宮津線：地理参照がない');
 const SRC='関西電力送配電 空容量一覧（154kV以上・送電線）（https://www.kansai-td.co.jp/interchange/takusou/pdf/154kv_more_line.csv 、2026年10月07日更新、2026-10-09取得）';
 l.name='宮津線';l.named=true;delete l.statusConfirmed;delete l.statusCheck;
 l.attributes=[{label:'公表の行',value:`${SRC}：No.57「宮津線」275kV、2回線、潮流正方向「発電所→AS」、予想潮流 0MW（一覧の想定値で、実績ではない。運転状態を示すものではない。潮流は表示しない）。`},
  {label:'公表区間との対応',value:'No.57 への対応付けは推定（2026-10-18 オーナー承認）。一覧の端点「AS」は記号で、一覧に1回しか出ないため読み解けていない。宮津エネルギー研究所の区画から出る275kVのOSMの線は way 320444666（2回線、新綾部変電所まで）の1本だけで、線名・回線数と合う。'},
  {label:'区分',value:'宮津エネルギー研究所（2023-05-31 廃止）と新綾部変電所を結ぶ275kVの線。運転状態は未確認。'},
  {label:'名前の訂正（2026-10-18）',value:'以前は「宮津エネルギー研究所発電所の連系線」（名前のない電源線）として描き、接続先の発電所の廃止により運用状態を「未確認」としていた。空容量一覧の No.57 に対応付け、線名を一覧の「宮津線」にした。ID・経路・接続は変えていない。'},
  geo,{label:'出典',value:`${SRC}。地理はOSM（data/raw/kansai-osm/lines-275.json ${osmAt}時点）。`}];}
{const {applyEndFixes}=await import('./end-fixes.mjs');applyEndFixes('kansai',lines,facilities);}
// 洛南支線・南河内支線と、その端の変電所（2026-11-16 保留123、オーナー指示「一気に纏めて実施して」）。一覧の記号：N＝南京都変電所（No.61 喜撰山線・No.64 甲賀線・No.65 南京都線）、
// BL＝東大阪変電所（No.67 東大阪線・No.77 東大阪新生駒線・No.78 泉南東大阪線）。BH・BM は線名から洛南変電所・南河内変電所とみなした（推定）。
// 洛南変電所は南京都線（OCCTO の行の端に「枚方変電所（洛南変電所）」）の真下（線分から約39m）、南河内変電所は泉南東大阪線から約50m の引込（OSM way 109826951）でつながる
{const KS='関西電力送配電 空容量一覧（154kV以上・送電線、2026年10月7日更新）';const FAC=read('data/raw/kansai-osm/facilities.json').elements,L275=read('data/raw/kansai-osm/lines-275.json').elements;
 const NODE=new Map(L275.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const addFac=(id,name)=>{const f=FAC.find(e=>e.type==='way'&&e.id===id);if(!f||f.tags.name!==name)throw Error('洛南・南河内：OSM の区画が想定と違う '+id);if(facilities.some(x=>x.id==='osm-way-'+id))throw Error('洛南・南河内：登録済み '+name);
  const r=f.geometry.map(q=>[q.lat,q.lon]),pos=[r.reduce((s,p)=>s+p[0],0)/r.length,r.reduce((s,p)=>s+p[1],0)/r.length].map(v=>Math.round(v*1e7)/1e7);
  facilities.push({id:'osm-way-'+id,assetId:'kansai-fac-way-'+id,name,kind:'substation',position:pos,voltages:[275],scopeConnected:true,url:'https://www.openstreetmap.org/way/'+id,attributes:[{label:'OSM登録',value:'名称：'+name+'、電圧：275kV'}]});return pos;};
 // 洛南変電所と洛南支線（一覧 No.66 BH→N）：南京都線の線分（way 161870228）の最寄りの節点 1738293212 から区画の中心までの直線（約40m、推定）
 {const pos=addFac(949748588,'洛南変電所'),nk=lines.find(x=>x.id==='kansai-275-南京都線'),q=NODE.get(1738293212);if(!nk||!q||!nk.paths.flat().some(p=>p[0]===q[0]&&p[1]===q[1]))throw Error('洛南：南京都線の節点がない');
  lines.push({id:'kansai-275-洛南支線',assetId:'kansai-275-洛南支線',name:'洛南支線',named:true,voltageKV:275,currentType:'ac',osmIds:[-9494875881],paths:[[q,pos]],schematic:true,
   connections:[{node:1738293212,position:q,status:'shared-node',facilities:[],neighborWays:[161870228]},{node:null,position:pos,status:'facility-area',facilities:[{id:'osm-way-949748588',name:'洛南変電所'}],neighborWays:[]}],
   referenceReview:{status:'partial',endpoints:'南京都線との分岐点（推定）―洛南変電所'},
   attributes:[{label:'公表の線名',value:KS+' No.66：洛南支線（275kV）、2回線、BH→N。N＝南京都変電所（読み解き）、BH は線名から洛南変電所とみなした（推定）。OCCTOに行なし（潮流なし）。'},
    {label:'端点の根拠',value:'洛南変電所（OSM の区画 way 949748588）は南京都線の線分の真下（約39m）にあり、南京都線との分岐点を最寄りの節点 1738293212 とみなした（推定）。引込の線は OSM にないので、区画の中心までの直線（約40m）で表す。'},
    {label:'地理参照',value:'直線 約40m（経路は南京都線と同じ鉄塔とみられる。個別回線は未確認）。'},
    {label:'出典',value:KS+'。OCCTO 関西の行（南京都線：南京都変電所→枚方変電所（洛南変電所））。地理はOSM（data/raw/kansai-osm）。'}]});}
 // 南河内変電所と南河内支線（一覧 No.79 BM→BL）：泉南東大阪線から南河内変電所の区画に入る OSM の線分 way 109826951（約50m、OSM の線名は泉南東大阪線）
 {addFac(191476516,'南河内変電所');const w=L275.find(e=>e.type==='way'&&e.id===109826951);if(!w||w.nodes.length!==2)throw Error('南河内：way 109826951 が想定と違う');
  const tip=NODE.get(w.nodes[0]),br=NODE.get(w.nodes[1]),sn=lines.find(x=>x.id==='kansai-275-泉南東大阪線（東大阪～１０９T）');if(!sn||!sn.paths.flat().some(p=>p[0]===br[0]&&p[1]===br[1]))throw Error('南河内：泉南東大阪線の節点がない');
  lines.push({id:'kansai-275-南河内支線',assetId:'kansai-275-南河内支線',name:'南河内支線',named:true,voltageKV:275,currentType:'ac',osmIds:[109826951],paths:[[br,tip]],
   connections:[{node:w.nodes[1],position:br,status:'shared-node',facilities:[],neighborWays:[160589167]},{node:w.nodes[0],position:tip,status:'facility-area',facilities:[{id:'osm-way-191476516',name:'南河内変電所'}],neighborWays:[]}],
   referenceReview:{status:'partial',endpoints:'泉南東大阪線との分岐点（推定）―南河内変電所'},
   attributes:[{label:'公表の線名',value:KS+' No.79：南河内支線（275kV）、2回線、BM→BL。BL＝東大阪変電所（読み解き）、BM は線名から南河内変電所とみなした（推定）。OCCTOに行なし（潮流なし）。'},
    {label:'端点の根拠',value:'泉南東大阪線との分岐点を、OSM の引込の線分 way 109826951 の端（node '+w.nodes[1]+'）とみなした（推定）。南河内変電所は OSM の区画 way 191476516。'},
    {label:'地理参照',value:'OSM 1線分（way 109826951、約50m、OSM の線名は泉南東大阪線）。個別回線は未確認。'},
    {label:'出典',value:KS+'。地理はOSM（data/raw/kansai-osm）。'}]});}}
// 保留128（2026-11-17）：関西の設備・線の追加と修正（scripts/kansai-128.mjs）
{const {applyKansai128}=await import('./kansai-128.mjs');applyKansai128(lines,facilities);}
// 保留130（2026-11-18）：富南の削除と新北陸幹線の延長、大黒部幹線（scripts/kansai-130.mjs）。北陸・中部の builder を先に実行する
{const {applyKansai130}=await import('./kansai-130.mjs');applyKansai130(lines,facilities);}
const tiers=applyTiers('kansai',lines,facilities);console.log('kansai tiers',JSON.stringify(tiers));
// 保留128：直線で描く線は照合区分の付け直しのあとで足す（scripts/kansai-128.mjs）
{const {applyKansai128Late}=await import('./kansai-128.mjs');applyKansai128Late(lines,facilities);}
// 保留130：北陸・中部から移した線（新北陸幹線（成出～城端）・御母衣北幹線）を足し、属性を整える（scripts/kansai-130.mjs）
{const {applyKansai130Late}=await import('./kansai-130.mjs');applyKansai130Late(lines,facilities);}
// 保留130-10：No.208・No.210（No.208 の分岐）と御母衣第二・鳩谷・下小鳥の発電所・電源線（scripts/kansai-130.mjs）
{const {applyKansai130_10}=await import('./kansai-130.mjs');applyKansai130_10(lines,facilities);}
// 保留131：No.204 新北陸幹線（御母衣～栗東）、祖山・新祖山発電所と新祖山線、御母衣第二の種別・出力（scripts/kansai-130.mjs）
{const {applyKansai131}=await import('./kansai-130.mjs');applyKansai131(lines,facilities);}
// 保留132：丸山・新丸山発電所と新丸山発電所の電源線（scripts/kansai-130.mjs）
{const {applyKansai132}=await import('./kansai-130.mjs');applyKansai132(lines,facilities);}
// 保留135（2026-11-19 オーナー回答「図のとおり進めて」）：姫路まわりの描き直し（scripts/kansai-135.mjs）
{const {applyKansai135}=await import('./kansai-135.mjs');applyKansai135(lines,facilities);}
// 保留136（2026-11-19 オーナー回答「(a)は②、(b)は推奨、(c)は②」）：南姫路・飾磨港・高砂変電所と高砂の発電所、No.52、No.39・43 の付け替え（scripts/kansai-136.mjs）
{const {applyKansai136}=await import('./kansai-136.mjs');applyKansai136(lines,facilities);}
// 保留146（2026-11-22）：姫路第一発電所の開閉所（推定）と飾磨港線（推定、No.35）
{const {applyKansai146}=await import('./kansai-146.mjs');applyKansai146(lines,facilities);}
// 関開閉所の属性を中部のデータとそろえる（scripts/seki-switchyard.mjs、2026-11-16 保留121c）
{const {applySekiAttributes}=await import('./seki-switchyard.mjs');applySekiAttributes(facilities);}
// applyTiers は要注意・照合の根拠を定型文にする。両端が OCCTO の運用容量の行で確定している次の3本は、実際の理由に差し替える（C区分はそのまま、2026-10-17）
{const C={'kansai-osm-275-630117950':'両端は OCCTO の運用容量の行（紀の川線 紀の川⇒多奈川）で分かっているが、経路はOSMの名前のない線分だけで描き、多奈川側の末端は直線で補った参考表示。','ledger-infer-kansai-275-291678113':'両端は OCCTO の運用容量の行（送電線 紀の川⇒海南港、線名は匿名）で分かっているが、経路はOSMの名前のない線分だけで描いた参考表示。','kansai-osm-275-191880850':'両端は OCCTO の運用容量の行（送電線 多奈川⇒泉南、線名は匿名）で分かっているが、経路は泉南東大阪線と共用とみられる4回線の区間（OSM way 191880845）と、OSMの線名「多奈二火力線」の線分を通り、多奈川側の末端は直線で補った参考表示。'};
 for(const [id,why] of Object.entries(C)){const l=lines.find(x=>x.id===id);if(!l)throw Error('要注意の差し替え：線がない '+id);const set=(label,value)=>{const i=l.attributes.findIndex(a=>a.label===label);if(i<0)throw Error('要注意の差し替え：'+label+' がない '+id);l.attributes[i]={label,value};};set('要注意（C区分）',why);set('照合の根拠',id==='kansai-osm-275-191880850'?'両端は OCCTO の運用容量の行で確定。経路は別名の線を経由し、末端は直線で補った（C区分）。':'両端は OCCTO の運用容量の行で確定。経路はOSMの名前のない線分（C区分）。');}}
// 宮津線も同じく実際の理由に差し替える（C区分のまま、2026-10-18）
{const l=lines.find(x=>x.id===MIYAZU);const set=(label,value)=>{const i=l.attributes.findIndex(a=>a.label===label);if(i<0)throw Error('宮津線：'+label+' がない');l.attributes[i]={label,value};};
 if(l.attributes.find(a=>a.label==='照合区分')?.value!=='C区分')throw Error('宮津線：照合区分がCでない');
 set('要注意（C区分）','空容量一覧の行（線名・回線数）への対応は推定で（端点の記号「AS」は読み解けていない）、経路はOSMの名前のない線分だけで描いた参考表示。');
 set('照合の根拠','発電所の区画から出る275kVのOSMの線が1本だけであることから、空容量一覧の No.57 宮津線に対応付けた（推定）。経路はOSMの名前のない線分（C区分）。');}
for(const l of lines)for(const c of l.connections)for(const f of c.facilities)if(!facilities.some(x=>x.id===f.id))throw Error('Unknown Kansai facility '+f.id);
// 大河内開閉所の「位置の確認」（照合区分の付与のあとに付く）を、発電所の注記であることが分かる文言にする（2026-10-20 オーナー判断 D）
{const f=facilities.find(x=>x.id==='osm-way-962796302');if(f)f.attributes=f.attributes.map(a=>a.label==='位置の確認'?{label:a.label,value:'国土地理院の地図注記「大河内発電所」（設備の中心から約1,003m）は発電所（kansai-place-大河内発電所）の注記で、開閉所の名称の確認ではない。開閉所の名称は OCCTO の運用容量の表による。'}:a);}
const ids=[...lines,...facilities].map(x=>x.assetId);if(new Set(ids).size!==ids.length)throw Error('Duplicate Kansai asset IDs');
const data={schemaVersion:1,datasetId:'kansai-trunk-v1',rights:'pending',
 coverage:'関西500kV・275kV・'+lines.length+'路線'+facilities.length+'設備の限定検証（OCCTO関西の500kV全25区間と275kV全29区間。地理はOSM。終点が3変電所の西大阪小曽根線＋北豊中線は関西電力送配電の系統図どおり十字の4区間（分岐点は推定、C区分）で、OCCTOの合計を西大阪～分岐点に、分岐後は予想潮流の比で按分した推定値を表示）。',
 retrievedAt:source.requests.map(r=>r.retrievedAt).sort().at(-1),osmTimestamp:source.requests.map(r=>r.osmBase).filter(Boolean).sort().join(' – '),
 license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',sourceUrl:'https://overpass-api.de/api/interpreter',sources:source.requests.map(({name,endpoint,retrievedAt,sha256})=>({file:name,url:endpoint,retrievedAt,sha256})),
 lines,facilities,changePlans:[]};
data.coverage+='照合区分 A'+tiers.A+'・B'+tiers.B+'・C'+tiers.C+(tiers.D?'・D'+tiers.D:'')+'（A・Bは公表区間の両端にOSMの線で到達したもの。要注意はC・Dのみ）。';
const text=JSON.stringify(publicWording(data,'kansai-trunk.json'),null,2)+'\n';writeFileSync('public/data/kansai-trunk.json',text);
writeFileSync('config/kansai-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(text).digest('hex'),lineIds:lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(lines.map(l=>[l.assetId,l.voltageKV])),lineCurrentTypes:Object.fromEntries(lines.filter(l=>l.currentType!=='ac').map(l=>[l.assetId,l.currentType])),facilityIds:facilities.map(f=>f.assetId)},null,2)+'\n');
// OCCTO→地図の対応表を画面用モジュールへ書き出す（src/kansai-pairs.ts）
// 地図の設備名（6・7列目）は、改名した大河内開閉所に合わせる（2026-10-20 オーナー判断 D。OCCTO の起点・終点の列はそのまま）
const pairs=read('docs/research/kansai-occto-pairs.json').pairs.map(p=>p.map((v,i)=>i>=5&&v==='大河内発電所'?'大河内開閉所':v));
const header='// 生成ファイル（scripts/build-kansai.mjs）。元は docs/research/kansai-occto-pairs.json（tools/prep/adopt-kansai.mjs）。手で編集しない。\n// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]\n';
writeFileSync('src/kansai-pairs.ts',header+'export const pairs=[\n'+pairs.map(p=>' '+JSON.stringify(p).replaceAll('"',"'")).join(',\n')+',\n] as const;\n');
console.log('Kansai dataset',lines.length,'lines',facilities.length,'facilities');
