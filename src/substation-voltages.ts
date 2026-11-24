// 変電所の電圧区分を、確認できた根拠（各社の公表変圧器・接続する収録線路・OSM登録）から組み立てる。
// 公表変圧器は名称で照合し、地図の設備の電圧（OSM登録・接続線路）と一つも重ならないものは同名の別設備とみなして使わない。
import type {GeoFacility, GeoLine} from './real-domain.ts';

export interface PublishedBank {primaryKV:number; secondaryKV:number; units?:number; source:number}
export interface SubstationVoltageTable {
  schemaVersion:1; basis:string;
  sources:{region:string; label:string; url:string; published:string|null; file:string}[];
  regions:Record<string, Record<string, {names:string[]; banks:PublishedBank[]}>>;
}
export interface VoltageEvidence {
  voltages:number[];
  banks:(PublishedBank & {sourceLabel:string; published:string|null; url:string; name:string})[];
  lineVoltages:number[]; osmVoltages:number[];
}

/** 表記ゆれを除いた照合用の名称（号機表記「（１）」「(2)」、末尾の「変電所」「開閉所」、会社名、空白）。変換所は同じ地名の変電所と別設備なので名称を残す。 */
export function normalizeSubstationName(name:string){
  return name.normalize('NFKC').replace(/\s+/g,'').replace(/^'/,'')
    .replace(/^(東北電力(ネットワーク)?|北海道電力(ネットワーク)?|東京電力(パワーグリッド)?|中部電力(パワーグリッド)?)/,'')
    .replace(/\((\d+|[A-Z])\)$/,'').replace(/(変電所|開閉所|SS|S\/S)$/,'').replace(/\((\d+|[A-Z])\)$/,'')
    .replace(/(?<=\D)(\d+[BU]?[・,、-]?)+$/,''); // 東京の表はバンク番号付き（「新野田11・12・14B」「戸塚1，2」「新富士2U」）
}
const desc=(a:number,b:number)=>b-a;
const uniq=(xs:number[])=>[...new Set(xs)].sort(desc);

/** 設備ごとの電圧の根拠。発電所は公表変圧器（変電所の表）と照合しない。
 * regions は照合する会社の表の順（自地域→隣接地域）。地域の境の設備（東清水・新北信など）は隣の会社の表で見つかる。 */
export function voltageEvidence(f:GeoFacility, lines:GeoLine[], table:SubstationVoltageTable|null, regions:string[]):VoltageEvidence{
  const osmVoltages=uniq(f.voltages);
  const lineVoltages=uniq(lines.filter(l=>l.currentType!=='dc'&&l.connections?.some(c=>c.facilities.some(x=>x.id===f.id))).map(l=>l.voltageKV));
  const known=new Set([...osmVoltages,...lineVoltages]);
  let used:VoltageEvidence['banks']=[];
  if(f.kind!=='plant'&&table)for(const region of regions){
    const entry=table.regions[region]?.[normalizeSubstationName(f.name)];if(!entry)continue;
    const banks=entry.banks.map(b=>{const s=table.sources[b.source];return {...b,sourceLabel:s.label,published:s.published,url:s.url,name:entry.names.join('・')};});
    if(!known.size||banks.some(b=>known.has(b.primaryKV)||known.has(b.secondaryKV))){used=banks;break;}
  }
  return {voltages:uniq([...known,...used.flatMap(b=>[b.primaryKV,b.secondaryKV])]),banks:used,lineVoltages,osmVoltages};
}

/** 地域ごとの照合順 */
export const TABLE_ORDER:Record<string,string[]>={tohoku:['tohoku','tokyo','chubu','hokkaido'],hokkaido:['hokkaido','tohoku'],tokyo:['tokyo','chubu','tohoku'],chubu:['chubu','tokyo'],hokuriku:['hokuriku','chubu','kansai'],kansai:['kansai','hokuriku','chubu','chugoku'],chugoku:['chugoku','kansai','shikoku'],shikoku:['shikoku','chugoku','kansai'],kyushu:['kyushu','chugoku']};

/** データセット（地域）ごとに全設備の根拠を求める。 */
export function evidenceFor(facilities:GeoFacility[], lines:GeoLine[], table:SubstationVoltageTable|null, region:string){
  return new Map(facilities.map(f=>[f.id,voltageEvidence(f,lines,table,TABLE_ORDER[region]??[region])]));
}

const kvText=(v:number)=>String(v);
/** 「500/275kV×3台・275/154kV×2台」 */
export function bankSummary(banks:VoltageEvidence['banks']){
  const m=new Map<string,number|undefined>();
  for(const b of banks){const k=kvText(b.primaryKV)+'/'+kvText(b.secondaryKV);m.set(k,b.units===undefined?m.get(k):(m.get(k)??0)+b.units);}
  return [...m].map(([k,u])=>k+'kV'+(u?'×'+u+'台':'')).join('・');
}

// 公開版（変圧器一覧を同梱しない）の詳細欄に出す各社の公表資料（系統空容量の変圧器一覧）。2026-10-03：許諾確認まで公開・iOSビルドから除外
// 2026-11-04 に詳細欄からリンクを一旦外した（ダウンロードになるため）。今は画面から使っていない（容量の記載を検討するときの資料一覧として残す）
export const TSO_TABLE_LINKS:Record<string,{label:string;url:string}>={
 tohoku:{label:'東北電力ネットワーク 系統空容量（変圧器）',url:'https://nw.tohoku-epco.co.jp/consignment/system/announcement/data/sys_capa_local01_tr_202609_02.csv'},
 hokkaido:{label:'北海道電力ネットワーク 系統空容量（基幹系統）',url:'https://www.hepco.co.jp/network/con_service/public_document/zip/sys_capa_kikan.zip'},
 tokyo:{label:'東京電力パワーグリッド 予想潮流（変電所）',url:'https://www.tepco.co.jp/pg/consignment/system/pdf/csv_yosochoryu_kikan.zip'},
 chubu:{label:'中部電力パワーグリッド 系統空容量・予想潮流マッピング',url:'https://gridmap.powergrid.chuden.co.jp/geo_data/KRSIH010'},
 hokuriku:{label:'北陸電力送配電 系統空容量（基幹変圧器）',url:'https://www.rikuden.co.jp/nw_notification/attach/sys_capa_kikan01_tr_202609_05.csv'},
 kansai:{label:'関西電力送配電 変圧器の空容量（154kV以上）',url:'https://www.kansai-td.co.jp/interchange/takusou/pdf/154kv_more_trans.csv'},
 chugoku:{label:'中国電力ネットワーク 系統空容量（220kV）',url:'https://www.energia.co.jp/nw/service/retailer/keitou/access/zip/csv_220kv.zip'},
 shikoku:{label:'四国電力送配電 系統空容量（基幹変圧器）',url:'https://www.yonden.co.jp/nw/assets/line_access/data/sys_capa_kikan00_tr_202610_08.csv'},
 kyushu:{label:'九州電力送配電 系統空容量（変圧器）',url:'https://www.kyuden.co.jp/var/rev0/0925/6795/td_oLsu7j3Y.zip'},
};
