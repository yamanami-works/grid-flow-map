// Builds the Hokuriku validation dataset (public/data/hokuriku-trunk.json) and its pinned approval from the adopted sections
// (docs/research/hokuriku-adopted.json, produced by tools/prep/adopt-hokuriku.mjs). All lines are C tier (OSM routes only, 要注意).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyTiers} from './assign-tiers.mjs';
import {mergeJpower,annotateJpower} from './jpower.mjs';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const adopted=read('docs/research/hokuriku-adopted.json');
const source=read('data/raw/hokuriku-osm/source.json');
const lines=[...adopted.lines],facilities=adopted.facilities.map(f=>({...f}));
// 基幹系統に接続する発電所（tools/prep/adopt-plants.mjs、2026-10-02）：追加の発電所・OCCTO公表外の電源線と、既存の発電所へのOSM登録値
let plants=null;try{plants=read('docs/research/hokuriku-plants-adopted.json');}catch{}
if(plants){for(const f of plants.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...plants.lines);
 for(const e of plants.enriched){const f=facilities.find(x=>x.id===e.id);if(f&&f.assetId?.startsWith('hokuriku-'))f.attributes=[...(f.attributes??[]).filter(a=>!e.attributes.some(b=>b.label===a.label)),...e.attributes];}}
// 発電所の2本目以降の電源線で、一次資料で両端を確かめたもの（tools/prep/adopt-plant-extra-lines.mjs、2026-10-15）：志賀原子力線
let extra=null;try{extra=read('docs/research/plant-extra-lines.json');}catch{}
if(extra)for(const x of extra.lines.filter(x=>x.region==='hokuriku'))lines.push(x.line);
// 地域間連系線（tools/prep/adopt-ties.mjs、2026-10-03）：このエリアが端になる線を同じIDで入れる。端の設備は自エリアのものを優先し、相手側はそのエリアの設備を使う。潮流は未反映。
let ties=null;try{ties=read('docs/research/ties-adopted.json');}catch{}
if(ties)for(const l of ties.lines.filter(l=>l.regions.includes('hokuriku'))){const {regions,...line}=l;lines.push(line);for(const c of l.connections)for(const x of c.facilities)if(!facilities.some(f=>f.id===x.id)){const {region,...f}=ties.facilities.find(f=>f.id===x.id);facilities.push(f);}}
// 照合区分（A/B/C）を東京と同じ規則で付け直す（scripts/assign-tiers.mjs、2026-10-03）
// 電源開発の設備（scripts/jpower.mjs、2026-10-04）
mergeJpower('hokuriku',lines,facilities);annotateJpower('hokuriku',lines,facilities);
// もんじゅの電源線を、OSM の線が美浜の連系線（関西の No.60、OSM way 725340694）に合流する点で止める（2026-11-18 保留128-1、オーナー回答「(a)でno60は美浜原子力発電所の敷地まで伸ばして描いて」）。
// 合流点から嶺南変電所までの区間（way 725340694 の一部と 1084685262）は、関西のデータの「美浜原子力発電所の連系線（No.60、推定）」として描く（同じ線を2つの地域で重ねて描かない）
{const l=lines.find(x=>x.id==='plant-hokuriku-275-725346294');
 if(!l||l.osmIds.join()!=='725346294,1085605125,725340694,1084685262')throw Error('もんじゅの電源線が想定と違う');
 const J=l.paths[2][0];if(l.paths[1].at(-1)[0]!==J[0]||l.paths[1].at(-1)[1]!==J[1])throw Error('もんじゅの電源線：合流点が想定と違う');
 const dm=(a,b)=>6371000*Math.hypot((b[1]-a[1])*Math.PI/180*Math.cos(a[0]*Math.PI/180),(b[0]-a[0])*Math.PI/180);
 l.osmIds=l.osmIds.slice(0,2);l.paths=l.paths.slice(0,2);if(l.sourceOsmIds)l.sourceOsmIds=l.sourceOsmIds.filter(i=>l.osmIds.includes(i));
 const km=l.paths.reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+dm(p[i],q),0),0)/1000;
 l.connections[1]={node:6801932107,position:J,status:'shared-node',facilities:[],neighborWays:[725340694]};
 l.referenceReview={status:'partial',endpoints:'もんじゅ―美浜原子力発電所の連系線（No.60、推定）との合流点（推定）'};
 const set=(label,value)=>{const i=l.attributes.findIndex(a=>a.label===label);if(i<0)l.attributes.push({label,value});else l.attributes[i]={label,value};};
 set('推定の内容','もんじゅの区画から275kVのOSMの線（線名なし）を共有ノードでたどり、美浜原子力発電所から嶺南変電所へ向かう線（OSM way 725340694）に合流する点までを、この発電所の電源線とみなした。');
 set('地理参照',`もんじゅから275kVのOSMの線を共有ノードでたどり、OSM way 725340694 に合流する点（node 6801932107、美浜原子力発電所の東約2km）まで（OSM 2線分、約${km.toFixed(2)}km）。個別回線は未確認。`);
 set('端点の根拠','嶺南側の端点を、OSM の線が美浜原子力発電所の連系線（No.60、推定）の経路（way 725340694）に合流する点（node 6801932107）とみなした（推定）。電気的に合流するのか、同じ鉄塔に載る別の回線かは未確認。');
 set('端点の変更（2026-11-18）','以前は合流点から先も嶺南変電所まで描いていた。合流点から嶺南変電所までは関西のデータの「美浜原子力発電所の連系線（No.60、推定）」と同じ OSM の線のため、こちらは合流点で止めた（オーナー回答「(a)でno60は美浜原子力発電所の敷地まで伸ばして描いて」、保留128-1）。もんじゅの電気が No.60 の線を通って嶺南へ流れるのか、別の回線かは未確認。');}
const tiers=applyTiers('hokuriku',lines,facilities);console.log('hokuriku tiers',JSON.stringify(tiers));
// 保留130-6（2026-11-18）：新成出水力発電所の電源線（→新北陸幹線（成出～城端））と新成出水力発電所を関西のデータへ移す（城端開閉所は両方に載せる。scripts/move-to-kansai-130.mjs）。関西の builder より先に実行する
{const {moveToKansai130}=await import('./move-to-kansai-130.mjs');moveToKansai130('hokuriku',lines,facilities);}
for(const l of lines)for(const c of l.connections)for(const f of c.facilities)if(!facilities.some(x=>x.id===f.id))throw Error('Unknown Hokuriku facility '+f.id);
const ids=[...lines,...facilities].map(x=>x.assetId);if(new Set(ids).size!==ids.length)throw Error('Duplicate Hokuriku asset IDs');
const data={schemaVersion:1,datasetId:'hokuriku-trunk-v1',rights:'pending',
 coverage:'北陸500kV・275kV・'+lines.length+'路線'+facilities.length+'設備の限定検証（OCCTO北陸の500kV全4区間と275kV全7区間。地理はOSM。OSMで途切れた所は直線で補完）。',
 retrievedAt:source.requests.map(r=>r.retrievedAt).sort().at(-1),osmTimestamp:source.requests.map(r=>r.osmBase).filter(Boolean).sort().join(' – '),
 license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',sourceUrl:'https://overpass-api.de/api/interpreter',sources:source.requests.map(({name,endpoint,retrievedAt,sha256})=>({file:name,url:endpoint,retrievedAt,sha256})),
 lines,facilities,changePlans:[]};
data.coverage+='照合区分 A'+tiers.A+'・B'+tiers.B+'・C'+tiers.C+(tiers.D?'・D'+tiers.D:'')+'（A・Bは公表区間の両端にOSMの線で到達したもの。要注意はC・Dのみ）。';
const text=JSON.stringify(publicWording(data,'hokuriku-trunk.json'),null,2)+'\n';writeFileSync('public/data/hokuriku-trunk.json',text);
writeFileSync('config/hokuriku-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(text).digest('hex'),lineIds:lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(lines.map(l=>[l.assetId,l.voltageKV])),lineCurrentTypes:Object.fromEntries(lines.filter(l=>l.currentType!=='ac').map(l=>[l.assetId,l.currentType])),facilityIds:facilities.map(f=>f.assetId)},null,2)+'\n');
// OCCTO→地図の対応表を画面用モジュールへ書き出す（src/hokuriku-pairs.ts）
const pairs=read('docs/research/hokuriku-occto-pairs.json').pairs;
const header='// 生成ファイル（scripts/build-hokuriku.mjs）。元は docs/research/hokuriku-occto-pairs.json（tools/prep/adopt-hokuriku.mjs）。手で編集しない。\n// [OCCTO線名, 地図の線名, kV, OCCTO起点, OCCTO終点, 地図の起点設備, 地図の終点設備]\n';
writeFileSync('src/hokuriku-pairs.ts',header+'export const pairs=[\n'+pairs.map(p=>' '+JSON.stringify(p).replaceAll('"',"'")).join(',\n')+',\n] as const;\n');
console.log('Hokuriku dataset',lines.length,'lines',facilities.length,'facilities');
