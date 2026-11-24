import {readFile,writeFile} from 'node:fs/promises';
import {publicWording} from './public-wording.mjs';
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const route=await read('docs/research/hokkaido-hokuto-route.json');
const dc=await read('public/data/tohoku-dc-osm.json');
const hokuto=dc.facilities.find(f=>f.assetId==='asset-b1927582-d144-4e18-bb32-d18565bd14b1');
if(!hokuto)throw Error('Existing Hokuto asset missing');
const lineId='asset-919f35c2-894f-4d1a-a3d0-84b84c8f90d0',ohnoId='asset-5d83b8bb-2c10-41b3-a429-3f61e2471ae8';
const source='https://www.hepco.co.jp/network/con_service/public_document/bid_info.html';
const ohno={id:'way/254271516',assetId:ohnoId,name:'大野変電所',kind:'substation',position:[41.8883824, 140.60735315],voltages:[275,187,66],scopeConnected:true,url:'https://www.openstreetmap.org/way/254271516',attributes:[{label:'資料版',value:'北海道電力NW 2026-08-28版、取得2026-09-26。最新性未確認。'},{label:'接続確認',value:'北斗幹線275kVの公表端点。187kV線路は今回未収録。個別回線・母線実結線は未確認。'}]};
const connections=route.lines.flatMap(l=>l.endpoints.filter(e=>e.insideFacilities.length).map(e=>({node:Number(e.node),position:[e.lonlat[1],e.lonlat[0]],status:'facility-area',facilities:e.insideFacilities.map(id=>id==='801582512'?{id:hokuto.id,name:hokuto.name}:{id:ohno.id,name:ohno.name}),neighborWays:[]})));
const line={id:lineId,assetId:lineId,name:'北斗幹線',voltageKV:275,currentType:'ac',named:true,paths:route.lines.map(l=>l.coordinatesLatLon),osmIds:route.lines.map(l=>Number(l.id)),connections,attributes:[{label:'公表区間',value:'北斗変換所―大野変電所（北海道NW 送46・275kV・2回線）'},{label:'地理照合',value:'5つのOSM wayが共有ノードで連続し、両端の設備敷地に到達。個別回線・母線結線は未確認。旧ref「道南」は名称置換に使わない。'},{label:'DCとの関係',value:'北斗変換所の交流側。既存北斗今別DCとは同じ施設IDを共有するが、DC実績との連続アニメーションは行わない。'},
 // 2026-10-11 送電線チェックの「出典欠落」：出典の項目を追加（内容は上の公表区間・地理照合と同じ資料）
 {label:'出典',value:`北海道電力ネットワーク 系統空容量（基幹系統・送電線）送46（2026-08-28版、${source}）。地理はOSM（2026-09-26取得、docs/research/hokkaido-hokuto-route.json）。`}]};
const data={schemaVersion:1,datasetId:'hokkaido-hokuto-v1',rights:'pending',osmTimestamp:'2026-09-26（OSM取得日）',license:'ODbL',coverage:'北海道・北斗―大野の限定検証（AC1路線・両端2設備）。187kV線路は未収録。',sourceUrl:source,published:'2026-08-28',retrievedAt:'2026-09-26',lines:[line],facilities:[{...hokuto,attributes:[...(hokuto.attributes??[]),{label:'北海道交流接続',value:'北斗幹線275kVで大野変電所へ。DCと共通の施設ID。個別母線・DC潮流の照合は未完了。'}]},ohno]};
// Reviewed 187kV geographic reference. Do not merge the adjacent 66kV OSM parcel.
const ohnoRoute=await read('docs/research/hokkaido-ohno-187-survey.json');
const north={id:'way/222851764',assetId:'asset-a739c42f-2169-4a04-bc63-c6cd1d938281',name:'北七飯変電所',kind:'substation',position:[41.9315445,140.6533646],voltages:[187,66],scopeConnected:true,url:'https://www.openstreetmap.org/way/222851764',attributes:[
 {label:'設備名称の根拠',value:'北海道電力第91期第1四半期報告書（2014-08-05、p.6）：七飯発電所の流通設備を区分し北七飯変電所として2014年4月運用開始。187/66kV。'},
 {label:'地理参照と未確認事項',value:'OSMでは旧名称「七飯発電所」の187/66kV変電設備区画222851764を参照。大野線の終端が区画内に到達。名称・電圧・公表区間と沿革を照合した参照対応であり、公式敷地境界ではありません。隣接66kV区画262597731は統合していません。個別回線・母線実結線は未確認。'},
 
 {label:'資料版・取得',value:'系統構成2026-05-29版、設備一覧2026-08-28版（取得2026-09-26）。沿革資料取得2026-09-27。最新性未確認。'}]};
const ohnoConnections=ohnoRoute.lines.flatMap(l=>l.endpoints.filter(e=>e.insideFootprints.some(id=>['254271516','222851764'].includes(id))).map(e=>({node:Number(e.node),position:l.coordinatesLatLon[l.nodes.indexOf(e.node)],status:'facility-area',facilities:[e.insideFootprints.includes('254271516')?{id:ohno.id,name:ohno.name}:{id:north.id,name:north.name}],neighborWays:[]})));
const ohnoLineId='asset-8cc91839-66a6-4118-a233-3ce81b7ec038';
data.lines.push({id:ohnoLineId,assetId:ohnoLineId,name:'大野線',voltageKV:187,currentType:'ac',named:true,paths:ohnoRoute.lines.map(l=>l.coordinatesLatLon),osmIds:ohnoRoute.lines.map(l=>Number(l.id)),connections:ohnoConnections,attributes:[
 {label:'公表区間',value:'大野変電所―北七飯変電所（北海道NW 送52・187kV・2回線）'},
 
 {label:'地理照合',value:'大野線の5つのOSM wayは共有ノードで連続し、大野と北七飯187kV側の参照区画内に到達。北七飯側は旧七飯発電所の流通設備の沿革と照合。公式敷地境界・個別回線・母線実結線は未確認。架空線分なし。'},
 {label:'潮流方向',value:'OCCTOの正方向は北七飯SS→大野SS。線上表示は参照経路へ対応付けたもの。容量は実際の方向と一致する公表行だけを使用し、逆方向の容量は補いません。'},
 {label:'資料版',value:'系統構成2026-05-29版、設備一覧2026-08-28版（取得2026-09-26）。最新性未確認。'}]});
ohno.attributes.find(a=>a.label==='接続確認').value='北斗幹線275kVと大野線187kVの公表端点。275/187kVは変圧関係として区別。個別回線・母線実結線は未確認。';
data.facilities.push(north);data.datasetId='hokkaido-hokuto-ohno-v2';data.coverage='北海道・北斗―大野―北七飯の限定検証（AC2路線・3設備）。全道未収録。関連DCは既存参照経路。';
data.identitySource={url:'https://www.hepco.co.jp/corporate/ir/ir_lib/pdf/91quarterlyreport_1q.pdf',published:'2014-08-05',retrievedAt:'2026-09-27',page:6};
const nanaeRoute=await read('docs/research/hokkaido-nanae-route.json');
const hakodateBase=dc.facilities.find(f=>f.assetId==='asset-e24810a7-7446-41da-9015-000433dd231f');
if(!hakodateBase)throw Error('Existing Hakodate asset missing');
const hakodate={...hakodateBase,name:'函館変換所',attributes:[...(hakodateBase.attributes??[]),
 {label:'公表設備と既存ID',value:'既存OSM名：電源開発株式会社北地域制御所。北本DCの既存変換所IDを再利用。J-POWER公式事業所住所（七飯町峠下703）、北海道電力の北本設備図、187kV公表端点と連続地理経路を照合。公式敷地境界は未確認。'},
 {label:'交流接続',value:'北本七飯線187kVで北七飯変電所へ。DCと交流の実績を連続させない。変換所容量を交流線路容量へ転用しない。個別母線・回線結線は未確認。'}]};
const nanaeId='asset-6e2fe879-7683-4d85-aa60-7dc773535eee';
const nanaeConnections=nanaeRoute.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>id==='222851764'?{id:north.id,name:north.name}:{id:hakodate.id,name:hakodate.name}),neighborWays:[]})));
data.lines.push({id:nanaeId,assetId:nanaeId,name:'北本七飯線',voltageKV:187,currentType:'ac',named:true,paths:nanaeRoute.lines.map(l=>l.coordinatesLatLon),osmIds:nanaeRoute.lines.map(l=>Number(l.id)),connections:nanaeConnections,attributes:[
 {label:'公表区間',value:'北七飯変電所―函館変換所（187kV）。北海道NW 2026-08-28版送58は他社線表記、OCCTO公表名は北本七飯線。'},
 {label:'地理照合',value:'187kVの5つのOSM wayが共有ノードで連続し、両端の既存参照区画内へ到達。OSM線名なしを公表区間・両端・電圧で対応付け。個別回線・母線の実結線は未確認、構内母線は追加しない。'},
 {label:'容量の扱い',value:'線路設備容量・北海道NW運用容量は今回確認できず未収録。OCCTO同日方向別容量は対応行のみ使用し、欠測・反対方向を補完しない。'},
 {label:'出典・公表版',value:'北海道NW設備一覧2026-08-28版（取得2026-09-26）、北海道電力2016-10-06設備概要図p.30、OCCTO第443回理事会2024-02-21作業停止計画（北本七飯線）。補足原本・OSM取得2026-09-27。最新性未確認。'}]});
data.facilities.push(hakodate);data.datasetId='hokkaido-nanae-v3';data.coverage='北海道・北斗―大野―北七飯―函館変換所の限定検証（AC3路線・4設備）。全道未収録。';
const donanRoute=await read('docs/research/hokkaido-donan-route.json');
const west={id:donanRoute.facilityId,assetId:donanRoute.facilityAssetId,name:'西双葉開閉所',kind:'switchyard',position:donanRoute.facilityPosition,voltages:[275],scopeConnected:true,url:'https://www.openstreetmap.org/way/518829081',attributes:[{label:'公表接続',value:'道南幹線275kVの公表端点。双葉開閉所187kVとは別施設。北海道NW系統構成2026-05-29版・設備一覧2026-08-28版。'},{label:'地理参照',value:'OSM西双葉開閉所275kV区画への到達を確認。公式敷地境界・個別回線・母線実結線は未確認。設備容量は未収録。'}]};
const donanConnections=donanRoute.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>id==='801582512'?{id:hokuto.id,name:hokuto.name}:{id:west.id,name:west.name}),neighborWays:[]})));
data.lines.push({id:donanRoute.lineAssetId,assetId:donanRoute.lineAssetId,name:'道南幹線',voltageKV:275,currentType:'ac',named:true,paths:donanRoute.lines.map(l=>l.coordinatesLatLon),osmIds:donanRoute.lines.map(l=>Number(l.id)),connections:donanConnections,attributes:[{label:'公表区間',value:'北斗変換所―西双葉開閉所（北海道NW送45・275kV・2回線）'},{label:'地理照合',value:'9つのOSM wayが共有ノードで連続し、北斗と西双葉の参照区画へ到達。線分数は回線数ではありません。構内母線は未収録、個別相・回線結線は未確認。'},{label:'潮流方向',value:'OCCTO正方向は西双葉SWS→北斗CS。両端と電圧を照合。方向が一致する容量行のみ使用し、他方向の容量は補完しません。'},{label:'資料版・取得',value:'北海道NW系統構成2026-05-29版・設備一覧2026-08-28版、OSM参照経路取得2026-09-27。公表資料の最新性未確認。'}]});
data.facilities.push(west);data.datasetId='hokkaido-donan-v4';data.coverage='北海道・西双葉―北斗―大野―北七飯―函館変換所の限定検証（AC4路線・5設備）。全道未収録。函館幹線とその支線は未収録。';
// Southern central block: keep this section independently removable.
const southRoute=await read('docs/research/hokkaido-doou-south-route.json');
const hayakita={id:southRoute.facilityId,assetId:southRoute.facilityAssetId,name:'南早来変電所',kind:'substation',position:southRoute.facilityPosition,voltages:[275,187,66],scopeConnected:true,url:'https://www.openstreetmap.org/way/256894928',attributes:[{label:'公表接続',value:'道央南幹線275kVで西双葉開閉所へ。北海道NW送9・2026-08-28版。未収録の周辺線路や個別母線を接続済みと表示しません。'},{label:'設備参照',value:'南早来変電所のOSM参照区画256894928。275/187/66kVは登録電圧。変圧器の個別構成・容量は今回未収録。公式境界・個別回線・母線実結線は未確認。'}]};
const southConnections=southRoute.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>id==='518829081'?{id:west.id,name:west.name}:{id:hayakita.id,name:hayakita.name}),neighborWays:[]})));
data.lines.push({id:southRoute.lineAssetId,assetId:southRoute.lineAssetId,name:'道央南幹線',voltageKV:275,currentType:'ac',named:true,paths:southRoute.lines.map(l=>l.coordinatesLatLon),osmIds:southRoute.lines.map(l=>Number(l.id)),connections:southConnections,attributes:[{label:'公表区間・運用',value:'南早来変電所―西双葉開閉所（北海道NW送9・275kV・2回線）。実績系統資料とOCCTO当日実績の対象。計画設備としての追加ではありません。'},{label:'地理照合',value:'10個のOSM線分が共有ノードで連続し、南早来と既存西双葉の参照区画に到達。線分数は回線数ではありません。交差や近接では接続せず、構内母線・個別相・回線結線は未確認。'},{label:'潮流方向',value:'OCCTO正方向は西双葉SWS→南早来SS。容量公表行は南早来→西双葉の反対方向。実際の潮流方向と一致する場合だけ参考使用率を算出し、反対方向容量は補いません。道南幹線とは別の実績です。'},{label:'資料版・取得',value:'北海道NW系統構成2026-05-29版・設備一覧2026-08-28版。OSM取得2026-09-27。個別資料の最新性は未確認。'}]});
data.facilities.push(hayakita);data.datasetId='hokkaido-hayakita-v5';data.coverage='北海道・南早来―西双葉―北斗―大野―北七飯―函館変換所の限定検証（AC5路線・6設備）。全道未収録。南早来線・苫東厚真線・函館幹線は未収録。';
// Reviewed central block; independent of the preceding southern additions.
const central=await read('docs/research/hokkaido-central-route.json');
for(const f of central.facilities.filter(f=>f.assetId))data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:'substation',position:f.position,voltages:[275,187],scopeConnected:true,url:`https://www.openstreetmap.org/${f.id}`,attributes:[
 
 {label:'地理・接続確認',value:'公表名称・電圧・区間とOSM参照区画への線路到達を照合。275/187kVは変圧関係。未収録187kV線路や個別回線・母線実結線は描かない。公式敷地境界は未確認。'},
 {label:'出典・資料版',value:'北海道NW系統構成2026-05-29版、設備一覧2026-08-28版（取得2026-09-26）。OSM取得2026-09-27。最新性未確認。'}]});
for(const r of central.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===`way/${id}`);if(!f)throw Error('Unknown reviewed endpoint');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:275,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
  {label:'公表区間・運用',value:`${r.from}―${r.to}（北海道NW送${r.publicSectionId}・275kV・2回線）。実績系統資料とOCCTO実績の対象。計画設備ではありません。`},
  
  {label:'地理照合',value:`${r.lines.length}個のOSM wayを共有ノードで連続確認。両端の参照区画へ到達。${r.connectionStatus} ${r.sharedSupport} 線分数は回線数ではありません。`},
  {label:'潮流方向',value:`OCCTO正方向：${r.occtoPositive}。区間・電圧・両端を照合した実績のみ使用。方向の一致する容量行だけで参考使用率を算出し、欠測や逆方向容量を補いません。`},
  {label:'出典・公表版',value:'北海道NW系統構成2026-05-29版・設備一覧2026-08-28版（取得2026-09-26）。OSM取得2026-09-27。個別回線・母線結線と公式敷地境界は未確認。最新性未確認。'}]});
}
data.datasetId='hokkaido-central-v6';data.coverage='北海道・道央東/北/西/南幹線から道南・北斗―大野―北七飯―函館変換所の限定検証（AC8路線・8設備）。全道未収録。函館幹線・南早来線・苫東厚真線は未収録。';
// 187kV block: independent sections only; the Nishi-Sapporo terminal gaps remain held.
const branch187=await read('docs/research/hokkaido-187-central-route.json');
for(const f of branch187.facilities.filter(f=>f.assetId))data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:f.name==='双葉開閉所'?'switchyard':'substation',position:f.position,voltages:f.name==='双葉開閉所'?[187]:[187,66],scopeConnected:true,url:`https://www.openstreetmap.org/${f.id}`,attributes:[
 {label:'公表設備・接続',value:f.name==='双葉開閉所'?'室蘭西幹線187kV送25の公表端点。275kVの西双葉開閉所とは別設備です。両者の近接を変圧接続とは扱いません。':'北江別線187kV送42の公表端点。北江別変電所区画を参照し、隣接する総合研究所区画と統合しません。'},
 
 {label:'資料版・未確認事項',value:'北海道NW系統構成2026-05-29版、設備一覧2026-08-28版（取得2026-09-26）。OSM取得2026-09-27。参照区画への到達のみ照合。公式敷地境界・個別回線・母線実結線は未確認。資料の最新性未確認。'}]});
for(const r of branch187.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===`way/${id}`);if(!f)throw Error('Unknown 187kV endpoint');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:187,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・運用',value:`${r.from}―${r.to}（北海道NW送${r.publicSectionId}、187kV・2回線）。実績系統資料とOCCTO実績の対象。計画設備ではありません。`},
 
 {label:'地理・電圧の照合',value:`${r.lines.length}個のOSM wayが共有ノードで連続し、両端の参照区画へ到達。共架を電気的接続とは扱わず、275kV設備との関係は既存の公表275/187kVバンク情報を参照。公式敷地境界・個別回線・母線実結線は未確認。`},
 {label:'潮流の対象',value:`OCCTO正方向：${r.occtoPositive}。この公表区間のみ対応。実際の方向と一致する容量のみで参考使用率を算出し、逆方向容量を補いません。${r.publicSectionId==='25'?'室蘭西幹線の他3公表区間は今回未収録。路線全体へ実績を複製しません。':''}`},
 {label:'出典・公表版',value:'北海道NW系統構成2026-05-29版、設備一覧2026-08-28版（取得2026-09-26）、OSM取得2026-09-27。最新性未確認。'}]});
}
data.datasetId='hokkaido-central-187-v7';data.coverage='北海道・道央/道南の限定検証（AC10区間・10設備）。北江別線と室蘭西幹線の西野―双葉区間を含む。室蘭西幹線全体・全道は未収録。';

// Reviewed 275kV endpoints: published topology and OSM reference geometry remain distinct.
const trunk275=await read('docs/research/hokkaido-275-route.json');
for(const f of trunk275.facilities)data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:f.kind,position:f.position,voltages:f.voltages,scopeConnected:true,url:'https://www.openstreetmap.org/'+f.id,attributes:[
 {label:'公表設備・対象',value:f.name==='北新得変電所'?null:f.name==='泊発電所'?'泊幹線の発電所側端点。地理位置は発電所275kV開閉設備の参照区画。送電設備の供用と原子炉の発電運転は別であり、現在の発電運転状態は未確認。発電容量を線路容量へ転用しません。':'石狩火力幹線の発電所側端点。送電線は2018-02-22運用開始、1号機は2019年2月運転開始。建設中の増設号機を運転済みとして追加しません。'},
 {label:'地理・実結線',value:'公表端点とOSM参照区画への到達を確認。公式敷地境界と個別回線・母線実結線は未確認。北新得の別電圧区画を別施設として重複登録しません。'},
 {label:'出典・公表版',value:'北海道NW設備一覧2026-08-28版・系統構成2026-05-29版。一次資料とOSM取得2026-09-27。設備詳細の運開資料とは版を区別。'}]});
for(const r of trunk275.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id==='way/'+id);if(!f)throw Error('Unknown 275 endpoint');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:275,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・運用',value:r.from+'―'+r.to+'（北海道NW送'+r.publicSectionId+'、275kV・2回線）。既設送電設備。発電所の発電運転状態とは別。'},
 
 {label:'地理参照・確認状態',value:r.lines.length+'個のOSM wayを共有ノードで連続確認し、両端の参照区画へ到達。線分数は回線数ではありません。公式敷地境界・個別回線・母線結線は未確認。'+(r.publicSectionId==='13'?'OSM名称「石狩湾新港発電所線」は公表区間・電圧・両端到達で石狩火力幹線と照合。':'')},
 {label:'潮流表示',value:r.flowMatched?'OCCTO正方向：北新得SS→南早来SS。公表区間・参照経路を照合。容量公表方向は南早来→北新得のため、実際の流向が一致する場合のみ参考使用率を算出。':'現在取得したOCCTO北海道実績に対応行なし。実績数値・線上アニメーション・参考使用率は表示しません。予想潮流で代用しません。'},
 {label:'出典・公表版',value:'北海道NW系統構成2026-05-29版、設備一覧2026-08-28版（2026-09-27再取得で保存版とバイト一致）。石狩2018-02-22/狩勝2008-12-02運開資料、泊外部電源報告2011-05を補足使用。OSM取得2026-09-27。'}]});
}
data.datasetId='hokkaido-trunk-275-v8';data.coverage='北海道・道央/道南/道東の限定検証。泊・石狩火力・狩勝幹線を含む。275kVの未収録区間あり、全道完全収録ではありません。';


// Public sections 6/7 split at the reviewed shared reference node; section 8 is explicitly partial.
const shiribeshi=await read('docs/research/hokkaido-shiribeshi-route.json');
for(const r of shiribeshi.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id==='way/'+id);if(!f)throw Error('Unknown Shiribeshi terminal');return {id:f.id,name:f.name};}),neighborWays:[]})));
 connections.push({node:Number(shiribeshi.junction.node),position:shiribeshi.junction.position,status:'shared-node',facilities:[],neighborWays:[640607784,624389505]});
 if(r.status==='partial')connections.push({node:Number(shiribeshi.heldPlantEnd.node),position:shiribeshi.heldPlantEnd.position,status:'unresolved',facilities:[],neighborWays:[]});
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:275,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:[...new Set(r.lines.map(l=>Number(l.id)))],connections,referenceReview:{status:r.status==='partial'?'partial':'section',endpoints:r.status==='partial'?'#115参照点―OSM線路末端まで。京極発電所への到達は未確認。':r.from+'―後志幹線#115参照点（公式座標・個別回線/母線未確認）'},attributes:[
 {label:'公表区間',value:'北海道NW送'+r.publicSectionId+'：'+r.from+'―'+r.to+'、275kV・2回線。2026-08-28設備版。'},
 {label:'地理収録状態',value:r.status==='partial'?'部分表示。#115から登録線路末端までの既存形状のみ。京極発電所の参照区画へ未到達。地下設備や未収録引込を直線で補いません。':'公表区間と地理参照経路を対応付け。後志幹線way640607784を共有ノード2600393178で分割。片側施設の参照区画と分岐参照点を確認。'},
 {label:'分岐の確認範囲',value:'公表#115は後志の2公表区間と京極幹線の共通端点。OSM ref=115で後志/京極275kV線が共有するノードに対応。変電所ではなく接続参照点。物理設備種別・個別回線/母線結線・公式座標は未確認。'},
 
 {label:'潮流表示',value:'取得済みOCCTO北海道実績に対応行なし。数値・アニメーション・参考使用率は表示せず、予想潮流を代用しません。'},
 {label:'出典・版・運用',value:'北海道NW実績系統2026-05-29、設備一覧2026-08-28。京極幹線は北海道電力第90期第3四半期報告書（2014-02-06提出）で2013-05運開、後志No.115―京極(発)を確認。OSM取得2026-09-27。発電所号機の計画と送電線運用は別。'}]});
}
data.datasetId='hokkaido-shiribeshi-v9';data.coverage='北海道限定検証。275kVは11公表区間を地理表示、京極1区間は部分表示、2区間保留。全道完全収録ではありません。';
// Reviewed Ebetsu block: facility-area arrival is not a busbar/circuit assertion.
const ebetsu=await read('docs/research/hokkaido-ebetsu-route.json');
for(const f of ebetsu.facilities.filter(f=>!f.existing))data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:f.kind,position:f.position,voltages:f.kind==='switchyard'?[187]:[187,66],scopeConnected:true,url:'https://www.openstreetmap.org/'+f.id,attributes:[
 {label:'名称・地理対応',value:f.name==='南札幌変電所'?'公表送41端点とOSM同名施設relation/12927262の2参照区画、南札幌幹線の到達を照合。':'OSM区画は名称なし。北海道NW実績系統の送68/69/67の接続順、同名187kV線路の連続経路と到達区画を照合した地理参照対応。近接する発電所そのものとは区別。'},
 
 {label:'確認範囲',value:'施設全体と公表バンク群の容量は別。公式敷地境界・個別回線・母線実結線は未確認。西奈井江を経由しない2028年接続変更計画は今回描画しません。'},
 {label:'出典・公表版',value:'北海道NW系統構成2026-05-29・設備一覧2026-08-28、OSM取得2026-09-27。最新性未確認。'}]});
for(const r of ebetsu.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===id);if(!f)throw Error('Unknown Ebetsu endpoint');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:187,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・運用',value:r.from+'―'+r.to+'（北海道NW送'+r.publicSectionId+'、187kV・2回線）。現行公表版の既設系統。'},
 
 {label:'地理・分岐確認',value:'5つのOSM wayを共有ノードで連続確認、両端の参照区画へ到達。端部で分かれる引込形状は個別回線・母線の実結線確認を意味しません。地理交差に新しい接続点を作っていません。'},
 {label:'潮流表示',value:r.flowMatched?'OCCTO正方向は北江別SS→南札幌SS。公表区間と経路を照合し、実際の方向に対応する公表容量がある場合のみ参考使用率を算出。':'取得済みOCCTO実績に当該区間の対応行なし。実績・粒子・参考使用率を補完せず、予想潮流を使用しません。'},
 {label:'出典・公表版',value:'北海道NW系統構成2026-05-29版、設備一覧2026-08-28版。OSM取得2026-09-27。個別母線・回線結線と公式敷地境界は未確認。'}]});
}
data.datasetId='hokkaido-ebetsu-187-v10';data.coverage='北海道限定検証。北江別―南札幌・西奈井江―西滝川の187kVを追加。275kVは11全区間・1部分・2保留。全道完全収録ではありません。';

// Northern block: route-specific OSM geometry; shared supports do not assert circuit connections.
const northern=await read('docs/research/hokkaido-north-187-route.json');

for(const f of northern.facilities.filter(f=>!f.existing))data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:f.kind,position:f.position,voltages:f.voltages,scopeConnected:true,url:'https://www.openstreetmap.org/'+f.id,attributes:[
 {label:'地理・公表対応',value:'北海道NW実績系統2026-05-29版の公表端点と、OSM同名・187kV施設区画への経路到達を照合。公式敷地境界・個別回線・母線実結線は未確認。'},
 
 {label:'出典・版',value:'北海道NW設備一覧2026-08-28版（2026-09-26取得）。OSM地理取得2026-09-27。バンク群と施設全体の容量は区別し、合算しません。'}]});
for(const r of northern.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===id);if(!f)throw Error('Unknown northern terminal');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:187,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・運用',value:'北海道NW送'+r.publicSectionId+'：'+r.formalName+'、'+r.from+'―'+r.to+'。187kV・2回線、実績系統図の既設区間。'},
 
 {label:'地理経路',value:r.lines.length+' OSM線分を共有ノードで連続確認し、公表両端に対応する設備参照区画に到達。個別母線・回線の実結線は未確認。名寄/北幌延の共架地理形状は各区間に含めますが、共架点を電気的分岐にしません。'},
 {label:'潮流の対象',value:'当該区間のOCCTO実績端点・正方向を個別照合。名寄幹線の2公表区間は別の実績を使用。実際の流向に一致する容量がない場合は参考使用率を算出しません。'},
 {label:'資料版',value:'北海道NW実績系統2026-05-29、設備一覧2026-08-28、OSM取得2026-09-27。予想潮流・隣接区間の実績を代用しません。'}]});
}
data.datasetId='hokkaido-north-187-v11';data.coverage='北海道限定検証。旭川・名寄・道北・北幌延の5公表区間を含む。旭川南線は未収録。275kVは11全区間・1部分・2保留。全道完全収録ではありません。';

// Sapporo block: reference corridors stop at reviewed facility areas, not circuit/bus claims.
const sapporo=await read('docs/research/hokkaido-sapporo-187-route.json');

for(const f of sapporo.facilities.filter(f=>!f.existing))data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:f.kind,position:f.position,voltages:f.voltages,scopeConnected:true,url:'https://www.openstreetmap.org/'+f.id,attributes:[
 {label:'公表設備と地理参照',value:'北海道NW実績系統図の公表端点と、OSM同名187kV設備区画への到達を照合。施設IDは電圧別に分割しません。'},
 
 {label:'出典・確認範囲',value:'実績系統2026-05-29、設備一覧2026-08-28（取得2026-09-26）、OSM取得2026-09-27。公式境界・個別回線・母線実結線は未確認。'}]});
for(const r of sapporo.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===id);if(!f)throw Error('Unknown Sapporo terminal');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:187,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・運用',value:'北海道NW送'+r.publicSectionId+'：'+r.from+'―'+r.to+'。187kV・2回線。実績系統図に掲載の既設区間。'},
 
 {label:'地理参照の照合',value:r.lines.length+' OSM線分を共有ノードで連続確認し、両端設備の参照区画へ到達。'+(r.name==='西小樽線'?'室蘭西幹線/国富線との共架は地理形状だけを参照し、66kV専用区間は使用しません。':'地理原本の複合名「苗穂北線・西札幌線」および篠路側「西札幌線」と公表線名は異なります。西当別―苗穂/篠路の公表端点、187kV、連続経路で区間を対応付け。共架・共有ノードを電気的分岐とは扱いません。')+'公式境界・個別回線・母線実結線は未確認。'},
 {label:'潮流対応',value:'OCCTO実績の対象端点・正方向を当該公表区間と個別照合。参考使用率は実際の流向に対応する公表容量がある時だけ算出。別方向・別区間で補完しません。'},
 {label:'出典・公表版',value:'北海道NW系統構成2026-05-29、設備一覧2026-08-28（取得2026-09-26）、OSM取得2026-09-27。最新性・実結線の確認とは別。'}]});
}
data.datasetId='hokkaido-sapporo-187-v12';data.coverage='北海道限定検証。苗穂北・篠路・西小樽線を含む。南九条線・旭川南線は未収録。275kVは11全区間・1部分・2保留。全道完全収録ではありません。';

// Muroran block: reference corridors stop at reviewed facility areas, not circuit/bus claims.
const muroran=await read('docs/research/hokkaido-muroran-187-route.json');

for(const f of muroran.facilities.filter(f=>!f.existing))data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:f.kind,position:f.position,voltages:f.voltages,scopeConnected:true,url:'https://www.openstreetmap.org/'+f.id,attributes:[
 {label:'公表設備と地理参照',value:'北海道NW実績系統図の公表端点と、OSM同名187kV設備区画への到達を照合。施設IDは電圧別に分割しません。'},
 
 {label:'出典・確認範囲',value:'実績系統2026-05-29、設備一覧2026-08-28（取得2026-09-26）、OSM取得2026-09-27。公式境界・個別回線・母線実結線は未確認。'}]});
for(const r of muroran.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===id);if(!f)throw Error('Unknown Muroran terminal');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:187,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・運用',value:'北海道NW送'+r.publicSectionId+'：'+r.from+'―'+r.to+'。187kV・2回線。実績系統図に掲載の既設区間。'},
 
 {label:'地理参照の照合',value:r.lines.length+' OSM線分を共有ノードで連続確認し、両端設備の参照区画へ到達。'+'同名187kV経路と公表区間を照合。双葉187kVと西双葉275kVは別設備。地理的交差・共架を電気的分岐としません。'+'公式境界・個別回線・母線実結線は未確認。'},
 {label:'潮流対応',value:'OCCTO実績の対象端点・正方向を当該公表区間と個別照合。参考使用率は実際の流向に対応する公表容量がある時だけ算出。別方向・別区間で補完しません。'},
 {label:'出典・公表版',value:'北海道NW系統構成2026-05-29、設備一覧2026-08-28（取得2026-09-26）、OSM取得2026-09-27。最新性・実結線の確認とは別。'}]});
}
data.datasetId='hokkaido-muroran-187-v13';data.coverage='北海道限定検証。室蘭西2区間・双葉・室蘭東を含む。胆振・南九条・旭川南線は未収録。275kVは11全区間・1部分・2保留。全道完全収録ではありません。';

// Eastern block: reference corridors stop at reviewed facility areas, not circuit/bus claims.
const eastern=await read('docs/research/hokkaido-east-187-route.json');

for(const f of eastern.facilities.filter(f=>!f.existing))data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:f.kind,position:f.position,voltages:f.voltages,scopeConnected:true,url:'https://www.openstreetmap.org/'+f.id,attributes:[
 {label:'公表設備と地理参照',value:'北海道NW実績系統図の公表端点と、OSM同名187kV設備区画への到達を照合。施設IDは電圧別に分割しません。'},
 
 {label:'出典・確認範囲',value:'実績系統2026-05-29、設備一覧2026-08-28（取得2026-09-26）、OSM取得2026-09-27。公式境界・個別回線・母線実結線は未確認。'}]});
for(const r of eastern.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===id);if(!f)throw Error('Unknown Eastern terminal');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:187,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・運用',value:'北海道NW送'+r.publicSectionId+'：'+r.from+'―'+r.to+'。187kV・2回線。実績系統図に掲載の既設区間。'},
 
 {label:'地理参照の照合',value:r.lines.length+' OSM線分を共有ノードで連続確認し、両端設備の参照区画へ到達。'+'北新得の同名187kV参照区画way255511621は既存施設way640591807へ関連付け、施設IDを再利用。道東・岩松西の共架形状と釧路北・鳥取釧路の複合名区間は187kVを含む既存形状のみ使用し、共有ノードを電気的分岐としません。'+'公式境界・個別回線・母線実結線は未確認。'},
 {label:'潮流対応',value:'OCCTO実績の対象端点・正方向を当該公表区間と個別照合。参考使用率は実際の流向に対応する公表容量がある時だけ算出。別方向・別区間で補完しません。'},
 {label:'出典・公表版',value:'北海道NW系統構成2026-05-29、設備一覧2026-08-28（取得2026-09-26）、OSM取得2026-09-27。最新性・実結線の確認とは別。'}]});
}
data.datasetId='hokkaido-east-187-v14';data.coverage='北海道限定検証。北新得―北芽室・宇円別―東釧路の187kVを含む。全道完全収録ではありません。275kVは11全区間・1部分・2保留。';

// Kushiro block: reference corridors stop at reviewed facility areas, not circuit/bus claims.
const kushiro=await read('docs/research/hokkaido-kushiro-nissho-route.json');

for(const f of kushiro.facilities.filter(f=>!f.existing))data.facilities.push({id:f.id,assetId:f.assetId,name:f.name,kind:f.kind,position:f.position,voltages:f.voltages,scopeConnected:true,url:'https://www.openstreetmap.org/'+f.id,attributes:[
 {label:'公表設備と地理参照',value:'北海道NW実績系統図の公表端点と、OSM同名187kV設備区画への到達を照合。施設IDは電圧別に分割しません。'},
 
 {label:'出典・確認範囲',value:'実績系統2026-05-29、設備一覧2026-08-28（取得2026-09-26）、OSM取得2026-09-27。公式境界・個別回線・母線実結線は未確認。'}]});
for(const r of kushiro.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===id);if(!f)throw Error('Unknown Kushiro terminal');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:187,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・運用',value:'北海道NW送'+r.publicSectionId+'：'+r.from+'―'+r.to+'。187kV・2回線。'+(r.publicSectionId==='74+75'?'送74/75にまたがる本線参照経路。公表境界#162の地理位置・支線接続は未確認。送76は含めません。':'実績系統図に掲載の既設区間。')},
 
 {label:'地理参照の照合',value:r.lines.length+' OSM線分を共有ノードで連続確認し、両端設備の参照区画へ到達。'+(r.publicSectionId==='74+75'?'新冠―北新得の本線だけを対応付け。共有ノード4160968219を公表#162と同定していません。北新得側の富村線との共架・共有ノードは地理参照に限定。公表区間別進捗は境界未照合として部分表示に計上。':'東釧路―西春別の同名187kV形状と両施設を照合。「釧路東線」は前回次候補の誤記で、正式公表名は西春別線。')+'公式境界・個別回線・母線実結線は未確認。'},
 {label:'潮流対応',value:'OCCTO実績の対象端点・正方向を当該公表区間と個別照合。参考使用率は実際の流向に対応する公表容量がある時だけ算出。別方向・別区間で補完しません。'},
 {label:'出典・公表版',value:'北海道NW系統構成2026-05-29、設備一覧2026-08-28（取得2026-09-26）、OSM取得2026-09-27。最新性・実結線の確認とは別。'}]});
}
data.datasetId='hokkaido-kushiro-nissho-v15';data.coverage='北海道限定検証。西春別線と日勝幹線の新冠―北新得本線を含む。日勝の#162・支線・発電所側は未確認。全道完全収録ではありません。';

// Public section 40: official operating name and OSM corridor label are distinct.
const remaining=await read('docs/research/hokkaido-remaining-route.json');
for(const f of remaining.facilities.filter(f=>!f.existing))data.facilities.push({...f,scopeConnected:true,url:'https://www.openstreetmap.org/'+f.id,attributes:[
 
 {label:'地理参照・出典',value:'北海道NW系統構成2026-05-29・設備表2026-08-28（取得9/26）の同名端点とOSM恵庭変電所区画を照合。OSM取得2026-09-27。個別回線・母線結線、公式境界は未確認。'}]});
for(const r of remaining.routes){
 const connections=r.lines.flatMap(l=>l.endpoints.filter(e=>e.inside.length).map(e=>({node:Number(e.node),position:e.position,status:'facility-area',facilities:e.inside.map(id=>{const f=data.facilities.find(f=>f.id===id);if(!f)throw Error('Unknown remaining terminal');return {id:f.id,name:f.name};}),neighborWays:[]})));
 data.lines.push({id:r.lineAssetId,assetId:r.lineAssetId,name:r.name,voltageKV:187,currentType:'ac',named:true,paths:r.lines.map(l=>l.coordinatesLatLon),osmIds:r.lines.map(l=>Number(l.id)),connections,attributes:[
 {label:'公表区間・正式名称',value:'北海道NW送40「他社線」：恵庭変電所―南札幌変電所、187kV・2回線。OCCTO実績「十勝幹線(恵庭南札線)」および北海道NW運転操作資料の恵庭南札線を端点で対応。OSMの十勝幹線全体を対象にしていません。'},
 
 {label:'地理参照の照合',value:'7 OSM線分の共有node連続性と恵庭・南札幌の参照区画への到達を確認。個別回線・母線結線は未確認。送39・73へ架空接続しません。'},
 {label:'潮流対応',value:'南札幌SS→恵庭SSを公表正方向として、この1区間のみ照合。容量は実際の流向に対応する同日値のみ使用。逆方向・他区間から補完しません。'},
 {label:'出典・公表版',value:'北海道NW実績系統2026-05-29・設備2026-08-28、OCCTO当日実績、運転操作資料、OSM取得2026-09-27。名称と端点は2022/2023作業停止計画でも確認。運用開始日や最新資料版の保証とは別。'}],referenceReview:{status:'section',label:'公表端点・参照経路確認済み',endpoints:r.from+'・'+r.to+'（参照区画到達、個別母線未確認）'}});
}
// 保留区間のC区分採用（OSMの経路のみ・要注意）と、187/275kV線が届く発電所：tools/prep/adopt-hokkaido-holds.mjs（2026-10-01 オーナー指示）
{const h=await read('docs/research/hokkaido-holds-adopted.json');for(const f of h.facilities)if(!data.facilities.some(x=>x.id===f.id))data.facilities.push(f);for(const l of h.lines){for(const c of l.connections)for(const f of c.facilities)if(!data.facilities.some(x=>x.id===f.id))throw Error('Unknown holds facility '+f.id);data.lines.push(l);}
 data.coverage=(data.coverage??'')+' 保留区間を'+h.lines.length+'路線C区分で追加（OSMの経路のみ、要注意）。187/275kV線が届く発電所を追加。';}
// 残作業（2026-10-01）：末端の直線補完と、両端は分かるがルート不明の直線区間（docs/research/hokkaido-remaining-straight.json）
{const st=await read('docs/research/hokkaido-remaining-straight.json');const fac=id=>{const f=data.facilities.find(x=>x.id===id);if(!f)throw Error('straight facility '+id);return f;};let sid=-9201;
 for(const c of st.completions){const l=data.lines.find(x=>x.name===c.lineName);const f=fac(c.facilityId);const k=l.connections.findIndex(x=>x.status==='unresolved');if(k<0)throw Error('no unresolved end '+c.lineName);
  const at=l.connections[k].position,atStart=l.paths[0][0].join()===at.join();const part=atStart?[f.position,at]:[at,f.position];
  if(atStart){l.paths.unshift(part);l.osmIds.unshift(sid);}else{l.paths.push(part);l.osmIds.push(sid);}l.schematicParts=[...(l.schematicParts??[]),{osmId:sid--,construction:'unknown'}];
  l.connections[k]={...l.connections[k],position:f.position,status:'facility-area',facilities:[{id:f.id,name:f.name}]};l.name=l.name.replace('（地理部分収録）','');
  l.referenceReview={...(l.referenceReview??{}),status:'section',endpoints:l.connections.map(x=>x.facilities[0]?.name??'後志幹線#115').join('―')+'（末端は直線）'};l.attributes=[...l.attributes,{label:'末端の直線',value:c.reason}];}
 for(const x of st.straight){const a=x.from.facilityId?fac(x.from.facilityId):null,b=x.to.facilityId?fac(x.to.facilityId):null;const pa=a?a.position:x.from.position,pb=b?b.position:x.to.position;const id='hokkaido-section-'+x.section;
  const end=(f,p,e)=>f?{node:null,position:p,status:'facility-area',facilities:[{id:f.id,name:f.name}],neighborWays:[]}:{node:e.node,position:p,status:'shared-node',facilities:[],neighborWays:[],label:e.label};
  data.lines.push({id,assetId:id,name:x.name,voltageKV:187,currentType:'ac',named:true,schematic:true,construction:x.construction,osmIds:[sid--],paths:[[pa,pb]],connections:[end(a,pa,x.from),end(b,pb,x.to)],
   referenceReview:{status:'section',endpoints:[x.from.label??a?.name,x.to.label??b?.name].join('―')+'（ルート不明・直線）'},
   attributes:[{label:'要注意（D区分）',value:'両端の位置は分かるがルートが分からないため直線で表示。地中・架空の別は不明（破線）。'},{label:'公表区間',value:x.publicLabel},{label:'根拠',value:x.reason}]});}
 // OSMの線で描き直した区間（勇払線、tools/prep/adopt-hokkaido-yufutsu.mjs、2026-10-06 オーナー判断）
 for(const l of st.routes??[]){for(const c of l.connections)for(const f of c.facilities)fac(f.id);data.lines.push(l);}}
// 高見線・春別支線・静内線・東の沢支線の対応の見直し、富村・高見の発電所（tools/prep/adopt-hokkaido-takami.mjs、2026-10-06 オーナー指摘）
// 北新得の北東（糠平・幌加・芽登・足寄・本別）の他社線（tools/prep/adopt-hokkaido-nukabira.mjs、2026-10-06 オーナー指示）
for(const file of ['docs/research/hokkaido-takami-fix.json','docs/research/hokkaido-nukabira-fix.json']){const fx=await read(file);data.lines=data.lines.filter(l=>!fx.replace.includes(l.id));
 for(const f of fx.facilities)if(!data.facilities.some(x=>x.id===f.id))data.facilities.push(f);
 for(const r of fx.renames){const f=data.facilities.find(x=>x.id===r.id);if(!f)throw Error('rename facility '+r.id);f.name=r.name;f.kind=r.kind;f.attributes=[...(f.attributes??[]).filter(x=>!r.attributes.some(y=>y.label===x.label)),...r.attributes];for(const l of data.lines)for(const c of l.connections)for(const x of c.facilities)if(x.id===r.id)x.name=r.name;}
 for(const l of fx.lines){for(const c of l.connections)for(const f of c.facilities)if(!data.facilities.some(x=>x.id===f.id))throw Error('takami fix facility '+f.id);data.lines.push(l);}}
// 電源開発・公表台帳の線（scripts/jpower.mjs、2026-10-04）
{const {mergeJpower}=await import('./jpower.mjs');mergeJpower('hokkaido',data.lines,data.facilities);}
// 保留138（2026-11-21 オーナー回答）：今金中里変電所・上八雲開閉所・木古内開閉所と今金中里支線・上八雲支線・鶴岡支線、発電所との関係の属性（scripts/hokkaido-138.mjs）
{const {applyHokkaido138}=await import('./hokkaido-138.mjs');applyHokkaido138(data.lines,data.facilities);}
// 勇払バイオマス発電の連系線（2026-10-16 オーナー承認、E区分＋推測）：勇払線（送36・送35）の鉄塔16（OSM node 12896228675、ref=16）から
// 1回線の架空線と地中線で発電所の区画の内側へ。根拠はOSMだけ。潮流・容量は持たせない（勇払線のOCCTOの行の値を複製しない）
{const raw=await read('data/raw/hokkaido-holds-osm/lines-187.json'),els=raw.elements,pos=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const W=id=>{const w=els.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('勇払 way '+id);return w;};
 const part=(id,from,to)=>{const w=W(id),i=w.nodes.indexOf(from),j=w.nodes.indexOf(to);if(i<0||j<0)throw Error('勇払 way '+id+' lacks '+from+'/'+to);const ns=i<=j?w.nodes.slice(i,j+1):w.nodes.slice(j,i+1).reverse();return ns.map(n=>{const p=pos.get(n);if(!p)throw Error('勇払 node '+n);return p;});};
 const chain=[[1477837531,12896228675,13556283959],[1477837537,13556283959,13556283960],[1477837532,13556283960,13556283964]],paths=chain.map(c=>part(...c));
 const plant=data.facilities.find(f=>f.id==='way/1477837533'),yl=data.lines.find(l=>l.id==='hokkaido-section-35');if(!plant||!yl)throw Error('勇払 plant/line');
 if(!yl.osmIds.includes(171940162)||!W(171940162).nodes.includes(12896228675))throw Error('勇払線に鉄塔16がない');
 const km=paths.reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+Math.hypot((q[0]-p[i][0])*110.54,(q[1]-p[i][1])*111.32*Math.cos(q[0]*Math.PI/180)),0),0);
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt)throw Error('勇払：OSMの取得時点が原本にない');
 const id='hokkaido-feeder-187-1477837531';if(data.lines.some(l=>l.id===id))throw Error('勇払 id exists');
 data.lines.push({id,assetId:id,name:'勇払バイオマス発電の連系線',named:false,voltageKV:187,currentType:'ac',osmIds:chain.map(c=>c[0]),paths,cableOsmIds:[1477837532],tsoSection:null,
  connections:[{node:12896228675,position:paths[0][0],status:'shared-node',facilities:[],neighborWays:[171940162]},{node:13556283964,position:paths.at(-1).at(-1),status:'facility-area',facilities:[{id:plant.id,name:plant.name}],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'勇払線の鉄塔16（分岐点）―勇払バイオマス発電'},
  attributes:[{label:'要注意（E区分）',value:'線の存在・区間・役割の根拠はOSM（補助資料）だけ。一次資料では確認できていない（2026-10-16）。'},{label:'照合区分',value:'E区分'},
   {label:'区分',value:'発電所の連系線（公表区間なし。OCCTOの行・容量表の行とは対応付けていない。潮流なし。勇払線の行の値は複製しない）'},
   {label:'分岐点の推定',value:'勇払線から分岐する点を、OSMの鉄塔（node 12896228675、ref=16）とみなした（推定）。北海道NWの公表区間 送36（南早来→#16）・送35（#16→東苫小牧）の #16 と番号が一致する（OSMのみ）。この線は1回線で、2回線の勇払線からのT分岐とみなした。個別回線は未確認。'},
   {label:'地理参照',value:`OSM 3線分（計約${km.toFixed(2)}km、187kV・1回線）：架空線（way 1477837531・1477837537、事業者タグは北海道電力ネットワーク）と地中線（way 1477837532、約0.35km、点線）。発電所の構内の引込（line=bay）は描かない。端は地中線の末端（発電所の区画の内側）。`},
   {label:'出典',value:`地理はOSM（data/raw/hokkaido-holds-osm/lines-187.json、${osmAt}時点。鉄塔のタグ ref=16 は data/raw/hokkaido-holds-osm/towers-ref.json）。公表区間は北海道NW 系統構成・設備一覧（送35・送36）。`}]});
 const sc=plant.attributes.findIndex(a=>a.label==='系統との接続'),v={label:'系統との接続',value:'勇払バイオマス発電の連系線（OSMのみ、E区分）で、勇払線の鉄塔16（推定の分岐点）につながる。'};if(sc<0)plant.attributes.push(v);else plant.attributes[sc]=v;
 const pub=yl.attributes.find(a=>a.label==='公表区間');if(!pub||!pub.value.includes('分割点#16の位置は不明のため1本で表示'))throw Error('勇払線の公表区間の文が変わった');
 pub.value=pub.value.replace('分割点#16の位置は不明のため1本で表示','分割点#16は、OSMの鉄塔（node 12896228675、ref=16）と推定（OSMのみ）。2区間に分けず1本で表示');}
data.datasetId='hokkaido-remaining-187-v16';
data.changePlans=(await read('data/validation/hokkaido-change-plans.json')).plans;
data.osmTimestamp='2026-09-26〜2026-09-27（OSM取得日。各路線の資料版を参照）';
// 照合区分のない線に、東京・西日本・東北と同じ規則（scripts/assign-tiers.mjs の classify）で区分を付ける（2026-11-04 オーナー承認 保留71）。
// 公表区間は北海道NW 系統構成・設備一覧（送番号と両端）。属性「公表区間・運用」「公表区間・正式名称」は、送番号と両端があるときだけ判定で公表区間として扱う（データのラベルは変えない）。
// 公表区間・正式名称の線（十勝幹線(恵庭南札線)）は公表名と OSM 名の対応を端点で判断したので、A にせず B とする（保留71b）。既に区分のある線は変えない（assert）
{const {classify,osmIndexDirs}=await import('./assign-tiers.mjs');
 const idx=osmIndexDirs(['data/raw/hokkaido-187-survey','data/raw/hokkaido-ebetsu-187','data/raw/hokkaido-terminal-review','data/raw/hokkaido-central','data/raw/hokkaido-275-holds','data/raw/hokkaido-275','data/raw/hokkaido-holds-osm']);
 const fb=new Map(data.facilities.map(f=>[f.id,f])),tiered=l=>l.attributes?.some(a=>a.label==='照合区分'||/^要注意（[CDE]区分/.test(a.label));
 const before=new Map(data.lines.filter(tiered).map(l=>[l.id,JSON.stringify(l.attributes)])),count={A:0,B:0,C:0};
 const near=(p,q)=>Math.abs(p[0]-q[0])<1e-6&&Math.abs(p[1]-q[1])<1e-6;
 const MID_WAY_LINES=new Set(['asset-28335b35-e3a6-401a-a028-6d594c6bba36','asset-db91af05-2e84-4de3-96ac-86052029d872']); // 後志幹線（泊～#115）・（西双葉～#115）
 for(const l of data.lines){if(tiered(l))continue;
  if(l.osmIds.some(i=>i>0&&!idx.ways.has(i)))throw Error('照合区分：索引にない線分 '+l.id);
  if(l.osmIds.some(i=>idx.tagDiffers.has(i)))throw Error('照合区分：原本どうしで線名・電圧が違う線分 '+l.id);
  // 線分の経路の両端は、原本の way の両端であること。鉄塔#115で分けた後志幹線の2本だけは way の途中の節点で終わる（2026-11-04 確認）
  l.osmIds.forEach((id,i)=>{if(id<0)return;const w=idx.ways.get(id),p=l.paths[i];
   const ends=MID_WAY_LINES.has(l.id)?w.nodes.map(n=>idx.nodes.get(n)).filter(Boolean):[idx.nodes.get(w.nodes[0]),idx.nodes.get(w.nodes.at(-1))].filter(Boolean);
   if(!p||![p[0],p.at(-1)].every(q=>ends.some(x=>near(q,x))))throw Error('照合区分：線分の両端が原本と合わない '+l.id+' way '+id);});
  const pub=l.attributes.find(a=>/^公表区間(・運用|・正式名称)?$/.test(a.label));
  if(!pub||!/北海道NW.*送\d+/.test(pub.value)||!/―/.test(pub.value))throw Error('照合区分：公表区間（送番号と両端）がない '+l.id);
  const t=classify({...l,attributes:l.attributes.map(a=>a===pub?{...a,label:'公表区間'}:a)},idx,fb);
  if(!(t.tier in count))throw Error('照合区分：想定外の区分 '+t.tier+' '+l.id);
  if(pub.label==='公表区間・正式名称'&&t.tier==='A'){t.tier='B';t.reasons=['公表名とOSM名の対応を端点で判断'];}
  count[t.tier]++;
  const src='公表区間（北海道NW 系統構成・設備一覧）';
  const why=t.tier==='A'?src+'の両端の設備に、同名のOSM線（＋両端の短い引込）だけで到達。':t.tier==='B'?src+'の両端に到達。'+t.reasons.join('、')+'。':t.reasons.join('、')+'。';
  l.attributes=[...(t.tier==='C'?[{label:'要注意（C区分）',value:'公表区間の両端は分かるが、OSMの経路との対応を確定できない参考表示（理由は照合の根拠）。'}]:[]),{label:'照合区分',value:t.tier+'区分'},{label:'照合の根拠',value:why},...l.attributes];}
 for(const [id,a] of before)if(JSON.stringify(data.lines.find(l=>l.id===id).attributes)!==a)throw Error('照合区分：既存の区分の線が変わった '+id);
 console.log('hokkaido tiers',JSON.stringify(count),'索引',idx.files,'ファイル',idx.ways.size,'線分','重複',idx.duplicates,'うち節点の並びが違う',idx.differing,'線名・電圧が違う',idx.tagDiffers.size);}
// 各社の空容量一覧の値（変圧器のバンク・線の設備容量）は公開データに載せない（2026-11-09 保留95 ⑤）。値を外した行（null）は落とす
for(const x of [...data.lines,...data.facilities])if(x.attributes)x.attributes=x.attributes.filter(a=>a.value!=null);
const text=JSON.stringify(publicWording(data,'hokkaido-hokuto.json'),null,2)+'\n';await writeFile('public/data/hokkaido-hokuto.json',text);
// Independent copy: regenerate the pinned approval from the reviewed build (as for Tokyo).
{const {createHash}=await import('node:crypto');await writeFile('config/hokkaido-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(text).digest('hex'),lineIds:data.lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(data.lines.map(l=>[l.assetId,l.voltageKV])),facilityIds:data.facilities.map(f=>f.assetId)},null,2)+'\n');}
console.log('Created explicit validation dataset; public catalog unchanged');

