// Builds the Shikoku validation dataset (public/data/shikoku-trunk.json) and its pinned approval from the adopted sections
// (docs/research/shikoku-adopted.json, produced by tools/prep/adopt-shikoku.mjs). All lines are C tier (OSM routes only, 要注意).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyTiers} from './assign-tiers.mjs';
import {mergeJpower,annotateJpower} from './jpower.mjs';
import {addNahariFacilities,applyNahariLines,overrideNahariTiers} from './shikoku-nahari.mjs';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const adopted=read('docs/research/shikoku-adopted.json');
const source=read('data/raw/shikoku-osm/source.json');
const lines=[...adopted.lines],facilities=adopted.facilities.map(f=>({...f}));
// 基幹系統に接続する発電所（tools/prep/adopt-plants.mjs、2026-10-02）：追加の発電所・OCCTO公表外の電源線と、既存の発電所へのOSM登録値
let plants=null;try{plants=read('docs/research/shikoku-plants-adopted.json');}catch{}
if(plants){for(const f of plants.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...plants.lines);
 for(const e of plants.enriched){const f=facilities.find(x=>x.id===e.id);if(f&&f.assetId?.startsWith('shikoku-'))f.attributes=[...(f.attributes??[]).filter(a=>!e.attributes.some(b=>b.label===a.label)),...e.attributes];}}
// 地域間連系線（tools/prep/adopt-ties.mjs、2026-10-03）：このエリアが端になる線を同じIDで入れる。端の設備は自エリアのものを優先し、相手側はそのエリアの設備を使う。潮流は未反映。
let ties=null;try{ties=read('docs/research/ties-adopted.json');}catch{}
if(ties)for(const l of ties.lines.filter(l=>l.regions.includes('shikoku'))){const {regions,...line}=l;lines.push(line);for(const c of l.connections)for(const x of c.facilities)if(!facilities.some(f=>f.id===x.id)){const {region,...f}=ties.facilities.find(f=>f.id===x.id);facilities.push(f);}}
// 照合区分（A/B/C）を東京と同じ規則で付け直す（scripts/assign-tiers.mjs、2026-10-03）
// 新改・奈半利川・壬生川・西条火力・大川・西淡の設備（scripts/shikoku-nahari.mjs、2026-11-10 保留107）。発電所の一次資料（plant-primary）が当たるよう取り込みの前に足す
addNahariFacilities(facilities);
// 電源開発・公表台帳の線（scripts/jpower.mjs、2026-10-04）
mergeJpower('shikoku',lines,facilities);annotateJpower('shikoku',lines,facilities);
// 阿南火力線・阿南幹線・蔭平線（2026-10-18 オーナー承認）：空容量一覧の No.37 阿南火力線を地図の「阿南火力発電所の連系線」に、No.38 阿南幹線を
// 以前の「阿南火力線（推定）」（ID は残し経路を直す）に、No.36 蔭平線を新しい線に対応付ける。伏せ字の端点（変N）は、四国電力送配電の系統図・変電所一覧で確定
// （同日、オーナー指示で確認）。以前の推定の線は、阿南幹線の阿南側の半分と蔭平線の国府側の半分を、2本が点を共有する交点でつないだものだった。交点ではつながない。
// 蔭平線の南は、変電所の手前で OSM の線が国土地理院の送電線記号から外れるので、記号をなぞった経路にする（オーナー指示）。国府側の引込は OSM のまま（オーナー指示）
const ANAN={};{const raw=read('data/raw/shikoku-osm/lines-187.json'),els=raw.elements,np=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const way=id=>{const w=els.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('阿南：way '+id+' がない');return w;};
 const coords=w=>w.nodes.map(n=>{const p=np.get(n);if(!p)throw Error('阿南：node '+n);return p;});
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt)throw Error('阿南：OSMの取得時点が原本にない');
 const facRaw=read('data/raw/shikoku-osm/facilities.json'),facAt=facRaw.osm3s?.timestamp_osm_base?.slice(0,10);if(!facAt)throw Error('阿南：OSMの設備の取得時点が原本にない');
 const dm=(x,y)=>Math.hypot((x[0]-y[0])*110540,(x[1]-y[1])*111320*Math.cos(x[0]*Math.PI/180)),km=ps=>ps.reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+dm(p[i],q),0),0)/1000;
 const same=(p,q)=>p[0].toFixed(7)===q[0].toFixed(7)&&p[1].toFixed(7)===q[1].toFixed(7);
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 const kokufu=facilities.find(f=>f.id==='osm-way-309044203'),ikawa=facilities.find(f=>f.id==='osm-way-492707500'),anan=facilities.find(f=>f.id==='osm-way-1037463547');
 if(kokufu?.name!=='国府変電所'||ikawa?.name!=='井川変電所'||anan?.name!=='阿南発電所'||anan.kind!=='substation')throw Error('阿南：設備が想定と違う');
 const SRC='四国電力送配電 系統空容量（基幹系統・送電線）一覧（https://www.yonden.co.jp/nw/assets/line_access/data/sys_capa_kikan00_line_202610_08.csv 、2026年10月1日更新、2026-10-09取得）';
 const MAP='四国電力送配電「四国エリアの送電系統（187kV以上の特高系統）」と送電線・変電所の一覧（https://www.yonden.co.jp/nw/assets/line_access/data/sys_capa_kikan00_map_202611_08.pdf 、2026年11月1日更新、2026-11-10確認）';
 const ENDS=`伏せ字の端点は、${MAP}の系統図と変電所一覧で、変8＝国府変電所、変10＝阿南火力変電所、変11＝蔭平変電所、変12＝井川変電所。`;
 const GSI='国土地理院 ベクトルタイル（試験公開、experimental_bvmap ズーム16、地物 structurel の送電線 ftCode 8202、2026-10-18取得）を加工';
 const FROM=`${SRC}。${MAP}。地理はOSM（data/raw/shikoku-osm/lines-187.json ${osmAt}時点）。`;
 // No.37 阿南火力線：ID・経路・接続はそのまま。阿南側の端は発電所の区画内の点で、変電所一覧の阿南火力変電所には着いていない
 const kar=lines.find(l=>l.id==='shikoku-plant-187-way-605689959');
 if(!kar||kar.name!=='阿南火力発電所の連系線'||!kar.osmIds.includes(451546845)||kar.connections.map(c=>c.facilities[0]?.id).join()!=='osm-way-605689959,osm-way-309044203')throw Error('阿南火力線：以前の線が想定と違う');
 const geo=kar.attributes.find(a=>a.label==='地理参照');if(!geo)throw Error('阿南火力線：地理参照がない');
 kar.name='阿南火力線';kar.named=true;delete kar.statusConfirmed;delete kar.statusCheck;kar.referenceReview={status:'partial',endpoints:'阿南火力発電所の区画内―国府変電所'};
 kar.attributes=[{label:'公表の行',value:`${SRC}：No.37「阿南火力線」187kV、2回線、潮流正方向 変8→変10、予想潮流 -257MW（一覧の想定値で、実績ではない。潮流は表示しない）。`},
  {label:'公表区間との対応',value:`${ENDS}No.37 は国府変電所〜阿南火力変電所。この線は国府変電所から阿南へ向かう187kV・2回線で、No.37 に当たる。ただし地図の阿南側の端は阿南火力発電所の区画内の点で、変電所一覧の阿南火力変電所（地図ではOSM名「阿南発電所」の変電所区画、約0.27km先）には着いていないので、No.37 の端点との対応は推定（2026-10-18 オーナー承認）。`},
  {label:'区分',value:'国府変電所と阿南を結ぶ187kVの線。阿南の端は、OSMで阿南火力発電所（2026-06-30 廃止）の区画内の点で、接続は変えていない。'},
  {label:'名前の訂正（2026-10-18）',value:'以前は「阿南火力発電所の連系線」（名前のない電源線）として描き、接続先の発電所の廃止により運用状態を「未確認」としていた。空容量一覧の No.37 に対応付け、線名を一覧の「阿南火力線」にした。ID・経路・接続は変えていない。'},
  geo,{label:'出典',value:FROM}];
 // No.38 阿南幹線：以前の「阿南火力線（推定）」の ID を残し、経路を way 463775144 の全体（井川変電所〜阿南）に直す
 const old=lines.find(l=>l.id==='ledger-infer-shikoku-187-463775144');
 if(!old||old.name!=='阿南火力線（推定）'||old.osmIds.join()!=='463775144,722648701,1023600792,844748245'||old.connections[0]?.facilities[0]?.id!=='osm-way-1037463547'||old.connections[1]?.node!==6777256429||old.paths.length!==4)throw Error('阿南幹線：以前の線が想定と違う');
 const oldKm=km(old.paths),w1=way(463775144),c1=coords(w1),JUNCTION=9430205014;
 const endA=w1.nodes.indexOf(old.connections[0].node);if(w1.nodes[0]!==9430211609||endA<0||!same(c1[endA],old.paths[0][0])||w1.nodes.indexOf(JUNCTION)<0)throw Error('阿南幹線：way 463775144 の端が変わった');
 const kanRoute=c1.slice(0,endA+1);
 const w2=way(722648701),c2=coords(w2);if(!same(c2[0],old.paths[1].at(-1)))throw Error('蔭平線：way 722648701 の端が変わった');
 if(w2.nodes.indexOf(JUNCTION)<0||!same(old.paths[1][0],np.get(JUNCTION))||!same(old.paths[2][0],c2[0]))throw Error('蔭平線：以前の経路のつなぎ目が想定と違う');
 const tail=[old.paths[2],old.paths[3]],NORTH=old.connections[1];if(!same(tail[1].at(-1),NORTH.position))throw Error('蔭平線：以前の北端が想定と違う');
 old.name='阿南幹線';old.named=true;old.osmIds=[463775144];old.paths=[kanRoute];old.referenceReview={status:'partial',endpoints:'井川変電所―阿南発電所'};
 old.connections=[{node:9430211609,position:kanRoute[0],status:'facility-area',facilities:[{id:ikawa.id,name:ikawa.name}],neighborWays:[]},old.connections[0]];
 old.attributes=[{label:'公表の行',value:`${SRC}：No.38「阿南幹線」187kV、2回線、潮流正方向 変12→変10。運用容量・予想潮流は空欄（未確認）。`},
  {label:'公表区間との対応',value:`${ENDS}No.38 は井川変電所〜阿南火力変電所。井川変電所〜阿南の187kV・2回線のOSMの線（way 463775144、線名なし）が No.38 に当たる。阿南側の端は OSM で「阿南発電所」の名の187/66kVの変電所区画で、変電所一覧の阿南火力変電所に当たる。`},
  {label:'区分',value:'井川変電所と阿南火力変電所を結ぶ187kVの線。'},
  {label:'経路・名前の訂正（2026-10-18）',value:`以前は「阿南火力線（推定）」として、線名の「阿南」からOSMの線をたどって描いていた（OSM 4線分、約${oldKm.toFixed(1)}km）。その経路は、この線（way 463775144）の阿南側の半分と、蔭平線（shikoku-osm-187-722648701）の国府側の半分を、2本が点を共有する交点（node ${JUNCTION}）でつないだもので、誤りだった。No.37 阿南火力線は shikoku-plant-187-way-605689959 に対応付け、この線は No.38 阿南幹線に直して経路を way 463775144 の全体（井川変電所〜阿南）にした。ID は変えていない（IDの頭の ledger-infer は以前の推定の名残）。`},
  {label:'地理参照',value:`OSM 1線分（way 463775144、約${km(old.paths).toFixed(1)}km、187kV・2回線、線名なし）。井川側の端は井川変電所の区画の内側、阿南側の端は OSM「阿南発電所」の変電所区画（以前のまま）。途中の node ${JUNCTION} で蔭平線と点を共有するが、交差として扱い、つながない。`},
  {label:'出典',value:FROM}];
 // 蔭平変電所：OSM の名前のない187;66kVの変電所の区画（way 1037463543）。名前は変電所一覧の No.11、区画との対応は蔭平線の行き着く先による
 const kgEl=facRaw.elements.find(x=>x.type==='way'&&x.id===1037463543),kgRing=kgEl?.geometry?.map(q=>[q.lat,q.lon]);if(!kgRing)throw Error('蔭平変電所：区画がない');
 if(kgEl.tags.power!=='substation'||kgEl.tags.voltage!=='187000;66000'||kgEl.tags.name)throw Error('蔭平変電所：OSMの登録が想定と違う');
 const kv=kgRing.slice(0,-1),kgPos=[kv.reduce((s,p)=>s+p[0],0)/kv.length,kv.reduce((s,p)=>s+p[1],0)/kv.length];if(!inside(kgPos,kgRing))throw Error('蔭平変電所：代表点が区画の外');
 if(facilities.some(f=>f.id==='osm-way-1037463543'||f.name==='蔭平変電所'))throw Error('蔭平変電所：重複');
 const kagehira={id:'osm-way-1037463543',assetId:'shikoku-fac-way-1037463543',name:'蔭平変電所',kind:'substation',position:kgPos,voltages:[187,66],scopeConnected:true,url:'https://www.openstreetmap.org/way/1037463543',
  attributes:[{label:'要注意（C区分）',value:'名前のない地図データの区画に、一次資料の名称を当てた設備（位置は一次資料にない）。'},
   {label:'名称の根拠',value:`${MAP}の変電所一覧の No.11「蔭平変電所」（187/66kV）。系統図で No.36 蔭平線の端。この区画は、蔭平線の経路（国土地理院の送電線記号・OSMの線）が行き着く187;66kVの変電所の区画で、名前を当てたのは推定（2026-10-18 オーナー承認）。`},
   {label:'OSM登録',value:`OSMの区画（way 1037463543、power=substation、187/66kV、名前の登録なし、${facAt}時点）。隣に名前のない水力発電所の区画（way 722659585）がある。`},
   {label:'代表点の取り方',value:'OSMの区画の頂点の平均（区画の内側にあることを確認）。'}]};
 facilities.push(kagehira);
 // No.36 蔭平線：北（国府側）は以前のまま way 1023600792・844748245 と、way 722648701 の北側（node 6778853524 まで。地理院の送電線記号と2m以内で重なる）。
 // そこから南は国土地理院の送電線記号をなぞった点（下の定数、北→南）で、記号の終点から蔭平変電所の区画内の点（OSM node 6778853560）までは直線で補う
 const SPLIT=w2.nodes.indexOf(6778853524);if(SPLIT!==84)throw Error('蔭平線：way 722648701 の分かれ目の点が変わった');
 const GSI_ROUTE=[[33.8277371,134.2808649],[33.827492,134.2808636],[33.8250008,134.2809199],[33.8247936,134.2809239],[33.822464,134.2809977],[33.8202301,134.2818479],[33.8196385,134.2820746],[33.8195939,134.2821041],[33.8177098,134.2833325],[33.8166669,134.2840125],[33.8156663,134.2846642],[33.8152228,134.2849553],[33.814542,134.2858887],[33.8142512,134.2862856],[33.8132083,134.2878453],[33.8126367,134.2888109],[33.8111157,134.2913818],[33.8111023,134.291402],[33.8109474,134.2916662],[33.8099534,134.2934002],[33.8083343,134.2936134],[33.806538,134.2938562],[33.8044731,134.2941338],[33.8036641,134.2942505],[33.8034601,134.2953877]];
 const BAY=6778853560,bayPos=np.get(BAY);if(!bayPos||!inside(bayPos,kgRing))throw Error('蔭平線：変電所の区画内の点が想定と違う');if(inside(GSI_ROUTE.at(-1),kgRing))throw Error('蔭平線：記号の終点が区画内になった（直線の補いを見直す）');
 const southRoute=[...c2.slice(0,SPLIT+1),...GSI_ROUTE].reverse(),gsiKm=km([[c2[SPLIT],...GSI_ROUTE]]),straightM=dm(bayPos,GSI_ROUTE.at(-1));
 // 北端：国府変電所の手前の共有点（node 6777256429）から先は、阿南火力線と共架として同じ経路（way 1023830421・1023600789）で国府変電所に入る（オーナー指示）
 const kp=kar.paths;if(kar.osmIds.slice(-2).join()!=='1023830421,1023600789'||!same(kp.at(-2)[0],NORTH.position)||!same(kp.at(-1)[0],kp.at(-2).at(-1))||kar.connections[1].node!==9439387014)throw Error('蔭平線：阿南火力線の国府側の経路が想定と違う');
 const shared=[kp.at(-2),kp.at(-1)],KOKUFU=kar.connections[1],SCHEM=-7226487011;
 const kg={id:'shikoku-osm-187-722648701',assetId:'shikoku-osm-187-722648701',name:'蔭平線',named:true,voltageKV:187,currentType:'ac',osmIds:[SCHEM,722648701,1023600792,844748245,1023830421,1023600789],sourceOsmIds:[722648701,1023600792,844748245,1023830421,1023600789],
  paths:[[bayPos,GSI_ROUTE.at(-1)],southRoute,...tail,...shared],schematicParts:[{osmId:SCHEM,construction:'unknown'}],
  connections:[{node:BAY,position:bayPos,status:'facility-area',facilities:[{id:kagehira.id,name:kagehira.name}],neighborWays:[]},{node:KOKUFU.node,position:KOKUFU.position,status:'facility-area',facilities:[{id:kokufu.id,name:kokufu.name}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'蔭平変電所―国府変電所'}};
 kg.attributes=[{label:'公表の行',value:`${SRC}：No.36「蔭平線」187kV、1回線、潮流正方向 変11→変8、予想潮流 89MW（一覧の想定値で、実績ではない。潮流は表示しない）。`},
  {label:'公表区間との対応',value:`${ENDS}No.36 は蔭平変電所〜国府変電所。蔭平変電所から国府変電所へ向かう187kV・1回線の線がこれに当たる。`},
  {label:'端点の根拠',value:`南端は蔭平変電所の区画（OSM way 1037463543。名前のない区画で、蔭平変電所とみなしたのは線の行き着く先による推定）。北端は国府変電所の区画。国府変電所の手前の点（node ${NORTH.node}、以前の「阿南火力線（推定）」の端）から先は、阿南火力線と共架として同じ経路（OSM way 1023830421・1023600789）で描く（2026-10-18 オーナー指示）。OSM で way 1023830421 は3回線で、阿南火力線（2回線）と蔭平線（1回線）の計3回線に合い、国府変電所への引込も3本（way 1023600788・1023600789・1023600790）ある。どの引込を使うかは分からないので、阿南火力線と同じ way 1023600789 で描く。途中の node ${JUNCTION} で阿南幹線と点を共有するが、交差として扱い、つながない。`},
  {label:'区分',value:'蔭平変電所と国府変電所を結ぶ187kV・1回線の線。'},
  {label:'地理参照',value:`国府側は OSM の way 1023600789・1023830421（阿南火力線と共架）・844748245（1回線）・1023600792（187kV;66kV・3回線）と way 722648701（1回線）の北側（node 6778853524 まで。国土地理院の送電線記号と2m以内で重なる）。そこから南の約${gsiKm.toFixed(1)}kmは${GSI}した経路（OSM の way 722648701 の南側は記号から最大約100m外れるので使わない。OSM の way 1037463545・722659587 も使わない）。記号の終点から蔭平変電所の区画内の点（OSM node ${BAY}）まで約${Math.round(straightM)}mは、ルート不明のため直線で表示（破線）。計約${km([southRoute,...tail,...shared]).toFixed(1)}km。`},
  {label:'出典',value:`${FROM}${GSI}。`}];
 lines.push(kg);ANAN.ids=[kar.id,old.id,kg.id];}
{const {applyEndFixes}=await import('./end-fixes.mjs');applyEndFixes('shikoku',lines,facilities);}
// 長山線・奈半利川支線・二又線・魚梁瀬線・大川支線・壬生川線・西条火力線・讃岐坂出線・坂出火力線・香川線の付け替え・鳴門淡路線（2026-11-10 オーナー承認 保留107）
const NAHARI=applyNahariLines(lines,facilities);
const tiers=applyTiers('shikoku',lines,facilities);console.log('shikoku tiers',JSON.stringify(tiers));
// applyTiers は要注意・照合の根拠を定型文にする。阿南の3本は実際の理由に差し替える（C区分のまま、2026-10-18）
const ANAN_WHY={'shikoku-plant-187-way-605689959':['両端は一次資料（系統図・変電所一覧）で国府変電所〜阿南火力変電所と分かるが、地図の阿南側の端は発電所の区画内の点で、経路はOSMの名前のない線分だけで描いた参考表示。','No.37 の端点は一次資料で確定。地図の阿南側の端が阿南火力変電所の区画に着いていないので、端点との対応は推定。経路はOSMの名前のない線分（C区分）。'],
 'ledger-infer-shikoku-187-463775144':['両端は一次資料（系統図・変電所一覧）で井川変電所〜阿南火力変電所と分かるが、経路はOSMの名前のない線分だけで描いた参考表示。','No.38 の端点は一次資料で確定。経路はOSMの名前のない線分（C区分）。'],
 'shikoku-osm-187-722648701':['両端は一次資料（系統図・変電所一覧）で蔭平変電所〜国府変電所と分かるが、経路の南側は国土地理院の送電線記号だけ、北側はOSMの名前のない線分だけで描いた参考表示。','No.36 の端点は一次資料で確定。経路は国土地理院の送電線記号とOSMの名前のない線分（C区分）。']};
for(const id of ANAN.ids){const l=lines.find(x=>x.id===id);const set=(label,value)=>{const i=l.attributes.findIndex(a=>a.label===label);if(i<0)throw Error('阿南：'+label+' がない '+id);l.attributes[i]={label,value};};
 if(l.attributes.find(a=>a.label==='照合区分')?.value!=='C区分')throw Error('阿南：照合区分がCでない '+id);
 set('要注意（C区分）',ANAN_WHY[id][0]);
 set('照合の根拠',ANAN_WHY[id][1]);}
overrideNahariTiers(lines,NAHARI);
for(const l of lines)for(const c of l.connections)for(const f of c.facilities)if(!facilities.some(x=>x.id===f.id))throw Error('Unknown Shikoku facility '+f.id);
const ids=[...lines,...facilities].map(x=>x.assetId);if(new Set(ids).size!==ids.length)throw Error('Duplicate Shikoku asset IDs');
// 線のない設備（端点を確認できず保留した区間の設備：広島中央・北尾道など）は載せない。発電所は電源線がなくても隣接設備に直接つながるものを残す
for(let i=facilities.length-1;i>=0;i--){const f=facilities[i];if(f.kind!=='plant'&&!lines.some(l=>l.connections.some(c=>c.facilities.some(x=>x.id===f.id))))facilities.splice(i,1);}
const data={schemaVersion:1,datasetId:'shikoku-trunk-v1',rights:'pending',
 coverage:'四国500kV・187kV・'+lines.length+'路線'+facilities.length+'設備の限定検証（OCCTO四国の500kV全4区間と187kV全21区間。地理はOSM）。',
 retrievedAt:source.requests.map(r=>r.retrievedAt).sort().at(-1),osmTimestamp:source.requests.map(r=>r.osmBase).filter(Boolean).sort().join(' – '),
 license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',sourceUrl:'https://overpass-api.de/api/interpreter',sources:source.requests.map(({name,endpoint,retrievedAt,sha256})=>({file:name,url:endpoint,retrievedAt,sha256})),
 lines,facilities,changePlans:[]};
data.coverage+='照合区分 A'+tiers.A+'・B'+tiers.B+'・C'+tiers.C+(tiers.D?'・D'+tiers.D:'')+'（A・Bは公表区間の両端にOSMの線で到達したもの。要注意はC・Dのみ）。';
const text=JSON.stringify(publicWording(data,'shikoku-trunk.json'),null,2)+'\n';writeFileSync('public/data/shikoku-trunk.json',text);
writeFileSync('config/shikoku-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(text).digest('hex'),lineIds:lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(lines.map(l=>[l.assetId,l.voltageKV])),lineCurrentTypes:Object.fromEntries(lines.filter(l=>l.currentType!=='ac').map(l=>[l.assetId,l.currentType])),facilityIds:facilities.map(f=>f.assetId)},null,2)+'\n');
// OCCTO→地図の対応表を画面用モジュールへ書き出す（src/shikoku-pairs.ts）
const pairs=read('docs/research/shikoku-occto-pairs.json').pairs;
const header='// 生成ファイル（scripts/build-shikoku.mjs）。元は docs/research/shikoku-occto-pairs.json（tools/prep/adopt-shikoku.mjs）。手で編集しない。\n// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]\n';
writeFileSync('src/shikoku-pairs.ts',header+'export const pairs=[\n'+pairs.map(p=>' '+JSON.stringify(p).replaceAll('"',"'")).join(',\n')+',\n] as const;\n');
console.log('Shikoku dataset',lines.length,'lines',facilities.length,'facilities');
