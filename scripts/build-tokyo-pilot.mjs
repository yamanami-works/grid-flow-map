import fs from 'node:fs';import {createHash} from 'node:crypto';import {referenceFlowPath} from '../src/flow-path.ts';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const base=read('public/data/tohoku-trunk-osm.json'),survey=read('docs/research/tokyo-500-adopted.json');
const lines=survey.candidates.map(c=>{const path=referenceFlowPath({id:'survey',name:c.geoName,voltageKV:c.voltageKV,from:c.from,to:c.to},base.lines,false);if(!path)throw Error(c.name);const facilities=c.facilities;
const key=(a,b)=>[a.join(','),b.join(',')].sort().join('|');const lookup=new Map();for(const l of base.lines.filter(l=>l.voltageKV===c.voltageKV))l.paths.forEach((ps,i)=>ps.slice(1).forEach((q,j)=>{if(c.pathOsmIds.includes(l.osmIds[i]))lookup.set(key(ps[j],q),l.osmIds[i]);}));const paths=[],osmIds=[];for(let i=1;i<path.length;i++){const id=lookup.get(key(path[i-1],path[i]));if(!id)throw Error('Unproven path edge');if(osmIds.at(-1)!==id){osmIds.push(id);paths.push([path[i-1],path[i]]);}else paths.at(-1).push(path[i]);}
return {id:'tokyo-section-'+c.section,assetId:'tokyo-section-'+c.section,name:c.name,voltageKV:c.voltageKV,currentType:'ac',named:true,paths,osmIds,sourceOsmIds:c.pathOsmIds,sourceAssetIds:c.existingLines.map(l=>l.assetId),connections:[{node:base.lines.flatMap(l=>l.connections??[]).find(e=>e.position.join(',')===path[0].join(',')&&e.facilities.some(f=>f.id===facilities[0].id)).node,position:path[0],status:'facility-area',facilities:[facilities[0]],neighborWays:[]},{node:base.lines.flatMap(l=>l.connections??[]).find(e=>e.position.join(',')===path.at(-1).join(',')&&e.facilities.some(f=>f.id===facilities[1].id)).node,position:path.at(-1),status:'facility-area',facilities:[facilities[1]],neighborWays:[]}],referenceReview:{status:'section',endpoints:c.from+'―'+c.to+'（設備区画到達・個別回線/母線未確認）'},attributes:[{label:'公表区間',value:`東京PG 基幹${c.voltageKV}kV No.${c.section}：${c.from}―${c.to}`},{label:'参照経路',value:`既存OSM ${c.pathOsmIds.length}線分から1経路を抽出。空間的な交差では接続せず、共有座標と設備区画への到達を照合。個別回線・母線結線、全回線の収録は未確認。`},{label:'出典・公表版',value:'東京PG系統構成・設備一覧2026-06-22版、取得2026-09-27。OCCTO実績と同日方向別容量は別資料。'}, {label:'OSM原本の設備ID',value:c.existingLines.map(l=>l.assetId).join(' / ')}]};});
const facilities=[...new Map(survey.candidates.flatMap(c=>c.facilities).map(f=>[f.id,structuredClone(base.facilities.find(b=>b.id===f.id))])).values()];for(const f of facilities){if(['新いわき開閉所','南いわき開閉所'].includes(f.name))f.kind='switchyard';}for(const f of facilities)f.attributes=[...(f.attributes??[]),{label:'公表設備対応',value:'東京PG2026-06-22版の対象端点とOSM設備区画を照合。個別回線・母線未確認。'}];
const plans=[['higashishimizu','東清水線','東清水変換所～佐久間東幹線275kV','新設12.4km・既設6.4km','工事中',[['2027-1','使用開始',2027,1]]],['higashishinjuku','東新宿線','北多摩変電所～東新宿変電所275kV','新宿線(渋5K)～東新宿変電所','計画中',[['2035-6','2番線',2035,6],['2028-6','3番線',2028,6]]],['shinsodegaura','新袖ヶ浦線','発電所側引込','袖ヶ浦発電所構内新設鉄構～新袖ヶ浦変電所500kV','計画中',[['2028-11','1号線',2028,11],['2029-5','2号線',2029,5]]],['johoku','城北線','城北線（新座変電所～豊島変電所）','新座変電所～豊島変電所 275kV 20.9km 3回線 CV1400','工事中',[['2033-10','使用開始',2033,10]]]].map(([id,name,before,after,status,times])=>({id:'tokyo-plan-'+id+'-2026',regions:id==='higashishimizu'?['tokyo','chubu']:['tokyo'],targets:[{name,assetIds:[],mapping:'現行資産との個別対応未照合'}],changeType:'送電設備の新設・引替',latestProgressReview:{checkedAt:null,note:'公表後の予定変更・工事進捗の最新性は未確認。'},revisions:[{recordedAt:'2026-09-27',before,after,status,statusOriginal:status==='計画中'?'着工準備中':status,timing:times.map(([raw,label,year,month])=>({raw,label,year,month,precision:'month'})),source:{name:'東京PG 主要送電線路の整備計画（2026年度供給計画）',url:'https://www.tepco.co.jp/pg/consignment/system/pdf/20250526_setubikeikaku-j500-275.pdf',publishedAt:'2026-03-31',checkedAt:'2026-09-27'},reason:'初回記録。予定だけで現行系統へ反映しない。'}],unknowns:['最新工事進捗・運用開始・現行資産対応未確認'],updateRequired:['地理','接続','設備情報','潮流対応'],application:{status:'未反映',note:'将来系統レイヤーは追加せず、一次資料で運開と対象を確認してから反映する。'}}));
plans.push(read('docs/research/marumori-change-plan.json'));
plans.push(...read('docs/research/tohoku-voltage-upgrade-plans.json'));
// 相馬双葉幹線の接続変更（2026-11-05 保留78、オーナー指示「系統変更予定一覧にも反映して」）。工事開始の記事（日付記載なし）と 2026-07-01 の使用開始のプレスリリースの2件の記録
plans.push({id:'tohoku-tokyo-somafutaba-2026',regions:['tohoku','tokyo'],targets:[{name:'相馬双葉幹線',assetIds:['tie-500-相馬双葉幹線'],mapping:'既存資産に対応'}],changeType:'接続変更',
 latestProgressReview:{checkedAt:'2026-11-04',note:'2026-07-01 のプレスリリースで 2026-06-30 の使用開始を確認。'},
 revisions:[
  {recordedAt:'2026-11-05',before:'相馬双葉幹線：南相馬変電所―東京PG 南いわき開閉所',after:'相馬双葉幹線を南いわき開閉所から切り離し、新たなルートで東京PG 福島幹線山線に接続（東北東京間連系線の2ルート化）',timing:[{raw:'2025年11月',label:'使用開始予定',precision:'month',year:2025,month:11}],status:'工事中',statusOriginal:'本格工事が開始',
   source:{name:'東北電力NW「～東北東京間連系線２ルート化へ～相馬双葉幹線接続変更に係る本格工事が開始！」',url:'https://nw.tohoku-epco.co.jp/bridge/generalarticle/2022/posts0629b.html',publishedAt:null,checkedAt:'2026-11-04'},reason:'工事開始の記事。ページに日付の記載なし（2026-07-01 のプレスリリースに「2022年6月1日お知らせ済み」）。'},
  {recordedAt:'2026-11-05',before:'相馬双葉幹線：南相馬変電所―東京PG 南いわき開閉所',after:'相馬双葉幹線 No.54（福島県田村市）〜東京PG 福島幹線山線 No.10（福島県川内村）、15.3km／34基、500kV／2回線（工事開始 2022-06-01）',timing:[{raw:'2026年6月30日',label:'使用開始',precision:'month',year:2026,month:6}],status:'運用開始確認済み',statusOriginal:'使用を開始',
   source:{name:'東北電力NW プレスリリース「相馬双葉幹線の新ルートへの接続変更および使用開始について」',url:'https://nw.tohoku-epco.co.jp/news/pdf/__icsFiles/afieldfile/2026/07/01/2607010001.pdf',publishedAt:'2026-07-01',checkedAt:'2026-11-04'},reason:'使用開始の発表。地図に反映（2026-11-05 保留78）。'}],
 unknowns:['新ルートの鉄塔の位置は Google マップ航空写真からの読み取り（推定、誤差 数十m）','No.10 での接続の形（引込か分岐か）','旧ルート No.54〜南いわき開閉所のその後（旧 No.56 は丸森いわき幹線との接続個所）'],
 updateRequired:[],application:{status:'反映済み',note:'2026-11-05 に地図の相馬双葉幹線の経路と接続先を変更（保留78）。旧ルート No.54〜南いわき開閉所は地図から外した。'}});
const extra=read('docs/research/tokyo-500-north-adopted.json');lines.push(...extra.lines);for(const f of extra.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);
const oldPlans=read('public/data/hokkaido-hokuto.json').changePlans??[];if(plans.some(p=>oldPlans.some(q=>q.id===p.id||q.targets.some(t=>p.targets.some(s=>s.name===t.name)))))throw Error('Plan duplicate review needed');
const west=read('docs/research/tokyo-500-west-adopted.json');lines.push(...west.lines);for(const f of west.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);
const east=read('docs/research/tokyo-500-east-adopted.json');lines.push(...east.lines);for(const f of east.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);
const plantsC=read('docs/research/tokyo-500-plants-adopted.json'),fc=read('docs/research/tokyo-500-fc-adopted.json'),t275=read('docs/research/tokyo-275-adopted.json'),t275s=read('docs/research/tokyo-275-schematic.json');
// 高瀬川線 No.76 (C区分、新高瀬川発電所は末端鉄塔の点): tools/prep/adopt-takase.mjs.
{const tk=read('docs/research/tokyo-275-takase.json');t275.lines.push(...tk.lines);t275.facilities.push(...tk.facilities);}
// 東清水FCの東京側（50Hz側）の現行接続（154kV、C区分）：tools/prep/adopt-higashishimizu.mjs（2026-10-01 オーナー指示）
{const hs=read('docs/research/tokyo-higashishimizu-154.json');t275.lines.push(...hs.lines.map(l=>({...l,tier:'C'})));}
const remaining=read('docs/research/tokyo-500-remaining-adopted.json');lines.push(...remaining.lines);for(const f of remaining.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);else Object.assign(facilities.find(x=>x.id===f.id),{kind:f.kind,attributes:f.attributes});
lines.push(...plantsC.lines,...fc.lines,...t275.lines.map(({tier,...l})=>({...l,attributes:[{label:'照合区分',value:tier+'区分'},...l.attributes]})));for(const f of t275.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);lines.push(...t275s.lines.map(l=>({...l,attributes:[{label:'照合区分',value:'D区分'},...l.attributes]})));for(const f of t275s.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);for(const f of fc.facilities){const x=facilities.find(x=>x.id===f.id);if(!x)facilities.push(f);else Object.assign(x,{kind:f.kind,attributes:f.attributes,scopeConnected:f.scopeConnected});}for(const f of plantsC.facilities)if(!facilities.some(x=>x.id===f.id))facilities.push(f);else if(['plant','switchyard'].includes(f.kind)&&f.attributes?.length)Object.assign(facilities.find(x=>x.id===f.id),{kind:f.kind,attributes:f.attributes});
// 部分表示の線の未確定の末端を、資料で裏付けられた端点設備まで直線で補う（オーナー判断 2026-09-30：ルート不明は直線）
for(const g of read('docs/research/tokyo-gap-completions.json').completions){if(g.facility&&!facilities.some(x=>x.id===g.facility.id))facilities.push(g.facility);const l=lines.find(x=>x.id===g.lineId),f=facilities.find(x=>x.id===g.facilityId);if(!l||!f)throw Error('gap '+g.lineId);
 const k=g.end==='start'?0:l.connections.length-1,c=l.connections[k];if(c.status!=='unresolved')throw Error('gap target is not unresolved: '+g.lineId);
 // 2026-10-16：線の末端が発電所の区画の内側に届くもの（mode 'inside'）は直線を足さず、末端のままその設備につなぐ（広野火力線）
 if(g.mode==='inside'){if(c.node!==g.node)throw Error('gap inside: node '+g.lineId);
  const els=read(g.area.raw).elements,w=els.find(e=>e.type==='way'&&e.id===g.area.way);if(!w)throw Error('gap inside: area '+g.lineId);
  const ring=w.geometry?w.geometry.map(q=>[q.lat,q.lon]):(()=>{const pos=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));return w.nodes.map(n=>pos.get(n));})();
  const p=c.position;let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[yi,xi]=ring[i],[yj,xj]=ring[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)inside=!inside;}
  if(!inside)throw Error('gap inside: the line end is outside the area '+g.lineId);
  l.connections[k]={...c,status:'facility-area',facilities:[{id:f.id,name:f.name}]};l.name=l.name.replace('（地理部分収録）','');
  if(l.referenceReview?.status==='partial'&&!l.connections.some(x=>x.status==='unresolved'))l.referenceReview={status:'section',endpoints:l.connections.map(x=>x.facilities[0]?.name??'共有ノード').join('―')};
  const pub=l.attributes.find(a=>a.label==='公表区間との対応');if(pub){pub.value=pub.value.replace('発電所区画の手前で終わる','発電所の区画の内側で終わる（2026-10-16 確認）').replace('発電所への到達は未確認のため部分表示。','');if(/手前で終わる|部分表示/.test(pub.value))throw Error('gap inside: 公表区間との対応 の古い文が残る '+g.lineId);}
  l.attributes=[...l.attributes,{label:'末端',value:f.name+'側は、OSMの線の末端（node '+g.node+'）が発電所の区画の内側に届くので、直線で補わない。構内の結線と、系統構成図のもう一方の発電所との接続は未確認。'}];continue;}
 // 2026-11-07 オーナー指示（保留86）：mode 'osmEnd' は直線を足さず、OSM の線の末端のまま（区画に届かない）線名から設備につなぐ（新豊根佐久間線。末端は地上の開閉設備とみられる区画の外側）
 if(g.mode==='osmEnd'){if(c.node!==g.node)throw Error('gap osmEnd: node '+g.lineId);
  const els=read(g.area.raw).elements,w=els.find(e=>e.type==='way'&&e.id===g.area.way);if(!w)throw Error('gap osmEnd: area '+g.lineId);
  const ring=w.geometry?w.geometry.map(q=>[q.lat,q.lon]):(()=>{const pos=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));return w.nodes.map(n=>pos.get(n));})();
  const p=c.position,xy=q=>[(q[1]-p[1])*111320*Math.cos(p[0]*Math.PI/180),(q[0]-p[0])*110540];let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[yi,xi]=ring[i],[yj,xj]=ring[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)inside=!inside;}
  const gapM=Math.round(Math.min(...ring.slice(1).map((q,i)=>{const[ax,ay]=xy(ring[i]),[bx,by]=xy(q),dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));return Math.hypot(ax+t*dx,ay+t*dy);})));
  if(inside||gapM>100)throw Error('gap osmEnd: the line end is not just outside the area '+g.lineId+' '+gapM);
  const plantM=Math.round(Math.hypot(...xy(f.position)));
  l.connections[k]={...c,status:'facility-area',facilities:[{id:f.id,name:f.name}]};l.name=l.name.replace('（地理部分収録）','');
  if(l.referenceReview?.status==='partial'&&!l.connections.some(x=>x.status==='unresolved'))l.referenceReview={status:'section',endpoints:l.connections.map(x=>x.facilities[0]?.name??'共有ノード').join('―')};
  l.attributes=[...l.attributes,{label:'末端',value:`${f.name}側は、OSMの線の末端（node ${g.node}、発電所の代表点から約${plantM}m）までを表示。末端は発電所の区画に届かず、OSM の無名の変電設備の区画（way ${g.area.way}。発電所の地上の開閉設備とみられる、推定）の外側約${gapM}mにある。${f.name}への接続は${g.reason.replace(/。$/,'')}から判断した。発電所の代表点までの直線は表示しない（2026-11-07 オーナー指示）。構内の結線は未確認。`}];continue;}
 const id=-(Number(l.id.split('-').at(-1))*10+1),seg=g.end==='start'?[f.position,c.position]:[c.position,f.position];
 if(g.end==='start'){l.paths.unshift(seg);l.osmIds.unshift(id);}else{l.paths.push(seg);l.osmIds.push(id);}
 l.schematicParts=[...(l.schematicParts??[]),{osmId:id,construction:g.construction}];
 l.connections[k]={...c,position:f.position,status:'facility-area',facilities:[{id:f.id,name:f.name}]};
 l.name=l.name.replace('（地理部分収録）','');
 if(l.referenceReview?.status==='partial'&&!l.connections.some(x=>x.status==='unresolved'))l.referenceReview={status:'section',endpoints:l.connections.map(x=>x.facilities[0]?.name??'共有ノード').join('―')+'（末端は直線・ルート不明）'};
 l.attributes=[...l.attributes,{label:'末端の直線',value:f.name+'側の末端はルート不明のため直線で表示（'+(g.construction==='underground'?'地中と推定・点線':g.construction==='overhead'?'架空と推定・実線':'地中・架空の別は不明・破線')+'）。根拠：'+g.reason}];}
// 「X線分岐」端点：OSMの共有ノードで区切り、分岐点を共有ノード端点とする（docs/research/tokyo-branch-points.json）
for(const b of read('docs/research/tokyo-branch-points.json').branches){const same=(q)=>q[0]===b.position[0]&&q[1]===b.position[1];
 const lineById=id=>{const l=lines.find(x=>x.id===id);if(!l)throw Error('branch '+id);return l;};
 const cutIds=b.cuts.map(c=>c.lineId),endIds=b.ends.map(e=>e.lineId),neighbors=id=>[...new Set([...cutIds,...endIds].filter(x=>x!==id).flatMap(x=>lineById(x).osmIds))];
 for(const c of b.cuts){const l=lineById(c.lineId);let pi=-1,vi=-1;l.paths.forEach((p,i)=>p.forEach((q,j)=>{if(pi<0&&same(q)&&!(i===0&&j===0)){pi=i;vi=j;}}));if(pi<0)throw Error('branch vertex not on '+c.lineId);
  const paths=l.paths.slice(0,pi+1).map((p,i)=>i===pi?p.slice(0,vi+1):p).filter(p=>p.length>1),osmIds=l.osmIds.slice(0,pi+1).filter((_,i)=>l.paths[i].slice(0,i===pi?vi+1:undefined).length>1);
  l.paths=paths;l.osmIds=osmIds;l.sourceOsmIds=[...new Set(osmIds)];
  const k=l.connections.findIndex(x=>x.status==='unresolved');l.connections[k]={node:b.node,position:b.position,status:'shared-node',facilities:[],neighborWays:neighbors(l.id)};}
 for(const e of b.ends){const l=lineById(e.lineId),k=l.connections.findIndex(x=>x.status==='unresolved');if(k<0||!same(l.connections[k].position))throw Error('branch end mismatch '+e.lineId);l.connections[k]={...l.connections[k],status:'shared-node',facilities:[],neighborWays:neighbors(l.id)};}
 for(const id of [...cutIds,...endIds]){const l=lineById(id);l.name=l.name.replace('（地理部分収録）','');l.referenceReview={status:'section',endpoints:l.connections.map(x=>x.facilities[0]?.name??b.name+'（共有ノード）').join('―')};
  l.attributes=[...l.attributes,{label:'分岐点',value:b.name+'はOSMの共有ノードで特定（設備にしない）。根拠：'+b.evidence}];}}
const cableWays=new Set(read('data/catalog/cable-ways.json').wayIds);for(const l of lines){const c=l.osmIds.filter(id=>cableWays.has(id));if(c.length)l.cableOsmIds=[...new Set(c)];else delete l.cableOsmIds;}
// 新信濃 is a substation that also houses the 50/60Hz frequency converter: keep kind=converter and add the substation role (owner instruction 2026-09-30).
for(const f of facilities)if(f.id==='osm-way-315662839')f.alsoKinds=['substation'];
// A plant that a line now reaches no longer carries the "no connected line" note.
{const linked=new Set(lines.flatMap(l=>l.connections.flatMap(c=>c.facilities.map(f=>f.id))));for(const f of facilities)if(linked.has(f.id)&&f.attributes?.some(a=>/^接続する送電線は未収録/.test(a.value))){f.attributes=f.attributes.filter(a=>!/^接続する送電線は未収録/.test(a.value));f.scopeConnected=true;}}
// 鉄道事業者（JR東日本）の水力は鉄道用の系統で、基幹系統への連系ではないので描かない（2026-10-07 オーナー指示「基幹系統に明らかに接続していない発電所は削除」）
// 2026-10-11 オーナー判断（案1）：小千谷第二発電所（osm-way-658690610）は中東京幹線につながる線を描くので戻す
{const RAIL_PLANTS=['osm-way-544385597','osm-way-658678499'];const linked=new Set(lines.flatMap(l=>l.connections.flatMap(c=>c.facilities.map(f=>f.id))));for(const id of RAIL_PLANTS){if(linked.has(id))throw Error('rail plant is linked '+id);const i=facilities.findIndex(f=>f.id===id);if(i>=0)facilities.splice(i,1);}}
// 東北東京間連系線 相馬双葉幹線（2026-10-03「東北と東京…の連系線も潮流表示して」）。OSMは線名なし（way 199522664、事業者 東北電力）。補助取得 data/raw/north-ties/souma.json。
// 2026-11-05 接続変更（保留78、オーナー回答「この内容で実施」「(b) 鉄塔の座標で描く」）：2026-06-30 から南いわき開閉所ではなく、新ルートで東京PG 福島幹線山線 No.10 に接続
// （東北電力NW 2026-07-01 プレスリリース）。南相馬変電所〜No.54（OSM の49番目の点と推定）は OSM、No.54〜No.10 は Google マップ航空写真から読み取った鉄塔32基
// （2026-11-05 オーナーの今回だけの許可。座標の公開も許可）。旧ルート No.54〜南いわき開閉所（約3.2km、way 897526309 を含む）は地図から外す。No.10 は福島山幹線（tokyo-section-4）の点そのもの。
{const raw=JSON.parse(fs.readFileSync('data/raw/north-ties/souma.json','utf8')).elements,way=id=>raw.find(e=>e.type==='way'&&e.id===id);
 const a=way(199522664),pa=a.geometry.map(p=>[p.lat,p.lon]);
 const base=JSON.parse(fs.readFileSync('public/data/tohoku-trunk-osm.json','utf8')).facilities,minami=base.find(f=>f.name==='南相馬変電所'),iwaki=facilities.find(f=>f.name==='南いわき開閉所');
 if(!minami||!iwaki)throw Error('相馬双葉幹線 facilities');if(!facilities.some(f=>f.id===minami.id))facilities.push({...minami});
 const dmS=(p,q)=>Math.hypot((p[0]-q[0])*110574,(p[1]-q[1])*111320*Math.cos(p[0]*Math.PI/180));
 const len=q=>q.slice(1).reduce((s,x,i)=>s+dmS(q[i],x),0)/1000;
 const OWNER_A=[37.407261,140.792096],OWNER_B=[37.339876,140.915941],AI=48;
 const A=pa[AI];if(dmS(A,OWNER_A)>60)throw Error('相馬双葉幹線：No.54（A）が指定の座標から60m以上');
 const fuku=lines.find(l=>l.id==='tokyo-section-4');if(!fuku)throw Error('相馬双葉幹線：福島山幹線（tokyo-section-4）がない');
 const B=fuku.paths.flat().reduce((m,p)=>dmS(p,OWNER_B)<dmS(m,OWNER_B)?p:m);if(dmS(B,OWNER_B)>60)throw Error('相馬双葉幹線：No.10（B）が指定の座標から60m以上');
 // No.54〜No.10 の鉄塔（Google マップ航空写真ズーム17から 2026-11-05 に読み取り。誤差 数十m。reports の evidence-20261104-pending78/route-towers.json と同じ値）
 const TOWERS=[[37.405551,140.796257],[37.406287,140.802721],[37.406497,140.806848],[37.407082,140.811445],[37.407135,140.816489],[37.406682,140.822083],[37.406525,140.827455],[37.405163,140.830707],[37.403749,140.833917],[37.402596,140.837193],[37.400268,140.841862],[37.398067,140.844548],[37.395473,140.846952],[37.395211,140.851145],[37.394816,140.857559],[37.393087,140.863258],[37.391578,140.869083],[37.391421,140.8762],[37.387753,140.88],[37.380567,140.885828],[37.376159,140.888462],[37.374063,140.889969],[37.371233,140.892],[37.367894,140.894624],[37.364591,140.895476],[37.362075,140.896262],[37.358579,140.897314],[37.355381,140.899214],[37.352917,140.900524],[37.348685,140.903921],[37.345696,140.90831],[37.344213,140.914114]];
 const head=pa.slice(0,AI+1),route=[A,...TOWERS,B],newKm=len(route);
 if(newKm<13.8||newKm>16.8)throw Error('相馬双葉幹線：新ルートの長さが15.3±1.5kmの外 '+newKm.toFixed(2));
 const iwakiArea=raw.find(e=>e.type==='way'&&e.id===253566674)?.geometry?.map(p=>[p.lat,p.lon]);if(!iwakiArea)throw Error('相馬双葉幹線：南いわき開閉所の区画がない');
 const inArea=([y,x])=>iwakiArea.reduce((b,[y1,x1],i)=>{const [y2,x2]=iwakiArea[(i+1)%iwakiArea.length];return ((y1>y)!==(y2>y))&&x<(x2-x1)*(y-y1)/(y2-y1)+x1?!b:b;},false);
 const oldPts=new Set([...pa.slice(AI+1),...way(897526309).geometry.map(p=>[p.lat,p.lon])].map(p=>p.join(',')));
 if([...head,...route].some(p=>inArea(p)||oldPts.has(p.join(','))))throw Error('相馬双葉幹線：旧ルートの点か南いわき開閉所の区画を含む');
 lines.push({id:'tie-500-相馬双葉幹線',assetId:'tie-500-相馬双葉幹線',name:'相馬双葉幹線',named:true,voltageKV:500,currentType:'ac',osmIds:[199522664,-9500001],paths:[head,route],tracedParts:[{osmId:-9500001,basis:'Google マップ航空写真の鉄塔'}],
  connections:[{node:a.nodes[0],position:pa[0],status:'facility-area',facilities:[{id:minami.id,name:minami.name}],neighborWays:[]},{node:null,position:B,status:'shared-node',facilities:[],neighborWays:[]}],
  referenceReview:{status:'section',endpoints:'南相馬変電所―福島幹線山線 No.10（分岐点）'},
  attributes:[{label:'要注意（C区分）',value:'区間（相馬双葉幹線 No.54〜東京PG 福島幹線山線 No.10）は一次資料で確認したが、分岐点・接続点・鉄塔の位置は地図データと航空写真から推定した参考表示。'},{label:'照合区分',value:'C区分'},
   {label:'設備の位置付け',value:'地域間連系線：東北東京間連系線（東北―東京）。2026-06-30 から南いわき開閉所ではなく、東京PG 福島幹線山線（地図の「福島山幹線」、OCCTO の「福島幹線(山)」）の No.10 に接続。潮流はOCCTO連系線潮流実績（30分平均）。'},
   {label:'分岐点の推定',value:'福島幹線山線 No.10 への接続点は、福島幹線（OSM way 104392606）の新福島側から10番目の点と推定（オーナー指定の座標から約'+Math.round(dmS(B,OWNER_B))+'m）。相馬双葉幹線 No.54 は OSM の線の49番目の点と推定（指定の座標から約'+Math.round(dmS(A,OWNER_A))+'m）。No.10 での接続の形（引込か分岐か）は未確認。'},
   {label:'地理参照',value:`南相馬変電所〜No.54 は OSM way 199522664 の一部（約${len(head).toFixed(1)}km、線名なし、事業者 東北電力）。No.54〜No.10 は約${newKm.toFixed(1)}km（資料は15.3km／34基）。`},
   {label:'経路の根拠',value:`No.54〜No.10 は、Google マップの航空写真（ズーム17）から 2026-11-05 に読み取った鉄塔${TOWERS.length}基の位置を結んだ線（誤差 数十m）。2026-11-05 オーナーの今回だけの許可（座標の公開を含む）。国土地理院の送電線記号には新ルートがなく、空中写真は工事前で鉄塔を確かめられない。`},
   {label:'変更の経緯',value:'使用開始 2026-06-30、工事開始 2022-06-01（東北電力NW プレスリリース 2026-07-01 作成「相馬双葉幹線の新ルートへの接続変更および使用開始について」、2026-11-04 確認）。旧ルート No.54〜南いわき開閉所（約'+len(pa.slice(AI)).toFixed(1)+'km）は地図から外した（2026-11-05 オーナー回答。旧 No.56 は丸森いわき幹線との接続個所）。'},
   {label:'出典',value:`東北電力NW プレスリリース 2026-07-01 https://nw.tohoku-epco.co.jp/news/pdf/__icsFiles/afieldfile/2026/07/01/2607010001.pdf 、同NW「相馬双葉幹線接続変更に係る本格工事が開始！」（ページに日付なし）https://nw.tohoku-epco.co.jp/bridge/generalarticle/2022/posts0629b.html 。地理はOSM（${JSON.parse(fs.readFileSync('data/raw/north-ties/souma.json','utf8')).osm3s.timestamp_osm_base.slice(0,10)}時点 data/raw/north-ties/souma.json）と Google マップ航空写真（鉄塔の位置の読み取り、2026-11-05）。`}]});}
// OCCTO潮流の対応（2026-10-03「OCCTOの潮流データがあるもので反映できていないもの」）
// flowNames：OCCTOの1行が地図の複数区間にまたがる（北千葉線＝No.36＋No.143、港北線＝No.92＋No.144）。河北線・中沢線（2ルートの合計）は src/tokyo-domain.ts で2本に分けて表示
// flowTaps：線の途中にある変電所（OCCTOの区間の端）。江東線の葛南、鹿島線の筑波南はOSMで線の経路上（15m・77m）にある
{const FLOW_NAMES={'tokyo-section-36':['北千葉線'],'tokyo-section-143':['北千葉線'],'tokyo-section-92':['港北線'],'tokyo-section-144':['港北線']};
 const TAPS={'江東線':{name:'葛南変電所',position:[35.665877171428576,139.90767052857143]},'鹿島線':{name:'筑波南変電所',position:[35.9731,140.24985],osm:'way/211356757'}};
 const dm=(a,b)=>Math.hypot((a[0]-b[0])*111000,(a[1]-b[1])*91000);
 for(const l of lines){if(FLOW_NAMES[l.id])l.flowNames=FLOW_NAMES[l.id];const t=TAPS[l.name];if(t&&l.voltageKV===275){const pt=l.paths.flat().reduce((m,q)=>dm(q,t.position)<dm(m,t.position)?q:m);
  l.flowTaps=[{name:t.name,position:pt}];l.attributes=[...l.attributes.filter(a=>a.label!=='途中の変電所'),{label:'途中の変電所',value:`${t.name}（${t.osm?'OSMの設備区画 '+t.osm:'既存の設備'}）が経路上にある（約${Math.round(dm(pt,t.position))}m）。OCCTOの区間（${l.name==='江東線'?'新京葉→葛南':'鹿島→筑波南'}）はこの点までとして潮流を表示。`}];}}}
// 設備の重複の解消（2026-10-03 指摘4a）：中津川第一はOSMの way 1135976065「中津川第一発電所」と relation 15402384「中津川第一水力発電所」が32m差で別々に入っていた（どちらも接続線なし）。
// 東京電力の名称に近い way を残し、relation を除く（tests/baseline/approved-removals.json に記録）
{const i=facilities.findIndex(f=>f.id==='osm-relation-15402384');if(i>=0&&facilities.some(f=>f.id==='osm-way-1135976065')&&!lines.some(l=>l.connections?.some(c=>c.facilities.some(x=>x.id==='osm-relation-15402384'))))facilities.splice(i,1);}
// 運用状態・建設中の線（2026-10-03 オーナー指示「状態の追加」「建設中・計画中の線を描画」）
{const raw=JSON.parse(fs.readFileSync('data/raw/tokyo-higashishimizu/lines.json','utf8')).elements,nodes=new Map(raw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 // 東清水線【建設中】：OSMは同じ経路に2本（12条・6条）。12条の way 1484888279 を経路に使う。南端＝東清水変電所、北端＝佐久間東幹線との接続点（設備なし）
 const w=raw.find(e=>e.type==='way'&&e.id===1484888279),pts=w.nodes.map(n=>nodes.get(n));if(pts.some(p=>!p))throw Error('東清水線 nodes');
 const hs=facilities.find(f=>f.name==='東清水変電所');if(!hs)throw Error('東清水変電所');
 const south=pts[0][0]<pts.at(-1)[0]?0:pts.length-1,path=south===0?pts:[...pts].reverse(),ids=south===0?w.nodes:[...w.nodes].reverse();
 const km=path.slice(1).reduce((t,x,i)=>t+Math.hypot((x[0]-path[i][0])*111,(x[1]-path[i][1])*91),0);
 const plan=plans.find(p=>p.id==='tokyo-plan-higashishimizu-2026');const src=plan?.revisions?.at(-1)?.source;
 lines.push({id:'tokyo-plan-東清水線',assetId:'tokyo-plan-東清水線',name:'東清水線',named:true,voltageKV:275,currentType:'ac',osmIds:[1484888279],paths:[path],
  status:'建設中',plannedStart:'2027年1月',statusSource:`${src?.name??'東京PG 主要送電線路の整備計画（2026年度供給計画）'}：東清水変換所～佐久間東幹線、275kV、新設12.4km・既設6.4km、工事中、2027年1月使用開始予定（${src?.url??'https://www.tepco.co.jp/pg/consignment/system/pdf/20250526_setubikeikaku-j500-275.pdf'}）。`,
  connections:[{node:ids[0],position:path[0],status:'facility-area',facilities:[{id:hs.id,name:hs.name}],neighborWays:[]},{node:ids.at(-1),position:path.at(-1),status:'shared-node',facilities:[],neighborWays:[]}],
  referenceReview:{status:'section',endpoints:'東清水変電所―佐久間東幹線（接続点）'},
  attributes:[{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},
   {label:'設備の位置付け',value:'建設中の送電線（東清水周波数変換所の東京側を275kV化）。使用開始まで潮流なし。完成後は東清水FCの東京側154kV接続（富士川線）と置き換わる見込み。'},
   {label:'地理参照',value:`OSMの「東清水線【建設中】」（way 1484888279、約${km.toFixed(1)}km、12条）。同じ経路に6条の線分（way 1484893807）も登録。北端は佐久間東幹線との接続点とみなした（設備なし）。`},
   {label:'出典',value:`${src?.name??'東京PG 主要送電線路の整備計画（2026年度供給計画）'}（${src?.publishedAt??'2026-03-31'}公表、${src?.checkedAt??'2026-09-27'}確認）。地理はOSM（data/raw/tokyo-higashishimizu/lines.json）。`}]});
 if(plan)plan.targets=plan.targets.map(t=>t.name==='東清水線'?{...t,assetIds:['tokyo-plan-東清水線'],mapping:'OSMの建設中の経路に対応（地図に建設中として表示）'}:t);
 // （新）佐久間東幹線【建設中】：OSMにあるが電圧未登録・一次資料未確認のため線は描かない。系統変更予定に「一次資料確認待ち」で登録（2026-10-03オーナー判断）
 if(!plans.some(p=>p.id==='tokyo-plan-shin-sakuma-higashi'))plans.push({id:'tokyo-plan-shin-sakuma-higashi',regions:['tokyo','chubu'],targets:[{name:'（新）佐久間東幹線',assetIds:[],mapping:'未対応（一次資料確認待ち）'}],changeType:'送電設備の新設・引替（一次資料確認待ち）',
  latestProgressReview:{checkedAt:'2026-10-03',note:'東京PG「主要送電線路の整備計画」（500・275kV、2026年度供給計画）に該当行なし。東京中部間連系設備の増強（佐久間側）として別資料での確認待ち。'},
  revisions:[{recordedAt:'2026-10-03',before:'佐久間東幹線（山線）1L（OSM「増強後廃線」）',after:'（新）佐久間東幹線（OSM「建設中」、電圧未登録）',status:'一次資料確認待ち',statusOriginal:'OSMのみ',timing:[],source:{name:'OpenStreetMap（（新）佐久間東幹線【建設中】、data/raw/tokyo-500-support/fc-lines.json）',url:'https://www.openstreetmap.org/',publishedAt:null,checkedAt:'2026-10-03'}}]});}
// （新）佐久間東幹線・新佐久間周波数変換所：J-POWER送変電の2026年度供給計画で工事中・使用開始時期を確認（2026-10-04）。線は従来どおり描かない（OSMの電圧未登録）
{const p=plans.find(x=>x.id==='tokyo-plan-shin-sakuma-higashi');
 if(p&&!p.revisions.some(r=>r.recordedAt==='2026-10-04')){p.changeType='送電設備の引替・周波数変換所の新設';p.latestProgressReview={checkedAt:'2026-10-04',note:'J-POWER送変電「2026年度供給計画の概要」（2026-02-27公表）に工事中として掲載。'};
  p.targets=[{name:'佐久間東幹線（佐久間東幹線No.6～新富士変電所、124km）',assetIds:[],mapping:'未対応（新しい経路はOSMで電圧未登録）'},{name:'新佐久間周波数変換所（300MW）',assetIds:[],mapping:'未対応（設備の位置は未確認）'}];
  p.revisions.push({recordedAt:'2026-10-04',before:'佐久間東幹線（山線）・佐久間周波数変換所（300MW）',after:'佐久間東幹線 No.6～東京電力パワーグリッド新富士変電所 275kV 124km（引替）、新佐久間周波数変換所 300MW、佐久間東幹線FC分岐線 3km',status:'工事中',statusOriginal:'工事中',
   timing:[{raw:'2028-3',label:'佐久間東幹線 使用開始',year:2028,month:3,precision:'month'},{raw:'2027-8',label:'東清水線分岐鉄塔No.144～新富士変電所 先行運開',year:2027,month:8,precision:'month'},{raw:'2028-12',label:'新佐久間周波数変換所 使用開始',year:2028,month:12,precision:'month'}],
   source:{name:'J-POWER送変電「2026年度供給計画の概要」',url:'https://www.jpower.co.jp/tn/news/pdf/oshirase260227-2.pdf',publishedAt:'2026-02-27',checkedAt:'2026-10-04'},reason:'一次資料（事業者の供給計画）で工事中・使用開始予定を確認。予定だけで現行系統へ反映しない。'});}}
// 東清水FCの東京側154kV（富士川線・田代幹線）：対象電圧の例外と、Wikipediaだけが根拠である旨（2026-10-03「対象電圧」「出典」）
{const l=lines.find(x=>x.id==='tokyo-fc-higashishimizu-154');if(!l)throw Error('tokyo-fc-higashishimizu-154');
 l.attributes=l.attributes.filter(a=>a.label!=='対象電圧の例外');
 const i=l.attributes.findIndex(a=>a.label==='照合区分');l.attributes.splice(i+1,0,{label:'対象電圧の例外',value:'FC交流側接続の例外：基幹系統（500・275kV）の対象外の154kVだが、東清水周波数変換所の東京側（50Hz側）の現行接続として表示する。'});
 const src=l.attributes.find(a=>a.label==='出典');if(src&&!src.value.includes('一次資料未確認'))src.value+='　※154kVの富士川線で東京側へ接続することはWikipediaのみが根拠（一次資料未確認）。一次資料で確認できたら差し替える。';
 if(!l.attributes.some(a=>a.label.startsWith('要注意')))l.attributes.unshift({label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'});}
// 五井火力発電所と五井火力線（2026-10-17 オーナー承認）：OSMの区画（way 605327351）は construction:power=plant（建設中）のままで、
// 発電所の取り込み（power=plant）から漏れていた。運転状態は一次資料（五井ユナイテッドジェネレーション）による。OSMの出力0MW・建設中のタグは使わない。
// 五井火力線は房総変電所―五井火力発電所。2026-10-17 オーナー承認で東京PG 公表区間 No.29（房総→匿名《1002070》）に対応させた（C区分＋推測）。
// OCCTO の実績に No.29 の行はなく、東京PGの容量表にも行がないので、潮流・容量は付かない（tsoSection は null のまま）
{const goi=read('data/raw/tokyo-275/goi-2026-10-17.json').elements.find(e=>e.type==='way'&&e.id===605327351);
 if(!goi||goi.tags?.name!=='五井火力発電所'||goi.tags?.['construction:power']!=='plant'||goi.tags?.power)throw Error('五井火力発電所：OSMの区画のタグ・名前が変わった（取り込みを見直す）');
 const ring=goi.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 if(!inside(pos,ring))throw Error('五井火力発電所：代表点が区画の外');if(facilities.some(f=>f.id==='osm-way-605327351'||f.name==='五井火力発電所'))throw Error('五井火力発電所：重複');
 const SITE='五井ユナイテッドジェネレーション合同会社（https://www.goi-united.com/ 、2026-10-16確認）';
 const plant={id:'osm-way-605327351',assetId:'tokyo-fac-plant-605327351',name:'五井火力発電所',kind:'plant',position:pos,voltages:[],scopeConnected:true,url:'https://www.openstreetmap.org/way/605327351',
  status:'運用中',statusConfirmed:true,statusSource:`${SITE}：新1号機 2024-08-01、新2号機 2024-11-14、新3号機 2025-03-01 に営業運転開始。`,
  attributes:[{label:'事業者',value:'株式会社JERA（HJKSの発電事業者。新1〜3号機、2026-10-09取得のユニット一覧）'},
   {label:'事業者の資料との差',value:'発電所のサイト（https://www.goi-united.com/ 、2026-10-16確認）では、事業は五井ユナイテッドジェネレーション合同会社が引き継いだとしている。HJKSの発電事業者（株式会社JERA）を主にした（docs/RULES.md 3節）。'},
   {label:'OSM登録',value:'OSMの区画（way 605327351）は「建設中」（construction:power=plant）・出力0MW・2023年運転開始予定の注記のままで、更新されていない。運転状態は一次資料による。出力は送電容量として扱わない。'},
   {label:'代表点の取り方',value:'OSMの区画の頂点の平均（区画の内側にあることを確認）。'},
   {label:'別の発電所との区別',value:'南の五井南海岸にある株式会社ベイサイドエナジー 市原発電所（OSM way 1444382011）とは別の発電所（事業者・所在地が違う）。'}]};
 facilities.push(plant);
 const raw=read('data/raw/tokyo-275/held-cables.json').elements,np=new Map(raw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const W=id=>{const w=raw.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('五井火力線 way '+id);return w;};
 const a=W(168782022),b=W(1247083092);if(a.nodes[0]!==1799967479||a.nodes.at(-1)!==1799966664||b.nodes[0]!==1799966664||b.nodes.at(-1)!==1799966645)throw Error('五井火力線：線分のつなぎ目・端が変わった');
 if(a.tags?.name!=='五井火力線／北五井火力線（休止中）'||a.tags?.voltage||b.tags?.voltage!=='275000')throw Error('五井火力線：OSMのタグが変わった（注記を見直す）');
 const boso=facilities.find(f=>f.id==='osm-way-151379730');const bosoRaw=read('data/raw/tokyo-275/substations.json').elements.find(e=>e.type==='way'&&e.id===151379730);
 if(!boso||!bosoRaw)throw Error('五井火力線：房総変電所がない');
 const p1=[...b.nodes].reverse().map(n=>np.get(n)),p2=[...a.nodes].reverse().map(n=>np.get(n));if([...p1,...p2].some(x=>!x))throw Error('五井火力線：点が足りない');
 if(!inside(p1[0],bosoRaw.geometry.map(q=>[q.lat,q.lon])))throw Error('五井火力線：東の端が房総変電所の区画の外');if(!inside(p2.at(-1),ring))throw Error('五井火力線：西の端が五井火力発電所の区画の外');
 const dm=(x,y)=>Math.hypot((x[0]-y[0])*110540,(x[1]-y[1])*111320*Math.cos(x[0]*Math.PI/180)),km=[p1,p2].reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+dm(p[i],q),0),0)/1000;
 lines.push({id:'tokyo-feeder-275-168782022',assetId:'tokyo-feeder-275-168782022',name:'五井火力線',named:true,voltageKV:275,currentType:'ac',osmIds:[1247083092,168782022],sourceOsmIds:[1247083092,168782022],paths:[p1,p2],tsoSection:null,
  referenceReview:{status:'section',endpoints:'房総変電所―五井火力発電所'},
  connections:[{node:1799966645,position:p1[0],status:'facility-area',facilities:[{id:boso.id,name:boso.name}],neighborWays:[]},{node:1799967479,position:p2.at(-1),status:'facility-area',facilities:[{id:plant.id,name:plant.name}],neighborWays:[]}],
  attributes:[{label:'照合区分',value:'C区分'},{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},
   {label:'公表区間',value:'東京PG 基幹275kV No.29：端点匿名（2回線）'},
   {label:'区分',value:'発電所の電源線（線名はOSMの名前）。No.29 への対応は推測。OCCTO に No.29 の行がないので、潮流・容量は表示しない。'},
   {label:'地理参照',value:`OSM 2線分（way 1247083092 と 168782022、計約${km.toFixed(1)}km、2回線）。東の端は房総変電所の区画の内側、西の端は五井火力発電所の区画（OSM way 605327351）の内側。同じ鉄塔に北五井火力線（154kV、末端は休止中、way 1133622352）が並ぶが、この線には含めない。個別回線・母線は未確認。`},
   {label:'公表区間との対応',value:'系統構成図(29)の「房総→《1002070》」を、OSMの五井火力線（房総変電所―五井火力発電所）に対応付けたのは推定。根拠は、両端（房総・発電所）、2回線、OSMの線名の3点。匿名の《1002070》が五井火力発電所だと示す一次資料はない。'},
   {label:'電圧の根拠',value:'275kV のタグは房総側の way 1247083092 だけにある。way 168782022 には電圧のタグがなく、同じ275kVとしたのは推定。'},
   {label:'状態について',value:'OSMの名前「五井火力線／北五井火力線（休止中）」は北五井火力線との共架の表記で、「休止中」が五井火力線にもかかるかは未確認（状態の値は付けない）。'},
   {label:'出典',value:'公表区間は東京PG系統構成・設備一覧2026-06-22版（基幹275kV）と系統構成図（2025-12-01）。地理はOSM（data/raw/tokyo-275/held-cables.json 2026-09-29取得、発電所の区画は goi-2026-10-17.json 2026-10-17取得）。発電所の運転は '+SITE+'。'}]});}
// 常総変電所と、鹿島線から常総変電所への線（2026-10-17 オーナー承認。表示名は「常総変電所への線（鹿島線の分岐）」：東京PGは分岐を名指ししていないため説明の名前にし、No.45 と同名にしない）：送電線チェックの欠落（OSM「鹿島線 / 取手線」way 340659460）から。
// 東京PGの系統構成図（予想潮流の資料4ページ、資料作成日 2026-06-22）で、常総は鹿島線（45）上の275kV/66kV変電所。分岐（T）か引き込み（π）かは図から読めないので、
// OSMの経路のとおり No.45 の途中の共有点（node 3479085769、way 1077611345 の途中の点）から分かれる線として描き、分かれ目に推測を付ける。66kV の取手線（共架）は対象外の電圧で描かない
{const sub=read('data/raw/tokyo-275/substations.json'),w=sub.elements.find(e=>e.type==='way'&&e.id===340365829);
 if(!w||w.tags?.name!=='常総変電所'||w.tags?.power!=='substation'||w.tags?.voltage!=='275000;66000')throw Error('常総変電所：OSMの区画のタグ・名前が変わった');
 const ring=w.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 if(!inside(pos,ring))throw Error('常総変電所：代表点が区画の外');if(facilities.some(f=>f.id==='osm-way-340365829'||f.name==='常総変電所'))throw Error('常総変電所：重複');
 const MAP='東京PG「系統構成 500kV,275kV系統」（予想潮流の資料 https://www.tepco.co.jp/pg/consignment/system/pdf/kikan_yosochoryu.pdf の4ページ、資料作成日 2026-06-22、確認日 2026-10-17。原本は保存しない）';
 const osmAt=sub.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt)throw Error('常総：OSMの取得時点が原本にない');
 const joso={id:'osm-way-340365829',assetId:'tokyo-fac-substation-340365829',name:'常総変電所',kind:'substation',position:pos,voltages:[275],scopeConnected:true,url:'https://www.openstreetmap.org/way/340365829',
  attributes:[{label:'運営者',value:'東京電力パワーグリッド'},{label:'公表設備対応',value:`${MAP}に、鹿島線（45）上の275kV/66kV変電所として「常総」が描かれている。設備一覧に常総の行はない。`},
   {label:'OSM登録',value:`OSMの区画（way 340365829、power=substation、275kV;66kV、事業者 東京電力パワーグリッド、${osmAt}時点）。`},{label:'代表点の取り方',value:'OSMの区画の頂点の平均（区画の内側にあることを確認）。'}]};
 facilities.push(joso);
 const raw=read('data/raw/tokyo-275/held-cables.json'),els=raw.elements,np=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const W=(id,from,to)=>{const x=els.find(e=>e.type==='way'&&e.id===id);if(!x||x.nodes[0]!==from||x.nodes.at(-1)!==to)throw Error('常総への線 way '+id+' が変わった');const p=x.nodes.map(n=>np.get(n));if(p.some(q=>!q))throw Error('常総への線 nodes '+id);return p;};
 const a=W(195981776,3479085769,2063529233),b=W(340659460,2063529233,2063529452),route=[...a,...b.slice(1)];
 const l45=lines.find(x=>x.id==='tokyo-section-45');if(!l45||!l45.osmIds.includes(1077611345)||!l45.paths.some(p=>p.slice(1,-1).some(q=>q[0]===route[0][0]&&q[1]===route[0][1])))throw Error('常総への線：分かれ目が No.45 の経路の途中の点でない');
 const dm=(x,y)=>Math.hypot((x[0]-y[0])*110540,(x[1]-y[1])*111320*Math.cos(x[0]*Math.PI/180)),km=route.slice(1).reduce((t,q,i)=>t+dm(route[i],q),0)/1000;
 const seg=(p,a,b)=>{const k=Math.cos(p[0]*Math.PI/180),ax=(a[1]-p[1])*111320*k,ay=(a[0]-p[0])*110540,bx=(b[1]-p[1])*111320*k,by=(b[0]-p[0])*110540,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/((dx*dx+dy*dy)||1)));return Math.hypot(ax+t*dx,ay+t*dy);};
 const endIn=inside(route.at(-1),ring),gap=Math.round(Math.min(...ring.slice(1).map((q,i)=>seg(route.at(-1),ring[i],q))));
 lines.push({id:'tokyo-feeder-275-340659460',assetId:'tokyo-feeder-275-340659460',name:'常総変電所への線（鹿島線の分岐）',named:false,voltageKV:275,currentType:'ac',osmIds:[340659460],sourceOsmIds:[195981776,340659460],paths:[route],tsoSection:null,
  referenceReview:{status:'section',endpoints:'鹿島線（分岐点）―常総変電所'},
  connections:[{node:3479085769,position:route[0],status:'shared-node',facilities:[],neighborWays:[1077611345]},{node:2063529452,position:route.at(-1),status:'facility-area',facilities:[{id:joso.id,name:joso.name}],neighborWays:[]}],
  attributes:[{label:'照合区分',value:'C区分'},{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},
   {label:'公表区間',value:'東京PG 基幹275kV No.45 鹿島線（新野田―鹿島、2回線）の途中の常総変電所への線。設備一覧に常総の行はない。'},
   {label:'分岐点の推定',value:`一次資料で言えること：${MAP}で、常総は鹿島線（45）上の275kV/66kV変電所。OSMだけが根拠のもの：分かれ目の位置（No.45 の線分 way 1077611345 の途中の共有点 node 3479085769）と経路。未確認のこと：常総が鹿島線に分岐（T）でつながるのか、引き込み（π）なのか。ここでは分岐とみなした（推定）。`},
   {label:'区分',value:'鹿島線（No.45、東京PGの設備一覧では新野田→鹿島）の途中から常総変電所へ分かれる線。OCCTO の鹿島線の行は鹿島→筑波南の区間で、常総への分かれ目はその外（新野田側）にあるため、この行は分岐を含む行にならない。この線には潮流を割り当てない。'},
   {label:'地理参照',value:`OSM 2線分（計約${km.toFixed(1)}km）：way 195981776「鹿島線」（ref 45、2回線）と way 340659460「鹿島線 / 取手線」（ref 45、275kV;66kV、OSMの回線数は4）。275kV 分の回線数は未確認。66kV の取手線（同じ鉄塔）は対象外の電圧のため描かない。北西の端は${endIn?'常総変電所の区画の内側':`常総変電所の区画の外（区画の辺から約${gap}m）`}。`},
   {label:'出典',value:`${MAP}。地理はOSM（data/raw/tokyo-275/held-cables.json ${raw.osm3s?.timestamp_osm_base?.slice(0,10)??''}時点、常総変電所の区画は substations.json ${osmAt}時点）。`}]});}
// 筑波南変電所（2026-10-17 オーナー承認）：東京PGの系統構成図（2026-06-22）で鹿島線（45）上の275kV/66kV変電所、OCCTO の鹿島線の行（鹿島→筑波南）の端。
// OSMでは No.45 の線分 way 340659466 が区画の中を通る。区画の中の点のうち鹿島側から入る点（node 7031897655）を No.45 の途中の接続にする（connections は経路の順：新野田・筑波南・鹿島）。
// 潮流の区切り（flowTaps）はこの点で、以前の手書きの座標と同じ位置。区画の中の名前のない短い線分2本（way 1153124546・1153129472）は描かない
{const sub=read('data/raw/tokyo-275/substations.json'),w=sub.elements.find(e=>e.type==='way'&&e.id===211356757);
 if(!w||w.tags?.name!=='筑波南変電所'||w.tags?.power!=='substation'||w.tags?.voltage!=='275000;66000')throw Error('筑波南変電所：OSMの区画のタグ・名前が変わった');
 const ring=w.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 if(!inside(pos,ring))throw Error('筑波南変電所：代表点が区画の外');if(facilities.some(f=>f.id==='osm-way-211356757'||f.name==='筑波南変電所'))throw Error('筑波南変電所：重複');
 const MAP='東京PG「系統構成 500kV,275kV系統」（予想潮流の資料 https://www.tepco.co.jp/pg/consignment/system/pdf/kikan_yosochoryu.pdf の4ページ、資料作成日 2026-06-22、確認日 2026-10-17。原本は保存しない）';
 const osmAt=sub.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt)throw Error('筑波南：OSMの取得時点が原本にない');
 const tsukuba={id:'osm-way-211356757',assetId:'tokyo-fac-substation-211356757',name:'筑波南変電所',kind:'substation',position:pos,voltages:[275],scopeConnected:true,url:'https://www.openstreetmap.org/way/211356757',
  attributes:[{label:'運営者',value:'東京電力パワーグリッド'},{label:'公表設備対応',value:`${MAP}に、鹿島線（45）上の275kV/66kV変電所として「筑波南」が描かれている。OCCTO 系統情報サービス（東京）の実績の鹿島線の行（鹿島→筑波南）の端（2026-10-17の取得分で確認）。設備一覧に筑波南の行はない。`},
   {label:'OSM登録',value:`OSMの区画（way 211356757、power=substation、275kV;66kV、事業者 東京電力パワーグリッド、${osmAt}時点）。`},{label:'代表点の取り方',value:'OSMの区画の頂点の平均（区画の内側にあることを確認）。'}]};
 facilities.push(tsukuba);
 const l=lines.find(x=>x.id==='tokyo-section-45');if(!l||l.connections.length!==2||l.osmIds[2]!==340659466)throw Error('筑波南：No.45 の形が想定と違う');
 const raw=read('data/raw/tokyo-275/lines-north1.json').elements,np=new Map(raw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]])),pt=np.get(7031897655);
 const way=raw.find(e=>e.type==='way'&&e.id===340659466);if(!pt||!way?.nodes.includes(7031897655)||!inside(pt,ring))throw Error('筑波南：区画の中の点が変わった');
 if(!l.paths[2].some(q=>q[0]===pt[0]&&q[1]===pt[1]))throw Error('筑波南：点が No.45 の経路にない');
 l.connections=[l.connections[0],{node:7031897655,position:pt,status:'facility-area',facilities:[{id:tsukuba.id,name:tsukuba.name}],neighborWays:[]},l.connections[1]];
 l.referenceReview={...l.referenceReview,endpoints:'新野田変電所―筑波南変電所（途中）―鹿島変電所'};
 l.flowTaps=[{name:tsukuba.name,position:pt}];
 const set=(label,value)=>{const i=l.attributes.findIndex(a=>a.label===label);if(i<0)throw Error('筑波南：No.45 の属性がない '+label);l.attributes[i]={label,value};};
 const geo=l.attributes.find(a=>a.label==='地理参照').value,old='経路の途中で他の設備区画（筑波南変電所）を通過。途中の設備との電気的接続は推定しない。';if(!geo.includes(old))throw Error('筑波南：No.45 の地理参照の文が変わった');
 set('地理参照',geo.replace(old,'経路の途中で筑波南変電所の区画の中を通る（東京PGの系統構成図で筑波南は鹿島線上の変電所。引き込みか分岐かは一次資料で未確認）。'));
 set('途中の変電所',`筑波南変電所（OSMの設備区画 way/211356757）の区画の中を通る。OCCTOの区間（鹿島→筑波南）は区画の中の点（OSM node 7031897655）までとして潮流を表示。`);}
// 電源開発の設備（scripts/jpower.mjs、2026-10-04）
{const {mergeJpower,annotateJpower}=await import('./jpower.mjs');mergeJpower('tokyo',lines,facilities);annotateJpower('tokyo',lines,facilities);}
// 田子倉線（推定）の端の食い違いの記録（2026-11-16 保留123b）：東京PG 設備一覧 No.56 は「発電所→発電所」だが、地図の端は OSM の本名変電所（東北電力）。
// 国土地理院の地図注記「本名発電所」は本名変電所の区画から約0.8km 離れていて、同じ設備とは確かめられない。端は変えず、食い違いを注記に残す
{const l=lines.find(x=>x.id==='ledger-infer-tokyo-275-233038415');if(l?.name!=='田子倉線（推定）')throw Error('田子倉線：元の線が想定と違う');
 l.attributes=[...(l.attributes??[]).filter(a=>a.label!=='端点の食い違い'),{label:'端点の食い違い',value:'東京電力パワーグリッド 設備一覧 No.56 の端点は「発電所→発電所」。地図の端は OSM の本名変電所（OSM のタグの運営者：東北電力）で、国土地理院の地図注記「本名発電所」（2026-11-16取得）は区画から約0.8km 離れている。もう一方の発電所がどれかは未確認（2026-11-16）。'}];}
// 奥只見線 No.57（2026-10-10 オーナー判断）：東京PGの送電線インピーダンス表は「東群馬変電所―発電所1002039」（発電所名は非公表）。オーナー判断で奥只見発電所とする。
// OSMの終点（way 316420981 の端）は奥只見発電所の区画内（代表点から約30m）。発電所側の約0.6kmを重ねて描いていた電源開発の線 jpower-275-way-232998815 は除く（tests/baseline/approved-removals.json）
{const l=lines.find(x=>x.id==='tokyo-section-57'),okuF=facilities.find(f=>f.id==='osm-way-232998815');if(!l||!okuF)throw Error('奥只見線');
 const c=l.connections.at(-1);if(c.status!=='unresolved')throw Error('奥只見線 end is not unresolved');
 l.connections[l.connections.length-1]={...c,status:'facility-area',facilities:[{id:okuF.id,name:okuF.name}]};
 l.name='奥只見線';l.referenceReview={status:'section',endpoints:'東群馬変電所―奥只見発電所'};
 const geo=l.attributes.find(a=>a.label==='地理参照');if(geo)geo.value=geo.value.replace(/終点側の同名線がOSMで途切れており、起点から同名線でたどれる範囲だけを描いた部分表示。/,'終点はOSMの奥只見発電所の区画内（way 316420981 の端、発電所の代表点から約30m）。');
 l.attributes.push({label:'終点の判断',value:'東京PGの送電線インピーダンス表は奥只見線1L・2Lを「東群馬変電所―発電所1002039」とし、発電所名を公表しない（予想潮流の表も「東群馬→発電所」）。発電所1002039を奥只見発電所とするのはオーナー判断（2026-10-10）。根拠は線名・OSMの経路（終点が奥只見発電所の区画内、OSMの線名「奥只見線」）・田子倉線（発電所1002039―1002040―1002036）とのつながり。一次資料での確認は未了。'});
 const i=lines.findIndex(x=>x.id==='jpower-275-way-232998815');if(i>=0)lines.splice(i,1);}
// 中東京幹線 No.55（2026-10-10 オーナー指示「中東京幹線がないので反映して」）：東京PGの予想潮流の表は「玉原線分岐→発電所」、送電線インピーダンス表は中東京幹線(山)「発電所1002036―信濃川変電所」。
// OSMは線名なし（事業者 東京電力、275kV・2回線）の2線分：田子倉発電所の区画から小千谷付近の分岐（JR東日本の線「…ーTEPCO中東京線」の接続点、node 3255133963）を経て信濃川へ。補助取得 data/raw/nakatokyo-osm（tools/prep/fetch-osm-area.mjs）。
// 信濃川変電所はOSMに区画がないため、終点は線が集まる点（東京電力 信濃川発電所の区画の東約290m）で止める（unresolved）。C区分。
{const dir='data/raw/nakatokyo-osm',raw=['lines-275.json'].flatMap(f=>JSON.parse(fs.readFileSync(dir+'/'+f,'utf8')).elements),nodes=new Map(raw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const src=JSON.parse(fs.readFileSync(dir+'/source.json','utf8'));
 const way=id=>{const w=raw.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('中東京幹線 way '+id);return w;};
 const a=way(232998813),b=way(1030935555),JR=3255133963,SHINANO=3255130767;
 const orient=(w,first)=>w.nodes[0]===first?w.nodes:w.nodes.at(-1)===first?[...w.nodes].reverse():null;
 const na=orient(a,a.nodes.find(n=>n!==JR&&(n===a.nodes[0]||n===a.nodes.at(-1)))),nb=orient(b,JR);if(!na||na.at(-1)!==JR||!nb||nb.at(-1)!==SHINANO)throw Error('中東京幹線 ways not continuous');
 const pa=na.map(n=>nodes.get(n)),pb=nb.map(n=>nodes.get(n));if([...pa,...pb].some(p=>!p))throw Error('中東京幹線 nodes');
 const tago=facilities.find(f=>f.id==='osm-way-158064651');if(!tago)throw Error('田子倉発電所');
 const km=q=>q.slice(1).reduce((s,x,i)=>s+Math.hypot((x[0]-q[i][0])*110.54,(x[1]-q[i][1])*111.32*Math.cos(x[0]*Math.PI/180)),0);
 const dm=(p,q)=>Math.round(Math.hypot((p[0]-q[0])*110540,(p[1]-q[1])*111320*Math.cos(p[0]*Math.PI/180)));
 if(dm(pa[0],tago.position)>300)throw Error('中東京幹線 start is not at 田子倉発電所');
 lines.push({id:'ledger-tokyo-275-232998813',assetId:'ledger-tokyo-275-232998813',name:'中東京幹線',named:true,voltageKV:275,currentType:'ac',osmIds:[232998813,1030935555],paths:[pa,pb],
  connections:[{node:na[0],position:pa[0],status:'facility-area',facilities:[{id:tago.id,name:tago.name}],neighborWays:[]},{node:SHINANO,position:pb.at(-1),status:'unresolved',facilities:[],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'田子倉発電所―信濃川変電所（OSM未登録、線の集まる点で止める）'},
  attributes:[{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},
   {label:'公表の線名',value:'東京電力パワーグリッド 系統構成・予想潮流 基幹275kV No.55：中東京幹線（275kV、2回線、玉原線分岐→発電所）。送電線インピーダンス表では中東京幹線(山)1L・2L「発電所1002036―信濃川変電所」。'},
   {label:'区分',value:'各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。'},
   {label:'端点の判断',value:`起点の発電所1002036は田子倉発電所とみなした（推定）：田子倉線（発電所1002039―1002040―1002036）の端で、発電所1002039（奥只見線の端）は奥只見発電所とするオーナー判断（2026-10-10）。OSMの起点は田子倉発電所の区画（代表点から約${dm(pa[0],tago.position)}m）。終点の信濃川変電所はOSMに区画がなく、東京電力 信濃川発電所（OSM way 319098734）の区画の東約${dm(pb.at(-1),[37.0537909,138.6830422])}mで東京電力の275kVの線が集まる点（node ${SHINANO}）で止める。表の「玉原線分岐」との対応は未確認。`},
   {label:'地理参照',value:`OSM 2線分（計約${(km(pa)+km(pb)).toFixed(1)}km、線名なし、事業者 東京電力、275kV・2回線）。way 232998813（田子倉発電所→小千谷付近の分岐）と way 1030935555（分岐→信濃川）を共有ノード ${JR} で連結。この分岐点にJR東日本の線（way 319135059、OSM名「JR東日本小千谷第二発電所ーTEPCO中東京線」）がつながり、OSM上でこの線が中東京線（幹線）であることの補助資料になる。個別回線は未確認。`},
   {label:'出典',value:`東京電力パワーグリッド 系統構成・予想潮流（基幹275kV No.55、data/raw/tso-lines/tokyo）・送電線インピーダンス（data/raw/tokyo-sources）。地理はOSM（${src.retrievedAt?.slice?.(0,10)??'2026-10-10'}取得 data/raw/nakatokyo-osm）。`}]});
 // 中東京幹線(中)（2026-10-10 オーナー承認）：信濃川―群馬側の中東京幹線（ledger-tokyo-275-519125413）の間の約42km。インピーダンス表 No.66 の中東京幹線(中)1L「信濃川変電所―矢木沢開閉所」・2L「信濃川変電所―新榛名変電所」の信濃川側。
 // OSMは線名なしの275kVの3線分（way 319098733・169928474・519125416）。南端は群馬側の線の2番目の点（node 5061622671）を共有する。北端は信濃川（OSM未登録の変電所）の線の集まる点で止める（unresolved）
 {const ids=[319098733,169928474,519125416],START=3255112064,END=5061622671;let at=START;const parts=ids.map(id=>{const n=orient(way(id),at);if(!n)throw Error('中東京幹線(中) not continuous at '+id);at=n.at(-1);return n;});if(at!==END)throw Error('中東京幹線(中) end');
  const ps=parts.map(n=>n.map(x=>nodes.get(x)));if(ps.flat().some(p=>!p))throw Error('中東京幹線(中) nodes');
  const south=lines.find(l=>l.id==='ledger-tokyo-275-519125413');if(!south||!south.paths.flat().some(q=>q[0]===ps.at(-1).at(-1)[0]&&q[1]===ps.at(-1).at(-1)[1]))throw Error('中東京幹線(中) does not meet the Gunma section');
  lines.push({id:'ledger-tokyo-275-319098733',assetId:'ledger-tokyo-275-319098733',name:'中東京幹線',named:true,voltageKV:275,currentType:'ac',osmIds:ids,paths:ps,
   connections:[{node:START,position:ps[0][0],status:'unresolved',facilities:[],neighborWays:[]},{node:END,position:ps.at(-1).at(-1),status:'shared-node',facilities:[],neighborWays:[519125413]}],
   referenceReview:{status:'partial',endpoints:'信濃川変電所（OSM未登録、線の集まる点で止める）―中東京幹線（群馬側）との共有ノード'},
   attributes:[{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},
    {label:'公表の線名',value:'東京電力パワーグリッド 送電線インピーダンス 基幹275kV No.66：中東京幹線(中)1L「信濃川変電所―矢木沢開閉所」、中東京幹線(中)2L・玉原線2L「信濃川変電所―新榛名変電所」。系統構成・予想潮流の表では No.66 は「玉原線」の行。この線は信濃川側の区間。'},
    {label:'区分',value:'各社の系統空容量一覧に載る基幹送電線。OCCTOの地内実績に行がないため潮流なし。'},
    {label:'端点の判断',value:`北端の信濃川変電所（東京PGの新潟県の変電所の表に「信濃川 275/154kV」）はOSM・国土地理院の地図注記に区画・名称がなく、位置は一次資料で未確認。東京電力 信濃川発電所の区画の東で東京電力の275kVの線が集まる点（node ${START}、中東京幹線(山)の終点から約${dm(ps[0][0],pb.at(-1))}m）で止める。南端は群馬側の中東京幹線（way 519125413）の2番目の点を共有（OSMの共有ノード）。途中の分岐（node 1810855460）から新湯沢変電所方面へ275kVの線分が分かれる（描いていない）。`},
    {label:'地理参照',value:`OSM 3線分（計約${ps.reduce((s,p)=>s+km(p),0).toFixed(1)}km、線名なし、275kV）。way 319098733（事業者 東京電力、2回線）・169928474・519125416 を共有ノードで連結。個別回線は未確認。`},
    {label:'出典',value:`東京電力パワーグリッド 送電線インピーダンス（data/raw/tokyo-sources）、予想潮流 新潟県の変電所（data/raw/substation-banks/tokyo）。地理はOSM（${src.retrievedAt?.slice?.(0,10)??'2026-10-10'}取得 data/raw/nakatokyo-osm）。`}]});}
 // 八木沢線（2026-10-10 オーナー指示「八木沢線を追加して」）：OSMの「八木沢線」（way 518992990、東京電力、275kV・2回線）。南端は群馬側の中東京幹線の起点（node 5061622670）。
 // 信濃川→中東京幹線(中)→（群馬側の線の最初の約230m）→八木沢線→矢木沢 が、インピーダンス表の中東京幹線(中)1L「信濃川変電所―矢木沢開閉所」の経路に当たる。北端は矢木沢発電所（東京電力リニューアブルパワーの水力発電所一覧、OSMの点 node 1210028290、docs/research/plant-primary-sources.json で追加）まで約150mを直線で補っていた（2026-10-24 まで。ルート不明・破線、2026-10-10 オーナー指示「八木沢発電所も記載して」）。矢木沢開閉所は発電所の構内とみなす（推定）
 // 2026-10-24（オーナー承認、保留8）：北端の直線をやめ、鉄塔から国土地理院の送電線記号をなぞった点（下の定数、鉄塔→記号の端）と、記号の端から発電所の位置
 // （空中写真の建屋の中心。plant-primary-sources.json）までの構内の約22mでつなぐ。記号からは接続先を決めていない。照合は docs/NETWORK_COVERAGE.md「2026-10-24 の確認結果」
 {const START=5061618107,END=5061622670,n=orient(way(518992990),START);if(!n||n.at(-1)!==END)throw Error('八木沢線 ends');const p=n.map(x=>nodes.get(x));if(p.some(x=>!x))throw Error('八木沢線 nodes');
  const yagi=facilities.find(x=>x.id==='osm-node-1210028290');if(!yagi)throw Error('矢木沢発電所');
  const GSI_ROUTE=[[36.9101835,139.0557575],[36.9109127,139.0566695]];
  if(dm(p[0],[36.9101641,139.0557711])>2)throw Error('八木沢線：北端の鉄塔の位置が想定と違う');if(dm(GSI_ROUTE.at(-1),yagi.position)>30)throw Error('八木沢線：記号の端と発電所の位置が離れすぎ');
  const south=lines.find(l=>l.id==='ledger-tokyo-275-519125413');if(!south||south.paths[0][0][0]!==p.at(-1)[0]||south.paths[0][0][1]!==p.at(-1)[1])throw Error('八木沢線 does not meet the Gunma section start');
  const north=[yagi.position,...[...GSI_ROUTE].reverse()],gsiM=dm(p[0],GSI_ROUTE[0])+dm(GSI_ROUTE[0],GSI_ROUTE[1]),yardM=dm(GSI_ROUTE.at(-1),yagi.position);
  lines.push({id:'ledger-tokyo-275-518992990',assetId:'ledger-tokyo-275-518992990',name:'八木沢線',named:true,voltageKV:275,currentType:'ac',osmIds:[518992990],paths:[[...north,...p]],
   connections:[{node:START,position:yagi.position,status:'facility-area',facilities:[{id:yagi.id,name:yagi.name}],neighborWays:[]},{node:END,position:p.at(-1),status:'shared-node',facilities:[],neighborWays:[519125413]}],
   referenceReview:{status:'section',endpoints:'矢木沢発電所（北端は国土地理院の送電線記号）―中東京幹線（群馬側）との共有ノード'},
   attributes:[{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},
    {label:'公表の線名',value:'東京PGの系統構成・予想潮流・送電線インピーダンスの表に「八木沢線」の行はない（線名はOSM）。インピーダンス表 No.66 の中東京幹線(中)1L「信濃川変電所―矢木沢開閉所」の矢木沢側の区間とみられる（推定）。'},
    {label:'区分',value:'基幹送電線（275kV）。OCCTOの地内実績に行がないため潮流なし。'},
    {label:'端点の判断',value:`北端：OSMの線の末端の鉄塔（node ${START}）から先は、国土地理院の送電線記号をなぞって約${Math.round(gsiM)}m、記号の端から矢木沢発電所の位置（空中写真の建屋の中心）まで構内の約${Math.round(yardM)}m。北端の約${Math.round(gsiM)}mは国土地理院の送電線記号だけが根拠で、記号からは接続先を決めていない。インピーダンス表の端点「矢木沢開閉所」はOSM・国土地理院の地図注記に区画・名称がなく、建屋が発電所か開閉所かも確かめられていないため、矢木沢発電所の構内とみなした（推定）。南端は群馬側の中東京幹線（way 519125413）の起点と共有ノード。`},
    {label:'地理参照',value:`OSM 1線分（約${km(p).toFixed(1)}km、OSMの線名：八木沢線、事業者 東京電力、275kV・2回線）と、北端の国土地理院の送電線記号（約${Math.round(gsiM)}m）。個別回線は未確認。`},
    {label:'出典',value:`東京電力パワーグリッド 送電線インピーダンス（data/raw/tokyo-sources）。地理はOSM（${src.retrievedAt?.slice?.(0,10)??'2026-10-10'}取得 data/raw/nakatokyo-osm）、国土地理院 ベクトルタイル（試験公開、experimental_bvmap、送電線 ftCode 8202、2026-10-24取得）とシームレス空中写真（撮影年未確認、2026-10-24取得）を加工、国土地理院 地図注記（data/raw/gsi-anno）。`}]});}
 // 容量表（各社の系統空容量一覧）の行の対応を区間ごとに分ける（2026-10-10 オーナー指示）。tools/prep/build-line-capacity.mjs は tsoSection があれば線名より優先（null＝対応させない）
 // 2026-10-11 オーナー判断（案a）：予想潮流の表の No.55 中東京幹線「玉原線分岐→発電所」に合わせ、玉原線分岐から信濃川を経て田子倉発電所までを No.55 とする
 //   （中東京幹線(山)・(中)、群馬側の線の北側）。八木沢線（矢木沢への分かれ）と、玉原線分岐より南（需要家の変電所まで）は表に行がないので対応させない。
 //   インピーダンス表は (中) を No.66 としていて食い違う（線の属性に記録）。群馬側の線の北側・南側の分割と対応は下の「玉原線分岐で分ける」で設定
 const SECTIONS={'ledger-tokyo-275-232998813':'基幹275kV55','ledger-tokyo-275-319098733':'基幹275kV55','ledger-tokyo-275-518992990':null};
 for(const [id,no] of Object.entries(SECTIONS)){const l=lines.find(x=>x.id===id);if(!l)throw Error('section '+id);l.tsoSection=no;}
 // 信濃川変電所（2026-10-10 オーナー判断「推定でおいてよい」）：OSM・国土地理院の注記に区画がないため、中東京幹線(山)・(中)の端（OSMの東京電力の275kVの線が集まる2点、約79m離れる）の中点に置く
 {const a=nodes.get(3255130767),b=nodes.get(3255112064),pos=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const f={id:'tokyo-est-信濃川変電所',assetId:'tokyo-est-信濃川変電所',name:'信濃川変電所',kind:'substation',position:pos,voltages:[275,154],scopeConnected:true,
   attributes:[{label:'要注意（位置推定）',value:'変電所の区画・名称がOSMにも国土地理院の地図注記にもないため、位置は推定（オーナー判断 2026-10-10）。'},
    {label:'位置の根拠',value:`中東京幹線(山)の終点（OSM node 3255130767）と中東京幹線(中)の起点（node 3255112064）の中点。どちらも東京電力の275kVの線が集まる点で、東京電力 信濃川発電所（OSM way 319098734）の区画の東約${dm(pos,[37.0537909,138.6830422])}m。`},
    {label:'出典',value:'東京電力パワーグリッド 予想潮流 新潟県の変電所の表（「信濃川 275/154kV」、data/raw/substation-banks/tokyo）、送電線インピーダンス（中東京幹線(山)・(中)の端「信濃川変電所」、data/raw/tokyo-sources）、系統構成図（信濃川 275kV、オーナー提供の抜粋 2026-10-10）。'}]};
  facilities.push(f);
  for(const [id,k] of [['ledger-tokyo-275-232998813',-1],['ledger-tokyo-275-319098733',0]]){const l=lines.find(x=>x.id===id),i=k<0?l.connections.length-1:0;if(l.connections[i].status!=='unresolved')throw Error('信濃川 end '+id);
   l.connections[i]={...l.connections[i],status:'facility-area',facilities:[{id:f.id,name:f.name}]};l.referenceReview={status:'section',endpoints:l.referenceReview.endpoints.replace('信濃川変電所（OSM未登録、線の集まる点で止める）','信濃川変電所（位置推定）')};
   const e=l.attributes.find(x=>x.label==='端点の判断');if(e)e.value+=' 2026-10-10 オーナー判断で信濃川変電所を推定位置（2点の中点）に置き、この端をつないだ。';}}
 // 玉原線分岐（2026-10-10 オーナー提供の系統構成図の抜粋：玉原線（66）は信濃川から南へ延びる中東京幹線につながる）。OSMでは群馬側の中東京幹線（way 519125413）と玉原線（way 192208302）は共有点がなく、
 // 鉄塔どうし（node 5061556351・5061556358）が46mで交差している。この46mを直線でつなぎ、玉原線の点を中東京幹線と共有させる（接続の根拠は系統構成図。交差だけでは接続にしない規則の例外）
 {const g=lines.find(x=>x.id==='ledger-tokyo-275-519125413'),t=lines.find(x=>x.id==='tokyo-section-66');if(!g||!t)throw Error('玉原線分岐');
  const pn=[36.6394834,138.938958],pt=[36.6394253,138.9394623];
  if(!g.paths.some(p=>p.some(q=>q[0]===pn[0]&&q[1]===pn[1]))||!t.paths.some(p=>p.some(q=>q[0]===pt[0]&&q[1]===pt[1])))throw Error('玉原線分岐 nodes moved');
  // 直線は下の「玉原線分岐で分ける」で北側の中東京幹線に持たせる（玉原線は末端補完の直線を1つだけ持つ前提：tests/tokyo-finish.test.ts）
  const note=`東京電力パワーグリッドの系統構成図（オーナー提供の抜粋、2026-10-10）で、玉原線（No.66、新榛名から）が中東京幹線（信濃川から南へ延びる線）につながる。OSMでは共有点がなく、中東京幹線の鉄塔（node 5061556351）と玉原線の鉄塔（node 5061556358）が約${dm(pn,pt)}mで交差しているため、この間を直線（破線・ルート不明）でつなぎ、ここを玉原線分岐とみなした（位置は推定）。予想潮流の表の No.55「玉原線分岐→発電所」の玉原線分岐に当たるとみられる。`;
  g.attributes.push({label:'玉原線分岐',value:note});t.attributes=[...t.attributes.filter(a=>a.label!=='玉原線分岐'),{label:'玉原線分岐',value:note}];}
 // 中東京幹線の南端（2026-10-11 オーナー指示「南側の端点は需要家の変電所の可能性。需要も載せる運用で問題ない」（要旨））：群馬側の線の南端（node 1819000152）から、
 // OSMの「中東京幹線」（way 1029623367、500/275kV・4回線、西上武幹線と共架）を南へたどり、275kVの引込（way 971349914・1029623365）で
 // 需要家の変電所（OSM way 848771201、275/25kV。名称は docs/research/customer-aux-names.json）の区画に入る。補助取得 data/raw/nakatokyo-south-osm/area.json
 {const raw=JSON.parse(fs.readFileSync('data/raw/nakatokyo-south-osm/area.json','utf8')).elements,W=id=>{const w=raw.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('中東京幹線南端 way '+id);return w;};
  const seq=[[1029623367,1819000152],[971349914,1819000033],[1029623365,8989952444]],parts=[];
  for(const [id,from] of seq){const w=W(id),fwd=w.nodes[0]===from,rev=w.nodes.at(-1)===from;if(!fwd&&!rev)throw Error('中東京幹線南端 not continuous at '+id);const p=w.geometry.map(q=>[q.lat,q.lon]);parts.push({id,path:fwd?p:p.reverse(),end:fwd?w.nodes.at(-1):w.nodes[0]});}
  const cust=W(848771201),b=cust.bounds,pos=[(b.minlat+b.maxlat)/2,(b.minlon+b.maxlon)/2],last=parts.at(-1).path.at(-1);
  if(!(last[0]>=b.minlat&&last[0]<=b.maxlat&&last[1]>=b.minlon&&last[1]<=b.maxlon))throw Error('中東京幹線南端 does not enter the customer substation');
  // 2026-10-11 需要家の規則（docs/RULES.md 3節「需要家」）：一次資料で名前を確認できないので表示名は「需要家」、確度E。
  // 2026-10-13 OSMの名称は配信データに入れず、配布しない docs/research/customer-aux-names.json にだけ保持する。実名未確認なのでOSMの設備ページへのリンクも付けない（url は空）
  const osmBase=JSON.parse(fs.readFileSync('data/raw/nakatokyo-south-osm/source.json','utf8')).requests[0].osmBase.slice(0,10);
  const f={id:'osm-way-848771201',assetId:'tokyo-fac-customer-848771201',name:'需要家',kind:'customer',position:pos,voltages:[275],scopeConnected:true,url:'',evidenceTier:'E',
   customer:{displayName:'需要家',industry:'鉄道（き電用変電所、補助資料のみ）',owner:'未確認',receivingKV:[275],nameStatus:'unconfirmed',
    sources:[
     {kind:'auxiliary',category:'OSM',name:`OpenStreetMap（power=substation、substation=traction、voltage=275000;25000）。名称・事業者タグは画面・配信データに出さない（実名未確認）。${osmBase}時点`,checkedAt:'2026-10-11'},
     {kind:'primary',category:'メーカー技報',name:'明電時報 2014年 北陸新幹線（長野・金沢間）設備紹介',url:'https://www.meidensha.co.jp/rd/rd_01/rd_01_02/rd_01_02_16/rd_01_02_16_01/pdf/article-201403-0023.pdf',checkedAt:'2026-10-11',namesFacility:false,result:'記載なし（オーナー確認）'},
     {kind:'primary',category:'一般送配電会社',name:'東京電力パワーグリッド 系統構成・予想潮流（送電線・変電所の表）・送電線インピーダンス（data/raw/tso-lines・substation-banks・tokyo-sources）',checkedAt:'2026-10-11',namesFacility:false,result:'記載なし'},
     {kind:'primary',category:'需要家・行政・OCCTO',name:'Web検索（需要家とみられる事業者・鉄道建設・運輸施設整備支援機構・OCCTO・東京電力パワーグリッドの公表資料。補助資料上の名称と「変電所 新幹線 受電」などの語で検索）',checkedAt:'2026-10-11',namesFacility:false,result:'見つからない'}]},
   attributes:[{label:'要注意（E区分）',value:'設備の存在・役割の根拠はOSM（補助資料）だけ。一次資料で名前を確認できないため「需要家」と表示する（2026-10-11）。'},
    {label:'区分',value:'需要家の変電所（基幹系統 275kV で受電）。2026-10-11 オーナー判断で基幹系統に接続する需要家の設備を載せる。'},
    {label:'出典',value:`OSM（補助資料、data/raw/nakatokyo-south-osm/area.json、${osmBase}時点）。一次資料の検索結果は需要家の情報の出典欄に記録（いずれも記載なし）。`}]};
  if(!facilities.some(x=>x.id===f.id))facilities.push(f);
  const g=lines.find(x=>x.id==='ledger-tokyo-275-519125413'),k=g.connections.findIndex(c=>c.node===1819000152);if(k<0)throw Error('中東京幹線 south end');
  for(const p of parts){g.paths.push(p.path);g.osmIds.push(p.id);}
  g.connections[k]={node:9492516502,position:last,status:'facility-area',facilities:[{id:f.id,name:f.name}],neighborWays:[]};
  g.referenceReview={status:'section',endpoints:'八木沢線・中東京幹線(中)との接続点―需要家（275kV受電の変電所）'};
  const km=q=>q.slice(1).reduce((s,x,i)=>s+Math.hypot((x[0]-q[i][0])*110.54,(x[1]-q[i][1])*111.32*Math.cos(x[0]*Math.PI/180)),0);
  g.attributes.push({label:'南端',value:`群馬側の南端（node 1819000152）からOSMの「中東京幹線」（way 1029623367、約${km(parts[0].path).toFixed(1)}km、500/275kVの共架線分、西上武幹線500kVと同じ鉄塔）を南へたどり、275kVの引込（way 971349914・1029623365）で需要家の変電所（275kV受電）に入る。需要家への供給とみられる（OSMのみ・推定）。共架区間は西上武幹線の線と同じ経路に重ねて描く。`});}
 // 玉原線分岐で分ける（2026-10-11 オーナー判断 案a）：群馬側の線を、北側（八木沢線・中東京幹線(中)との接続点―玉原線分岐、ID はそのまま）と
 // 南側（玉原線分岐―需要家の変電所、ID ledger-tokyo-275-519125413-south）の2本にする。容量表の行は北側に No.55、南側は対応させない
 {const g=lines.find(x=>x.id==='ledger-tokyo-275-519125413'),pn=[36.6394834,138.938958];
  const i=g.paths[0].findIndex(q=>q[0]===pn[0]&&q[1]===pn[1]);if(g.osmIds[0]!==519125413||i<1)throw Error('玉原線分岐 split');
  const km=q=>q.slice(1).reduce((s,x,j)=>s+Math.hypot((x[0]-q[j][0])*110.54,(x[1]-q[j][1])*111.32*Math.cos(x[0]*Math.PI/180)),0);
  const branch={node:5061556351,position:pn,status:'shared-node',facilities:[],neighborWays:[192208302]};
  const south=structuredClone(g);
  Object.assign(south,{id:'ledger-tokyo-275-519125413-south',assetId:'ledger-tokyo-275-519125413-south',paths:[g.paths[0].slice(i),...g.paths.slice(1)],osmIds:[...g.osmIds],
   connections:[branch,g.connections.find(c=>c.node===9492516502)],referenceReview:{status:'section',endpoints:'玉原線分岐―需要家（275kV受電の変電所）'},tsoSection:null,
   // 需要家線（役割で判定：需要家の設備だけに供給する区間。OCCTOの東京エリアの行なし＝潮流公表対象外）。所有者は別記
   lineType:'customer',customerLine:{owner:'一般送配電会社',ownerBasis:'OSMの事業者タグ（way 1029623367：東京電力パワーグリッド、補助資料）と、東京PGの表の線名「中東京幹線」'}});
  g.paths=[g.paths[0].slice(0,i+1)];g.osmIds=[519125413];g.connections=[g.connections.find(c=>c.node===5061622670),structuredClone(branch)];if(g.connections.some(c=>!c)||!south.connections[1])throw Error('玉原線分岐 split ends');g.tsoSection='基幹275kV55';
  const BR=-5191254131,pt=[36.6394253,138.9394623];g.paths.push([pn,pt]);g.osmIds.push(BR);g.schematicParts=[{osmId:BR,construction:'unknown'}];
  g.referenceReview={status:'section',endpoints:'八木沢線・中東京幹線(中)との接続点―玉原線分岐'};
  g.attributes=g.attributes.filter(a=>a.label!=='南端');
  const geo=(l,v)=>{const a=l.attributes.find(x=>x.label==='地理参照');if(a)a.value=v;};
  geo(g,`OSM 1線分の北側（way 519125413 の接続点から玉原線分岐まで、約${km(g.paths[0]).toFixed(1)}km）、OSMの線名：中東京幹線。個別回線は未確認。`);
  geo(south,`OSM 5線分（計約${south.paths.reduce((s,p)=>s+km(p),0).toFixed(1)}km）：way 519125413 の玉原線分岐より南・519125414、中東京幹線（way 1029623367、西上武幹線と共架）、引込（way 971349914・1029623365）。個別回線は未確認。`);
  const pub=l=>l.attributes.find(x=>x.label==='公表の線名');
  pub(g).value='東京電力パワーグリッド 系統構成・予想潮流 基幹275kV No.55：中東京幹線（275kV、2回線、玉原線分岐→発電所）。この線は玉原線分岐から北側（信濃川方面）の区間で、No.55 に当てる（2026-10-11 オーナー判断 案a：予想潮流の表の区間に合わせる）。送電線インピーダンス表ではこの区間を中東京幹線(中)として No.66 に分けていて、表どうしが食い違う。';
  pub(south).value='東京PGの系統構成・予想潮流の表に、玉原線分岐より南の中東京幹線の行はない（No.55 は「玉原線分岐→発電所」で北側）。需要家の変電所（275kV受電）への供給とみられる。容量表の行は対応させない。OCCTOの東京エリアの地内実績にも行がない（潮流公表対象外）。';
  // 需要家線の根拠（玉原線分岐より南の存在・役割）はOSMだけ＝確度E
  south.attributes=[{label:'要注意（E区分）',value:'玉原線分岐より南の区間の存在・役割（需要家への供給）の根拠はOSM（補助資料）だけ。一次資料では確認できていない（2026-10-11）。'},{label:'照合区分',value:'E区分'},...south.attributes.filter(a=>a.label!=='玉原線分岐'&&!/^要注意（C区分|^照合区分$/.test(a.label)),{label:'需要家線',value:'需要家の設備だけに供給する区間（役割で判定）。所有者：一般送配電会社（OSMの事業者タグ、補助資料）。'}];
  lines.splice(lines.indexOf(g)+1,0,south);}
 // (中) の線にも案aの対応を記録
 {const l=lines.find(x=>x.id==='ledger-tokyo-275-319098733'),a=l.attributes.find(x=>x.label==='公表の線名');a.value+=' 容量表の行は予想潮流の表の No.55 中東京幹線（玉原線分岐→発電所）に当てる（2026-10-11 オーナー判断 案a。インピーダンス表の No.66 とは食い違う）。';}}
// 小千谷第二発電所の連系線（2026-10-11 オーナー判断 案1：JR東日本の小千谷第二発電所を戻し、中東京幹線につながる線を描く）。
// OSMの「JR東日本小千谷第二発電所ーTEPCO中東京線」（way 319135059、275kV・2回線、事業者 東日本旅客鉄道）。南端は中東京幹線(山)の途中の点（node 3255133963、way 232998813 と 1030935555 の境）。
// 線の存在・区間の根拠はOSMだけ＝確度E。発電所の名称・水力であることは JR東日本の公表ページ（一次資料、docs/research/plant-primary-sources.json）
{const raw=JSON.parse(fs.readFileSync('data/raw/nakatokyo-osm/lines-275.json','utf8')).elements,nodes=new Map(raw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const w=raw.find(e=>e.type==='way'&&e.id===319135059);if(!w)throw Error('小千谷第二 way');
 const PLANT_END=3255433966,JUNCTION=3255133963,ids=w.nodes[0]===PLANT_END?w.nodes:[...w.nodes].reverse();if(ids[0]!==PLANT_END||ids.at(-1)!==JUNCTION)throw Error('小千谷第二 ends');
 const p=ids.map(n=>nodes.get(n));if(p.some(x=>!x))throw Error('小千谷第二 nodes');
 const plant=facilities.find(f=>f.id==='osm-way-658690610'),yama=lines.find(l=>l.id==='ledger-tokyo-275-232998813');if(!plant||!yama)throw Error('小千谷第二 plant/中東京幹線');
 if(!yama.paths.some(q=>q.some(x=>x[0]===p.at(-1)[0]&&x[1]===p.at(-1)[1])))throw Error('小千谷第二 junction not on 中東京幹線');
 const dm=(a,b)=>Math.round(Math.hypot((a[0]-b[0])*110540,(a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180)));
 const km=q=>q.slice(1).reduce((s,x,i)=>s+Math.hypot((x[0]-q[i][0])*110.54,(x[1]-q[i][1])*111.32*Math.cos(x[0]*Math.PI/180)),0);
 lines.push({id:'tokyo-feeder-275-319135059',assetId:'tokyo-feeder-275-319135059',name:'小千谷第二発電所の連系線',named:true,voltageKV:275,currentType:'ac',osmIds:[319135059],paths:[p],
  connections:[{node:PLANT_END,position:p[0],status:'facility-area',facilities:[{id:plant.id,name:plant.name}],neighborWays:[]},{node:JUNCTION,position:p.at(-1),status:'shared-node',facilities:[],neighborWays:[232998813,1030935555]}],
  referenceReview:{status:'section',endpoints:'小千谷第二発電所―中東京幹線（接続点）'},
  attributes:[{label:'要注意（E区分）',value:'線の存在・区間の根拠はOSM（補助資料）だけ。一次資料では確認できていない（2026-10-11）。'},{label:'照合区分',value:'E区分'},
   {label:'区分',value:'発電所の連系線（JR東日本の自営の水力発電所から中東京幹線へ）。各社の系統空容量一覧・OCCTOの地内実績に行がないため潮流なし。'},
   {label:'端点の判断',value:`北端は小千谷第二発電所の区画（線の端から代表点まで約${dm(p[0],plant.position)}m）。南端は中東京幹線(山)の途中の点（OSMの共有ノード ${JUNCTION}）。OSMの線名「JR東日本小千谷第二発電所ーTEPCO中東京線」は、この線が中東京線（幹線）につながることを示す補助資料。`},
   {label:'地理参照',value:`OSM 1線分（約${km(p).toFixed(1)}km、275kV・2回線）。個別回線は未確認。`},
   {label:'出典',value:'地理はOSM（data/raw/nakatokyo-osm、2026-10-10取得）。発電所はJR東日本「信濃川発電所について」（https://www.jreast.co.jp/de/company/csr/environment/shinanogawa/ 、2026-10-11確認）。'}]});}
// 京浜線3・4L・東京南線3・4Lの経路の差し替え（2026-10-16 オーナー承認）：以前は1・2Lと同じOSM線分で描いていた。
// OSMには3,4号線の独自の経路がある（data/raw/tokyo-275/lines-south.json）。ID・公表区間・OCCTOの対応・向きは変えない。京浜線1・2Lからは3,4号線の線分（way 161967897）を外す
{const dm=(a,b)=>Math.hypot((a[0]-b[0])*110540,(a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180));
 const raw=read('data/raw/tokyo-275/lines-south.json').elements,pos=new Map(raw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const part=(way,from,to)=>{const w=raw.find(e=>e.type==='way'&&e.id===way);if(!w)throw Error('3・4L way '+way);const i=w.nodes.indexOf(from),j=w.nodes.indexOf(to);if(i<0||j<0)throw Error('3・4L way '+way+' lacks '+from+'/'+to);
  const ids=i<=j?w.nodes.slice(i,j+1):w.nodes.slice(j,i+1).reverse(),p=ids.map(n=>pos.get(n));if(p.some(x=>!x))throw Error('3・4L nodes '+way);return p;};
 const route=(l,chain)=>{for(let k=1;k<chain.length;k++)if(chain[k-1][2]!==chain[k][1])throw Error('3・4L chain '+l.id);l.paths=chain.map(c=>part(...c));l.osmIds=chain.map(c=>c[0]);l.sourceOsmIds=[...l.osmIds];};
 const km=ps=>ps.reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+dm(p[i],q),0),0)/1000;
 const geo=(l,text)=>{const i=l.attributes.findIndex(a=>a.label==='地理参照');l.attributes[i]={label:'地理参照',value:text};};
 const note={label:'経路の差し替え（2026-10-16）',value:'以前は1・2Lと同じOSM線分で描いていた。OSMの3,4号線の独自の経路に差し替えた（ID・公表区間・OCCTOの対応・向きは同じ）。送電線チェックの欠落（OSMに名前のある線が地図にない）から。'};
 const by=id=>{const l=lines.find(x=>x.id===id);if(!l)throw Error(id);return l;};
 const keihin=facilities.find(f=>f.id==='osm-way-128364781'),nishi=facilities.find(f=>f.id==='osm-way-47110637'),yoko=facilities.find(f=>f.id==='osm-way-1347097154');if(!keihin||!nishi||!yoko)throw Error('3・4L facilities');
 // 京浜線3・4L（No.104、京浜→西東京）：京浜変電所の区画の内側（構内の線分 161967895 の端）から西東京変電所の区画の内側（1383900536 の端）まで
 {const l=by('tokyo-section-104');route(l,[[161967895,3463210573,1739206371],[161967897,1739206371,1803128105],[156415470,1803128105,1686590647],[91828740,1686590647,600697353],[1383900536,600697353,12813234046]]);
  l.connections=[{node:3463210573,position:l.paths[0][0],status:'facility-area',facilities:[{id:keihin.id,name:keihin.name}],neighborWays:[]},{node:12813234046,position:l.paths.at(-1).at(-1),status:'facility-area',facilities:[{id:nishi.id,name:nishi.name}],neighborWays:[]}];
  geo(l,`OSM 5線分（計約${km(l.paths).toFixed(1)}km）。OSMの線名：京浜線3,4号線・京浜線3・4号線。両端とも変電所の区画の内側に届く。1・2Lとは別の経路（京浜変電所の近くの約3kmだけ1・2Lと並走し、鉄塔を共有する）。個別回線・母線は未確認。`);l.attributes.push(note);}
 // 東京南線3・4L（No.102、京浜→発電所）：京浜変電所の区画の内側（構内の線分 161967889 の端）から、JERA 横須賀火力発電所の区画の手前まで。末端は1・2Lと同じく直線
 {const l=by('tokyo-section-102');route(l,[[161967889,3463210584,1739206362],[161967890,1739206362,3347918638]]);
  const end=l.paths.at(-1).at(-1),m=Math.round(dm(end,yoko.position)),sid=-1021;l.paths.push([end,yoko.position]);l.osmIds.push(sid);l.schematicParts=[{osmId:sid,construction:'unknown'}];
  l.connections=[{node:3463210584,position:l.paths[0][0],status:'facility-area',facilities:[{id:keihin.id,name:keihin.name}],neighborWays:[]},{node:3347918638,position:yoko.position,status:'facility-area',facilities:[{id:yoko.id,name:yoko.name}],neighborWays:[]}];
  geo(l,`OSM 2線分（計約${km(l.paths.slice(0,-1)).toFixed(1)}km）＋末端の直線（約${(m/1000).toFixed(2)}km）。OSMの線名：東京南線3,4号線。東京PG資料は発電所端点を匿名化。OSMの線はJERA 横須賀火力発電所の代表点の約${m}m手前で終わる。1・2Lとは別の経路。個別回線・母線は未確認。`);
  const i=l.attributes.findIndex(a=>a.label==='末端の直線');l.attributes[i]={label:'末端の直線',value:`JERA 横須賀火力発電所側の末端はルート不明のため直線で表示（地中・架空の別は不明・破線）。根拠：東京PG設備表の発電所端点、OCCTOの端点名「南横須賀」（発電所とみなした推定）、OSMの線路末端（東京南線3,4号線）が発電所の代表点の約${m}m手前。地中・架空の別は不明。`};l.attributes.push(note);}
 // 京浜線1・2L（No.103）：3,4号線の way 161967897 を外し、1,2号線の way 161967893 だけで京浜側へ（2本は合流点 node 1803128105 と鉄塔 node 1803127989 を共有）
 {const l=by('tokyo-section-103'),i=l.osmIds.indexOf(161967897);if(i<0||l.osmIds[i+1]!==161967893)throw Error('京浜線1・2L');
  l.paths.splice(i,2,part(161967893,1803128105,1739206366));l.osmIds.splice(i,2,161967893);l.sourceOsmIds=l.sourceOsmIds?.filter(x=>x!==161967897);
  const at=(p,q)=>p[0]===q[0]&&p[1]===q[1];for(let k=1;k<l.paths.length;k++)if(!at(l.paths[k-1].at(-1),l.paths[k][0]))throw Error('京浜線1・2L の線分が途切れる');
  geo(l,`OSM ${l.osmIds.length}線分（計約${km(l.paths).toFixed(1)}km）。275kVの共有ノードだけで連結、交差・近接で接続しない。OSMの線名：京浜線1,2号線（西東京変電所側の短い線分1本は名前なし）。個別回線・母線は未確認。`);
  l.attributes.push({label:'経路の差し替え（2026-10-16）',value:'京浜変電所の近くで3,4号線の線分（way 161967897）を経由していたのを、1,2号線の線分（way 161967893）だけにした（2本は合流点と鉄塔1基を共有する）。'});}}
// 鹿島の電源線 No.40・43・44（2026-10-16 オーナー判断・承認）：3本とも同じOSM経路（鹿島第二火力線）に重ねて描いている。経路・ID・公表区間・OCCTOの対応・端は変えず、
// 行き先の発電所が未確認であることを書く。No.40 を一度OSMの鹿島火力線に差し替えたが（224b758）、東京PGの整備計画で鹿島火力線は 2024-12 廃止の計画のため取り消した（同日 オーナー承認）
{const by=id=>{const l=lines.find(x=>x.id===id);if(!l)throw Error(id);return l;};
 const SRC='東京PG「系統構成 500kV,275kV系統 予想潮流」（https://www.tepco.co.jp/pg/consignment/system/pdf/keitoukousei_kikan.pdf 、2ページ、図中の日付 2025年12月1日、確認日 2026-10-16）';
 const PLAN='東京PG「主要送電線路の整備計画」（https://www4.tepco.co.jp/pg/consignment/system/pdf/setubikeikaku-j500-275_202309.pdf 、表の注記 2024年3月31日現在、確認日 2026-10-16）';
 const add=(l,label,value)=>{const i=l.attributes.findIndex(a=>a.label===label);if(i<0)l.attributes.push({label,value});else l.attributes[i]={label,value};};
 const same='No.40・43・44 の3本は、地図では同じOSMの経路（鹿島第二火力線）に重ねて表示している。';
 add(by('tokyo-section-40'),'端点の根拠',`発電所側の端点を鹿島火力発電所とみなした（推定）。${same}${SRC}では、No.40 は鹿島から2つの発電所（番号で匿名）へ分かれる。分岐の先のもう一方は描いていない。並走するOSMの鹿島火力線（way 300345937）は、${PLAN}に「鹿島火力線1，2号 鹿島変電所～鹿島火力発電所 2→0、2024-12（廃止）」とあり、No.40 の経路にしない（廃止の実施は未確認）。同じ計画の鹿島海浜線の接続変更（鹿島火力発電所構内開閉所～7号系列開閉所）も、No.40 がどの線かに関わる可能性がある（未確認）。`);
 for(const id of ['tokyo-section-43','tokyo-section-44'])add(by(id),'端点の根拠',`発電所側の端点を鹿島火力発電所とみなした（推定）。${same}${SRC}では、No.43・44 はそれぞれ1つの発電所（番号で匿名）へ向かう。どの発電所への線かは未確認。`);}
// 沼原線 No.22 の発電所側の端（2026-10-17 オーナー判断）：オーナー提示の概要図で、沼原発電所（地下）は母線トンネルで地上の沼原電力所につながる。
// 概要図に沼原線そのものの記載はないため、線の端を沼原電力所としたのは推定（docs/RULES.md 3節「推測」）
{const l=lines.find(x=>x.id==='tokyo-section-22');if(!l||l.connections.at(-1).facilities[0]?.id!=='osm-way-1016436036')throw Error('沼原線の末端が沼原電力所でない');
 l.attributes.push({label:'端点の根拠',value:'発電所側の端点を沼原電力所とみなした（推定）。オーナーが提示した「発電設備の概要図」（現地の案内図とみられる。作成者・作成日は不明、2026-10-17 提示）では、沼原発電所（地下）が母線トンネルで地上の沼原電力所につながるが、沼原線そのものは描かれていない。東京PG設備表の端点は「発電所」。一次資料では未確認。'});}
// No.31 を千葉火力線3・4L の経路へ移す（2026-10-17 オーナー承認）：以前は No.30 と同じ OSM 千葉火力線1・2L（way 156332175）に重ねて描いていた。
// 系統構成図(30)(31)はどちらも千葉中央から《1002014》へ向かう2つの発電所記号で、どちらの番号がどちらの線かの一次資料はない（両方に推測を付ける）。
// way 704195151 は 2026-10-05 に「千葉印西線（推定）」として取り下げた線分と同じだが、それの復活ではない（今回は線名・両端が千葉中央―千葉火力と合う）
{const raw=read('data/raw/tokyo-275/held-cables.json').elements,pos=new Map(raw.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const w=raw.find(e=>e.type==='way'&&e.id===704195151);if(!w||w.tags?.name!=='千葉火力線3・4L'||w.nodes[0]!==6612138710||w.nodes.at(-1)!==6612138707)throw Error('No.31: 千葉火力線3・4L の線分が変わった');
 const l=lines.find(x=>x.id==='tokyo-section-31'),l30=lines.find(x=>x.id==='tokyo-section-30'),chuo=facilities.find(f=>f.id==='osm-way-211241774'),plant=facilities.find(f=>f.id==='osm-way-605327355');
 if(!l||!l30||!chuo||!plant)throw Error('No.31: 線・設備がない');if(l.osmIds.join()!=='156332175,-311')throw Error('No.31: 差し替え前の経路が想定と違う');
 const dm=(a,b)=>Math.hypot((a[0]-b[0])*110540,(a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180));
 const p=[...w.nodes].reverse().map(n=>pos.get(n));if(p.some(x=>!x))throw Error('No.31: 点が足りない');
 const km=p.slice(1).reduce((s,q,i)=>s+dm(p[i],q),0)/1000,m=Math.round(dm(p.at(-1),plant.position));
 l.paths=[p,[p.at(-1),plant.position]];l.osmIds=[704195151,-311];l.sourceOsmIds=[704195151];l.schematicParts=[{osmId:-311,construction:'unknown'}];
 l.connections=[{node:6612138707,position:p[0],status:'facility-area',facilities:[{id:chuo.id,name:chuo.name}],neighborWays:[]},{node:6612138710,position:plant.position,status:'facility-area',facilities:[{id:plant.id,name:plant.name}],neighborWays:[]}];
 const set=(x,label,value)=>{const i=x.attributes.findIndex(a=>a.label===label);if(i<0)x.attributes.push({label,value});else x.attributes[i]={label,value};};
 set(l,'地理参照',`OSM 1線分（千葉火力線3・4L、way 704195151、約${km.toFixed(1)}km、275kV・2回線）＋末端の直線（約${(m/1000).toFixed(2)}km）。東の端は千葉中央変電所の区画の内側、西の端はOSMの無名の開閉所の区画（way 704195148、地図にない）の内側。個別回線・母線は未確認。`);
 set(l,'末端の直線',`千葉火力発電所側は、3・4Lの西の端から発電所の代表点まで、ルート不明のため直線で表示（地中・架空の別は不明・破線）。`);
 set(l,'公表区間との対応','系統構成図(30)(31)はどちらも千葉中央から《1002014》の発電所記号へ向かう。(31)を千葉火力線3・4Lに対応付けたのは推定（どちらの番号がどちらの線かの一次資料はない）。');
 set(l,'端点の根拠','西の端点を、千葉火力発電所の構内の開閉所とみなした（推定）。この開閉所の区画（OSM way 704195148、名前なし）は千葉火力発電所の区画の東隣にあり、隣にあることのほかに根拠はない。');
 set(l30,'公表区間との対応','系統構成図(30)(31)はどちらも千葉中央から《1002014》の発電所記号へ向かう。(30)を千葉火力線1・2Lに対応付けたのは推定（どちらの番号がどちらの線かの一次資料はない）。');
 l.attributes.push({label:'経路の差し替え（2026-10-17）',value:'以前は No.30 と同じ OSM 千葉火力線1・2L に重ねて描いていた。OSMの千葉火力線3・4L の経路に差し替えた（ID・公表区間・向きは同じ）。'});}
// 鹿島地区の神栖火力線（E区分）と鹿島海浜線（C区分、南の端は未確認）を描く（2026-10-16 オーナー指示・承認）。送電線チェックの欠落（OSMに名前のある線が地図にない）から。
// どちらも東京PGの予想潮流・系統構成図に線名がない（電源線は「送電線」と匿名）ので、OCCTOの行・容量表の行には対応させない
{const raw=read('data/raw/tokyo-275/lines-north1.json'),els=raw.elements,pos=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const W=id=>{const w=els.find(e=>e.type==='way'&&e.id===id);if(!w)throw Error('鹿島 way '+id);return w;};
 const fac=id=>{const f=facilities.find(x=>x.id===id);if(!f)throw Error('鹿島 facility '+id);return f;};
 const km=p=>p.slice(1).reduce((s,q,i)=>s+Math.hypot((q[0]-p[i][0])*110.54,(q[1]-p[i][1])*111.32*Math.cos(q[0]*Math.PI/180)),0);
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt)throw Error('鹿島：OSMの取得時点が原本にない');
 const PLAN='東京PG「主要送電線路の整備計画」（https://www4.tepco.co.jp/pg/consignment/system/pdf/setubikeikaku-j500-275_202309.pdf 、表の注記 2024年3月31日現在、確認日 2026-10-16）';
 const kashima=fac('osm-way-300345952'),kamisu=fac('osm-way-754094565');
 // 神栖火力線：神栖火力発電所の区画の内側（node 9911008455）から鹿島火力発電所の区画の内側（node 2563275426、鹿島海浜線の途中の点でもある）まで
 {const w=W(1081326554),p=w.nodes.map(n=>pos.get(n));if(w.nodes[0]!==9911008455||w.nodes.at(-1)!==2563275426||p.some(x=>!x))throw Error('神栖火力線');
  lines.push({id:'tokyo-feeder-275-1081326554',assetId:'tokyo-feeder-275-1081326554',name:'神栖火力線',named:true,voltageKV:275,currentType:'ac',osmIds:[1081326554],paths:[p],tsoSection:null,
   connections:[{node:9911008455,position:p[0],status:'facility-area',facilities:[{id:kamisu.id,name:kamisu.name}],neighborWays:[]},{node:2563275426,position:p.at(-1),status:'facility-area',facilities:[{id:kashima.id,name:kashima.name}],neighborWays:[249766416]}],
   referenceReview:{status:'partial',endpoints:'神栖火力発電所―鹿島火力発電所'},
   attributes:[{label:'要注意（E区分）',value:'線の存在・区間・役割の根拠はOSM（補助資料）だけ。一次資料では確認できていない（2026-10-16）。'},{label:'照合区分',value:'E区分'},
    {label:'区分',value:'発電所の電源線（東京PGの予想潮流・系統構成図では電源線の線名が「送電線」と匿名のため、OCCTOの行・容量表の行とは対応付けていない。潮流なし）'},
    {label:'地理参照',value:`OSM 1線分（約${km(p).toFixed(2)}km、275kV・1回線、OSMの事業者タグは東京電力パワーグリッド）。両端ともOSMの発電所の区画の内側。`},
    {label:'端点の根拠',value:'鹿島火力発電所側の端点を、鹿島火力発電所の構内（開閉所）への接続とみなした（推定）。この点（OSM node 2563275426）は鹿島海浜線の途中の点でもあり、構内の開閉所につながるのか、鹿島海浜線から分岐するのかは未確認。'},
    {label:'出典',value:`地理はOSM（data/raw/tokyo-275/lines-north1.json、${osmAt}時点）。発電所は HJKS（data/raw/hjks/transcribed-2026-10-09.json）の神栖火力発電所・鹿島火力発電所。${PLAN}・東京PGの系統構成図（2025-12-01）に神栖火力線の記載はない。`}]});}
 // 鹿島海浜線：鹿島火力発電所の区画の内側（node 2563275422）から南へ。南の端（node 3044313242）は設備の登録がなく未確認
 {const w=W(249766416),p=w.nodes.map(n=>pos.get(n));if(w.nodes[0]!==2563275422||w.nodes.at(-1)!==3044313242||p.some(x=>!x))throw Error('鹿島海浜線');
  lines.push({id:'tokyo-feeder-275-249766416',assetId:'tokyo-feeder-275-249766416',name:'鹿島海浜線',named:true,voltageKV:275,currentType:'ac',osmIds:[249766416],paths:[p],tsoSection:null,
   connections:[{node:2563275422,position:p[0],status:'facility-area',facilities:[{id:kashima.id,name:kashima.name}],neighborWays:[]},{node:3044313242,position:p.at(-1),status:'unresolved',facilities:[],neighborWays:[1081097241,1081097242]}],
   referenceReview:{status:'partial',endpoints:'鹿島火力発電所―端点未確認'},
   attributes:[{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},
    {label:'区分',value:'発電所につながる送電線（東京PGの予想潮流・系統構成図では電源線の線名が「送電線」と匿名のため、OCCTOの行・容量表の行とは対応付けていない。潮流なし）'},
    {label:'地理参照',value:`OSM 1線分（約${km(p).toFixed(1)}km、275kV・2回線、OSMの事業者タグは東京電力パワーグリッド）。北の端は鹿島火力発電所の区画の内側。南の端は設備の区画の外で、名前のない約40mの線分2本だけがつながり、その先に設備の登録はない（端点未確認）。OSMの鉄塔番号の登録はない。`},
    {label:'公表資料',value:`${PLAN}に、鹿島海浜線接続変更（鹿島海浜線（鹿島火力発電所構内開閉所）～鹿島火力発電所（7号系列開閉所）、275kV、2回線、使用開始 2025-4（1号線）・2024-11（2号線））と、電源のアクセス線（仮称）～鹿島海浜線（No.11-1）（275kV、0.1km、2回線、使用開始 2026-6、電源対応）がある。地図は構内の接続変更を描き分けていない。`},
    {label:'南の端',value:'行き先は未確認で、どこにもつないでいない。南の端の名前のない短い線分2本は、整備計画のアクセス線に当たる可能性があるが、OSMに鉄塔番号の登録がなく確かめられないので描かない。No.40・43・44（鹿島変電所から匿名の発電所へ）との関係も未確認。'},
    {label:'出典',value:`地理はOSM（data/raw/tokyo-275/lines-north1.json、${osmAt}時点）。公表資料は上記の整備計画（原本は保存しない）。`}]});}}
// 鹿島変電所から北への線（名称未確認、E区分、北の端は未確認）（2026-10-16 オーナー判断・承認）：OSMの線名は需要家の可能性がある名前のため使わず、
// 配布しない docs/research/customer-aux-names.json に需要家候補として保持する。No.40 の分かれ先か、需要家への線かは未確認（どちらとも決めない）
{const raw=read('data/raw/tokyo-275/lines-north1.json'),els=raw.elements,pos=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10);if(!osmAt)throw Error('鹿島北：OSMの取得時点が原本にない');
 const part=(way,from,to)=>{const w=els.find(e=>e.type==='way'&&e.id===way);if(!w)throw Error('鹿島北 way '+way);const i=w.nodes.indexOf(from),j=w.nodes.indexOf(to);if(i<0||j<0)throw Error('鹿島北 way '+way+' lacks '+from+'/'+to);
  const ids=i<=j?w.nodes.slice(i,j+1):w.nodes.slice(j,i+1).reverse(),p=ids.map(n=>pos.get(n));if(p.some(x=>!x))throw Error('鹿島北 nodes '+way);return p;};
 const chain=[[340648890,3044313252,2105189113],[300345941,2105189113,2105189119],[1082496941,2105189119,2105189122],[1082497104,2105189122,2105189125],[754089893,2105189125,2105189132],
  [1082612599,2105189132,9920766894],[1082612598,9920766894,2207993480],[340648892,2207993480,2207993505],[1082612596,2207993505,2207993507]];
 for(let k=1;k<chain.length;k++)if(chain[k-1][2]!==chain[k][1])throw Error('鹿島北 chain');
 const paths=chain.map(c=>part(...c)),km=paths.reduce((s,p)=>s+p.slice(1).reduce((t,q,i)=>t+Math.hypot((q[0]-p[i][0])*110.54,(q[1]-p[i][1])*111.32*Math.cos(q[0]*Math.PI/180)),0),0);
 const sub=facilities.find(f=>f.id==='osm-way-340648895');if(!sub)throw Error('鹿島変電所');
 lines.push({id:'tokyo-feeder-275-300345941',assetId:'tokyo-feeder-275-300345941',name:'鹿島変電所から北への線（名称未確認）',named:false,voltageKV:275,currentType:'ac',osmIds:chain.map(c=>c[0]),paths,tsoSection:null,
  connections:[{node:3044313252,position:paths[0][0],status:'facility-area',facilities:[{id:sub.id,name:sub.name}],neighborWays:[]},{node:2207993507,position:paths.at(-1).at(-1),status:'unresolved',facilities:[],neighborWays:[]}],
  referenceReview:{status:'partial',endpoints:'鹿島変電所―端点未確認'},
  attributes:[{label:'要注意（E区分）',value:'線の存在・区間・役割の根拠はOSM（補助資料）だけ。一次資料では確認できていない（2026-10-16）。'},{label:'照合区分',value:'E区分'},
   {label:'区分',value:'行き先未確認の送電線。東京PGの系統構成図で鹿島から2つの発電所へ分かれる No.40 の分かれ先か、需要家への線かは未確認で、どちらとも決めていない。OSMでは6本の線分に ref「40」の登録がある（補助資料だけで、確定しない）。OCCTOの行・容量表の行とは対応付けていない（潮流なし）。'},
   {label:'地理参照',value:`OSM ${chain.length}線分（計約${km.toFixed(1)}km、275kV・2回線。構内の引込は回線数の登録なし（ケーブル3本）、北の端の線分は1回線。OSMの事業者タグは東京電力パワーグリッド）。鹿島変電所の区画の内側から構内の引込を経て北へ。途中の約1km（way 1082612598）はOSMで4回線・2つの線名の併記で、地図の鹿島パワー線と同じ線分を使う（併架とみなした）。一部はOSMで別の線名と併記の区間（4回線）を通る。OSMの線名は表示しない（名称未確認）。`},
   {label:'北の端',value:'行き先は未確認で、どこにもつないでいない。北の端の周りにOSMの設備の登録はない。'},
   {label:'出典',value:`地理はOSM（data/raw/tokyo-275/lines-north1.json、${osmAt}時点）。東京PGの予想潮流・系統構成図（2025-12-01）・整備計画（2024-03-31現在）に、この線を名指しする記載はない。`}]});}
// 新豊根東栄線の一部廃止・つなぎ替え（中部、電源開発、2026-10-17 オーナー承認）：線は中部のデータ（scripts/build-chubu.mjs、chubu-jpower-275-502513998）。
// 経産省の重要送電設備等の指定（2019-07-23）は古い版の計画値として1つ目の版に、J-POWER送変電の2026年度供給計画を2つ目の版に入れる
if(!plans.some(p=>p.id==='jpower-plan-shintoyone-toei'))plans.push({id:'jpower-plan-shintoyone-toei',regions:['chubu'],
 targets:[{name:'新豊根東栄線',assetIds:['chubu-jpower-275-502513998'],mapping:'今の経路（新豊根発電所―東栄変電所）に対応。No.20 の位置と、つなぎ替え後の経路は未確認'}],
 changeType:'送電設備の一部廃止・つなぎ替え',latestProgressReview:{checkedAt:'2026-10-17',note:'J-POWER送変電「2026年度供給計画の概要」に工事中として掲載。工事の最新の進み具合は未確認。'},
 revisions:[
  {recordedAt:'2026-10-17',before:'新豊根東栄線（新豊根～東栄変電所）',after:'新豊根東栄線 275kV、こう長約1km、回線数は1（重要送電設備等の指定。東京中部間連系設備の増強）',status:'計画中',statusOriginal:'重要送電設備等の指定',
   timing:[{raw:'令和9年度',label:'運用開始予定',year:2027,precision:'fiscal-year'}],
   source:{name:'資源エネルギー庁「『重要送電設備等』の指定をしました」',url:'https://www.enecho.meti.go.jp/category/electricity_and_gas/electric/important_transmission/',publishedAt:'2019-07-23',checkedAt:'2026-10-17'},reason:'古い版の計画値（2019年）。下の2026年の版に置き換わる。'},
  {recordedAt:'2026-10-17',before:'新豊根東栄線 No.20～中部電力パワーグリッド東栄変電所（275kV、約3km）',after:'新豊根東栄線 No.20～佐久間東栄線 No.22（275kV、0.1km）。あわせて佐久間東栄線 No.22～東栄変電所（275kV、2km）',status:'工事中',statusOriginal:'工事中（つなぎ替え）・その他（廃止）',
   timing:[{raw:'2027年4月',label:'No.20～東栄変電所 廃止',year:2027,month:4,precision:'month'},{raw:'2027年9月',label:'No.20～佐久間東栄線No.22 使用開始',year:2027,month:9,precision:'month'}],
   source:{name:'J-POWER送変電「2026年度供給計画の概要」',url:'https://www.jpower.co.jp/tn/news/pdf/oshirase260227-2.pdf',publishedAt:'2026-02-25',checkedAt:'2026-10-17'},reason:'送電線チェックの欠落の確認から（2026-10-17 オーナー承認）。予定だけで今の地図の線は変えない。'}],
 unknowns:['No.20 の位置','つなぎ替え後の経路','工事の最新の進み具合'],updateRequired:['地理','接続'],application:{status:'未反映',note:'使用開始を一次資料で確認してから地図の経路に反映する。'}});
// 城北線【建設中】（2026-10-17 オーナー承認）：送電線チェックの欠落から。東京PGの整備計画で工事中（新座変電所～豊島変電所、275kV、20.9km、3回線、CV1400、2033-10 使用開始）。
// 2016年の新座洞道火災で北武蔵野線とともに被災した既設の線の作り直しで、設備一覧（2026-06-22版）に行はない。経路は被災前のOFケーブルのOSMの経路（新設の経路は未確認）。
// 新座側の way 1556050856 は OSM で「北武蔵野線/城北線」（ref 112/113）の共用の区間で、No.112 と同じ線分を使う（同じ洞道の別の線）。
// 2つの線分を1本の経路にまとめ、osmIds は城北線の区間（1556050857）だけにする。分けると、分かれ目が No.112 の経路の途中の点になり、No.112 の潮流が「分岐（城北線）を含む行」と扱われ（flowBranches）、
// No.112 を選んだときに豊島変電所が「つながる設備」に入る（connectedFacilityIds）ため。共用の区間は sourceOsmIds（来歴）に入れる
{const n1=read('data/raw/tokyo-275/lines-north1.json'),n2=read('data/raw/tokyo-275/held-cables.json');
 const W=(raw,id,from,to)=>{const w=raw.elements.find(e=>e.type==='way'&&e.id===id);if(!w||w.nodes[0]!==from||w.nodes.at(-1)!==to)throw Error('城北線 way '+id+' が変わった');
  const pos=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]])),p=w.nodes.map(n=>pos.get(n));if(p.some(x=>!x))throw Error('城北線 nodes '+id);return p;};
 const a=W(n1,1556050856,14154054672,14154054679),b=W(n2,1556050857,14154054679,14154037836);
 const niiza=facilities.find(f=>f.id==='osm-way-136298957'),toshima=facilities.find(f=>f.id==='osm-node-14154037836');if(!niiza||!toshima)throw Error('城北線：新座・豊島変電所がない');
 const km=p=>p.slice(1).reduce((s,q,i)=>s+Math.hypot((q[0]-p[i][0])*110.54,(q[1]-p[i][1])*111.32*Math.cos(q[0]*Math.PI/180)),0);
 const at=r=>{const t=r.osm3s?.timestamp_osm_base?.slice(0,10);if(!t)throw Error('城北線：OSMの取得時点が原本にない');return t;};
 const PLAN='東京PG「主要送電線路の整備計画」（500・275kV、表の注記 2026年3月31日現在、https://www.tepco.co.jp/pg/consignment/system/pdf/20250526_setubikeikaku-j500-275.pdf 、確認日 2026-09-27）';
 const FIRE='東京PG お知らせ「新座洞道火災事故に伴う経済産業大臣からの指示を踏まえた点検や防火対策等に関する対応結果ならびに進捗状況の報告について」（2016-12-16、https://www.tepco.co.jp/pg/company/press-information/information/2016/1349502_8914.html 、確認日 2026-10-17）';
 lines.push({id:'tokyo-plan-城北線',assetId:'tokyo-plan-城北線',name:'城北線',named:true,voltageKV:275,currentType:'ac',osmIds:[1556050857],sourceOsmIds:[1556050856,1556050857],paths:[[...a,...b.slice(1)]],cableOsmIds:[1556050857],
  status:'建設中',plannedStart:'2033年10月',statusSource:`${PLAN}：城北線 新座変電所～豊島変電所、275kV、20.9km、3回線、CV1400、工事中、着工 2022年9月、2033年10月使用開始予定。`,
  connections:[{node:14154054672,position:a[0],status:'facility-area',facilities:[{id:niiza.id,name:niiza.name}],neighborWays:[]},{node:14154037836,position:b.at(-1),status:'facility-area',facilities:[{id:toshima.id,name:toshima.name}],neighborWays:[1556050127,1556157684]}],
  referenceReview:{status:'section',endpoints:'新座変電所―豊島変電所'},
  attributes:[{label:'要注意（C区分）',value:'公表区間（東京PGの設備一覧）に行がない線。区間・電圧・回線数・状態は整備計画で確認したが、経路は被災前の設備のOSMの登録だけで描いた参考表示。'},{label:'照合区分',value:'C区分'},
   {label:'設備の位置付け',value:`建設中の送電線（地中）。2016年10月の新座洞道火災で北武蔵野線とともに被災した既設の線（${FIRE}に「北武蔵野線・城北線の早期復旧」の指示）。東京PGの設備一覧（2026-06-22版）に行がなく、今は運用されていないとみられるが、運用状態は一次資料で未確認。使用開始まで潮流なし（OCCTO東京の公表行にない）。`},
   {label:'地理参照',value:`OSM 2線分（計約${(km(a)+km(b)).toFixed(1)}km、地中）。新座側の way 1556050856（約${km(a).toFixed(1)}km）はOSMで「北武蔵野線/城北線」（ref 112/113）の共用の区間で、北武蔵野線（No.112）と同じ線分。そこから way 1556050857「城北線」（約${km(b).toFixed(1)}km）が豊島変電所まで続く。被災前のOFケーブルの経路とみられ、工事中の新しいケーブルが同じ経路を通るかは未確認。整備計画のこう長 20.9km とは約${(20.9-km(a)-km(b)).toFixed(1)}km 違う。`},
   {label:'出典',value:`${PLAN}。${FIRE}。地理はOSM（data/raw/tokyo-275/lines-north1.json ${at(n1)}時点、held-cables.json ${at(n2)}時点）。`}]});
 const plan=plans.find(p=>p.id==='tokyo-plan-johoku-2026');if(!plan)throw Error('城北線の系統変更予定がない');
 plan.targets=[{name:'城北線',assetIds:['tokyo-plan-城北線'],mapping:'OSMの被災前の経路に対応（地図に建設中として表示。新しい経路は未確認）'}];
 Object.assign(plan.revisions[0],{recordedAt:'2026-10-17',reason:'初回記録（送電線チェックの欠落の確認から、2026-10-17 オーナー承認）。'});}
// 逗子変電所と、東京南線から逗子変電所への線（2026-10-18 オーナー承認）：送電線チェックの欠落（OSM「逗子線」way 328143017、275kV・2回線、0.14km）から。
// 東京PGの系統構成図（2026-06-22）に「逗子」の変電所の記号が東京南線（101・102）の近くにあるが、どちらにつながるか・変電所の電圧は図から読み取れていない。
// OSMでは東京南線3・4L（No.102、way 161967890）の途中の点（node 1609521184）から分かれる。表示名は「逗子変電所への線（東京南線の分岐）」（3・4L につながるのは OSM による）。
// 同じ名前の鉄道用の変電所（OSM way 200887286、需要家の設備）は取り込まない（事業者名は書かない：docs/RULES.md 3節「需要家」）
{const fac=read('data/raw/tokyo-osm/facilities.json'),w=fac.elements.find(e=>e.type==='way'&&e.id===327974991);
 if(!w||w.tags?.name!=='逗子変電所'||w.tags?.power!=='substation'||w.tags?.voltage!=='275000;66000'||w.tags?.operator!=='東京電力パワーグリッド')throw Error('逗子変電所：OSMの区画のタグ・名前が変わった');
 const ring=w.geometry.map(q=>[q.lat,q.lon]),v=ring.slice(0,-1),pos=[v.reduce((s,p)=>s+p[0],0)/v.length,v.reduce((s,p)=>s+p[1],0)/v.length];
 const inside=(p,R)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const[yi,xi]=R[i],[yj,xj]=R[j];if((yi>p[0])!=(yj>p[0])&&p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi)c=!c;}return c;};
 if(!inside(pos,ring))throw Error('逗子変電所：代表点が区画の外');if(facilities.some(f=>f.id==='osm-way-327974991'||f.name==='逗子変電所'))throw Error('逗子変電所：重複');
 const MAP='東京PG「系統構成 500kV,275kV系統」（予想潮流の資料 https://www.tepco.co.jp/pg/consignment/system/pdf/kikan_yosochoryu.pdf の4ページ、資料作成日 2026-06-22、確認日 2026-10-18。原本は保存しない）';
 const facAt=fac.osm3s?.timestamp_osm_base?.slice(0,10);if(!facAt)throw Error('逗子：OSMの取得時点が原本にない');
 const zushi={id:'osm-way-327974991',assetId:'tokyo-fac-substation-327974991',name:'逗子変電所',kind:'substation',position:pos,voltages:[275],scopeConnected:true,url:'https://www.openstreetmap.org/way/327974991',
  attributes:[{label:'運営者',value:'東京電力パワーグリッド'},{label:'公表設備対応',value:`${MAP}に「逗子」の変電所の記号が東京南線（101・102）の近くにある。記号の種類（電圧）と、どちらの線につながるかは図から読み取れていない。東京PGの供給系統図（神奈川）は取得できず未確認（2026-10-18）。設備一覧に逗子の行はない。`},
   {label:'OSM登録',value:`OSMの区画（way 327974991、power=substation、275kV;66kV、事業者 東京電力パワーグリッド、${facAt}時点）。275/66kV はOSMの登録による。同じ名前の鉄道用の変電所（way 200887286）は別の設備。`},{label:'代表点の取り方',value:'OSMの区画の頂点の平均（区画の内側にあることを確認）。'}]};
 facilities.push(zushi);
 const raw=read('data/raw/tokyo-osm/lines-275.json'),els=raw.elements,np=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lat,e.lon]]));
 const x=els.find(e=>e.type==='way'&&e.id===328143017);if(!x||x.nodes[0]!==1609521184||x.nodes.at(-1)!==3349675739||x.tags?.name!=='逗子線')throw Error('逗子線：OSMの線分が変わった');
 const route=x.nodes.map(n=>np.get(n));if(route.some(q=>!q))throw Error('逗子線 nodes');
 const l102=lines.find(y=>y.id==='tokyo-section-102');if(!l102?.osmIds.includes(161967890)||!l102.paths.some(p=>p.slice(1,-1).some(q=>q[0]===route[0][0]&&q[1]===route[0][1])))throw Error('逗子線：分かれ目が No.102 の経路の途中の点でない');
 const inW=inside(route.at(-1),ring),paths=inW?[route]:[route,[route.at(-1),pos]];
 const dm=(a,b)=>Math.hypot((a[0]-b[0])*110540,(a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180)),km=route.slice(1).reduce((t,q,i)=>t+dm(route[i],q),0)/1000;
 const osmAt=raw.osm3s?.timestamp_osm_base?.slice(0,10);
 lines.push({id:'tokyo-feeder-275-328143017',assetId:'tokyo-feeder-275-328143017',name:'逗子変電所への線（東京南線の分岐）',named:false,voltageKV:275,currentType:'ac',osmIds:inW?[328143017]:[328143017,-3281430171],paths,...(inW?{}:{schematicParts:[{osmId:-3281430171,construction:'unknown'}]}),tsoSection:null,
  referenceReview:{status:'section',endpoints:'東京南線（分岐点）―逗子変電所'},
  connections:[{node:1609521184,position:route[0],status:'shared-node',facilities:[],neighborWays:[161967890]},{node:inW?3349675739:null,position:paths.at(-1).at(-1),status:'facility-area',facilities:[{id:zushi.id,name:zushi.name}],neighborWays:[]}],
  attributes:[{label:'照合区分',value:'C区分'},{label:'要注意（C区分）',value:'一次資料で区間・端点を確定できず、OSMの地理登録だけで描いた参考表示。'},
   {label:'公表区間',value:'東京PG の設備一覧・OCCTO に逗子への線の行はない。東京南線（No.101・102）の近くの逗子変電所への線。'},
   {label:'分岐点の推定',value:`一次資料で言えること：${MAP}に、逗子の変電所の記号が東京南線（101・102）の近くにある。OSMだけが根拠のもの：東京南線3・4L（No.102 の線分 way 161967890 の途中の共有点 node 1609521184）から分かれる位置と経路。未確認のこと：1・2L と 3・4L のどちらにつながるか、分岐（T）か引き込み（π）か、回線。ここでは OSM のとおり 3・4L からの分岐とみなした（推定）。`},
   {label:'区分',value:'東京南線の途中から逗子変電所へ分かれる線。この線には潮流を割り当てない。'},
   {label:'地理参照',value:`OSM 1線分（way 328143017「逗子線」、約${km.toFixed(2)}km、275kV・2回線、事業者 東京電力パワーグリッド）。西の端は${inW?'逗子変電所の区画の内側':'逗子変電所の区画の外で、代表点まで直線（ルート不明・破線）'}。`},
   {label:'出典',value:`${MAP}。地理はOSM（data/raw/tokyo-osm/lines-275.json ${osmAt??''}時点、逗子変電所の区画は facilities.json ${facAt}時点）。`}]});}
// 東京の点検（2026-11-17 オーナー回答、保留124）：発電所7か所の削除、大鳥・大津岐と引込分岐線、梓川線と No.78、新野田への500kVの引込線、南多摩・中相模・墨東・南横須賀の変電所、川崎高輪線の分岐（scripts/tokyo-check-1117.mjs）
{const {applyTokyoCheck1117}=await import('./tokyo-check-1117.mjs');applyTokyoCheck1117(lines,facilities);}
// 保留127（2026-11-17）：東京PG 2019年版の系統図による接続の見直し（scripts/tokyo-2019-127.mjs）
{const {applyTokyo2019}=await import('./tokyo-2019-127.mjs');applyTokyo2019(lines,facilities);}
// 端点未接続の個別修正（2026-10-11、scripts/end-fixes.mjs）
{const {applyEndFixes}=await import('./end-fixes.mjs');applyEndFixes('tokyo',lines,facilities);}
// 基幹系統表示の例外（2026-10-14 オーナー指示、東清水FCの東京側154kV）：正本は config/tokyo-approval.json の trunkExceptionLines（線ID）。
// ここでは線のデータに目印 trunkException:'fc-ac-side' を書き写すだけ。画面は目印だけを見て、電圧の絞り込みに関係なく基幹系統表示に出す（対象電圧には足さない）
const trunkExceptionLines=JSON.parse(fs.readFileSync('config/tokyo-approval.json','utf8')).trunkExceptionLines??[];
for(const l of lines)delete l.trunkException;
for(const id of trunkExceptionLines){const l=lines.find(x=>x.id===id);if(!l)throw Error('trunkExceptionLines の線がない: '+id);l.trunkException='fc-ac-side';}
// 奥清津発電所の印の位置（2026-10-24 オーナー指示「奥清津発電所（第一）の座標は36°50'43.7"N 138°45'59.4"Eにうつして」、保留12）：OSM の区画の代表点から約170m 南へ移す
{const ok=facilities.find(x=>x.id==='osm-relation-13413356');if(!ok||ok.name!=='奥清津発電所')throw Error('奥清津発電所');
 const P=[36.845472,138.7665],t=Math.PI/180,m=Math.round(6371000*Math.hypot((P[1]-ok.position[1])*t*Math.cos(P[0]*t),(P[0]-ok.position[0])*t));if(m>300)throw Error('奥清津発電所：移す距離が想定と違う');
 ok.position=P;ok.attributes=[...ok.attributes.filter(a=>a.label!=='位置の根拠'),{label:'位置の根拠',value:'オーナー指定の座標（北緯36°50′43.7″・東経138°45′59.4″、2026-10-24）。OSM の区画（relation 13413356、奥清津と奥清津第二の敷地）の代表点から約'+m+'m 南。国土地理院 地図注記「奥清津発電所」（2026-10-24取得）から約20m。奥清津第二発電所（tokyo-place-奥清津第二発電所）は約230m 北。連系線（No.69）の端は区画の中の点のまま。'}];}
// 照合区分のない線（tokyo-section-* の500kV・275kVの一部）に、西日本・東北と同じ規則（scripts/assign-tiers.mjs の classify）で区分を付ける（2026-11-04 オーナー承認 保留70）。
// 東京の地域の原本 data/raw/tokyo-osm は275kVだけなので、東京と周辺の取得分を合わせた索引で判定する。既に区分のある線は変えない（assert）。公表区間は東京PG 系統構成・設備一覧
{const {classify,osmIndexDirs}=await import('./assign-tiers.mjs');
 const idx=osmIndexDirs(['data/raw/osm-trunk.json','data/raw/osm-trunk-expanded.json',...[1,2,3,4,5,6,7].map(i=>`data/raw/osm-trunk-neighbors-${i}.json`),'data/raw/tohoku-osm','data/raw/north-ties','data/raw/hokuriku-osm','data/raw/chubu-osm','data/raw/jpower-osm','data/raw/nakatokyo-south-osm','data/raw/nakatokyo-osm','data/raw/tokyo-500-support','data/raw/tokyo-500','data/raw/tokyo-275','data/raw/tokyo-osm']);
 const fb=new Map(facilities.map(f=>[f.id,f])),tiered=l=>l.attributes?.some(a=>a.label==='照合区分'||/^要注意（[CDE]区分/.test(a.label));
 const before=new Map(lines.filter(tiered).map(l=>[l.id,JSON.stringify(l.attributes)])),count={A:0,B:0,C:0};
 for(const l of lines){if(tiered(l))continue;
  if(l.osmIds.some(i=>i>0&&!idx.ways.has(i)))throw Error('照合区分：索引にない線分 '+l.id);
  if(l.osmIds.some(i=>idx.tagDiffers.has(i)))throw Error('照合区分：原本どうしで線名・電圧が違う線分 '+l.id);
  const t=classify(l,idx,fb);if(!(t.tier in count))throw Error('照合区分：想定外の区分 '+t.tier+' '+l.id);count[t.tier]++;
  const why=t.tier==='A'?'公表区間（東京PG 系統構成・設備一覧）の両端の設備に、同名のOSM線（＋両端の短い引込）だけで到達。':t.tier==='B'?'公表区間（東京PG 系統構成・設備一覧）の両端に到達。'+t.reasons.join('、')+'。':t.reasons.join('、')+'。';
  l.attributes=[...(t.tier==='C'?[{label:'要注意（C区分）',value:'公表区間の両端は分かるが、OSMの経路との対応を確定できない参考表示（理由は照合の根拠）。'}]:[]),{label:'照合区分',value:t.tier+'区分'},{label:'照合の根拠',value:why},...l.attributes];}
 for(const [id,a] of before)if(JSON.stringify(lines.find(l=>l.id===id).attributes)!==a)throw Error('照合区分：既存の区分の線が変わった '+id);
 console.log('tokyo tiers',JSON.stringify(count),'索引',idx.files,'ファイル',idx.ways.size,'線分','重複',idx.duplicates,'うち節点の並びが違う',idx.differing,'線名・電圧が違う',idx.tagDiffers.size);}
const data={...base,datasetId:'tokyo-500-v6',rights:'pending',coverage:'東京500kV・275kV整備・'+lines.length+'路線'+facilities.length+'設備の限定検証（新信濃・佐久間・東清水・飛騨の周波数変換関連設備、水力・火力発電所を含む）。東京全域未収録。',lines,facilities,changePlans:plans};const bytes=JSON.stringify(publicWording(data,'tokyo-trunk.json'),null,2)+'\n';fs.writeFileSync('public/data/tokyo-trunk.json',bytes);fs.writeFileSync('config/tokyo-approval.json',JSON.stringify({datasetId:data.datasetId,sha256:createHash('sha256').update(bytes).digest('hex'),lineIds:lines.map(l=>l.assetId),lineVoltages:Object.fromEntries(lines.map(l=>[l.assetId,l.voltageKV])),lineCurrentTypes:Object.fromEntries(lines.filter(l=>l.currentType!=='ac').map(l=>[l.assetId,l.currentType])),facilityIds:facilities.map(f=>f.assetId),trunkExceptionLines},null,2)+'\n');
