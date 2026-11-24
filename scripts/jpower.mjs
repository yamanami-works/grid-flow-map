// 電源開発（J-POWER）の設備を各地域の builder で取り込む（2026-10-04 オーナー指示「電源開発の発電所や送電線の反映が抜けていれば追加」）。
// - docs/research/jpower-adopted.json（tools/prep/adopt-jpower.mjs）の地域ごとの線・設備を足す。
// - J-POWER送変電「2026年度供給計画の概要」（2026-02-27公表 https://www.jpower.co.jp/tn/news/pdf/oshirase260227-2.pdf 、2026-10-04確認）の工事中・廃止予定を線・設備に記録する。
import {readFileSync,existsSync} from 'node:fs';
import {applyRetiredPlants} from './retired-plants.mjs';
import {applyPlantPrimary} from './plant-primary.mjs';
import {applyOutputNotes} from './plant-output-note.mjs';
// 地中・海底の線分（OSM power=cable）の一覧。描き足した線も同じ一覧で点線にする
const CABLES=new Set(existsSync('data/catalog/cable-ways.json')?JSON.parse(readFileSync('data/catalog/cable-ways.json','utf8')).wayIds:[]);
export const JP_PLAN='J-POWER送変電「2026年度供給計画の概要」（2026-02-27公表、https://www.jpower.co.jp/tn/news/pdf/oshirase260227-2.pdf 、2026-10-04確認）';
export function mergeJpower(region,lines,facilities){
 // 2026-10-04：公表された基幹送電線の台帳から描いた線（tools/prep/adopt-ledger.mjs）も同じ形で取り込む
 let n=0;
 for(const file of ['docs/research/jpower-adopted.json','docs/research/ledger-adopted.json','docs/research/ledger-anonymous-adopted.json','docs/research/extra-adopted.json','docs/research/owner-points-adopted.json','docs/research/plants-adopted.json']){if(!existsSync(file))continue;
  const r=JSON.parse(readFileSync(file,'utf8')).regions[region];if(!r)continue;
  for(const f of r.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(structuredClone(f));
  for(const l of r.lines)if(!lines.some(x=>x.id===l.id)){const c=structuredClone(l);const cab=c.osmIds.filter(i=>CABLES.has(i));if(cab.length)c.cableOsmIds=[...new Set(cab)];else delete c.cableOsmIds;lines.push(c);n++;}}
 // 発電方式の一次資料（2026-10-10）と廃止発電所（2026-10-09）：全 builder がここを通るので、取り込みの最後に設備・電源線へ反映する（足した設備も廃止の判定に入るよう、一次資料を先に）
 applyPlantPrimary(region,lines,facilities);
 applyRetiredPlants(lines,facilities);
 applyPlantConnectionNotes(region,lines,facilities);
 applyFacilityPoints(region,facilities);
 // 「出力・号機構成は未照合」の文言を、HJKS・一次資料で確認できた項目に合わせて置き換える（2026-10-19）
 applyOutputNotes(facilities);
 return n;
}
// 設備の代表点の補正（2026-10-16 オーナー承認、手作業の表 docs/research/facility-points.json）：OSMの区画の頂点の平均が区画の外に落ちる設備だけ、
// 区画の内側の点へ移す。設備がない・名前が違う・今の座標が表の oldPosition から1mより離れている（元のデータが変わった）ときはビルドを止める
function applyFacilityPoints(region,facilities){
 const FILE='docs/research/facility-points.json';if(!existsSync(FILE))return;
 const dm=(a,b)=>Math.hypot((a[0]-b[0])*110540,(a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180));
 for(const e of JSON.parse(readFileSync(FILE,'utf8')).entries.filter(e=>e.region===region)){
  const f=facilities.find(x=>x.id===e.facilityId);if(!f||f.name!==e.name)throw Error(`facility-points: ${e.name}（${e.facilityId}）が見つからない、または名前が違う`);
  if(dm(f.position,e.oldPosition)>1)throw Error(`facility-points: ${e.name} の今の座標が表と違う（元のデータが変わった）`);
  f.position=[...e.newPosition];
  const a=[...(f.attributes??[])],i=a.findIndex(x=>x.label==='代表点の取り方'),v={label:'代表点の取り方',value:e.note};if(i<0)a.push(v);else a[i]=v;f.attributes=a;}
}
// 線のない発電所の「系統との接続」（2026-10-16 オーナー承認、手作業の表 docs/research/plant-connection-notes.json）：廃止の判定のあとに当て、
// 同じ見出しの項目は元の位置で置き換える。発電所・つながる先の設備・線のどれかが見つからなければビルドを止める（OSMの更新で表が古くなるのを防ぐ）
function applyPlantConnectionNotes(region,lines,facilities){
 const FILE='docs/research/plant-connection-notes.json';if(!existsSync(FILE))return;
 for(const e of JSON.parse(readFileSync(FILE,'utf8')).entries.filter(e=>e.region===region)){
  const f=facilities.find(x=>x.id===e.facilityId),to=facilities.find(x=>x.id===e.toFacilityId),l=lines.find(x=>x.id===e.lineId);
  if(!f||!to||!l)throw Error(`plant-connection-notes: ${e.name} の${!f?'発電所':!to?'つながる先':'線'}が見つからない`);
  if(!l.connections.some(c=>c.node===e.lineEndNode&&c.facilities.some(x=>x.id===e.toFacilityId)))throw Error(`plant-connection-notes: ${e.name} の線の末端が変わった`);
  // replaceLabel：以前の同じ趣旨の注記（例「接続」）があれば、その位置で置き換えて1つにする
  const a=[...(f.attributes??[])].filter(x=>x.label!=='系統との接続'||!e.replaceLabel),i=a.findIndex(x=>x.label===(e.replaceLabel??'系統との接続')),v={label:'系統との接続',value:e.note};if(i<0)a.push(v);else a[i]=v;f.attributes=a;}
}
const note=(x,label,value)=>{x.attributes=[...(x.attributes??[]).filter(a=>a.label!==label),{label,value}];};
/** 地域ごとの電源開発の設備の記録（名称の補正・工事中・廃止予定） */
export function annotateJpower(region,lines,facilities){
 if(region==='chubu'){
  const f=facilities.find(x=>x.id==='osm-way-169121278');
  if(f){if(f.name==='電源名古屋')f.name='名古屋変電所';note(f,'事業者','電源開発送変電ネットワーク（J-POWER送変電）');note(f,'名称の根拠','OSMの区画名は「電源名古屋」（事業者タグは中部電力）。J-POWER送変電の送変電事業地図（https://www.jpower.co.jp/tn/business/map.html 、2026-10-04確認）の名古屋変電所の位置と一致。');}
  for(const l of lines.filter(x=>/^佐久間西幹(山|里)?線$/.test(x.name)))note(l,'計画（廃止予定）',`${JP_PLAN}：佐久間西幹線 No.24～中部電力パワーグリッド東部変電所（275kV、57km）を2027年4月に廃止。この線（${l.name}）のどの区間・回線が当たるかは未照合。`);
 }
 if(region==='tokyo'){
  for(const l of lines.filter(x=>/^佐久間東幹線/.test(x.name)))note(l,'計画（工事中）',`${JP_PLAN}：佐久間東幹線 No.6～東京電力パワーグリッド新富士変電所（275kV、124km）は工事中で2028年3月使用開始予定（東清水線との分岐鉄塔No.144～新富士変電所は2027年8月に先行運開）。新佐久間周波数変換所（300MW、2028年12月）への分岐線（3km）も工事中。`);
 }
 if(region==='tohoku'){
  const f=facilities.find(x=>x.id==='osm-way-371468679');
  if(f){f.status='建設中';f.plannedStart='未定';f.statusConfirmed=true;f.statusSource='電源開発「大間原子力発電所建設計画の概要・計画概要」（https://www.jpower.co.jp/bs/nuclear/oma/plan.html 、2026-10-04確認）：建設工事中、2008年5月着工、運転開始は未定、電気出力138万3千kW。電力は大間幹線（約61km）・東北電力ネットワークむつ幹線経由で送電する計画。';}
  const l=lines.find(x=>x.id==='tohoku-plant-500-way-371468679');
  if(l){l.name='大間幹線';l.named=true;l.status='建設中';l.plannedStart='未定';l.statusSource=`${JP_PLAN}：大間幹線 電源開発大間原子力発電所～東北電力ネットワークむつ幹線No.1、500kV、61km、2006年6月着工・工事中、使用開始未定。`;
   note(l,'線名の根拠',`${JP_PLAN}の工事中の送電線「大間幹線」（大間原子力発電所～むつ幹線No.1）。地図の線はOSMで大間原子力発電所から南へたどった経路で、むつ幹線No.1との接続点は分岐点（推定）。`);
   if(l.referenceReview)l.referenceReview.endpoints='大間原子力発電所―むつ幹線No.1（分岐点）';}
 }
}
