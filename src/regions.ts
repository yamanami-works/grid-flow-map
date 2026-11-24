import {latestIndex} from './occto-time.ts';
import {regionMapSources} from './primary-sources.ts';
import {trunkDisplay} from './display-settings.ts';
export type RegionId='tohoku'|'hokkaido'|'tokyo'|'chubu'|'hokuriku'|'kansai'|'chugoku'|'shikoku'|'kyushu'|'national'|'tie';
const hokkaidoSources=[
 {label:'北海道の系統構成（実績・2026-05-29版）',url:'https://www.hepco.co.jp/network/con_service/public_document/pdf/sys_config_results.pdf'},
 {label:'北海道の系統・設備資料（北海道電力NW公式）',url:'https://www.hepco.co.jp/network/con_service/public_document/bid_info.html'},
];
export const regions={
 tokyo:{label:'東京',voltages:[500,275],coverage:'東京500kV・275kVの限定検証（周波数変換所・水力/火力発電所を含む。東清水FCの東京側接続線（154kV）は基幹系統+連系線と154/66kVの両方で表示）。一部は部分表示・ルート不明の直線。',sources:regionMapSources.tokyo},
 kyushu:{label:'九州',voltages:[500,220],coverage:'九州の500kV全12区間と220kV全59区間（OCCTO九州の公表区間。九州電力の基幹系統は500kVと220kV）。地理はOSM。照合区分A・BはOCCTO公表区間の両端にOSMの線で到達したもの、C・Dは要注意。OSMで途切れた所は直線（破線）で補完。名前のない区画や名称違いの区画（速水→速見、川内電力所→川薩など）は所在地で名称を当てた（推定を含む）。',sources:regionMapSources.kyushu},
 shikoku:{label:'四国',voltages:[500,187],coverage:'四国の500kV全4区間と187kV全21区間（OCCTO四国の公表区間。四国電力の基幹系統は500kVと187kV）。地理はOSM。照合区分A・BはOCCTO公表区間の両端にOSMの線で到達したもの、C・Dは要注意。OSMで名称が実態と違う区画（川内変電所・阿南変換所）は名称を当て直した。',sources:regionMapSources.shikoku},
 chugoku:{label:'中国',voltages:[500,220],coverage:'中国の500kV全11区間と220kV全18区間（OCCTO中国の公表区間。中国電力の基幹系統は500kVと220kV）。地理はOSM。照合区分A・BはOCCTO公表区間の両端にOSMの線で到達したもの、C・Dは要注意。線名が端点の区間（山口幹線→南山口など）は、終点から親の線に着く点を分岐点とみなした推定。広島中央線は分岐点を推定した直線（D区分）、北尾道連絡線は終点の手前を直線で補完。',sources:regionMapSources.chugoku},
 kansai:{label:'関西',voltages:[500,275],coverage:'関西の500kV全25区間と275kV全29区間（OCCTO関西の公表区間）。地理はOSM。照合区分A・BはOCCTO公表区間の両端にOSMの線で到達したもの、C・Dは要注意。鉄塔番号の端（42T・17T）は支線の合流点とみなした推定、OSMの途切れは直線（破線）で補完。終点が3変電所の西大阪小曽根線＋北豊中線は3本の直線（D区分、潮流は合計のため割り当てない）。',sources:regionMapSources.kansai},
 hokuriku:{label:'北陸',voltages:[500,275],coverage:'北陸の500kV全4区間と275kV全7区間（OCCTO北陸の公表区間）。地理はOSM。照合区分A・BはOCCTO公表区間の両端にOSMの線で到達したもの、C・Dは要注意。OSMで途切れた所は直線（構造不明＝破線）で補完。設備の名称は無名区画に所在地で当てたものを含む。275/500kVに接続する発電所（志賀原子力・七尾大田火力・富山新港火力）もOSMの登録値つきで表示（電源線は潮流なし）。',sources:regionMapSources.hokuriku},
 chubu:{label:'中部',voltages:[500,275],coverage:'中部の500kV全17区間と275kV全64区間（OCCTO中部の公表区間）。地理はOSM。照合区分A・BはOCCTO公表区間の両端にOSMの線で到達したもの、C・Dは要注意。OSMの共有ノードだけでつながらなかった20区間は、OSMの線分でたどれたものはその経路、名古屋都市部の地中線などOSMにないものは両端を結ぶ直線（地中の根拠がある区間は点線、構造不明は破線）。設備の位置は住所・資料による。275/500kVに接続する発電所（新名古屋火力・渥美火力・奥美濃・高根第一など）もOSMの登録値つきで表示（OCCTO公表外の電源線は潮流なし）。',sources:regionMapSources.chubu},
 tohoku:{label:'東北',voltages:[500,275],coverage:trunkDisplay.coverage,sources:regionMapSources.tohoku},
 hokkaido:{label:'北海道',voltages:[275,187],coverage:'北海道の275/187kV公表89区間のうち81区間を表示（うち43区間はOSMの経路だけで描いた参考表示＝要注意、京極は部分収録。匿名の他社線は系統構成の図のつながりから推定したものを含む）。名称・端点が匿名の他社線など8区間は未収録。187/275kV線が届く水力・火力発電所を含む。関連DCは既存参照経路。',sources:regionMapSources.hokkaido},
 // 連系線（2026-10-10）：OCCTO 連系線潮流実績の対象の線だけを全国の地図に出す
 tie:{label:'連系線',voltages:[500,275],coverage:'地域間連系線（OCCTO 連系線潮流実績の対象の線）：北海道・本州間（北本・新北本）、相馬双葉幹線、周波数変換設備（新信濃・飛騨信濃・東清水）、西播東岡山線・山崎智頭線、本四連系線、阿南紀北直流幹線、関門連系線、三重東近江線・越前嶺南線（推定）。地理はOSM。',sources:[] as {label:string;url:string}[]},
 national:{label:'全国',voltages:[500,275,220,187],coverage:'全国（利用可能な収録済み範囲）。東北＋北海道の限定収録範囲。下位は宮城の限定範囲のみ。',sources:[]},
};
export type RegionalSnapshot={commonLatest?:number;date:string;retrievedAt:string;sourceUrl:string;attribution:string;actual:{times:string[];originalTimes:string[];lines:{id:string;name:string;voltageKV:number;from:string;to:string;note:string;values:(number|null)[]}[]};capacities:{id:string;name:string;voltageKV:number;from:string;to:string;capacityMW:number|null;constraint?:string;capacityValues?:(number|null)[];excluded?:string}[]};
// Align exact timestamps. Missing observations are never carried forward.
// wait：グループごとに最新時刻をそろえる対象にするか（連系線は false。取得が各地域より数分遅れるので待つと地図全体が30分古くなる、2026-10-04）
export function combineRegionDays(groups:RegionalSnapshot[][],wait:boolean[]=groups.map(()=>true)):RegionalSnapshot[]{
 const dates=[...new Set(groups.flatMap(g=>g.map(d=>d.date)))].sort().reverse().slice(0,30);
 return dates.map(date=>{const days=groups.flatMap(g=>g.filter(d=>d.date===date)),waits=groups.flatMap((g,k)=>g.filter(d=>d.date===date).map(()=>wait[k]!==false));const first=days[0];const times=Array.from({length:48},(_,i)=>`${date}T${String(i>>1).padStart(2,'0')}:${i%2?'30':'00'}:00`);
  // 各公表元の最新時刻のうち一番早いもの（データのある公表元だけ）
  const lasts=days.filter((_,k)=>waits[k]).map(d=>{const li=latestIndex(d);return d.actual.lines.some(l=>l.values[li]!=null)?times.indexOf(d.actual.times[li]):-1;}).filter(i=>i>=0);
  return {...first,commonLatest:lasts.length?Math.min(...lasts):undefined,retrievedAt:days.map(d=>d.retrievedAt).sort().at(-1)!,actual:{times,originalTimes:times.map(t=>t.replace('T',' ')),lines:days.flatMap(d=>{
   // 時刻の位置は公表元の1日ごとに1回だけ求める（以前は線ごと・時刻ごとに探し直していた。2026-10-10 表示速度の改善）
   const at=times.map(t=>d.actual.times.indexOf(t));
   return d.actual.lines.map(l=>({...l,values:at.map(i=>i<0?null:l.values[i]??null)}));})},capacities:days.flatMap(d=>d.capacities)};});
}
export function uniqueAssets<T extends {id:string;assetId?:string}>(items:T[]):T[]{return [...new Map(items.map(i=>[i.assetId??i.id,i])).values()];}
