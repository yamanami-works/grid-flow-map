// Builds the Kyushu validation dataset (public/data/kyushu-trunk.json) and its pinned approval from the adopted sections
// (docs/research/kyushu-adopted.json, produced by tools/prep/adopt-kyushu.mjs). All lines are C tier (OSM routes only, 要注意).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyTiers} from './assign-tiers.mjs';
import {mergeJpower,annotateJpower} from './jpower.mjs';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const adopted=read('docs/research/kyushu-adopted.json');
const source=read('data/raw/kyushu-osm/source.json');
const lines=[...adopted.lines],facilities=adopted.facilities.map(f=>({...f}));
// 基幹系統に接続する発電所（tools/prep/adopt-plants.mjs、2026-10-02）：追加の発電所・OCCTO公表外の電源線と、既存の発電所へのOSM登録値
let plants=null;try{plants=read('docs/research/kyushu-plants-adopted.json');}catch{}
if(plants){for(const f of plants.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...plants.lines);
 for(const e of plants.enriched){const f=facilities.find(x=>x.id===e.id);if(f&&f.assetId?.startsWith('kyushu-'))f.attributes=[...(f.attributes??[]).filter(a=>!e.attributes.some(b=>b.label===a.label)),...e.attributes];}}
// 地域間連系線（tools/prep/adopt-ties.mjs、2026-10-03）：このエリアが端になる線を同じIDで入れる。端の設備は自エリアのものを優先し、相手側はそのエリアの設備を使う。潮流は未反映。
let ties=null;try{ties=read('docs/research/ties-adopted.json');}catch{}
if(ties)for(const l of ties.lines.filter(l=>l.regions.includes('kyushu'))){const {regions,...line}=l;lines.push(line);for(const c of l.connections)for(const x of c.facilities)if(!facilities.some(f=>f.id===x.id)){const {region,...f}=ties.facilities.find(f=>f.id===x.id);facilities.push(f);}}
// 川薩・川内まわりの修正（2026-10-10 オーナー承認、川薩開閉所の位置は案A。docs/research/kyushu-sensatsu-fix.json、tools/fix-kyushu-sensatsu.mjs）
const FIX_SENSATSU=read('docs/research/kyushu-sensatsu-fix.json');
// 台帳の線（出水分岐線など）は mergeJpower で入るので、その後に通す
const applySensatsuFix=()=>{const X=FIX_SENSATSU,TSO='九州電力送配電 送電線一覧（27 川内・出水地区、2026-09-29更新）',SYS='九州電力送配電「基幹系統 系統構成（実績）」2024年度';
 const OSM_SRC='地理はOSM（data/raw/kyushu-osm、2026-10-02時点）。';
 const setAttr=(o,label,value)=>{o.attributes=[...(o.attributes??[]).filter(a=>a.label!==label),...(value==null?[]:[{label,value}])];};
 // 1. OSMの「川内電力所」は川内変電所（川薩ではない）
 const sendai=facilities.find(f=>f.id===X.sendaiSubstation.id);if(!sendai||sendai.name!==X.sendaiSubstation.from)throw Error('川内電力所の区画が想定と違う');
 sendai.name=X.sendaiSubstation.to;
 setAttr(sendai,'名称・位置の根拠',`OSMの区画名は「川内電力所」（220/110/66kV、薩摩川内市）。${TSO.replace('送電線一覧','変圧器一覧')}の川内変電所（220/110kV・220/66kV）と電圧が一致し、OSMの220kV「川内分岐線」（一次資料：川内分岐線 南九州→川内）が入る。以前は川薩変電所とみなしていた（2026-10-10 一次資料で訂正。川薩は系統開閉所で別の設備）。`);
 // 2. 川薩開閉所（推定位置）
 const swsRef={id:X.sws.id,name:X.sws.name};
 facilities.push({id:X.sws.id,assetId:X.sws.assetId,name:X.sws.name,kind:'switchyard',position:X.sws.position,voltages:[220],scopeConnected:true,attributes:[
  {label:'名称の根拠',value:`${SYS}に「川薩SWS」（系統開閉所）、${TSO}に「川薩sws」（川薩南九州線の起点）。OCCTOの潮流実績は「川薩ss」と表記。`},
  {label:'名称・位置の根拠',value:`位置は推定（OSMに区画なし）。旧川内発電所の敷地内で、OSMの新鹿児島線と川内火力線（一次資料の川薩南九州線とみられる）の端が集まる4ノード（広がり約${X.sws.spreadM}m）の中心に置いた。系統構成の図でも川内変電所の西、発電所の近くに描かれている（模式図）。2026-10-10 オーナー判断「案A」。`}]});
 // 起点の「他社」の注記（2026-10-10 オーナー指示。推定）
 const OTHER_NOTE=`九州電力送配電の送電線一覧（2026-09-29更新）で新鹿児島線の起点は「他社」。九州電力「川内原子力発電所1号機 第28回定期検査の概要」（https://www.kyuden.co.jp/var/rev0/0529/1654/kX86AjtK.pdf 、写真 2024年6月撮影、2026-10-25確認）では、2024年までの工事で新鹿児島線は川内原子力発電所～新鹿児島変電所になったので、「他社」は川内原子力発電所（九州電力）とみられる（推定）。地図では新鹿児島線を発電所～新鹿児島変電所とし、OCCTOの行の終点「川薩ss」は発電所と読み替える（2026-10-25 オーナー指示）。以前（2026-10-10）は、川薩開閉所（もと九州電力 川内発電所の開閉所）を指すとみていた。`;
 setAttr(facilities.at(-1),'起点の「他社」',OTHER_NOTE);
 const conn=(node,position,facility)=>({node,position,status:facility?'facility-area':'shared-node',facilities:facility?[facility]:[],neighborWays:[]});
 const geoNote=(parts,km,names)=>`OSM ${parts.length}線分（計約${km}km）、OSMの線名：${names}。同電圧の共有ノードだけで連結。個別回線は未確認。`;
 // 3. 新鹿児島線：OSMの「新鹿児島線」の線分だけ（川薩開閉所→新鹿児島変電所）
 const sk=lines.find(l=>l.id===X.shinKagoshima.id);if(!sk)throw Error('新鹿児島線がない');
 const skEnd=sk.connections.find(c=>c.facilities.some(f=>f.name==='新鹿児島変電所'));
 const skParts=[...X.shinKagoshima.parts].reverse().map(p=>({...p,path:[...p.path].reverse()})); // 新鹿児島→川薩（元の線の向き）
 sk.osmIds=skParts.map(p=>p.osmId);sk.paths=skParts.map(p=>p.path);delete sk.schematicParts;
 sk.connections=[skEnd,conn(X.shinKagoshima.swsNode,skParts.at(-1).path.at(-1),swsRef)];
 sk.referenceReview={...sk.referenceReview,endpoints:'新鹿児島変電所―川薩開閉所'};
 setAttr(sk,'地理参照',geoNote(skParts,X.shinKagoshima.km,'新鹿児島線'));setAttr(sk,'末端の直線',null);
 setAttr(sk,'起点の「他社」',OTHER_NOTE);
 setAttr(sk,'経路の訂正','2026-10-10：以前は川内火力線・川内分岐線（OSM名）を経由して川内変電所（当時は川薩変電所とみなしていた）まで描いていた。一次資料で川薩は系統開閉所と分かり、OSMの新鹿児島線の線分だけにした。');
 // 4. 川薩南九州線（OSM名「川内火力線」）
 const minami=facilities.find(f=>f.name==='南九州変電所');if(!minami)throw Error('南九州変電所がない');
 const S=X.sensatsuMinamikyushu,B=X.sendaiBranch,first=S.parts.find(p=>p.osmId>0&&p.path.length>2).osmId;
 const ledgerLine=(id,name,parts,connections,endpoints,no,dir,cap,extra)=>({id,assetId:id,name,named:true,voltageKV:220,currentType:'ac',osmIds:parts.map(p=>p.osmId),paths:parts.map(p=>p.path),connections,referenceReview:{status:'section',endpoints},attributes:[
  {label:'公表の線名',value:`${TSO} No.${no}：${name}（220kV）、2回線、${dir}。${cap}`},
  {label:'区分',value:'各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。'},
  ...extra,{label:'出典',value:`${TSO}、${SYS}。${OSM_SRC}`}]});
 lines.push(ledgerLine(`ledger-kyushu-220-${first}`,'川薩南九州線',S.parts,[conn(S.swsNode,S.parts[0].path[0],swsRef),conn(S.endNode,S.parts.at(-1).path.at(-1),{id:minami.id,name:minami.name})],'川薩開閉所―南九州変電所',3,'川薩sws→南九州','',
  [{label:'地理参照',value:geoNote(S.parts,S.km,'川内火力線')+'OSMの線名は一次資料の線名と違う（一次資料の両端・電圧・途中の分岐（出水分岐線・川内分岐線）が合うので川薩南九州線とみなした。補助資料のみ）。'}]));
 // 5. 川内分岐線（川薩南九州線の途中の分岐→川内変電所）
 lines.push(ledgerLine(`ledger-kyushu-220-${B.parts[0].osmId}`,'川内分岐線',B.parts,[conn(B.startNode,B.parts[0].path[0],null),conn(B.endNode,B.parts.at(-1).path.at(-1),{id:sendai.id,name:sendai.name})],'川薩南九州線との分岐―川内変電所',4,'南九州→川内（川薩南九州線から分岐）','',
  [{label:'地理参照',value:geoNote(B.parts,B.km,'川内分岐線、川内分岐線・川内佐志線')+'川内変電所の手前は66kVの川内佐志線と併架（OSM）。'}]));
 // 出水分岐線：起点は川薩南九州線との分岐（共有ノード）
 const iz=lines.find(l=>l.id===X.izumiBranch.id);if(!iz)throw Error('出水分岐線がない');
 iz.connections=[conn(X.izumiBranch.startNode,X.izumiBranch.startPosition,null),iz.connections.at(-1)];
 iz.referenceReview={...iz.referenceReview,endpoints:'川薩南九州線との分岐―出水変電所'};
 setAttr(iz,'公表の線名',`${TSO} No.2：出水分岐線（220kV）、2回線、南九州→出水。起点は川薩南九州線の途中の分岐（OSMの共有ノード、2026-10-10 訂正）。`);
 // 電源線「川内火力線」は川薩南九州線の一部として描く（川内発電所は2022-04-01廃止）
 for(const id of X.dropLineIds){const i=lines.findIndex(l=>l.id===id);if(i<0)throw Error('消す線がない：'+id);lines.splice(i,1);}
 {const np=facilities.find(f=>f.id==='osm-way-215429864');if(!np)throw Error('川内原子力発電所がない');setAttr(np,'経由する線',null);setAttr(np,'接続する220kVの線','新鹿児島線（新鹿児島変電所へ）と川内原子力連絡線（川薩開閉所へ）。どちらも発電所の東の高台の特高開閉所（国土地理院の記号の位置、OSMに区画なし）から出る（九州電力「川内原子力発電所1号機 第28回定期検査の概要」（https://www.kyuden.co.jp/var/rev0/0529/1654/kX86AjtK.pdf 、写真 2024年6月撮影、2026-10-25確認）、2026-10-25 オーナー指示。経路の一部は推測）。');}
 const plant=facilities.find(f=>f.id==='osm-way-365487155');if(plant)setAttr(plant,'系統との接続','旧発電所の敷地内に川薩開閉所（推定位置）。電源線（OSM名 川内火力線）は川薩南九州線として描く（2026-10-10）。');
};
// 照合区分（A/B/C）を東京と同じ規則で付け直す（scripts/assign-tiers.mjs、2026-10-03）
// 電源開発の設備（scripts/jpower.mjs、2026-10-04）
mergeJpower('kyushu',lines,facilities);applySensatsuFix();annotateJpower('kyushu',lines,facilities);{const {applyEndFixes}=await import('./end-fixes.mjs');applyEndFixes('kyushu',lines,facilities);}
// 送電線（新大分変電所～東大分変電所）（空容量一覧 No.2 の名前を伏せた行から推定で描いた直線、D区分）は新大分連絡線と重複するので外す（2026-10-25 オーナー指示・承認 保留31）。
// 国土地理院の記号（14/14185/6585・14/14186/6585）では、新大分変電所から出た線は川を渡って新大分連絡線の経路で東大分変電所に入り、直線の経路に記号・鉄塔はない。承認済み削除は tests/baseline/approved-removals.json
{const id='ledger-infer-kyushu-220-s-osm-way-1199776835-osm-way-1199776830',i=lines.findIndex(l=>l.id===id),l=lines[i];
 if(!l||!l.schematic||!l.attributes.some(a=>a.label==='要注意（D区分）')||l.connections.map(c=>c.facilities[0]?.id).join()!=='osm-way-1199776835,osm-way-1199776830')throw Error('新大分～東大分の直線の線が想定と違う');lines.splice(i,1);}
// 新小倉火力発電所の連系線：到津変電所から北へ、東へ曲がる所までの3線分を地中（点線）で描く（2026-10-26 オーナー指示）。OSM のタグ（power=cable・location=underground）を確かめ、違えば止める。
// 九州電力送配電「2024年度 ローカル系統 系統構成（実績）」〔2 小倉〕の図（2026-10-26確認）でも新小倉～到津の220kVは地中線の記号
{const raw=read('data/raw/kyushu-osm/lines-220.json').elements,l=lines.find(x=>x.id==='kyushu-plant-220-way-605420902'),ids=[1517856236,1517856237,1517852070];
 if(!l||!ids.every(id=>l.osmIds.includes(id)&&(t=>t?.power==='cable'&&t?.location==='underground')(raw.find(e=>e.type==='way'&&e.id===id)?.tags)))throw Error('新小倉火力発電所の連系線：地中の線分が想定と違う');
 l.cableOsmIds=ids;l.attributes=[...l.attributes.filter(a=>a.label!=='地中区間'),{label:'地中区間',value:'到津変電所から北へ、東へ曲がる所まで（OSM way 1517856236・1517856237・1517852070、約4.1km）は地中（点線）。OSM のタグは power=cable・location=underground（data/raw/kyushu-osm、2026-10-02時点）。九州電力送配電「2024年度 ローカル系統 系統構成（実績）」（託送の公表資料、2026-10-26確認）の図でも新小倉～到津の220kVは地中線。2026-10-26 オーナー指示。東の区間（way 1517852073、約1.4km）は架空（実線）。OSM のタグと系統図は地中だが、オーナーが航空写真で架空を確認した（2026-10-26。写真の種類・撮影時期は記録なし）。'}];}
// 新小倉火力発電所～槻田系統開閉所の地中線（OSM「新小倉火力線2/3L」way 1517856238）を足す（2026-10-30 オーナー承認 保留36 案a）。
// 九州電力送配電「2024年度 ローカル系統 系統構成（実績）」〔2 小倉〕の新小倉～槻田の220kV地中線にあたるとみられる（推定）。北の端は OSM で連系線の地中区間の途中のノード（推測）
{const raw=read('data/raw/kyushu-osm/lines-220.json').elements,pos=new Map(raw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const w=raw.find(e=>e.type==='way'&&e.id===1517856238),host=lines.find(x=>x.id==='kyushu-plant-220-way-605420902'),sw=facilities.find(f=>f.id==='osm-way-297939963'),id='kyushu-plant-220-way-1517856238';
 if(!w||w.tags?.power!=='cable'||w.tags?.location!=='underground'||w.tags?.voltage!=='220000'||w.nodes[0]!==1579505033||!host?.osmIds.includes(1517856237)||!host.osmIds.includes(1517856236)||!sw)throw Error('新小倉～槻田の地中線：原本か既存の線・設備が想定と違う');
 if(lines.some(l=>l.id===id||l.osmIds?.includes(1517856238)))throw Error('新小倉～槻田の地中線：既にある');
 const path=w.nodes.map(n=>{const p=pos.get(n);if(!p)throw Error('新小倉～槻田の地中線：ノード '+n+' がない');return p;}),end=path.at(-1);
 if(Math.hypot((end[0]-sw.position[0])*110.5,(end[1]-sw.position[1])*92.6)>0.15)throw Error('新小倉～槻田の地中線：南の端が槻田系統開閉所から離れている');
 const km=path.slice(1).reduce((t,q,k)=>t+Math.hypot((q[0]-path[k][0])*110.54,(q[1]-path[k][1])*111.32*Math.cos(q[0]*Math.PI/180)),0).toFixed(1);
 lines.push({id,assetId:id,name:'新小倉火力発電所～槻田の地中線',named:false,voltageKV:220,currentType:'ac',osmIds:[1517856238],paths:[path],cableOsmIds:[1517856238],
  connections:[{node:1579505033,position:path[0],status:'shared-node',facilities:[],neighborWays:[1517856237,1517856236]},{node:w.nodes.at(-1),position:end,status:'facility-area',facilities:[{id:sw.id,name:sw.name}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'新小倉火力発電所の連系線の途中（推測）―槻田系統開閉所'},
  // 要注意の文は scripts/assign-tiers.mjs の C区分の共通文に揃う。図との対応・北の端の推定は「分岐点の推定」「地中区間」に書く
  attributes:[{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},
   {label:'照合区分',value:'C区分'},{label:'照合の根拠',value:'公表区間なし（電源線・連系線）。'},{label:'区分',value:'OCCTOの公表区間ではない電源線（潮流なし）'},
   {label:'分岐点の推定',value:'北の端は、OSM で新小倉火力発電所の連系線の地中区間の途中のノード（node 1579505033、新小倉火力線1L との接続点）。電気的には新小倉火力発電所から槻田系統開閉所への線とみられるが、連系線と同じ経路を通る発電所までの区間は重ねて描かず、このノードで連系線に接続するとみなした（推測）。'},
   {label:'地理参照',value:'OSM 1線分（way 1517856238、約'+km+'km、OSMの線名：新小倉火力線2/3L、220kV・2回線・地中）。南の端は槻田系統開閉所の区画の中。個別回線は未確認。'},
   {label:'地中区間',value:'全区間が地中（点線）。OSM のタグは power=cable・location=underground（data/raw/kyushu-osm、2026-10-02時点）。九州電力送配電「2024年度 ローカル系統 系統構成（実績）」〔2 小倉〕の図（2026-10-26確認）でも新小倉～槻田の220kVは地中線の記号。'},
   {label:'出典',value:'九州電力送配電「2024年度 ローカル系統 系統構成（実績）」〔2 小倉〕（託送の公表資料、2026-10-26確認）。地理はOSM（data/raw/kyushu-osm、2026-10-02時点）。2026-10-30 オーナー承認（保留36）。'}]});}
// 一ツ瀬発電所を一ツ瀬変電所から分ける（2026-10-26 オーナー判断「発電所のみ設置し送電線は記載しない」、大平発電所と同じやり方）：OSM の「一ツ瀬水力発電所」の区画を一ツ瀬変電所として使っているので、
// 発電所の OSM 登録値は発電所（kyushu-place-一ツ瀬発電所、plant-primary-sources の addFacilities）へ移し、変電所には分けたことを注記する
{const sub=facilities.find(f=>f.id==='osm-way-231759891'),pl=facilities.find(f=>f.id==='kyushu-place-一ツ瀬発電所');if(!sub||!pl)throw Error('一ツ瀬：変電所か発電所がない');
 const MOVE=['発電方式（OSM登録）','発電設備出力（OSM登録値）','運用開始（OSM登録値）'];
 pl.attributes=[...pl.attributes,...sub.attributes.filter(x=>MOVE.includes(x.label))];
 sub.attributes=[...sub.attributes.filter(x=>!MOVE.includes(x.label)&&x.label!=='出力の扱い'),{label:'注記（発電所）',value:'この区画の OSM の名前は「一ツ瀬水力発電所」。発電所は別の設備（一ツ瀬発電所）に分けた（2026-10-26）。'}];}
// 新大分発電所：新大分連絡線の端を新大分変電所の区画の中に移したので、発電所につながる線はない。発電所は隣の新大分変電所に直接つながるとみなす（推測、線は描かない。小丸川発電所と同じ扱い。2026-10-26 オーナー承認 保留31 案a）。新大分連絡線の ID（kyushu-plant-220-way-216781917）は発電所につないでいたときの名残で、承認リストと結び付くので変えない
{const p=facilities.find(f=>f.id==='osm-way-216781917');if(!p||lines.some(l=>l.connections.some(c=>c.facilities.some(x=>x.id===p.id))))throw Error('新大分発電所：想定と違う（線がつながっている）');
 p.attributes=[...p.attributes.filter(a=>a.label!=='系統との接続'),{label:'系統との接続',value:'新大分変電所（osm-way-1199776835）に直接つながるとみなした（推測）。発電所の区画（OSM way 216781917）は新大分変電所の区画と隣り合う。新大分連絡線は新大分変電所の区画の中から東大分変電所へ（OSM の新大分連絡線の線分と国土地理院の送電線記号、2026-10-25 オーナー承認 保留31）。発電所と変電所の間の線は描かない。OCCTOの公表区間ではない。'}];}
// 大平発電所を大平変電所から分ける（2026-10-23 オーナー判断「別の設備に分ける」）：発電所の OSM 登録値（発電方式・出力・運用開始）と出力の扱いは
// 発電所（kyushu-place-大平発電所、docs/research/plant-primary-sources.json の addFacilities）だけに出し、変電所には分けたことを注記する
{const sub=facilities.find(f=>f.id==='osm-way-216499699'),pl=facilities.find(f=>f.id==='kyushu-place-大平発電所');if(!sub||!pl)throw Error('大平：変電所か発電所がない');
 const MOVE=['発電方式（OSM登録）','発電設備出力（OSM登録値）','運用開始（OSM登録値）'];
 pl.attributes=[...pl.attributes,...sub.attributes.filter(x=>MOVE.includes(x.label))];
 sub.attributes=sub.attributes.filter(x=>!MOVE.includes(x.label)&&x.label!=='出力の扱い').map(x=>x.label==='名称・位置の根拠'?{label:x.label,value:x.value+' 九州の系統空容量一覧では端点を「大平sws」（開閉所）と書き、OCCTO の「大平ss」と呼び方が違う。'}:x);
 // 2026-10-25 オーナー指示「大平変電所→大平開閉所」：九州電力送配電 空容量一覧（2026-09-29 八代地区 No.6 大平人吉線）「大平sws」、2024年度 基幹系統 系統構成「大平SWS」（系統開閉所）。OCCTO は「大平ss」
 sub.name='大平開閉所';sub.kind='switchyard';sub.attributes.push({label:'名称の根拠',value:'九州電力送配電 空容量一覧（2026-09-29更新、八代地区 No.6 大平人吉線）の端点「大平sws」、九州電力送配電「2024年度 基幹系統 系統構成（実績）」の「大平SWS」（系統開閉所）。OCCTOは「大平ss」と書く。2026-10-25 オーナー指示で「大平変電所」から「大平開閉所」に。'});
 for(const l of lines)for(const c of l.connections)for(const x of c.facilities)if(x.id===sub.id)x.name=sub.name;
 // 線の区間名・発電所と開閉所の注記に残る旧名も直す（以前の名前の記録は「名称の根拠」に残す）
 const rn=v=>v.replaceAll('大平変電所','大平開閉所');for(const l of lines)if(l.connections.some(c=>c.facilities.some(x=>x.id===sub.id))&&l.referenceReview?.endpoints)l.referenceReview.endpoints=rn(l.referenceReview.endpoints);
 for(const f of [sub,pl])f.attributes=f.attributes.map(x=>x.label==='名称の根拠'?x:{...x,value:rn(x.value).replace('発電所構内の変電所とみなした','発電所構内の開閉所とみなした')});
 sub.attributes.push({label:'注記（発電所）',value:'発電所は別の設備（kyushu-place-大平発電所）に分けた（2026-10-23 オーナー判断）。この区画は OSM では「大平水力発電所」。'});}
// 日向幹線と送電線（ひむか～宮崎）の経路（2026-10-24 オーナー承認 保留13、南の約8kmは案A）：日向幹線（OCCTO 東九州ss→ひむかss）は、OSM に東九州―ひむかの名前のある線がなく、
// 共有ノードをたどって熊本・南九州・宮崎を回る約467kmで描かれていた（最後の区間は OSM の「小丸川幹線」＝送電線（ひむか～宮崎）の区間）。
// OSM の名前のない 500kV の線 way 704876994（東九州の区画の約134m手前〜ひむかの約8km手前）と、南の途切れを国土地理院の送電線記号でなぞった経路に置き換える。
// 送電線（ひむか～宮崎）（九州の空容量一覧 No.1、名前を伏せた行）は直線から OSM の way 216953913（OSMの線名「小丸川幹線」）に置き換える。端の設備・公表区間・照合表は変えない。
// 照合は docs/KYUSHU.md「日向幹線の経路」
{const raw=read('data/raw/kyushu-osm/lines-500.json');const node=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const at=raw.osm3s?.timestamp_osm_base?.slice(0,10);if(!at)throw Error('日向幹線：OSMの取得時点が原本にない');
 const way=(id,name)=>{const w=raw.elements.find(e=>e.type==='way'&&e.id===id);if(!w||w.tags?.power!=='line'||w.tags?.voltage!=='500000'||(w.tags?.name??null)!==name)throw Error('日向幹線：OSMの線 '+id+' のタグが変わった');return w.nodes;};
 const dm=(a,b)=>6371000*Math.hypot((b[1]-a[1])*Math.PI/180*Math.cos(a[0]*Math.PI/180),(b[0]-a[0])*Math.PI/180);
 const km=p=>p.slice(1).reduce((t,q,i)=>t+dm(p[i],q),0)/1000;
 const hy=lines.find(l=>l.id==='kyushu-500-日向幹線'),hm=lines.find(l=>l.id==='ledger-infer-kyushu-500-s-osm-way-216953915-osm-way-216956620');
 if(!hy||!hm)throw Error('日向幹線：線がない');
 const [c0,c1]=hy.connections;if(c0.node!==1985409669||c0.facilities[0].id!=='osm-way-216778426'||c1.node!==2262722057||c1.facilities[0].id!=='osm-way-216953915')throw Error('日向幹線：端が想定と違う');
 if(lines.some(l=>l!==hy&&l.osmIds.some(x=>[704876994,216953913].includes(x))))throw Error('日向幹線：OSMの線をほかの線が使っている');
 const w7=way(704876994,null).map(n=>node.get(n)).reverse(),KM=way(216953913,'小丸川幹線');if(KM[0]!==2262722057)throw Error('小丸川幹線：ひむか側の端が想定と違う');
 const GSI_ROUTE=[[32.3180695,131.3548887],[32.3166687,131.3533008],[32.3159977,131.3525391],[32.3150185,131.3514286],[32.3132685,131.3499963],[32.3116953,131.3487089],[32.3083357,131.3482422],[32.3073927,131.3481081],[32.305706,131.3475931],[32.3044002,131.3471961],[32.3014348,131.3457048],[32.300002,131.3460428],[32.2981338,131.346488],[32.2959482,131.3480437],[32.2916675,131.3498461],[32.2913093,131.3499963],[32.2905882,131.3503021],[32.2871326,131.3518256],[32.2856043,131.3525069],[32.2854819,131.3525391],[32.2833368,131.353097],[32.2822347,131.3533813],[32.2780985,131.3525927],[32.2752321,131.3526142],[32.2750007,131.3527],[32.2718893,131.3538158],[32.2685554,131.3558811],[32.2676256,131.3564605],[32.2666685,131.3565463],[32.2605583,131.3571095],[32.2583355,131.357426],[32.2571877,131.3575923],[32.2569246,131.3583326],[32.2556862,131.3618088],[32.2551645,131.3666636],[32.2551055,131.3672161],[32.2557043,131.3705152],[32.2550102,131.3738519],[32.254856,131.3745117],[32.2547562,131.3749409],[32.2538897,131.3785994],[32.2521294,131.3833308],[32.251957,131.3837868]];
 if(dm(w7.at(-1),GSI_ROUTE[0])>15)throw Error('日向幹線：記号の始点がOSMの線の南端から離れた');// 記号の始点（OSMの線の南端から約7m）は OSM の線の南端にそろえ、区間を途切れなくつなぐ
 // 東九州変電所の引き込み（2026-10-25 オーナー指示・承認 保留30）：国土地理院の送電線記号（ベクトルタイル 14/14187/6592、2026-10-25取得）では、日向幹線は OSM の北端から北東へ約110mで
 // 変電所の中の枠の南西の角（HK_SW）に、東九州幹線は OSM の端（node 1985409669）から南東へ約110mで枠の北西の角（HK_NW）に入り、2本はつながらない。記号の他端は OSM の端にそろえる
 const HK_SW=[33.134452,131.728477],HK_NW=[33.134887,131.728595],GSI_HK='国土地理院 ベクトルタイル（試験公開、experimental_bvmap ズーム14、送電線 ftCode 8202、14/14187/6592、2026-10-25取得）';
 {const fac=read('data/raw/kyushu-osm/facilities.json').elements.find(e=>e.type==='way'&&e.id===216778426),poly=fac?.geometry?.map(p=>[p.lat,p.lon]);if(!poly)throw Error('東九州変電所：区画がない');
  const inside=([y,x])=>poly.reduce((b,[y1,x1],i)=>{const [y2,x2]=poly[(i+1)%poly.length];return ((y1>y)!==(y2>y))&&x<(x2-x1)*(y-y1)/(y2-y1)+x1?!b:b;},false);
  if(!inside(HK_SW)||!inside(HK_NW))throw Error('東九州変電所：引き込みの端が区画の外');}
 if(dm(HK_SW,w7[0])>150)throw Error('日向幹線：東九州側の引き込みが長すぎる');
 const north=[HK_SW,w7[0]],south=[GSI_ROUTE.at(-1),c1.position];if(dm(...south)>120)throw Error('日向幹線：補いの直線が長すぎる');
 const near=lines.find(l=>l.name==='ひむか新日向線');if(near&&near.paths.flat().some(q=>q[0]===w7.at(-1)[0]&&q[1]===w7.at(-1)[1]))throw Error('日向幹線：ひむか新日向線と共有点がある');
 const GSI='国土地理院 ベクトルタイル（試験公開、experimental_bvmap ズーム14、送電線 ftCode 8202、2026-10-24取得）';
 Object.assign(hy,{osmIds:[-9900011,704876994,-9900012,-9900013],paths:[north,w7,[w7.at(-1),...GSI_ROUTE.slice(1)],south],schematicParts:[{osmId:-9900013,construction:'unknown'}],tracedParts:[{osmId:-9900011,basis:'国土地理院の送電線記号'},{osmId:-9900012,basis:'国土地理院の送電線記号'}]});
 hy.connections=[{...c0,node:null,position:HK_SW},c1];
 hy.attributes=[...hy.attributes.filter(a=>!['地理参照','末端の直線','出典'].includes(a.label)),
  {label:'地理参照',value:'OSM の名前のない 500kV の線 way 704876994（約'+km(w7).toFixed(1)+'km）を日向幹線とみなした（電圧と、両端が東九州変電所・ひむか変電所の近くにあることから。OSM の線名はない）。この線は両端で途切れる。北端から東九州変電所の区画の中の枠（地理院の記号）の南西の角までの約'+Math.round(dm(...north))+'mは国土地理院の送電線記号だけ（'+GSI_HK+'。東九州幹線とはつながらない。2026-10-25 オーナー指示）。南端からひむか変電所の手前までの約'+km(GSI_ROUTE).toFixed(1)+'kmは国土地理院の送電線記号をなぞった（記号は途中でほかの記号と交差するが、1本の記号をたどった。交差は接続として扱わない）。記号の端からひむか側の端の点までの約'+Math.round(dm(...south))+'mは直線（経路不明・破線）。補った区間の経路は推定。個別回線は未確認。南端の約480m にある 220kV のひむか新日向線とはつながない。'},
  {label:'経路の根拠',value:'北側 約'+km(w7).toFixed(1)+'kmは OSM の線、南側 約'+km(GSI_ROUTE).toFixed(1)+'kmは国土地理院の送電線記号だけ（記号は途中でほかの記号と交差し、RULES 3節の「1本にたどれる」の条件を満たさないので C区分）、北端の約'+Math.round(dm(...north))+'mは国土地理院の送電線記号だけ、南端の短い区間は直線。'},
  {label:'出典',value:'OCCTO系統情報サービス（九州、2026-10-01の実績・容量）。地理はOSM（'+at+'時点 data/raw/kyushu-osm）と'+GSI+'・'+GSI_HK+'。2026-10-24 オーナー承認（約467kmの回り道から描き直し）。東九州側の引き込みは 2026-10-25 オーナー指示・承認（保留30）。'}];
 // 東九州幹線：OSM の端（node 1985409669）から、地理院の記号で東九州変電所の中の枠の北西の角まで延ばす（保留30）。照合区分は今のまま（変電所の区画の中への短い引込、オーナー判断）
 {const ek=lines.find(l=>l.id==='kyushu-500-東九州幹線'),e0=ek?.connections[0];const p0=raw.elements.find(e=>e.type==='node'&&e.id===1985409669);
  if(!ek||!p0||e0.node!==1985409669||e0.facilities[0].id!=='osm-way-216778426'||ek.paths[0][0][0]!==p0.lat||ek.paths[0][0][1]!==p0.lon)throw Error('東九州幹線：東九州側の端が想定と違う');
  const lead=[HK_NW,ek.paths[0][0]];if(dm(...lead)>150)throw Error('東九州幹線：引き込みが長すぎる');
  Object.assign(ek,{osmIds:[-9900014,...ek.osmIds],tracedParts:[...(ek.tracedParts??[]),{osmId:-9900014,basis:'国土地理院の送電線記号'}],paths:[lead,...ek.paths],connections:[{...e0,node:null,position:HK_NW},...ek.connections.slice(1)]});
  ek.attributes=ek.attributes.map(a=>a.label==='地理参照'?{label:a.label,value:a.value+'東九州側は、OSM の端から東九州変電所の中の枠（地理院の記号）の北西の角までの約'+Math.round(dm(...lead))+'mを国土地理院の送電線記号だけで足した（'+GSI_HK+'。変電所の区画の中への引込）。'}:a.label==='出典'?{label:a.label,value:a.value+'東九州側の引込は'+GSI_HK+'を加工。'}:a);
  ek.attributes.push({label:'端の修正（2026-10-25）',value:'東九州側の端を、OSM の端（node 1985409669、区画の外 約90m）から地理院の記号で東九州変電所の中の枠の北西の角まで延ばした（オーナー指示・承認 保留30）。日向幹線とは点を共有しない。'});
  const pts=new Set(hy.paths.flat().map(q=>q.join(',')));if(ek.paths.flat().some(q=>pts.has(q.join(','))))throw Error('東九州幹線：日向幹線と点を共有する');}
 const kp=KM.map(n=>node.get(n));if(kp.some(q=>!q))throw Error('小丸川幹線：節点がない');
 const mzk=lines.find(l=>l.id==='kyushu-500-宮崎幹線');if(KM.at(-1)!==4075700453||mzk?.connections[0].facilities[0].id!=='osm-way-216956620'||c1.node!==KM[0])throw Error('小丸川幹線：両端の節点が宮崎幹線・日向幹線の端と違う');
 // 苓北火力線の説明は、以前の日向幹線（中九州を通っていた）を前提にしていたので直す（端は 2026-10-11 から中九州変電所。データの接続は変えない）
 {const rh=lines.find(l=>l.id==='plant-kyushu-500-213736246');if(!rh||rh.connections[1].facilities[0].id!=='osm-way-216502300')throw Error('苓北火力線：端が想定と違う');
  rh.referenceReview={...rh.referenceReview,endpoints:'苓北火力発電所―中九州変電所'};rh.attributes=rh.attributes.map(a=>a.label==='地理参照'?{label:a.label,value:a.value.replace('地図の日向幹線に着くまで','中九州変電所の区画に着くまで')}:a);
  if(!rh.attributes.some(a=>a.label==='地理参照'&&/中九州変電所の区画に着くまで/.test(a.value)))throw Error('苓北火力線：地理参照の文が想定と違う');}
 delete hm.schematic;delete hm.construction;
 Object.assign(hm,{osmIds:[216953913],paths:[kp],connections:[{node:KM[0],position:kp[0],status:'facility-area',facilities:hm.connections[0].facilities,neighborWays:[]},{node:KM.at(-1),position:kp.at(-1),status:'facility-area',facilities:hm.connections[1].facilities,neighborWays:[]}],referenceReview:{status:'section',endpoints:'ひむか変電所―宮崎変電所'}});
 hm.attributes=[...hm.attributes.filter(a=>!a.label.startsWith('要注意（D区分')&&!['地理参照','出典'].includes(a.label)),
  {label:'地理参照',value:'OSM 1線分（約'+km(kp).toFixed(1)+'km）、OSMの線名：小丸川幹線（公表の行は名前を伏せているので、線名は確定しない）。ひむか側の端は日向幹線と同じ点（node 2262722057）。個別回線は未確認。'},
  {label:'出典',value:'九州電力送配電 予想潮流・空容量一覧表（送電線）（data/raw/tso-lines、2026-10-04取得）。地理はOSM（'+at+'時点 data/raw/kyushu-osm）。2026-10-24 オーナー承認（直線から描き直し）。'}];}
// 末端の直線の「計約0.0km」を直す（2026-11-04 オーナー指示 保留75、scripts/km-text.mjs）。docs/research/kyushu-adopted.json は古い文のまま。対象と件数を固定し、直線の長さ（0より大きく50m未満）を測り直す
{const {kmText}=await import('./km-text.mjs');const d=(a,b)=>{const t=Math.PI/180,x=(b[1]-a[1])*t*Math.cos((a[0]+b[0])/2*t),y=(b[0]-a[0])*t;return 6371000*Math.hypot(x,y);};
 const hits=lines.filter(l=>(l.attributes??[]).some(a=>a.label==='末端の直線'&&a.value.includes('（計約0.0km）')));
 if(hits.map(l=>l.id).join()!=='kyushu-220-西谷門司線')throw Error('末端の直線の約0.0km：対象の線が想定と違う '+hits.map(l=>l.id).join(','));
 for(const l of hits){const m=(l.schematicParts??[]).reduce((s,p)=>{const q=l.paths[l.osmIds.indexOf(p.osmId)];return s+d(q[0],q.at(-1));},0);
  if(!(m>0&&m<50))throw Error('末端の直線の約0.0km：直線の長さが想定と違う '+l.id+' '+m);
  for(const a of l.attributes)if(a.label==='末端の直線')a.value=a.value.replace('（計約0.0km）','（計'+kmText(m)+'）');}}
{const {checkTracedParts}=await import('./end-fixes.mjs');checkTracedParts(lines);} // なぞった区間（tracedParts）の整合（2026-11-06 保留79）
const tiers=applyTiers('kyushu',lines,facilities);console.log('kyushu tiers',JSON.stringify(tiers));
for(const l of lines)for(const c of l.connections)for(const f of c.facilities)if(!facilities.some(x=>x.id===f.id))throw Error('Unknown Kyushu facility '+f.id);
const ids=[...lines,...facilities].map(x=>x.assetId);if(new Set(ids).size!==ids.length)throw Error('Duplicate Kyushu asset IDs');
// 線のない設備（端点を確認できず保留した区間の設備：広島中央・北尾道など）は載せない。発電所は電源線がなくても隣接設備に直接つながるものを残す
for(let i=facilities.length-1;i>=0;i--){const f=facilities[i];if(f.kind!=='plant'&&!lines.some(l=>l.connections.some(c=>c.facilities.some(x=>x.id===f.id))))facilities.splice(i,1);}
const data={schemaVersion:1,datasetId:'kyushu-trunk-v1',rights:'pending',
 coverage:'九州500kV・220kV・'+lines.length+'路線'+facilities.length+'設備の限定検証（OCCTO九州の500kV全12区間と220kV全59区間。地理はOSM。OSMで途切れた所は直線で補完）。',
 retrievedAt:source.requests.map(r=>r.retrievedAt).sort().at(-1),osmTimestamp:source.requests.map(r=>r.osmBase).filter(Boolean).sort().join(' – '),
 license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',sourceUrl:'https://overpass-api.de/api/interpreter',sources:source.requests.map(({name,endpoint,retrievedAt,sha256})=>({file:name,url:endpoint,retrievedAt,sha256})),
 lines,facilities,changePlans:[]};
data.coverage+='照合区分 A'+tiers.A+'・B'+tiers.B+'・C'+tiers.C+(tiers.D?'・D'+tiers.D:'')+'（A・Bは公表区間の両端にOSMの線で到達したもの。要注意はC・Dのみ）。';
const text=JSON.stringify(publicWording(data,'kyushu-trunk.json'),null,2)+'\n';writeFileSync('public/data/kyushu-trunk.json',text);
writeFileSync('config/kyushu-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(text).digest('hex'),lineIds:lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(lines.map(l=>[l.assetId,l.voltageKV])),lineCurrentTypes:Object.fromEntries(lines.filter(l=>l.currentType!=='ac').map(l=>[l.assetId,l.currentType])),facilityIds:facilities.map(f=>f.assetId)},null,2)+'\n');
// OCCTO→地図の対応表を画面用モジュールへ書き出す（src/kyushu-pairs.ts）
// 2026-10-10：OCCTOの「川薩ss」は川薩開閉所（以前は川内変電所の区画を川薩変電所とみなしていた。tools/fix-kyushu-sensatsu.mjs）
const pairs=read('docs/research/kyushu-occto-pairs.json').pairs.map(p=>p.map(x=>x==='川薩変電所'?FIX_SENSATSU.sws.name:x));
// 2026-10-25 オーナー指示（保留22）：新鹿児島線の行の終点「川薩ss」は川内原子力発電所と読み替える（2024年の工事で新鹿児島線は発電所～新鹿児島変電所。発電所～川薩開閉所は別の線 川内原子力連絡線で、潮流は当てない）
for(const p of pairs)if(p[0]==='新鹿児島線'&&p[4]==='川薩ss')p[6]='川内原子力発電所';
// 2026-10-25 オーナー指示：大平変電所→大平開閉所。諫早分岐線は終点を長崎幹線との分岐点に（OCCTOの「武雄ss」を分岐点と読み替え）
for(const p of pairs){for(const i of [5,6])if(p[i]==='大平変電所')p[i]='大平開閉所';if(p[0]==='諫早分岐線'&&p[4]==='武雄ss')p[6]='分岐点';}
// 2026-10-25 オーナー指示④（保留25）：九州の分岐線11本は、OCCTOの行の端のうち分岐元の線側の変電所を分岐点と読み替える（分岐線の区間だけに潮流）
{const BRANCH_CUT={"苅田分岐線":"西谷変電所","久留米分岐線":"鳥栖変電所","宮崎分岐線":"南宮崎変電所","弓削分岐線":"熊本変電所","速見分岐線":"豊前変電所","北熊本分岐線":"三池変電所","霧島分岐線":"南九州変電所","古賀分岐線":"北九州変電所","東佐世保分岐線":"武雄変電所","北長崎分岐線":"東佐世保変電所","八代分岐線":"中九州変電所"};for(const p of pairs){const o=BRANCH_CUT[p[0]];if(!o)continue;const i=p[5]===o?5:p[6]===o?6:-1;if(i<0)throw Error('分岐線の照合表：'+p[0]);p[i]='分岐点';}}
const header='// 生成ファイル（scripts/build-kyushu.mjs）。元は docs/research/kyushu-occto-pairs.json（tools/prep/adopt-kyushu.mjs）。手で編集しない。\n// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]\n';
writeFileSync('src/kyushu-pairs.ts',header+'export const pairs=[\n'+pairs.map(p=>' '+JSON.stringify(p).replaceAll('"',"'")).join(',\n')+',\n] as const;\n');
console.log('Kyushu dataset',lines.length,'lines',facilities.length,'facilities');
