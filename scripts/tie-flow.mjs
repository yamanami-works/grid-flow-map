// 連系線の潮流（public/data/tie-flow.json）を作る。2026-10-03「連系線の潮流を進めて」。
// 入力：data/raw/occto-tie-<日付>/<コード>.csv（scripts/fetch-occto-tie.mjs、OCCTO 連系線潮流実績の5分値）と、中部・関西の地内実績（data/validation/*-flow.json）。
// 30分値は各30分の5分値6つの平均（00:00の値＝00:05〜00:30）。各エリアの地内実績と同じ時刻の並び。
// 向き（OCCTOのグラフの縦軸で確認）：関門 正＝中国→九州、本四 正＝中国→四国、阿南紀北 正＝関西→四国、西播東岡山線・山崎智頭線 正＝関西→中国、
//   北海道・本州間 正＝北海道→東北、相馬双葉幹線 正＝東北→東京、周波数変換設備 正＝東京→中部、
//   関西フェンス 正＝中部・北陸→関西、中部フェンス 正＝中部→北陸・関西、北陸フェンス 正＝中部・関西→北陸。
// 三重東近江線・越前嶺南線（・南福光）は2024年度からループ系統としてフェンス単位の公表で、個別の値は空欄。
//   三重東近江線＝両端（三重開閉所・東近江開閉所）につながる地内送電線の潮流の収支の平均（推定）。
//   越前嶺南線＝関西フェンス−三重東近江線（推定。南福光は地図に線がないので使わない）。
// 使い方: node --experimental-strip-types scripts/tie-flow.mjs
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {reviewedChubuDay} from '../src/chubu-domain.ts';
import {reviewedKansaiDay} from '../src/kansai-domain.ts';
import {writeFlowSplit} from './flow-split.mjs';
import {mergeTieDay,tieDates} from './tie-merge.mjs';
import {parseTieCsv} from './tie-csv.mjs';
const rd=p=>JSON.parse(readFileSync(p,'utf8'));
// CSV の読み取りは tie-csv.mjs（見出し・288行・日付と時刻の並び・数字の形を確かめる。2026-11-02 セキュリティレビュー E）
const csv=(date,code)=>{const f=`data/raw/occto-tie-${date}/${code}.csv`;if(!existsSync(f))return null;return parseTieCsv(readFileSync(f,'utf8'),date,date+'/'+code+'.csv');};
const half=(rows,key)=>Array.from({length:48},(_,i)=>{const v=rows?.slice(i*6,i*6+6).map(r=>r[key]).filter(x=>x!=null)??[];return v.length===6?Math.round(v.reduce((a,b)=>a+b,0)/6):null;});
// 運用容量の30分値：各30分の5分値6つの絶対値の平均（潮流の30分値と同じ区切り。2026-10-10 オーナー指示で時刻別の容量を分母に使う）
const halfCap=(rows,key)=>Array.from({length:48},(_,i)=>{const v=rows.slice(i*6,i*6+6).map(r=>r[key]).filter(x=>x!=null);return v.length===6?Math.round(v.reduce((a,b)=>a+Math.abs(b),0)/6):null;});
const median=a=>{const v=a.filter(x=>x!=null&&x!==0).map(Math.abs).sort((x,y)=>x-y);return v.length?v[v.length>>1]:null;};
const regional=(region,review)=>{const f=`public/data/${region}-flow.json`;return existsSync(f)?new Map(rd(f).days.map(d=>[d.date,review(d)])):new Map();};
const chubu=regional('chubu',reviewedChubuDay),kansai=regional('kansai',reviewedKansaiDay);
// 設備へ入る地内送電線の潮流の合計（正＝設備へ入る）
const inflow=(day,node)=>Array.from({length:48},(_,i)=>{if(!day)return null;let s=0,n=0;for(const l of day.actual.lines){if(l.from!==node&&l.to!==node)continue;const t=`${day.date}T${String(i>>1).padStart(2,'0')}:${i%2?'30':'00'}:00`;const k=day.actual.times.indexOf(t);const v=k<0?null:l.values[k];if(v==null)return null;s+=l.to===node?v:-v;n++;}return n?s:null;});
const LINES=[
 // [コード, 地図の線名, kV, 正方向の起点設備, 終点設備, 注記]
 // 東日本（2026-10-03「北海道と東北、東北と東京、東京と中部の連系線も潮流表示して」）
 ['01','北本直流幹線',250,'電源開発株式会社北地域制御所','上北変換所','OCCTO連系線潮流実績「北海道・本州間電力連系設備」（北本・北斗今別の2設備の合計）。正方向＝北海道→東北。2線それぞれに合計値を表示。函館変換所はOSMの「電源開発株式会社北地域制御所」の区画。'],
 // 表示名は「北斗今別直流幹線（新北本連系）」（一次資料の線名は北斗今別直流幹線、設備全体は新北本連系設備。2026-10-10 オーナー指示）
 ['01','北斗今別直流幹線（新北本連系）',250,'北斗変換所','今別変換所','OCCTO連系線潮流実績「北海道・本州間電力連系設備」（北本・北斗今別の2設備の合計）。正方向＝北海道→東北。2線それぞれに合計値を表示。'],
 // 相馬双葉幹線は 2026-06-30 から南いわき開閉所ではなく東京PG 福島幹線山線 No.10 につながる（2026-11-05 保留78）。終点は設備のない「分岐点」（src/flow-path.ts）
 ['02','相馬双葉幹線',500,'南相馬変電所','分岐点','OCCTO連系線潮流実績（相馬双葉幹線）。正方向＝東北→東京。'],
 ['03','新信濃FC 中部側連系線（OSM無名）',275,'新信濃変電所','中信変電所','OCCTO連系線潮流実績「周波数変換設備」（新信濃・飛騨信濃・佐久間・東清水の合計）。正方向＝東京→中部。新信濃・飛騨信濃・東清水の3線に合計値を表示（佐久間は地図の線で50Hz側・60Hz側を分けられないため表示しない）。'],
 ['03','飛騨信濃直流幹線',200,'新信濃変電所','飛騨変換所','OCCTO連系線潮流実績「周波数変換設備」（新信濃・飛騨信濃・佐久間・東清水の合計）。正方向＝東京→中部。新信濃・飛騨信濃・東清水の3線に合計値を表示。'],
 ['03','東清水FC 中部側連系線（OSM無名）',275,'東清水変電所','駿河変電所','OCCTO連系線潮流実績「周波数変換設備」（新信濃・飛騨信濃・佐久間・東清水の合計）。正方向＝東京→中部。新信濃・飛騨信濃・東清水の3線に合計値を表示。'],
 ['10','関門連系線',500,'新山口変電所','北九州変電所','OCCTO連系線潮流実績（関門連系線）。正方向＝中国→九州。'],
 ['09','本四連系線',500,'東岡山変電所','讃岐変電所','OCCTO連系線潮流実績（本四連系線）。正方向＝中国→四国。'],
 ['08','阿南紀北直流幹線',250,'紀北変換所','阿南変換所','OCCTO連系線潮流実績（阿南紀北直流幹線）。正方向＝関西→四国。'],
 ['07','西播東岡山線',500,'西播変電所','東岡山変電所','OCCTO連系線潮流実績「西播東岡山線・山崎智頭線」（2線の合計）。正方向＝関西→中国。2線それぞれに合計値を表示。'],
 ['07','山崎智頭線',500,'山崎開閉所','智頭変電所','OCCTO連系線潮流実績「西播東岡山線・山崎智頭線」（2線の合計）。正方向＝関西→中国。2線それぞれに合計値を表示。'],
];
// 原本のない日・線は前回の tie-flow.json の値を残す（scripts/tie-merge.mjs、2026-11-01 公開残件3-B）。Actions では前回分を公開中のサイトから読み戻す（scripts/restore-flows.mjs）
const prevDays=existsSync('public/data/tie-flow.json')?rd('public/data/tie-flow.json').days??[]:[],prev=new Map(prevDays.map(d=>[d.date,d]));
const rawDates=existsSync('data/raw')?readdirSync('data/raw').filter(d=>/^occto-tie-\d{4}-\d{2}-\d{2}$/.test(d)).map(d=>d.slice(10)):[];
const dates=tieDates(rawDates,prevDays);
const days=[];
for(const date of dates){
 if(!rawDates.includes(date)){if(prev.has(date))days.push(prev.get(date));continue;}
 const times=Array.from({length:48},(_,i)=>`${date}T${String(i>>1).padStart(2,'0')}:${i%2?'30':'00'}:00`);
 const lines=[],capacities=[];let retrievedAt='';
 const src=existsSync(`data/raw/occto-tie-${date}/source.json`)?rd(`data/raw/occto-tie-${date}/source.json`).files:[];retrievedAt=src.map(f=>f.retrievedAt).sort().at(-1)??'';
 for(const [code,name,kv,from,to,note] of LINES){const rows=csv(date,code);if(!rows)continue;const values=half(rows,'mw');if(values.every(v=>v==null))continue;
  lines.push({id:`tie-${code}-${name}`,name,voltageKV:kv,from,to,note,values});
  // 容量は運用容量の時刻別（30分値、capacityValues）を分母に使う。capacityMW は日中央値（向き別、表示用の代表値）
  const capF=median(rows.map(r=>r.capF)),capR=median(rows.map(r=>r.capR));
  if(capF)capacities.push({id:`tie-cap-${code}-${name}-f`,name,voltageKV:kv,from,to,capacityMW:capF,capacityValues:halfCap(rows,'capF'),constraint:'運用容量（30分値＝5分値6つの平均）'});
  if(capR)capacities.push({id:`tie-cap-${code}-${name}-r`,name,voltageKV:kv,from:to,to:from,capacityMW:capR,capacityValues:halfCap(rows,'capR'),constraint:'運用容量（30分値＝5分値6つの平均）'});}
 // 三重東近江線・越前嶺南線（推定）
 const mie=inflow(chubu.get(date),'三重開閉所'),hig=inflow(kansai.get(date),'東近江開閉所'),fenceK=half(csv(date,'15'),'mw');
 const x=mie.map((m,i)=>m==null||hig[i]==null?null:Math.round((m-hig[i])/2)); // 正＝中部→関西
 if(x.some(v=>v!=null))lines.push({id:'tie-04-三重東近江線',name:'三重東近江線',voltageKV:500,from:'三重開閉所',to:'東近江開閉所',values:x,
  note:'推定：OCCTOは三重東近江線を個別に公表しない（中部・北陸・関西のループ系統はフェンス単位）。三重開閉所と東近江開閉所につながる地内送電線（OCCTO地内実績）の潮流の収支の平均。正方向＝中部→関西。'});
 const y=x.map((v,i)=>v==null||fenceK[i]==null?null:fenceK[i]-v); // 正＝北陸→関西
 if(y.some(v=>v!=null))lines.push({id:'tie-06-越前嶺南線',name:'越前嶺南線',voltageKV:500,from:'越前変電所',to:'嶺南変電所',values:y,
  note:'推定：OCCTOは越前嶺南線を個別に公表しない。関西フェンス（中部・北陸→関西の合計、OCCTO連系線潮流実績）から三重東近江線の推定値を引いた値。正方向＝北陸→関西。'});
 const day=mergeTieDay(prev.get(date),lines.length?{date,retrievedAt,sourceUrl:'https://occtonet3.occto.or.jp/public/dfw/RP11/OCCTO/SD/LOGIN_login',attribution:'出典：OCCTO系統情報サービス（連系線潮流実績）。30分平均・三重東近江線と越前嶺南線の推定は本アプリで加工。',
  actual:{times,originalTimes:times.map(t=>t.replace('T',' ')),lines},capacities}:null,code=>code!=='04'&&code!=='06'&&existsSync(`data/raw/occto-tie-${date}/${code}.csv`)); // 推定の2線（04・06）は CSV から作らないので、作れなかったときは前回分を残す
 if(day)days.push(day);
}
// 北本直流幹線は OSM で複数の線分（陸上の区間・海底区間（表示名はどちらも北本直流幹線、海底区間の OSM名 HVDC Hokkaido-Honschu）・無名の線分）に分かれる（public/data/tohoku-dc-osm.json）。画面で同じ経路として扱う対応表
const lineAliases={'osm-244040213-250':['北本直流幹線'],'osm-797840188-250':['北本直流幹線'],'osm-797840190-250':['北本直流幹線'],'osm-797840191-250':['北本直流幹線']};
// 前回分から引き継いだ日（mergeTieDay・restore-flows）の起点・終点も、上の表にそろえる（相馬双葉幹線の終点の変更、2026-11-05 保留78）。全連系線に当てるが、相馬双葉幹線以外は表と同じ値で上書きするだけ
for(const d of days){for(const l of d.actual?.lines??[]){const row=LINES.find(([code,name])=>l.id===`tie-${code}-${name}`);if(row){l.from=row[3];l.to=row[4];}}
 for(const c of d.capacities??[]){const row=LINES.find(([code,name])=>c.id.startsWith(`tie-cap-${code}-${name}-`));if(row){const f=c.id.endsWith('-f');c.from=f?row[3]:row[4];c.to=f?row[4]:row[3];}}}
writeFileSync('public/data/tie-flow.json',JSON.stringify({schemaVersion:1,days,lineAliases,updatedAt:new Date().toISOString()})+'\n');
// 画面用の分割（各地域の潮流と同じ形。scripts/flow-split.mjs、2026-10-10）
writeFlowSplit('public/data/tie-flow.json');
console.log('tie-flow days',days.length,days[0]?.date,days[0]?.actual.lines.map(l=>l.name+':'+l.values.find(v=>v!=null)).join(' '));
