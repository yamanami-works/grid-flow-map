import {DOTTED, pathDash, isCaution, LINE_OPACITY, BAND_OPACITY, osmWays} from './line-drawing';
import {applyStatus, statusLabel} from './asset-status';
import {annotateEvidence,facilityTierOf} from './evidence';
import {reviewedTokyoDay,withoutTokyoOverlap} from './tokyo-domain.ts';
import {reviewedChubuDay} from './chubu-domain.ts';
import {reviewedHokurikuDay} from './hokuriku-domain.ts';
import {reviewedKansaiDay} from './kansai-domain.ts';
import {reviewedChugokuDay} from './chugoku-domain.ts';
import {reviewedShikokuDay} from './shikoku-domain.ts';
import {reviewedKyushuDay} from './kyushu-domain.ts';
import {reviewedTohokuDay} from './tohoku-domain.ts';
import {plansTableMarkup,type ChangePlan,type PlanTarget} from './change-plans';
import {facilitySymbol,plantSourceOf,PLANT_SOURCES,CUSTOMER_COLOR} from './facility-symbol';
import {detailHtml,rowsHtml,connectedLinesHtml,notesButtonHtml,uniqueNotes,flowSide,flowCardNotes,UNKNOWN,type DetailView,type Badge,type Tone,type Row,type SourceItem,type FlowCard,type ConnectedLine} from './detail-panel';
import './detail-panel.css';
import './facility-symbol.css';
import {selectionPane,selectionStrokes} from './selection-style';
import {reviewedHokkaidoDay} from './hokkaido-domain.ts';
import {regions,combineRegionDays,uniqueAssets,type RegionId} from './regions';
import {electricalColor,trunkDisplay,voltageFilterLabel,dcScopeVisible,facilityElectricalVisible,trunkVoltageShown} from './display-settings';
import {validatePilot} from '../scripts/pilot-validation.mjs';
import {externalLink, escapeHtml} from './safe-html';
import {MiyagiPilotView, LOWER_RANGE_LABEL} from './miyagi-pilot';
import {LinePicker} from './line-picker';
import {FacilityLabels} from './facility-labels';
import {endpointName} from './endpoint-aliases';
import {lineWidth,particleWidth,lineWidthProfile} from './line-style';
import {validDays,followsLatest,observedMessage,mergeLatest,type FlowIndexEntry} from './occto-refresh';
import {canUse, voltageColor} from './access-policy';
import {loadCatalog,datasetUrl} from './data-catalog';
import {voltageEvidence,bankSummary,TABLE_ORDER,type SubstationVoltageTable,type VoltageEvidence} from './substation-voltages';
import type {DatasetManifest} from './data-contracts';
let catalog:DatasetManifest;
import {compareCapacity} from './capacity-comparison';
import {latestIndex} from './occto-time';
import {FlowParticles,type Particle} from './flow-canvas';
import { capacityUsageInfo, combinedRowGroups, isWorkCapacity } from './occto-domain';
import { referenceFlowPath,flowBranches,offRowAt,offRowEnds } from './flow-path';
import L from 'leaflet';
import { actualFlowSource, primarySources, regionMapSources, regionSourceNote } from './primary-sources';
import { dcReferences, tieCapacityNotes } from './dc-catalog';
import { plantTypeView } from './plant-type';
import { plantExtraUnits } from './plant-extra-units';
import { type NuclearStatus, NRA_PLANT_IDS, nuclearStale, nuclearUnitStatus } from './nuclear-status';
import { type UnitOutages, outagesStale, unitOutageView } from './unit-outages';
import { mergeUnits, hjksUnitName, type UnitView } from './plant-unit-list';
import 'leaflet/dist/leaflet.css';
import './style.css';
import './real.css';
import { band, colors } from './domain';
import { osmFillCounts, candidateGeometry, changedDefinition, forecastUsage, normalizeName, inPrototypeScope, referenceStatus, invalidateNameIndex, facilityQueryMatch, recordLines } from './real-domain';
import type { Geography, GeoLine, GeoFacility, OfficialResearch, ActualLine, ForecastLine } from './real-domain';
import { legalLinksHtml, LEGAL_DIALOG_HTML, bindLegal } from './legal';
import { bindOutsideTapClose } from './mobile-panels';
import { verifiedDay } from './flow-hash';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const esc = escapeHtml;
// 数値の書式は1つの Intl.NumberFormat を使い回す（toLocaleString は呼ぶたびに書式を作る。2026-10-10 表示速度の改善。表示は同じ）
const jaNumber = new Intl.NumberFormat('ja-JP');
const number = (n: number | null | undefined) => n == null ? '不明' : jaNumber.format(n);
const kinds = { substation: '変電所', switchyard: '開閉所', plant: '発電所', converter: '変換所', customer: '需要家' };
type Mode = 'geo' | 'actual' | 'forecast' | 'facility';
let geography: Geography | null = null, official: OfficialResearch | null = null;
let mapPreview=false;
let mode: Mode = 'geo', query = '', selectedId: string | null = null;
let voltages = new Set<number>(), day = '2024-04-01', hourIndex = 11;
const dcFacilityIds = new Set<string>();
let dcScopeLines:GeoLine[]=[];
const currentDefinitions = new Map<string, ForecastLine>();
type OcctoSnapshot = {date:string;retrievedAt:string;capacityRetrievedAt?:string;attribution:string;sourceUrl:string;actual:OfficialResearch['actual'];capacities:{id:string;name:string;voltageKV:number;from:string;to:string;capacityMW:number|null;constraint?:string;capacityValues?:(number|null)[];excluded?:string;capacityRetrievedAt?:string}[]};
type NetworkLine=ForecastLine&{sourceUrl:string;n1:string;curtailment:string};
let networkCapacity:{lines:NetworkLine[];retrievedAt:string}|null=null;
// 東北の送電線の回線数だけ（公開版。東北電力NW の表そのものは携帯用ビルドだけ。2026-11-09）
let tohokuCircuits:{lines:{name:string;voltageKV:number;circuitCount:number|null;published:string|null;sourceUrl:string|null}[]}|null=null;
let substationTable:SubstationVoltageTable|null=null;
// 送電線の設備容量・N-1電制・出力制御・回線数（各社の系統空容量一覧、自分用プレビューだけ。tools/build-line-capacity.mjs）
type LineCap={region:string;no:string;name:string;kv:number;circuits:number|null;equipmentMW:number|null;constraint:string|null;direction:string;n1:string|null;n1MW:number|null;curtailment:string|null;published:string|null;source?:string;url?:string};
let lineCapacity:{lines:Record<string,LineCap>}|null=null;
const voltageCache=new Map<string,VoltageEvidence>();
/** 設備の電圧区分（公表変圧器・接続する収録線路・OSM登録）。設備はそれを収録した地域データの線路・会社の表で照合する。 */
function facilityVoltage(f:GeoFacility):VoltageEvidence{
 const hit=voltageCache.get(f.id);if(hit)return hit;
 // 東京と中部の境の設備（東清水など）は両方のデータに同じIDで入るので、両方の線路を合わせて見る
 const owners=([['hokkaido',hokkaidoGeography],['tokyo',tokyoGeography],['chubu',chubuGeography],['hokuriku',hokurikuGeography],['kansai',kansaiGeography],['chugoku',chugokuGeography],['shikoku',shikokuGeography],['kyushu',kyushuGeography]] as const).filter(([,g])=>g?.facilities.some(x=>x.id===f.id));
 const lines=owners.length?owners.flatMap(([,g])=>g!.lines):baseGeography?.lines??geography?.lines??[];
 const e=voltageEvidence(f,lines,substationTable,[...new Set((owners.length?owners.map(([r])=>r):['tohoku']).flatMap(r=>TABLE_ORDER[r]))]);
 if(!booting)voltageCache.set(f.id,e);return e;
}
const voltageText=(f:GeoFacility)=>{const v=facilityVoltage(f).voltages;return v.length?v.join('/')+' kV':'電圧未登録';};
type PlantProfile={id:string;name:string;operator:string;method:string;capacityMW:number|null;capacityBasis:string;note:string;sources:{url:string;checkedAt:string}[];units?:{name:string;mw:number;start:string|null;status:'運転中'|'運転終了'|'建設中'}[];unitsSource?:{url:string;checkedAt:string};unitsNote?:string};
let plantProfiles:PlantProfile[]=[];
// 発電所のユニット別の認可出力（JEPX HJKS、tools/build-plant-units.mjs、公開）
type PlantUnits={retrievedAt:string;source:{name:string;url:string};plants:Record<string,{operators:string[];units:{id:number;unit:string;mw:number;start:string|null;end:string|null;status:'運転中'|'運転終了';company:string;plant:string;code:string;area:string;format:string|null;updated:string|null}[]}>};
let plantUnits:PlantUnits|null=null;
// 原子力の号機の運転状態（原子力規制委員会、scripts/fetch-nra-status.mjs が1日1回取得。2026-11-10）
let nuclearStatus:NuclearStatus|null=null;
// 原子力以外の号機の運転状態（HJKS 停止情報一覧、scripts/fetch-hjks-outages.mjs が1日1回取得。2026-11-24）
let unitOutages:UnitOutages|null=null;
// Always start in the permitted national scope, independently of previous sessions.
let region:RegionId='national';
// Until every region's data has loaded, skip drawing: otherwise Tohoku renders first and the view jumps to national ~3 s later.
let booting=true;
// The 154/66 kV view (all lower-voltage validation data, Miyagi + 東清水 Tokyo side) is the pilot view; see togglePilot.
const LOWER_LABEL=LOWER_RANGE_LABEL;
// Every 154/66 kV item outside the Miyagi pilot (today the 東清水 FC Tokyo-side 154 kV line) is shown in the same 154/66 kV view.
// That line is also shown in the trunk+tie view through its trunkException mark (2026-10-14: both views).
function shareLowerData(){
 if(!pilot||!tokyoGeography)return;
 const lower=tokyoGeography.lines.filter(l=>l.voltageKV<187&&(l.currentType??'ac')==='ac');
 const ids=new Set(lower.flatMap(l=>l.connections?.flatMap(c=>c.facilities.map(f=>f.id))??[]));
 pilot.setExtras(lower,tokyoGeography.facilities.filter(f=>ids.has(f.id)));
}
let showCaution = true;
let changePlans:ChangePlan[]=[];
// 地図の読み込みに失敗したとき（系統変更予定の表で「確認中」のままにしない）
let mapLoadFailed=false;
let tokyoGeography:Geography|null=null;
let chubuGeography:Geography|null=null;
let hokurikuGeography:Geography|null=null;
let kansaiGeography:Geography|null=null;
let chugokuGeography:Geography|null=null;
let shikokuGeography:Geography|null=null;
let kyushuGeography:Geography|null=null;
let kyushuDays:OcctoSnapshot[]=[],kyushuFailed=false;
// 連系線の潮流（OCCTO 連系線潮流実績、scripts/tie-flow.mjs、2026-10-03）。全国表示と、その連系線が端になるエリアの表示に重ねる
let tieDays:OcctoSnapshot[]=[],tieFailed=false;
// 東北の表示：東北のデータに、東京のデータにある連系線（相馬双葉幹線）を足す
const borrowLines=(geo:Geography,from:Geography|null,pick:(l:GeoLine)=>boolean):Geography=>{const ties=from?.lines.filter(pick)??[];return ties.length?{...geo,lines:uniqueAssets([...geo.lines,...ties]),facilities:uniqueAssets([...geo.facilities,...(from?.facilities.filter(f=>ties.some(l=>(l.connections??[]).some(c=>c.facilities.some(x=>x.id===f.id))))??[])])}:geo;};
const tohokuView=():Geography=>borrowLines(baseGeography!,tokyoGeography,l=>l.id.startsWith('tie-'));
// 中部の表示：東京のデータにある周波数変換設備の中部側の線（新信濃・飛騨信濃・東清水）を足す
const FC_LINES=['tokyo-fc-shinshinano-60hz','tokyo-fc-hida-shinano-dc','tokyo-fc-higashishimizu-60hz'];
// 全国・連系線の表示でも、この3本は中部の線と重なる区間を削らない（中部表示と同じ。削ると潮流の経路が中信・駿河まで届かず粒子が出ない。2026-11-08）
const FC_KEEP:ReadonlySet<string>=new Set(FC_LINES);
const chubuView=():Geography=>borrowLines({...(chubuGeography??baseGeography!),lines:chubuGeography?.lines??[],facilities:chubuGeography?.facilities??[]},tokyoGeography,l=>FC_LINES.includes(l.id));
const withTies=(days:OcctoSnapshot[],geo:Geography|null)=>{if(!tieDays.length||!geo)return days;const ties=tieDays.map(d=>({...d,actual:{...d.actual,lines:d.actual.lines.filter(l=>geo.lines.some(x=>x.name===l.name&&x.voltageKV===l.voltageKV))}})).filter(d=>d.actual.lines.length);return ties.length?combineRegionDays([days,ties],[true,false]):days;};
let shikokuDays:OcctoSnapshot[]=[],shikokuFailed=false;
let chugokuDays:OcctoSnapshot[]=[],chugokuFailed=false;
let kansaiDays:OcctoSnapshot[]=[],kansaiFailed=false;
let hokurikuDays:OcctoSnapshot[]=[],hokurikuFailed=false;
let chubuDays:OcctoSnapshot[]=[],chubuFailed=false;
let tokyoDays:OcctoSnapshot[]=[],tokyoFailed=false;
let baseGeography:Geography|null=null,hokkaidoGeography:Geography|null=null;
let tohokuDays:OcctoSnapshot[]=[],hokkaidoDays:OcctoSnapshot[]=[];
let hokkaidoFailed=false;
// 潮流の分割読み込み（2026-10-10）：起動時・更新時は各地域の最新日（<名前>-latest.json）だけを読み、過去日は日付を切り替えた時に
// <名前>-days/<日付>.json?v=<ハッシュ> で読む（scripts/flow-split.mjs）。各地域の *Days は「読み込み済みの日」だけを持つ。
// 日付の選択肢は日付・ハッシュの一覧（index）から作る。一覧のハッシュが変わった過去日（遡及修正）は読み込み済みから外し、次に表示する時に読み直す。
type FlowKey='tohoku'|'hokkaido'|'tokyo'|'chubu'|'hokuriku'|'kansai'|'chugoku'|'shikoku'|'kyushu'|'tie';
const flowIndex=new Map<FlowKey,FlowIndexEntry[]>(),flowLoadedHash=new Map<FlowKey,Map<string,string>>();
let flowLoading:string|null=null,flowLoadFailed:string|null=null;
// その日の後の取得で運用容量が未公表だったため残した値（capacityRetrievedAt）は、容量の行ごとに取得時刻を持たせて詳細パネルに出す（2026-10-30）
const withKeptAt=(d:OcctoSnapshot):OcctoSnapshot=>d.capacityRetrievedAt?{...d,capacities:d.capacities.map(c=>({...c,capacityRetrievedAt:d.capacityRetrievedAt}))}:d;
function applyLatest(key:FlowKey,data:{days:OcctoSnapshot[];index?:FlowIndexEntry[]},current:OcctoSnapshot[],reviewDay:(d:OcctoSnapshot)=>OcctoSnapshot):OcctoSnapshot[]{
 const review=(d:OcctoSnapshot)=>reviewDay(withKeptAt(d));
 if(!Array.isArray(data.index)){// 30日分の形（分割前の配信）：今まで通り全部を使う
  const all=validDays<OcctoSnapshot>(data.days.map(review));flowIndex.set(key,all.map(d=>({date:d.date,hash:''})));flowLoadedHash.set(key,new Map(all.map(d=>[d.date,''])));return all;}
 const m=mergeLatest<OcctoSnapshot>({days:data.days,index:data.index},current,flowLoadedHash.get(key)??new Map(),review);
 flowIndex.set(key,m.index);flowLoadedHash.set(key,m.hashes);return m.days;
}
const regionVoltages=new Map<RegionId,Set<number>>();
const regionViews=new Map<RegionId,{center:L.LatLng;zoom:number}>();
let followLatest=true;
let occto: OcctoSnapshot | null = null;
let occtoDays: OcctoSnapshot[] = [];
let refreshFailed=false;
let refreshing=false;
function selectOcctoDay(date:string){selectFlowDate(date);}
let annualActual: OfficialResearch['actual'] | null = null;
let hasLocalResearch=false;
let flowBasis: 'forecast' | 'actual' | 'occto' = 'occto';
const actualLabel=()=>flowBasis==='occto'?'OCCTO実績':'2024年度実績';
// 使用率＝OCCTOの行の潮流÷同じ行の運用容量（2026-10-10）。分岐をはさむ行も行の経路全体を同じ使用率で色分けし、注記で「行単位の値」と示す。
// 逆潮流は公表の正方向の運用容量で算出（参考）。運用容量がなければ不明（設備容量などで代用しない）
function occtoUsageInfo(record:ActualLine,mw:number){return capacityUsageInfo(record,mw,occto?.capacities ?? [],timeIndex());}
function occtoUsage(record:ActualLine,mw:number) {return occtoUsageInfo(record,mw).usage;}
// 運用容量0の粒子は容量不明と同じ灰色で描く（2026-11-04。それまでは濃い灰＋白縁で分けていた）。負の値で公表された運用容量は絶対値で使用率を出し、通常の色で描く（2026-11-04）
function applyFlowBasis() {
 if(occto){$('#flow-basis option[value=occto]').textContent='OCCTO実績';}
 if(official){if(flowBasis==='occto'&&occto)official.actual=occto.actual;else if(annualActual)official.actual=annualActual;}
 $<HTMLOptionElement>('#data-mode option[value=actual]').textContent=flowBasis==='occto'?'潮流実績 · OCCTO':'潮流実績 · 2024年度（ローカル）';
 day=flowBasis==='occto'&&occto?occto.date:'2024-04-01'; hourIndex=occto?latestIndex(occto):0;
 renderDateOptions();
 flowPathCache.clear();selectedId=null;
}
let showConnected = false;
const visibleKinds = new Set<GeoFacility['kind']>(['substation', 'switchyard', 'plant', 'converter', 'customer']);
const visibleCurrents = new Set(['ac', 'dc', 'unknown']);
const currentLabel = (g: GeoLine) => ({ ac: '交流', dc: '直流 DC', unknown: '方式未確認' }[g.currentType ?? 'unknown']);
const routeColor = (line: GeoLine) => voltageColor(line, 'trunk');
const initial = new URLSearchParams(location.search).get('view');
$('#app').innerHTML = `
<header class="topbar"><div class="brand"><div class="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 2 4.5 13.6h6.1L9.4 22l10.1-12.6h-6.2z"/></svg></div><div><span class="wordmark">でんきの道<span class="brand-slash">/</span></span><span class="brand-title">全国の送電線と電気の流れ</span></div></div><div class="header-right"><button id="real-about" class="icon-button" aria-label="出典と収録状況">ⓘ</button></div></header>
<main class="workspace real-workspace"><aside class="sidebar" aria-label="実設備と公開データを探す">
<div id="region-controls"><label>地域 <select id="region-select"><option value="national" selected>全国</option><option value="hokkaido">北海道</option><option value="tohoku">東北</option><option value="tokyo">東京</option><option value="chubu">中部</option><option value="hokuriku">北陸</option><option value="kansai">関西</option><option value="chugoku">中国</option><option value="shikoku">四国</option><option value="kyushu">九州</option><option value="tie">連系線</option></select></label></div><details class="primary-links"><summary>このエリアの一次情報</summary>${occtoLink()}<span>${esc(regionSourceNote)}</span>${primarySources.map(source => externalLink(source.url, source.label)).join('')}</details><div class="display-settings"><details id="reading-guide"><summary>見方を開く</summary><div id="settings-voltage-legend"></div><p class="guide-head">線</p><ul><li>線色＝電圧</li><li>線幅＝地域の基幹階級に応じた表示<br>（容量や潮流量ではありません。同じ275kVでも地域で幅が異なります）</li><li>直流（DC）＝赤紫（色は上の見本のとおり。線種は交流と同じ）</li><li>実線＝架空送電線、点線＝地中送電線</li><li>直線＝両端は分かるがルート不明<br>（地中は点線、地中・架空の別が不明なものは破線）</li></ul><p class="guide-head">参考使用率</p><ul><li>参考使用率＝公表実績の絶対値 ÷ 同日最大需要時の運用容量（アプリ独自の区分）</li></ul></details><div class="section-title">対象電圧 <span>kV</span></div><div class="voltage-filters" id="real-voltage"></div>
<fieldset class="layer-options"><legend>設備の種類</legend><label><input type="checkbox" data-kind="substation" checked/>□ 変電所</label><label><input type="checkbox" data-kind="switchyard" checked/>◇ 開閉所</label><label><input type="checkbox" data-kind="plant" checked/>● 発電所</label><div class="legend-plant-sources">${PLANT_SOURCES.map(s=>`<span>${facilitySymbol('plant',s.key)}${s.label}</span>`).join('')}<span><span class="facility-plant" style="display:inline-flex">${facilitySymbol('plant')}</span>不明</span></div><label><input type="checkbox" data-kind="converter" checked/>${facilitySymbol('converter')} 変換所</label><label class="facility-customer"><input type="checkbox" data-kind="customer" checked/>${facilitySymbol('customer')} 需要家</label></fieldset>
</div><label class="search-box"><span aria-hidden="true">⌕</span><input id="real-search" type="search" placeholder="名称・公表設備番号で検索" aria-label="名称・公表設備番号で検索"/></label>
<label class="mode-label" for="data-mode">表示するデータ</label><select id="data-mode"><option value="geo">送電線</option><option value="actual" disabled>潮流実績 · 2024年度（ローカル）</option><option value="forecast" disabled>予想潮流 · 2026年公表（ローカル）</option><option value="facility">変電所・開閉所・発電所・変換所</option></select>
<div class="dataset-summary" id="dataset-summary" role="status">データを読み込んでいます…</div>
<div class="list-tabs"><span id="result-heading">送電線</span><b id="real-count">—</b></div><div class="result-list" id="real-results"></div>
<div class="sidebar-footer" id="real-footer">読み込み中…</div><nav class="legal-links sidebar-legal" aria-label="利用規約など">${legalLinksHtml()}</nav></aside>
<div class="map-column"><div id="real-map-status" class="map-notice" role="status" hidden></div><section class="map-area" aria-label="実データの送電線地図"><div id="map"></div><section id="change-plans-panel" aria-labelledby="change-plans-title" hidden><div class="plans-top"><h2 id="change-plans-title" tabindex="-1">系統変更予定</h2><button id="change-plans-close" class="icon-button" aria-label="系統変更予定を閉じる">×</button></div><p id="change-plans-hint" role="status" hidden></p><div id="change-plans-content"></div></section>
<div class="map-top real-map-top"><div class="basemaps" role="group" aria-label="背景地図"><button data-base="pale" aria-pressed="true">地図</button><button data-base="seamlessphoto" aria-pressed="false">航空写真</button><button data-base="std" aria-pressed="false">国土地理院</button></div></div>
<div class="demo-banner real-banner"><b>実地理データ</b><span>${esc(trunkDisplay.areaLabel)}</span></div>
<div class="map-controls"><button id="real-zoom-in" class="icon-button" aria-label="地図を拡大">＋</button><button id="real-zoom-out" class="icon-button" aria-label="地図を縮小">−</button><button id="real-fit" class="icon-button" aria-label="東北全域へ戻る">⊙</button></div>
<button class="mobile-browse" id="real-browse">⌕ 設備を探す</button><button id="show-flow-visual" type="button" disabled>▶ 潮流を見る</button>
<button id="mobile-layers-toggle" aria-label="選択（地域・電圧・設備の表示設定）" aria-expanded="false" aria-controls="mobile-layers">選択</button><div id="mobile-layers" class="mobile-map-filters" aria-label="地図の表示切替" hidden><div id="mobile-voltage"></div><div class="mobile-kinds"><button data-mobile-kind="substation" aria-pressed="true">変電所</button><button data-mobile-kind="switchyard" aria-pressed="true">開閉所</button><button data-mobile-kind="plant" aria-pressed="true">発電所</button><button data-mobile-kind="converter" aria-pressed="true">変換所</button><button data-mobile-kind="customer" aria-pressed="true">需要家</button></div></div>
<button id="mobile-flow-toggle" type="button" aria-expanded="false" aria-controls="map-flow-key real-time">潮流</button><div id="map-flow-key" tabindex="0" aria-label="潮流の凡例"><b id="flow-key-head"></b><ul id="flow-key-list"></ul><p id="flow-key-status" role="status"></p></div>
<div class="map-legend real-legend"><div class="legend-title">送電線の表示</div><div class="legend-bands">${trunkDisplay.acVoltages.map(voltageKV=>`<span><i style="background:${voltageColor({voltageKV,currentType:'ac'})}"></i>${voltageKV} kV</span>`).join('')}<span><i style="background:${voltageColor({voltageKV:250,currentType:'dc'})}"></i>直流</span><span><i style="background:#34434b"></i>外縁：選択・名称一致候補（接続確認を意味しません）</span></div><div class="legend-foot">線幅：電圧階級</div></div>
<div class="time-panel real-time" id="real-time" hidden><label class="flow-basis-label">流れる色 <select id="flow-basis"><option value="occto" disabled>OCCTO実績（読込中）</option><option value="forecast">予想使用率（2026年公表）</option><option value="actual">実績（2024年度・容量不明）</option></select></label><div id="time-explanation"></div><div id="actual-time-controls" hidden><label>実績日 <select id="actual-date"></select></label><button id="latest-flow" type="button">最新時刻へ</button><button id="time-prev" class="time-step" type="button" aria-label="30分前の潮流">◀ 30分前</button><strong id="actual-time-label">12:00 JST</strong><button id="time-next" class="time-step" type="button" aria-label="30分後の潮流">30分後 ▶</button><input id="actual-hour" aria-label="潮流実績の時刻（JST）" type="range" min="0" max="23" value="11"/><p id="tie-delay-note">連系線の潮流は、OCCTOによる公表がほかの送電線より30分〜1時間ほど遅れます。最新時刻で連系線の潮流が表示されない場合は、「◀ 30分前」で前の時刻に切り替えてください。</p></div></div>
<section id="detail" class="detail-panel real-detail" aria-label="選択した実データの詳細" hidden></section>
</section></div></main>
<dialog id="real-info"><div class="dialog-top"><h2>収録データと照合状況</h2><button id="real-info-close" class="icon-button" aria-label="出典を閉じる">×</button></div><h3>このサイトについて</h3><p>でんきの道は、日本の基幹送電線（主に500kV・275kV）と変電所・発電所のつながりを地図に示し、電力広域的運営推進機関（OCCTO）が公表する潮流の実績を、公表のある区間について線の上の電気の流れとして可視化する無料の Web サイトです。沖縄を除く9エリアと地域間連系線を収録し、公表値を約30分ごとに取り込みます。</p><div class="callout"><p class="callout-text">このアプリは、公表資料と OpenStreetMap などをもとにした参考表示です（接続先の推測を含みます）。系統運用や電力取引などの判断には使わないでください。</p><button type="button" class="legal-link callout-more" data-legal="disclaimer">詳しくは免責・データソース</button></div><h3>収録範囲</h3><ul class="info-list"><li>沖縄を除く9エリアの基幹系統、直流幹線、地域間連系線</li><li>電圧：500・275kV（中国・九州は220kV、北海道・四国は187kVも含む）<br>周波数変換所（FC）につながる154kVの一部も表示</li><li>設備：対象電圧の登録設備と、直流の追加範囲の設備</li><li>送電線・設備の状態は、建設中・計画中・要確認（設備は廃止も）のものだけ表示します。表示のない線・設備は運用中として描いています（ほとんどは運用状態を一次資料で個別に確認していません）。</li><li>電圧が不明な発電所などは、対象との関係が未確認のため表示しません</li></ul><div id="coverage-info"></div><p id="connection-coverage"></p><h3>確度（根拠の確かさ）</h3><div id="tier-info" class="small-copy"></div><details class="tier-compare"><summary>確度の説明</summary><p>確度は、地図の線・設備が公表資料（一次資料）のどれに当たるかの根拠の確かさです。線の形・設備の位置が何mずれているか（精度）を示すものではありません。</p><p class="tier-key"><span class="tc-p">公表資料</span><span class="tc-o">地図データ（OSM・国土地理院の地図）</span><span class="tc-x">照合なし</span></p><p><b>送電線</b></p><div class="tier-table wide"><table><tr><th scope="col">確度</th><th scope="col">公表資料の区間</th><th scope="col">線の名前<br>（公表名と地図データ）</th><th scope="col">両端<br>（公表の設備に地図データの線が届くか）</th><th scope="col">線の形の根拠</th></tr><tr><th scope="row">A</th><td class="tc-p">あり</td><td>一致</td><td>届く（同じ名前の線と短い引込だけ）</td><td class="tc-o">地図データの線</td></tr><tr><th scope="row">B</th><td class="tc-p">あり</td><td>一部一致（派生名・共架表記・名前のない区間を含む）</td><td>届く（分岐の端点を含む）</td><td class="tc-o">地図データの線</td></tr><tr><th scope="row">C</th><td class="tc-p">あり（電源線・連系線などは公表区間なし）</td><td>不一致を含む（別名の線を経由）</td><td>届くが補いを含む（途中の設備の区画を通過、途切れを直線で補う、推定した分岐点まで）</td><td class="tc-o">地図データの線（途切れの直線の補いを含む）、または全体が直線（推定した分岐点まで）</td></tr><tr><th scope="row">D</th><td class="tc-p">あり（両端の設備、または公表の鉄塔番号）</td><td class="tc-x">照合なし（地図データに線がない）</td><td>届かない（両端を直線で結ぶ）</td><td class="tc-x">直線（経路の資料なし）</td></tr><tr><th scope="row">E</th><td class="tc-x">なし</td><td class="tc-o">地図データなどの名前だけ</td><td class="tc-o">地図データの線の端だけ（接続先は確定しない）</td><td class="tc-o">地図データの線</td></tr></table></div><p class="tier-schem-key">模式図：四角＝両端の設備（青＝公表資料の設備、橙の破線＝地図データなどだけ）。線の形は主に地図データで、線の色は名前の照合だけを表します。青＝公表名と同じ名前、橙＝公表名と一致しない（B は名前なし・派生名、C は別名、E は地図データなどの名前だけ）、灰の破線＝直線。</p><div class="tier-schem"><figure><b>A</b><svg viewBox="0 0 250 66" role="img" aria-label="送電線の確度Aの模式図"><rect x="6" y="20" width="24" height="24" fill="#e6effa" stroke="#1558ac" stroke-width="2.5"/><rect x="220" y="20" width="24" height="24" fill="#e6effa" stroke="#1558ac" stroke-width="2.5"/><path d="M30 32 C75 14,120 50,160 28 S205 38,220 32" fill="none" stroke="#1558ac" stroke-width="5"/><text x="125" y="62" font-size="11" text-anchor="middle" fill="#3d4a4f">公表名＝地図データの線の名前</text></svg><figcaption>同じ名前の線で両端に届く</figcaption></figure><figure><b>B</b><svg viewBox="0 0 250 66" role="img" aria-label="送電線の確度Bの模式図"><rect x="6" y="20" width="24" height="24" fill="#e6effa" stroke="#1558ac" stroke-width="2.5"/><rect x="220" y="20" width="24" height="24" fill="#e6effa" stroke="#1558ac" stroke-width="2.5"/><path d="M30 32 L125 32" stroke="#1558ac" stroke-width="5"/><path d="M125 32 L220 32" stroke="#e07b1a" stroke-width="5"/><text x="78" y="20" font-size="11" text-anchor="middle" fill="#3d4a4f">名前が一致</text><text x="172" y="20" font-size="11" text-anchor="middle" fill="#3d4a4f">名前なし・派生名</text></svg><figcaption>届くが、名前のない区間・派生名の区間を含む</figcaption></figure><figure><b>C</b><svg viewBox="0 0 250 66" role="img" aria-label="送電線の確度Cの模式図"><rect x="6" y="20" width="24" height="24" fill="#e6effa" stroke="#1558ac" stroke-width="2.5"/><rect x="220" y="20" width="24" height="24" fill="#e6effa" stroke="#1558ac" stroke-width="2.5"/><path d="M30 32 L95 32" stroke="#1558ac" stroke-width="5"/><path d="M95 32 L145 32" stroke="#9aa4a9" stroke-width="4" stroke-dasharray="10 6"/><path d="M145 32 L220 32" stroke="#e07b1a" stroke-width="5"/><text x="62" y="20" font-size="11" text-anchor="middle" fill="#3d4a4f">名前が一致</text><text x="120" y="58" font-size="11" text-anchor="middle" fill="#3d4a4f">直線で補う</text><text x="183" y="20" font-size="11" text-anchor="middle" fill="#3d4a4f">別名の線</text></svg><figcaption>別名の線の経由や直線の補いなどを含む</figcaption></figure><figure><b>D</b><svg viewBox="0 0 250 66" role="img" aria-label="送電線の確度Dの模式図"><rect x="6" y="20" width="24" height="24" fill="#e6effa" stroke="#1558ac" stroke-width="2.5"/><rect x="220" y="20" width="24" height="24" fill="#e6effa" stroke="#1558ac" stroke-width="2.5"/><path d="M30 32 L220 32" stroke="#9aa4a9" stroke-width="4" stroke-dasharray="10 6"/><text x="125" y="20" font-size="11" text-anchor="middle" fill="#3d4a4f">経路の資料なし→直線</text></svg><figcaption>両端は公表資料、経路は直線</figcaption></figure><figure><b>E</b><svg viewBox="0 0 250 66" role="img" aria-label="送電線の確度Eの模式図"><rect x="6" y="20" width="24" height="24" fill="#fdf1e3" stroke="#e07b1a" stroke-width="2.5" stroke-dasharray="4 3"/><rect x="220" y="20" width="24" height="24" fill="#fdf1e3" stroke="#e07b1a" stroke-width="2.5" stroke-dasharray="4 3"/><text x="18" y="37" font-size="13" text-anchor="middle" fill="#e07b1a">?</text><text x="232" y="37" font-size="13" text-anchor="middle" fill="#e07b1a">?</text><path d="M34 32 C80 18,165 46,216 32" fill="none" stroke="#e07b1a" stroke-width="5"/><text x="125" y="62" font-size="11" text-anchor="middle" fill="#3d4a4f">公表資料で未確認</text></svg><figcaption>地図データなどだけ（接続先は確定しない）</figcaption></figure></div><p>線の形は主に地図データから取っています。一部は公表資料の系統図の線形を使っています。確度 D は両端を直線で結んでいます。国土地理院の送電線記号でなぞるのは、地図データに線がないか記号と食い違う区間です。食い違う区間は空中写真などで確かめています。</p><p><b>変電所・発電所など</b></p><div class="tier-table"><table><tr><th scope="col">確度</th><th scope="col">名前の照合</th><th scope="col">位置の根拠</th></tr><tr><th scope="row">A</th><td>国土地理院の地図の注記（補助）または公表資料の所在地で、名前と位置を確認</td><td class="tc-o">地図データの区画の代表点（注記などで裏付け）</td></tr><tr><th scope="row">B</th><td class="tc-p">公表資料の設備名と、地図データの区画の名前が一致</td><td class="tc-o">地図データの区画の代表点（屋内・地下の変電所は点）</td></tr><tr><th scope="row">C</th><td class="tc-o">地図データの名前だけ、または名前のない区画に、つながる線などから名前を当てた</td><td class="tc-o">地図データの区画の代表点・点</td></tr><tr><th scope="row">D</th><td>名前の根拠はあるが、地図データの区画がない（使えない）</td><td class="tc-x">推定（住所の代表点・ダムなどで代用、提供された座標、線の端の点など）</td></tr><tr><th scope="row">E</th><td class="tc-o">補助資料だけ</td><td class="tc-x">補助資料による（位置の確認なし）</td></tr></table></div><p class="tier-schem-key">模式図：橙の区画＝地図データの区画、●＝区画の代表点、○＝推定した位置、青の札＝公表資料の名前、橙の枠の札＝国土地理院の地図の注記（補助）、灰の線＝つながる送電線。</p><div class="tier-schem"><figure><b>A</b><svg viewBox="0 0 250 72" role="img" aria-label="設備の確度Aの模式図"><polygon points="14,14 84,10 92,52 20,58" fill="#fdf1e3" stroke="#e07b1a" stroke-width="2"/><circle cx="52" cy="34" r="4" fill="#1f2a2e"/><text x="53" y="69" font-size="11" text-anchor="middle" fill="#3d4a4f">区画と代表点</text><rect x="118" y="21" width="126" height="22" rx="3" fill="#fff" stroke="#e07b1a" stroke-width="1.5"/><text x="181" y="36" font-size="11" text-anchor="middle" fill="#8a4a0e">地理院「○○変電所」</text></svg><figcaption>区画のそばに国土地理院の地図の注記がある（または公表の所在地で確認）</figcaption></figure><figure><b>B</b><svg viewBox="0 0 250 72" role="img" aria-label="設備の確度Bの模式図"><rect x="2" y="21" width="106" height="22" rx="3" fill="#e6effa" stroke="#1558ac"/><text x="55" y="36" font-size="11" text-anchor="middle" fill="#0e3f7c">公表「○○変電所」</text><text x="117" y="37" font-size="13" text-anchor="middle" fill="#0e5a3a">＝</text><polygon points="128,14 190,10 198,52 134,58" fill="#fdf1e3" stroke="#e07b1a" stroke-width="2"/><circle cx="162" cy="34" r="4" fill="#1f2a2e"/><text x="164" y="69" font-size="11" text-anchor="middle" fill="#3d4a4f">地図データの区画「○○変電所」</text></svg><figcaption>公表名と区画の名前が一致</figcaption></figure><figure><b>C</b><svg viewBox="0 0 250 72" role="img" aria-label="設備の確度Cの模式図"><polygon points="10,14 70,10 78,52 16,58" fill="#fdf1e3" stroke="#e07b1a" stroke-width="2"/><circle cx="44" cy="34" r="4" fill="#1f2a2e"/><path d="M78 34 L240 34" stroke="#9aa4a9" stroke-width="4"/><text x="165" y="26" font-size="11" text-anchor="middle" fill="#3d4a4f">つながる線から名前を当てる</text><text x="125" y="69" font-size="11" text-anchor="middle" fill="#3d4a4f">名前なし／地図データの名前だけ</text></svg><figcaption>地図データだけ</figcaption></figure><figure><b>D</b><svg viewBox="0 0 250 72" role="img" aria-label="設備の確度Dの模式図"><rect x="60" y="8" width="130" height="48" fill="none" stroke="#9aa4a9" stroke-width="1.5" stroke-dasharray="4 3"/><text x="125" y="23" font-size="11" text-anchor="middle" fill="#6b767b">住所の範囲（丁目など）</text><circle cx="125" cy="40" r="5" fill="#fff" stroke="#c7642f" stroke-width="2.5"/><text x="125" y="69" font-size="11" text-anchor="middle" fill="#3d4a4f">代表点に置く（敷地の正確な位置ではない）</text></svg><figcaption>位置を推定で置いた（例：住所の代表点）</figcaption></figure><figure><b>E</b><svg viewBox="0 0 250 50" role="img" aria-label="設備の確度Eの模式図"><rect x="112" y="10" width="26" height="26" fill="#fdf1e3" stroke="#e07b1a" stroke-width="2.5" stroke-dasharray="4 3"/><text x="125" y="28" font-size="13" text-anchor="middle" fill="#e07b1a">?</text></svg><figcaption>補助資料だけ（位置の確認なし）</figcaption></figure></div><p>区画の代表点は、区画の中心付近の点です。設備の位置は接続の根拠にしていません。確度 C・D・E の送電線は、一覧と詳細に「要注意」と表示します。</p></details><h3>公表データの扱い</h3><ul class="info-list"><li>最新の公表時刻を初期表示し、直近30日分を切り替えられます。</li><li>地図の名称・電圧が一致しても、同じ観測区間とは限りません。</li><li id="flow-basis-method">―</li><li id="flow-basis-count">表示中の区間：―</li><li>複数の送電線の合計で管理する容量は、1本ごとの線に割り当てません。</li></ul><h3>セキュリティ上の考え方</h3><p>資源エネルギー庁 電力・ガス事業部「系統情報の公表の考え方」（令和8年4月改定）26ページ「（４）セキュリティの確保」から引用します。</p><blockquote class="info-quote" cite="https://www.enecho.meti.go.jp/category/electricity_and_gas/electric/summary/regulations/pdf/keitou_kangaekata_20260401.pdf"><p>電力系統は、一般送配電事業者及び配電事業者以外も含め多種多様な利用者（利用を検討する者）が存在することに鑑みれば、その運用も含め広く説明責任が果たされるべきであり、セキュリティという言葉の下で行われてきた旧来の運用・慣行は厳に改められるべきである。そこで、以下のような公安上の必要性などを除き、系統情報は公表することが適当である<sup>注51</sup>。ただし第三者情報について、社会的要請などに基づいて第三者の合意を得た上で開示する場合には、この限りではない。</p><ul><li>○ 国家や地方公共団体の重要な機能を担う施設、機能喪失により広く社会的に影響を与え得ることが懸念される重要施設への供給系統・供給設備に関する情報</li><li>○ 第三者情報（特定の電力の供給契約に係る契約条件に係る事項等）</li></ul><p class="small-copy">注51 情報の内容によっては、開示・提示に当たって一定の身元確認・秘密保持誓約を求めることなどを妨げるものではない。</p></blockquote><p>本アプリは、この考え方を踏まえ、公表資料と OpenStreetMap などの公開情報だけをもとに作成しています（非公表の情報は使っていません）。資源エネルギー庁・電力会社が作成・確認したものではありません。</p><p class="small-copy">出典：<a target="_blank" rel="noopener noreferrer" href="https://www.enecho.meti.go.jp/category/electricity_and_gas/electric/summary/regulations/pdf/keitou_kangaekata_20260401.pdf">資源エネルギー庁 電力・ガス事業部「系統情報の公表の考え方」（令和8年4月改定）26ページ ↗</a>（PDF・外部サイト、2026-11-22 確認）</p><h3>利用規約など</h3><nav class="legal-links" aria-label="利用規約など（ⓘ）">${legalLinksHtml()}</nav><h3>お問い合わせ</h3><a target="_blank" rel="noopener noreferrer" href="https://docs.google.com/forms/d/e/1FAIpQLScoZSI0GlK0r3gUO46iH8uY6hTkYfxUbq3HaOp71GKIxVEcvQ/viewform">お問い合わせフォーム（Google フォーム） ↗</a><p>誤りや追加情報要望等をいただければ幸いです。</p><p class="small-copy">Google フォーム（外部サイト）が新しいタブで開きます。送信した内容は Google のサービスで扱われます。</p></dialog>${LEGAL_DIALOG_HTML}`;

const map = L.map('map', { zoomControl: false, minZoom: 5, maxZoom: 18, preferCanvas: true }).setView([39.6, 140.6], 6);
map.attributionControl.setPrefix(false);
map.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">線路・設備 © OpenStreetMap contributors / ODbL</a>');
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
let base: L.TileLayer;
function changeBase(type: string) {
  if (base) map.removeLayer(base);
  $('#real-map-status').hidden = true;
  base = L.tileLayer(`https://cyberjapandata.gsi.go.jp/xyz/${type}/{z}/{x}/{y}.${type === 'seamlessphoto' ? 'jpg' : 'png'}`, { maxZoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">背景：国土地理院</a>' });
  base.addTo(map);
  document.querySelectorAll<HTMLButtonElement>('[data-base]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.base === type)));
}
changeBase('pale');
// Facility markers shrink below zoom 9 and, below zoom 7 (national/regional overview), only frequency converters and the selection stay visible so lines are not buried.
const updateMarkerScale = () => { const z = map.getZoom(); $('#map').classList.toggle('overview-map', z < 9); $('#map').classList.toggle('far-map', z < 7); };
map.on('zoomend', updateMarkerScale); updateMarkerScale();
$('#map').classList.add('line-emphasis');
map.createPane(selectionPane).style.zIndex='399';
map.getPane(selectionPane)!.style.pointerEvents='none';
const routes = L.layerGroup().addTo(map), nodes = L.layerGroup().addTo(map), highlight = L.layerGroup().addTo(map);
const linePicker=new LinePicker(map);
let pilot:MiyagiPilotView|undefined;
let trunkView:{center:L.LatLng;zoom:number}|undefined;
let trunkSearch='';
function togglePilot(active:boolean){
 if(!pilot||pilot.active===active)return;
 if(active){trunkView={center:map.getCenter(),zoom:map.getZoom()};trunkSearch=$<HTMLInputElement>('#real-search').value;for(const layer of [routes,nodes,highlight,flowOverlay,flowCanvas])layer.remove();}
 pilot.setActive(active);syncRegionSources();
 $<HTMLInputElement>('#real-search').value=active?'':trunkSearch;
 syncDisplaySettings();
 $('#mobile-layers').hidden=true;$('#mobile-layers-toggle').setAttribute('aria-expanded','false');
 if(active){pilot.setFacilities(visibleKinds.has('substation'));pilot.search('');}
 else{for(const layer of [routes,nodes,highlight,flowOverlay,flowCanvas])layer.addTo(map);$('.real-banner').innerHTML=`<b>実地理データ</b><span>${esc(regionCoverage())}</span>`;render();if(trunkView)map.setView(trunkView.center,trunkView.zoom,{animate:false});}
}
async function loadPilot(){
 try{const r=await fetch('./validation/miyagi-ishinomaki.json',{cache:'no-store'});if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const bytes=await r.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');const data=validatePilot(JSON.parse(new TextDecoder().decode(bytes)),digest);pilot=new MiyagiPilotView(map,data,togglePilot,linePicker);}catch(error){console.info('限定検証データは未提供、または読み込めません。',error);}
}
// 基幹系統表示の例外の線（trunkException、2026-10-14：東清水FCの東京側154kV）は、電圧の絞り込みに関係なく通す（方式・要注意・検索の絞り込みは通常どおり）
const voltageShown = (l: GeoLine) => trunkVoltageShown(l, voltages);
const filteredGeo = () => (geography?.lines ?? []).filter(l => (showCaution || !isCaution(l)) && voltageShown(l) && visibleCurrents.has(l.currentType ?? 'unknown') && (!query || normalizeName(l.name).includes(query) || l.osmIds.some(id => String(id).includes(query))));
const currentActual = () => official?.actual.lines.find(l => l.id === selectedId);
const currentForecast = () => official?.forecast.records.find(l => l.id === selectedId);
const dayIndices = () => (official?.actual.times ?? []).flatMap((t, i) => t.startsWith(day) ? [i] : []);
const timeIndex = () => dayIndices()[hourIndex] ?? -1;
function recordMatches(record: { name: string; id: string; voltageKV: number }) {
  return voltages.has(record.voltageKV) && (!query || normalizeName(record.name).includes(query) || record.id.includes(query));
}
function actualRecords() { return (official?.actual.lines ?? []).filter(recordMatches); }
function forecastRecords() { return (official?.forecast.records ?? []).filter(recordMatches); }
function connectedFacilityIds(line: GeoLine | undefined) {
  const ids = new Set(line?.connectedWayIds ?? line?.osmIds ?? []), result = new Set<string>();
  for(const g of geography?.lines ?? []) {
    if(g.voltageKV !== line?.voltageKV) continue;
    const paths = g.paths.filter((_,i)=>ids.has(g.osmIds[i]));
    if(!paths.length) continue;
    for(const e of g.connections ?? []) if(paths.some(path=>[path[0],path[path.length-1]].some(p=>p[0]===e.position[0]&&p[1]===e.position[1]))) e.facilities.forEach(f=>result.add(f.id));
  }
  return result;
}
function facilityRecords() {
  const connected = mode === 'geo' ? connectedFacilityIds(geography?.lines.find(l=>l.id===selectedId)) : new Set<string>();
  return (geography?.facilities ?? []).filter(f => {
    if (![f.kind, ...(f.alsoKinds ?? [])].some(k => visibleKinds.has(k)) || query && facilityQueryMatch(f, query) === null && !connected.has(f.id)) return false;
    if (dcFacilityIds.has(f.id)) return dcScopeVisible(dcScopeLines,voltages,visibleCurrents)||facilityElectricalVisible(f,geography?.lines??[],voltages,visibleCurrents);
    return facilityElectricalVisible(f,geography?.lines??[],voltages,visibleCurrents);
  });
}

// A page opened in a background tab has a 0×0 map; fitBounds would then jump to the maximum zoom.
// Hold the fit until the map has a size, then fit once (ResizeObserver fires when the tab becomes visible).
let pendingFit=false;
new ResizeObserver(()=>{if(pendingFit&&$('#map').clientWidth>0){pendingFit=false;fitAll();}}).observe($('#map'));
function fitAll() {
  if(!($('#map').clientWidth>0)){pendingFit=true;return;}
  map.invalidateSize({animate:false});
  if(pilot?.active){pilot.fit();return;}
  // 全線の座標の最小・最大だけを数える（以前は全座標を配列に並べて地図の座標に変換していた。範囲は同じ。2026-10-10 表示速度の改善）
  let s=90,w=180,n=-90,e=-180;
  if(region!=='tohoku')for(const l of geography?.lines??[]){if(region==='hokkaido'&&l.currentType==='dc')continue;for(const path of l.paths)for(const [la,lo] of path){if(la<s)s=la;if(la>n)n=la;if(lo<w)w=lo;if(lo>e)e=lo;}}
  const points=region==='tohoku'?trunkDisplay.bounds:n>=s?[[s,w],[n,e]] as [number,number][]:[];
  map.fitBounds(points.length?points:trunkDisplay.bounds, {paddingTopLeft:[30,region!=='tohoku'&&matchMedia('(max-width:760px)').matches?230:100],paddingBottomRight:[30,140],animate:false});
}

// 描き直しの分離（2026-10-10 表示速度の改善）：drawNetwork（線・設備の描画）は地域・電圧・表示設定・検索・表示モードが変わった時だけ。
// 選択は renderSelection（強調・一覧の選択状態・設備マーカーの選択状態・詳細）、時刻・潮流は renderFlow（粒子・一覧の数値・時刻欄・詳細）。
let lastShowing:GeoLine[]=[];const facilityMarkers=new Map<string,L.Marker>();
// 設備マーカー（2026-10-10 表示速度の改善）：見えるものだけ作る。全国表示（ズーム7未満）は CSS で変換所と選択中の設備以外を隠しているので、それだけを作る。
// ズーム7以上は画面内（余白25%）のものだけ作り、地図を動かしたら足し引きする。ツールチップはマウスを乗せた・フォーカスした時に付ける。形・色は変えない
let facilityList:GeoFacility[]=[];
// 印の重なり順（2026-11-10）：選択中＞発電所＞その他（変電所・開閉所・変換所・需要家）。
// Leaflet の既定は南にある印が上なので、発電所のすぐ南に変電所があると全体表示で発電所が隠れていた（四国の新改・長山など）
const markerZ=(f:GeoFacility)=>f.id===selectedId?2000:f.kind==='plant'?1000:0;
function facilityMarker(f:GeoFacility){
    // A site with several roles (新信濃 = substation + frequency converter) shows one symbol per role side by side, centred on the site.
    const roles = [f.kind, ...(f.alsoKinds ?? [])], label = roles.map(k => kinds[k]).join('・');
    const html = roles.length > 1 ? roles.map(k => `<span class="facility-${Object.hasOwn(kinds, k) ? k : 'unknown'}">${facilitySymbol(k, k === 'plant' ? plantSourceOf(f.id) : null)}</span>`).join('') : facilitySymbol(f.kind, f.kind === 'plant' ? plantSourceOf(f.id) : null);
    const marker = L.marker(f.position, { icon: L.divIcon({ className: `facility-symbol facility-${Object.hasOwn(kinds, f.kind) ? f.kind : 'unknown'}${roles.length > 1 ? ' facility-multi' : ''}${selectedId===f.id?' facility-selected':''}${f.status==='廃止'?' facility-retired':''}`, html, iconSize: [22 * roles.length, 22], iconAnchor: [11 * roles.length, 11] }), zIndexOffset: markerZ(f), title: `${label}：${f.name}`, alt: `${label}：${f.name}` });
    const previewFacility=()=>{/* 2026-10-07：クリックで詳細を直接開く */mapPreview=false;picked=null;const full=mode!=='facility';mode='facility';$<HTMLSelectElement>('#data-mode').value=mode;selectedId=f.id;full?render():renderSelection();};
    const tooltip=()=>{if(!marker.getTooltip()){marker.bindTooltip(esc(f.name)+(f.status==='廃止'?'（廃止）':''));marker.openTooltip();}};
    marker.on('mouseover',tooltip).on('click',(e:L.LeafletMouseEvent)=>{if(linePicker.canTap(e.originalEvent))previewFacility();});
    marker.on('add',()=>{const el=marker.getElement();if(!el)return;el.addEventListener('focus',tooltip);
    // Handle the key itself: Leaflet's legacy keyCode-only keypress is not reliable in every browser.
    el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&linePicker.canTap(e)){e.preventDefault();e.stopPropagation();previewFacility();}});});
    return marker;
}
// 設備名のラベル（2026-11-22 指示、src/facility-labels.ts）。地図のボタン・凡例・時刻・詳細パネルなどの下には置かない
const facilityLabels=new FacilityLabels(map,'.map-top,.map-controls,#map-flow-key,#real-time,#detail,#mobile-layers-toggle,#mobile-flow-toggle,#real-browse,#mobile-layers,.sidebar.mobile-open,.leaflet-control-attribution,.leaflet-control-scale,#real-map-status',()=>geography?.facilities??[]);
function syncFacilityMarkers(){
  if(pilot?.active){facilityLabels.clear();return;}
  const far=map.getZoom()<7,size=map.getSize(),view=size.x>0&&size.y>0?map.getBounds().pad(0.25):null;
  const want=new Map(facilityList.filter(f=>(!far||f.kind==='converter'||f.id===selectedId)&&(!view||view.contains(f.position))).map(f=>[f.id,f]));
  for(const [id,m] of facilityMarkers)if(!want.has(id)){nodes.removeLayer(m);facilityMarkers.delete(id);}
  for(const [id,f] of want)if(!facilityMarkers.has(id)){const m=facilityMarker(f);facilityMarkers.set(id,m);m.addTo(nodes);}
  facilityLabels.update([...want.values()],selectedId,true);
}
map.on('moveend zoomend resize',syncFacilityMarkers);
function drawNetwork() {
  routes.clearLayers(); nodes.clearLayers(); facilityMarkers.clear();
  const showing = mode === 'geo' ? filteredGeo() : (geography?.lines ?? []).filter(l => voltageShown(l) && visibleCurrents.has(l.currentType ?? 'unknown'));
  document.getElementById('legend-trunk-exception')?.toggleAttribute('hidden',!showing.some(l=>l.trunkException));
  linePicker.setLines(showing.map(line=>({id:line.id,label:`${line.name} · ${line.voltageKV} kV · ${currentLabel(line)}`,width:routeWidth(line),voltageKV:line.voltageKV,paths:line.paths,select:(position)=>{/* 2026-10-07：クリックで詳細を直接開く（以前は「詳細を開く」カードを挟んでいた）。名前はマウスオーバーの表示のまま */mapPreview=false;picked={id:line.id,at:[position.lat,position.lng]};const full=mode!=='geo'||query!=='';mode='geo';$<HTMLSelectElement>('#data-mode').value='geo';selectedId=line.id;showConnected=false;query='';$<HTMLInputElement>('#real-search').value='';full?render():renderSelection();}})));
  // Overhead parts get a white casing; underground (dotted) parts get a pale band in the voltage colour instead, so white flow particles never sit on white.
  for (const line of showing) {
    const casing = line.paths.filter((_, i) => pathDash(line, i) !== DOTTED), band = line.paths.filter((_, i) => pathDash(line, i) === DOTTED);
    if (casing.length) L.polyline(casing, { color: '#fff', weight: routeWidth(line) + 3, opacity: 0.95, interactive: false, smoothFactor:0 }).addTo(routes);
    if (band.length) L.polyline(band, { color: routeColor(line), weight: routeWidth(line) + 4, opacity: BAND_OPACITY, interactive: false, smoothFactor:0 }).addTo(routes);
  }
  for (const line of showing) {
    // Underground (OSM power=cable) segments are dotted, overhead solid; straight lines of unknown route follow their inferred construction (unknown = dashed).
    const groups = new Map<string, typeof line.paths>();
    line.paths.forEach((p, i) => { const k = pathDash(line, i); groups.set(k, [...(groups.get(k) ?? []), p]); });
    for (const [dash, paths] of groups) {
      const route = L.polyline(paths, { color: routeColor(line), dashArray: dash || undefined, lineCap: dash === DOTTED ? 'round' : undefined, weight: routeWidth(line), opacity: LINE_OPACITY, smoothFactor: 0 });
      // ツールチップは線名・電圧・交流／直流だけ（2026-11-07。状態・地中・要注意・分岐の注記は詳細パネルと線種で示す）
      route.bindTooltip(()=>`${esc(line.name)} · ${esc(line.voltageKV)} kV · ${currentLabel(line)}`, { sticky: true });
      route.addTo(routes);
    }
  }
  facilityList = facilityRecords();
  syncFacilityMarkers();
  lastShowing=showing;
  highlightSelected();
  drawFlowOverlay(showing);
}
const flowOverlay=L.layerGroup().addTo(map);
// 潮流の粒子は1枚のキャンバス（src/flow-canvas.ts、2026-10-05）
const flowCanvas=new FlowParticles().addTo(map);let particles:Particle[]=[];
const flowPathCache=new Map<string,[number,number][] | null>();
// 同じ地図の線名に複数の公表区間が対応する場合（佐久間東幹線の(中)・(里)など）、潮流の参照経路がこの線を通る区間を選ぶ
function recordOnLine(records:ActualLine[],g:GeoLine){
 const key=(a:[number,number],b:[number,number])=>{const x=a.join(','),y=b.join(',');return x<y?x+'|'+y:y+'|'+x;};
 const edges=new Set(g.paths.flatMap(p=>p.slice(1).map((q,i)=>key(p[i],q))));
 const hits=records.map(r=>{const p=referenceFlowPath(r,geography?.lines??[],false);return {r,n:p?p.slice(1).filter((q,i)=>edges.has(key(p[i],q))).length:0};}).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
 return hits.length&&(hits.length===1||hits[0].n>hits[1].n)?hits[0].r:undefined;
}
// 詳細パネル「OSM 線分」の欄：負の仮IDのうち、なぞった区間（tracedParts、地理院の記号・航空写真）は「直線補完」と分けて数える（2026-11-06）
function osmFillText(g:GeoLine){const f=osmFillCounts(g);return (f.straight?'、直線補完 '+f.straight:'')+(f.traced?'、なぞった区間 '+f.traced+'（'+esc(f.bases.join('・'))+'）':'');}
function routeWidth(line:GeoLine){return lineWidth(line.voltageKV,lineWidthProfile(line,hokkaidoGeography?.lines??[],shikokuGeography?.lines??[]),line.currentType);}
const FLOW_KEY_DOT=(fill:string,border:string)=>'<i style="display:inline-block;width:8px;height:8px;background:'+fill+';border:'+border+';border-radius:50%"></i> ';
// 止まった粒子・粒子なしの説明は凡例だけに置く（見方には参考使用率の定義だけ。2026-11-03）
// 粒子なし＝公表なし（需要家線を含む）・欠測など。OCCTO の行で線に照合できないものは 2026-11-04 時点で0件（2026-11-04）
const FLOW_KEY_STILL='<li>止まった粒子＝0 MW</li><li>粒子なし＝公表なし・欠測など</li>';
const FLOW_KEY_USAGE='<li>'+FLOW_KEY_DOT('#fff','1px solid #64766f')+'50%未満（白）</li><li style="color:#a16d00">● 50〜80%未満</li><li style="color:#d95b53">● 80〜100%</li><li class="flow-key-over"><i></i> 100%超（紫・太く点滅）</li><li>'+FLOW_KEY_DOT('#d3d9de','2px solid #2f3a44')+'容量不明</li>'+FLOW_KEY_STILL;
const FLOW_KEY_ACTUAL='<li>'+FLOW_KEY_DOT('#fff','1px solid #64766f')+'白点：実績のある区間</li>'+FLOW_KEY_STILL;
function drawFlowOverlay(showing: GeoLine[]) {
 flowOverlay.clearLayers();particles=[];if(!canUse('flow',null)){flowCanvas.setParticles([]);$('#flow-basis-method').textContent='―';$('#flow-basis-count').textContent='表示中の区間：―';return;}let count=0,zero=0;
 const records = flowBasis!=='forecast' ? official?.actual.lines ?? [] : (official?.forecast.records ?? []).flatMap(f => {
  const ends=f.direction.split('→');
  return ends.length===2 ? [{id:f.id,name:f.name,voltageKV:f.voltageKV,from:ends[0].trim(),to:ends[1].trim(),note:f.note,values:[] } satisfies ActualLine] : [];
 });
 for(const record of records) {
  const forecast=flowBasis==='forecast'?official?.forecast.records.find(f=>f.id===record.id):undefined;
  const mw=flowBasis==='forecast'?forecast?.forecastMW:record.values[timeIndex()];
  const matchedLines=candidateGeometry(record,showing);
  if(mw==null || !matchedLines.length)continue;
  // 東北の公表表との端点照合は地内の線だけ（連系線 相馬双葉幹線は公表表の端点が「送電線分岐」で一致しないため除く）
  // 東北NWの容量表との端点照合は、2026-10-04の作り直しで対応表（src/tohoku-pairs.ts）による照合に置き換えた。地図側の端点名（分岐点・発電所の正式名）が容量表と書き方が違い、常磐北・南幹線などを誤って弾いていた
  const cacheKey=flowBasis+record.id;
  if(!flowPathCache.has(cacheKey))flowPathCache.set(cacheKey,referenceFlowPath(record,geography?.lines ?? [],flowBasis!=='occto'));
  const path=flowPathCache.get(cacheKey);if(!path)continue;
  const oriented=mw<0?[...path].reverse():path;
  // 潮流0MW（原本が「0」。空欄は欠測で mw==null）は、容量が分かれば使用率0%（白）、容量不明なら容量不明と同じ灰で、粒子は止めて描く（2026-10-10、灰は 2026-11-07）
  const still=mw===0;
  // 0MW の件数は、止まった粒子を描いた区間だけ数える（表示中の区間の内数。2026-11-03）
  if(still)zero++;
  const info=flowBasis==='occto'?occtoUsageInfo(record,mw):null; // 1行につき1回だけ求める
  const usageBand=info ? band(info.usage) : forecast ? band(forecastUsage(forecast)) : 'low';
  const color=usageBand==='low' ? '#fff' : colors[usageBand];
  // 容量不明の塗りは凡例と同じ明るい灰。止まった粒子も同じ塗り（2026-11-07：0MWかつ容量不明だけ濃い灰 colors.unknown になっていたのを統一）
  const fill=usageBand==='unknown'?'#d3d9de':color;
  // 粒子は線より細く重ねる。ただし直流は細い線と白い縁取りに埋もれるため、線より1px太くする（2026-10-23、src/line-style.ts）
  const pw=Math.min(...matchedLines.map(line=>particleWidth(line.voltageKV,lineWidthProfile(line,hokkaidoGeography?.lines??[],shikokuGeography?.lines??[]),line.currentType)));
  // 容量不明（灰色）の粒子は濃い縁を付ける。灰色のままだと薄い色の線や500kVの青の上で見えなくなる（越美幹線・飛騨分岐線など、2026-10-02）
  // 100%超（紫）は太く・点滅させ、濃い紫の縁を付ける（色だけに頼らない。2026-10-10）
  particles.push(still?{latlngs:oriented as [number,number][],color:fill,weight:pw,still,...(usageBand==='unknown'?{edge:{color:'#2f3a44',weight:pw+2.5}}:{})}:usageBand==='over'?{latlngs:oriented as [number,number][],color,weight:pw+2,blink:true,edge:{color:'#3d1259',weight:pw+5}}:{latlngs:oriented as [number,number][],color:fill,weight:pw,...(usageBand==='unknown'?{edge:{color:'#2f3a44',weight:pw+2.5}}:{})});
  count++;
 }
 flowCanvas.setParticles(particles);
 // 凡例は右上に1項目1行で縦に並べる。計算方法・区間数はⓘ「公表データの扱い」（2026-11-16 に「公表データの出典」から改名）へ（2026-11-03）
 $('#flow-key-head').textContent=flowBasis==='actual'?'2024年度実績':flowBasis==='occto'?'OCCTO参考使用率':'予想使用率';
 $('#flow-key-list').innerHTML=flowBasis==='actual'?FLOW_KEY_ACTUAL:FLOW_KEY_USAGE;
 $('#flow-key-status').textContent='';
 $('#flow-basis-method').textContent=flowBasis==='actual'?'2024年度実績は白点で表示します（当時の容量は不明）。':flowBasis==='occto'?'使用率は、OCCTOの行の潮流を、同じ行・同じ日・同じ向き（公表上の正方向）の運用容量（OCCTO公表、対象断面「実績」の1日1つの値。連系線は時刻別の30分値）で割った参考値です。運用容量が公表されていないときは「未確認」とし、設備容量などで代用しません。OCCTOは公表上の正方向の運用容量だけを公表するため、逆潮流は正方向の運用容量で算出します。運用容量が負の値で公表されたときは、符号の意味がOCCTOの項目説明にないため、絶対値で算出した参考値とします（向きの対応も未確認。詳細パネルの注意に記載）。運用容量0で公表されたものは容量不明として表示します（停止中の可能性。詳細パネルの注意に記載）。分岐を含む行は行単位の値です。99999などの設定なしの値は容量不明として扱います。色の区分は地図の潮流の凡例のとおりです。':'予想使用率＝公表予想値÷同じ表の運用容量。';
 $('#flow-basis-count').textContent='表示中の区間：'+count+'区間'+(zero?'（うち0 MW '+zero+'区間）':'');
}
function selectedGeometries(): GeoLine[] {
  if (mode === 'geo') {
    const selected = filteredGeo().find(l => l.id === selectedId);
    if (!selected) return [];
    const ids = new Set(showConnected ? selected.connectedWayIds ?? selected.topology?.networks.flatMap(n => n.osmIds) ?? [] : []);
    // 選択のまとまり（selectGroup）が同じ線は全体を一緒に強調する（2026-11-18）
    const grouped = (l: GeoLine) => !!selected.selectGroup && l.selectGroup === selected.selectGroup;
    return (geography?.lines ?? []).filter(l => voltageShown(l) && visibleCurrents.has(l.currentType ?? 'unknown') && l.voltageKV === selected.voltageKV && (l.id === selectedId || grouped(l) || l.osmIds.some(id => ids.has(id)))).map(l => l.id === selectedId || grouped(l) ? l : {...l, paths:l.paths.filter((_,i)=>ids.has(l.osmIds[i]))});
  }
  const record = mode === 'actual' ? currentActual() : mode === 'forecast' ? currentForecast() : undefined;
  return record ? candidateGeometry(record, geography?.lines ?? []).filter(g => voltages.has(g.voltageKV) && visibleCurrents.has(g.currentType ?? 'unknown')) : [];
}
function highlightSelected() {
  highlight.clearLayers();
  for (const g of selectedGeometries()) for(const style of selectionStrokes(g.voltageKV,g.currentType,lineWidthProfile(g,hokkaidoGeography?.lines??[],shikokuGeography?.lines??[]))) L.polyline(g.paths,style).addTo(highlight);
  if (mode === 'geo') {
    const selected = geography?.lines.find(g => g.id === selectedId);
    const seen = new Set<number>();
    for (const network of selected?.topology?.networks ?? []) for (const endpoint of network.terminals) {
      if (seen.has(endpoint.node)) continue; seen.add(endpoint.node);
      L.circleMarker(endpoint.position, {radius:6, color:'#633989', weight:2, fillColor:'#fff', fillOpacity:1})
        .bindTooltip(`線分端点 · 最寄り：${esc(endpoint.nearest?.name ?? '不明')}（設備中心まで約${esc(endpoint.nearest?.meters ?? '—')} m）· 接続未確認`).addTo(highlight);
    }
  }
}
// 選んだ線・設備への拡大は、強調表示と詳細パネルを描いた次の描画フレーム以降に行う（2026-10-10 線選択の体感改善）。
// 操作の流れ（クリック→詳細表示→拡大）は同じ。続けて別のものを選んだら、古い拡大は取り消して新しい選択だけ拡大する
let focusTicket=0;
function focusSelection() {
  const ticket=++focusTicket;
  requestAnimationFrame(()=>setTimeout(()=>{if(ticket===focusTicket)focusSelectionNow();},0));
}
// PC で系統変更予定の表を開いているときは、選んだ線が表の下に隠れないよう左の余白を表の幅だけ広げる
// 地図の残りの幅が狭いとき（表と詳細パネルで地図がほぼ隠れるとき）は広げない
function plansPanelWidth(right:number){const p=document.getElementById('change-plans-panel');if(!p||p.hidden||matchMedia('(max-width:760px)').matches)return 0;const w=p.offsetWidth+16;return map.getSize().x-35-w-right>=200?w:0;}
function focusSelectionNow() {
  const points = selectedGeometries().flatMap(g => g.paths.flat());
  if (mode === 'facility') { const f = geography?.facilities.find(f => f.id === selectedId); if (f) points.push(f.position); }
  // 計測用の目印：拡大が終わった時（動かなかった時はすぐ）に grid:focus-done
  let moved=false;const done=()=>performance.mark('grid:focus-done'),onStart=()=>{moved=true;};map.on('movestart',onStart);
  const right = matchMedia('(min-width:1100px)').matches ? 370 : 35;
  if (points.length) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [35 + plansPanelWidth(right), 100], paddingBottomRight: [right, matchMedia('(max-width:760px)').matches ? 330 : 150], maxZoom: 12 });
  map.off('movestart',onStart);if(moved)map.once('moveend',done);else done();
}
// 詳細パネルの接続先と、系統変更予定の表から線・設備へ移る（2026-11-03 共通化）
function gotoFacility(id:string){ picked = null; const full = mode !== 'facility' || query !== ''; mode = 'facility'; $<HTMLSelectElement>('#data-mode').value = mode; query = ''; $<HTMLInputElement>('#real-search').value = ''; selectedId = id; full ? render() : renderSelection(); focusSelection(); }
function gotoLine(id:string){ picked = null; const full = mode !== 'geo' || query !== ''; mode = 'geo'; $<HTMLSelectElement>('#data-mode').value = mode; query = ''; $<HTMLInputElement>('#real-search').value = ''; selectedId = id; showConnected = false; full ? render() : renderSelection(); focusSelection(); }
// 地図で線を押した位置（行の外の区間の判定に使う。2026-11-08）。地図で押す以外の選び方では null に戻す
let picked:{id:string;at:[number,number]}|null=null;
function select(id: string) {
  mapPreview=false; picked = null;
  showConnected = false; selectedId = id; $('.sidebar').classList.remove('mobile-open'); $('#real-browse').textContent = '⌕ 設備を探す'; renderSelection(); focusSelection();
}
// 一覧の線ごとの OCCTO の行（地図の線に対応する行）。official.actual が変わるまで使い回す
let matchActual:unknown=null;const matchCache=new Map<string,ActualLine[]>();
function lineMatches(g:GeoLine):ActualLine[]{
  if(matchActual!==official?.actual){matchActual=official?.actual;matchCache.clear();}
  let m=matchCache.get(g.id);if(!m){m=official?.actual.lines.filter(l=>candidateGeometry(l,[g]).length)??[];matchCache.set(g.id,m);}return m;
}
let listKey:unknown=null;
// 時刻だけ変わった時：地理の一覧は数値だけ書き換える（一覧の中身・対応する行が変わる時は作り直す）
function renderListValues() {
  if (mode !== 'geo' || listKey !== official?.actual) { renderList(); return; }
  const byId = new Map((geography?.lines ?? []).map(g => [g.id, g])), index = timeIndex();
  document.querySelectorAll<HTMLElement>('#real-results [data-record]').forEach(b => { const g = byId.get(b.dataset.record!); if (!g) return; const matches = lineMatches(g); if (matches.length !== 1) return; const v = b.querySelector('.result-value'); if (v) v.innerHTML = `${number(matches[0].values[index])}<small> MW</small>`; });
}
function renderList() {
  let count = 0, content = '';
  listKey = official?.actual;
  const row = (id: string, name: string, sub: string, value: string, color = '#386d79', caution = false) => `<button class="result-item ${selectedId === id ? 'selected' : ''}" data-record="${esc(id)}"><span class="real-swatch" style="background:${color}"></span><span class="result-main"><b>${esc(name)}${caution ? '<span class="caution-tag">要注意</span>' : ''}</b><small>${esc(sub)}</small></span><span class="result-value" style="color:${color}">${value}</span></button>`;
  if (mode === 'geo') {
    // Without a search, list only named lines; unnamed OSM ways (hundreds in Tohoku) stay on the map and remain searchable by way ID.
    const all = filteredGeo(), unnamed = query ? [] : all.filter(g => !g.named || /^名称未登録/.test(g.name)), records = query ? all : all.filter(g => !unnamed.includes(g)); count = records.length;
    content = records.map(g => { const matches=lineMatches(g); const value=matches.length===1 ? matches[0].values[timeIndex()] : null; return row(g.id,g.name,`${currentLabel(g)} · ${g.voltageKV} kV${matches.length===1?' · 実績参考値':''}`,matches.length===1 ? `${number(value)}<small> MW</small>` : '↗', routeColor(g), isCaution(g)); }).join('');
    if (unnamed.length) content += `<div class="list-note">名前のない線（OSMで名称未登録）${unnamed.length}本は地図にのみ表示しています。OSMの番号で検索できます。</div>`;
  } else if (mode === 'actual') {
    const records = actualRecords(), index = timeIndex(); count = records.length;
    content = records.map(l => row(l.id, l.name, `${l.voltageKV} kV · No.${l.id}`, `${number(l.values[index])}<small> MW</small>`)).join('');
  } else if (mode === 'forecast') {
    const records = forecastRecords(); count = records.length;
    content = records.map(l => { const percent = forecastUsage(l); return row(l.id, l.name, `${l.voltageKV} kV · No.${l.id}`, percent === null ? '—' : `${percent.toFixed(1)}<small>%</small>`, colors[band(percent)]); }).join('');
  } else {
    const records = facilityRecords(); count = records.length;
    content = records.map(f => { const m = query ? facilityQueryMatch(f, query) : true; return row(f.id, f.name, `${[f.kind, ...(f.alsoKinds ?? [])].map(k => kinds[k]).join('・')} ·${voltageText(f)}${typeof m === 'string' ? ` · 別名：${m}で一致` : ''}`, '↗'); }).join('');
  }
  $('#real-count').textContent = String(count);
  $('#real-results').innerHTML = content || '<div class="empty-state">該当するデータがありません。<br/>検索条件や電圧階級を変更してください。</div>';
  $('#result-heading').textContent = { geo: '送電線', actual: '潮流実績（符号付きMW）', forecast: '予想潮流の使用率', facility: 'OSM登録設備' }[mode];
  document.querySelectorAll<HTMLButtonElement>('[data-record]').forEach(b => b.onclick = () => select(b.dataset.record!));
}
const external = externalLink;
function candidateNote(record: { id: string; name: string; voltageKV: number; from?:string; to?:string }) {
 // 東北NWの容量表との端点照合（資料間で対象区間が異なる旨の表示）は対応表による照合に置き換えた（2026-10-04）
 if(flowBasis==='occto'){
  const alias=record.from&&endpointName(record,record.from)!==record.from?'<p class="small-copy">設備名の対応：OCCTO「'+esc(record.from)+'」は、この500kV十和田幹線では「上北変電所」に対応します。'+external('https://www.tohoku-epco.co.jp/pastnews/normal/1183353_1049.html','東北電力：両端設備の根拠')+'。上北変換所とは別設備です。</p>':'';
  const path=record.from&&record.to?referenceFlowPath({...record,from:record.from,to:record.to,note:'',values:[]},geography?.lines??[],false):null;
  return alias+(path?'':'<p class="definition-change">地理経路未確認のため線上表示なし。登録線分から公表両端設備までの連続経路を確認できません。公表潮流の数値は表示します。</p>')+'<p class="research-note"> 出典：OCCTO系統情報サービス。本アプリで名称対応・可視化・参考使用率を加工。OCCTOの番号は既存資料と別体系のため、線名・電圧・両端設備・地理接続で対応付けた参考表示です。</p>';
 }
  const candidates = candidateGeometry(record, geography?.lines ?? []);
  const count = candidates.reduce((n, g) => n + g.osmIds.length, 0);
  const refState = referenceStatus(record.id, candidates);
  const review = count ? `<p class="small-copy">照合状況：名称・電圧一致 ／ 設備番号${refState === 'matching' ? '一致' : refState === 'conflicting' ? '不一致' : '未登録・未確認'} ／ 端点・回線・潮流方向は未確認</p>` : '';
  const conflictingRefs = [...new Set(candidates.flatMap(g => g.osmRefs ?? []).filter(ref => ref !== record.id))];
  return `${review}<div class="research-note">${count ? `名称・電圧が一致する地理候補：${count}線分。区間・回線・正方向は未照合のため、地図に潮流を割り当てていません。` : '抽出範囲内に名称・電圧が一致する地理ルートがありません。位置を推定して地図に描画していません。'}</div>${conflictingRefs.length ? `<p class="definition-change">設備番号の不一致：公式 No.${esc(record.id)} ／ OSM ref ${conflictingRefs.map(esc).join(', ')}。同じ設備としての結合を保留しています。</p>` : ''}`;
}
const num=(n:number)=>jaNumber.format(n);
// ---- 詳細パネル（2026-10-09 再設計、表示は src/detail-panel.ts） ----
let detailTab:'overview'|'sources'='overview',detailKey='';
// 注意の開閉は同じ選択のあいだ保つ（潮流の更新などで詳細パネルを作り直しても閉じない。2026-11-07）
let notesOpen=false;
const allRegional=()=>[hokkaidoGeography,tokyoGeography,chubuGeography,hokurikuGeography,kansaiGeography,chugokuGeography,shikokuGeography,kyushuGeography].filter((g):g is Geography=>!!g);
const isTohokuLine=(g:GeoLine)=>!!baseGeography?.lines.some(x=>x.id===g.id)&&!allRegional().some(r=>r.lines.some(x=>x.id===g.id&&!x.id.startsWith('tie-')));
const timeText=()=>{const t=official?.actual.originalTimes[timeIndex()];const m=t?.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);return m?`${m[2]}/${m[3]} ${m[4].padStart(2,'0')}:${m[5]} JST · 30分値`:t?t+' JST · 30分値':'時刻 未確認';};
const usageColor=(u:number|null)=>colors[band(u)];
const LINE_TIERS=[{letter:'A',label:'両端同名'},{letter:'B',label:'両端到達'},{letter:'C',label:'地図のみ'},{letter:'D',label:'経路不明'},{letter:'E',label:'補助資料のみ'}];
// 未判定は置かない（全線に確度を付ける。2026-11-04、tests/no-untiered-lines.test.ts）。区分のないデータが来たときの予備の表示（仮の区分で埋めない）
const LINE_TIER_MISSING:[string,string]=['確度 —','照合区分の記載がありません（データの不備）。'];
const LINE_TIER_TEXT:Record<string,[string,string]>={
 A:['確度 A：公表区間の両端まで、同名の地図データの線で到達','公表区間の両端の設備に、同じ名前の地図データの線（と短い引込）だけで届いています。'],
 B:['確度 B：区間は公表資料、経路は地図データ','公表区間の両端の設備に届いています。経路に派生名・共架表記・分岐の端点を含みます。'],
 C:['確度 C：地図データのみ・推定を含む','別名の線の経由、途切れの直線補完、公表資料に区間のない線（電源線など）、または分岐点の推定を含みます。'],
 D:['確度 D：両端は公表資料、経路は不明','両端の設備は公表資料で確定していますが、経路が分からないため両端を直線で結んでいます。'],
 E:['確度 E：補助資料のみ','線の存在・区間の根拠が補助資料（OSM・報道など）だけで、公表資料では確認できていません（最低区分）。'],
};
const FACILITY_TIERS=[{letter:'A',label:'名称・位置'},{letter:'B',label:'公表名'},{letter:'C',label:'地図のみ'},{letter:'D',label:'位置推定'},{letter:'E',label:'補助資料のみ'}];
// 設備の確度（2026-10-09。判定は src/evidence.ts の facilityTierOf）
const FACILITY_TIER_TEXT:Record<string,[string,string]>={
 A:['確度 A：名称と位置を確認','国土地理院の地図の注記（補助として位置の確認に使う）か公表資料の所在地で、名称と位置を確認しています。'],
 B:['確度 B：公表名と地図データが一致','公表資料の設備名と、地図データ（OSM）の区画の名前が一致しています。'],
 C:['確度 C：地図データのみ','地図データ（OSM）の登録だけによる設備です。名前のない区画に名称を当てたものを含みます。'],
 D:['確度 D：位置を推定で配置','住所の代表点・ダムなどで位置を代用しています（提供された座標を含む）。'],
 E:['確度 E：補助資料のみ','設備の存在・役割の根拠が補助資料（OSM・報道など）だけで、公表資料では確認できていません（最低区分）。'],
};
const attr=(x:{attributes?:{label:string;value:string}[]},re:RegExp)=>x.attributes?.find(a=>re.test(a.label))?.value;
function sourceFromText(text:string|undefined,label:string):SourceItem|null{if(!text)return null;return {label,name:text.length>60?text.slice(0,59)+'…':text};}
function lineActual(g:GeoLine){const matches=official?.actual.lines.filter(l=>candidateGeometry(l,[g]).length)??[];return matches.length===1?matches[0]:recordOnLine(matches,g);}
function capacitiesFor(r:{name:string;voltageKV:number}){return occto?.capacities.filter(c=>normalizeName(c.name)===normalizeName(r.name)&&c.voltageKV===r.voltageKV)??[];}
function flowCard(r:ActualLine):FlowCard{
 const mw=r.values[timeIndex()]??null,info=mw===null?null:occtoUsageInfo(r,mw),u=info?.usage??null;
 const branches=flowBranches(r,geography?.lines??[]);
 // OCCTOの1行を複数の線に出しているとき（連系線の2線合計など）は合計の値であることを示す（2026-10-10）
 const combined=combinedRowGroups((occto?.actual.lines??[]).filter(l=>l.id.startsWith('tie-')===r.id.startsWith('tie-'))).find(g=>g.includes(r.name));
 return {mw,...(combined?{combined}:{}),...(isWorkCapacity(info?.constraint)?{workCapacity:info!.constraint}:{}),...(info?.timed?{timedCapacity:true}:{}),...(info?.excluded?{capacityExcluded:info.excluded}:{}),...(info?.capacityRetrievedAt?{capacityRetrievedAt:info.capacityRetrievedAt}:{}),from:r.from,to:r.to,time:timeText(),...(branches.length?{reference:branches}:{}),...(info?.reverse?{reverse:true}:{}),...(/符号を反転/.test(r.note??'')?{signFlipped:true}:{}),usage:u,usageColor:usageColor(u),capacityMW:info?.capacityMW??null,capacityState:info?.capacityState??'none',spark:dayIndices().map(i=>r.values[i]??null),sparkIndex:hourIndex};
}
const shortName=(s:string)=>s.replace(/(変電所|開閉所|変換所|発電所)$/,'');
function constructionBadge(g:GeoLine):Badge|null{
 if(g.schematic)return {text:g.construction==='underground'?'地中（経路不明）':g.construction==='overhead'?'架空（経路不明）':'経路不明（直線）',tone:'muted'};
 if(g.publishedRoute)return {text:'公表図の線形',tone:'muted'};
 if(g.cableOsmIds?.length)return {text:g.cableOsmIds.length>=g.osmIds.filter(i=>i>0).length?'地中':g.cableLabel??'一部地中',tone:'muted'};
 return {text:'架空',tone:'muted'};
}
// 状態のバッジ・既定値の注意・出典の「運用状態」の行は、運用中（確認済み・既定値とも）では出さない（送電線 2026-11-04、設備 2026-11-07）。建設中・計画中・要確認・廃止だけ出す
const statusShown=(x:GeoLine|GeoFacility)=>!!x.statusCheck||x.status!=='運用中';
function statusBadge(x:GeoLine|GeoFacility):Badge{const s=statusLabel(x);return {text:s,tone:x.status==='廃止'?'retired':x.status==='建設中'||x.status==='計画中'?'warn':x.statusConfirmed===false?'muted':'ok'};}
// 値（連系線は向きも）が推定の OCCTO の行：note が「推定」で始まる（scripts/tie-flow.mjs・src/kansai-domain.ts の splitCross）
const flowEstimated=(actual:ActualLine|undefined)=>!!actual&&/^推定/.test(actual.note??'');
function lineNotes(g:GeoLine,actual:ActualLine|undefined,extra:string[],flowNotes:string[]=[]){
 return uniqueNotes([
  ...(g.attributes??[]).filter(a=>/^要注意/.test(a.label)).map(a=>a.value),
  ...(g.inferred??[]).map(i=>'推測した接続：'+i.basis),
  g.statusCheck,
  actual?'使用率は同日最大需要時の容量に対する参考値です。':null,
  ...flowNotes,
  actual&&/符号を反転/.test(actual.note??'')?actual.note.slice(actual.note.indexOf('OCCTOの実績値')):null,
  flowEstimated(actual)?actual!.note:null,
  ...extra,
  '個別の回線・母線の結線は未確認です。',
 ]);
}
function endpointChips(g:GeoLine,actual:ActualLine|undefined){
 const ends=(g.connections??[]).map(c=>c.facilities[0]?{id:c.facilities[0].id,name:c.facilities[0].name}:{id:'',name:c.status==='shared-node'?'分岐点（他の線と共有）':'端点未確認'});
 const uniq=ends.filter((e,i)=>ends.findIndex(x=>x.id===e.id&&x.name===e.name)===i);
 let pair=uniq.length>=2?[uniq[0],uniq[uniq.length-1]]:uniq;
 // 公表の正方向（from→to）に並べる
 if(actual&&pair.length===2){const m=(e:{name:string})=>normalizeName(e.name).includes(normalizeName(endpointName(actual,actual.from)).replace(/(変電所|開閉所|変換所|発電所)$/,''));if(!m(pair[0])&&m(pair[1]))pair=[pair[1],pair[0]];}
 const chip=(e:{id:string;name:string})=>e.id?`<button type="button" class="dp-chip" data-goto-facility="${esc(e.id)}">${esc(e.name)}</button>`:`<span class="dp-chip dp-chip-plain">${esc(e.name)}</span>`;
 return pair.length?pair.map(chip).join('<span aria-hidden="true">→</span>'):UNKNOWN;
}
function lineView(g:GeoLine):DetailView{
 // 途中の変電所で終わる行（flowTaps）：行の外の区間（鹿島線の新野田〜筑波南、江東線の葛南〜江東）を地図で押したときは潮流・運用容量を未確認にする（2026-11-08）。
 // この線に対応する行が1つだけのときに限る。値は0にしない
 const row=lineActual(g),single=!!row&&!!g.flowTaps?.length&&lineMatches(g).length===1;
 const offRow=single&&picked?.id===g.id&&offRowAt(row!,geography?.lines??[],g,picked.at);
 const actual=offRow?undefined:row;
 const offEnds=single?offRowEnds(row!,geography?.lines??[],g):null,offName=offEnds?`${shortName(offEnds[0])}〜${shortName(offEnds[1])}`:'';
 const dayText=(occto?.date??day).slice(5).split('-').map(Number).join('/');
 const rowText=row?`OCCTOの${row.name}の行は${shortName(row.from)}→${shortName(row.to)}の区間の値`:'';
 const offRowNote=offRow?`この日（${dayText}）のOCCTOの公表に、押した区間${offName?'（'+offName+'）':''}の行はありません（${rowText}）。`:single&&offEnds?`${rowText}です。${offName}の区間は、この日（${dayText}）のOCCTOの公表に行がなく未収録です（地図でその区間を押すと「未確認」と表示）。`:null;
 const tohoku=isTohokuLine(g);
 const nets=tohoku?networkCapacity?.lines.filter(r=>normalizeName(r.name)===normalizeName(g.name)&&r.voltageKV===g.voltageKV)??[]:[];
 const net=nets.length===1?nets[0]:undefined;
 const caps=offRow?[]:actual?capacitiesFor(actual):capacitiesFor(g); // 行の外の区間は行の運用容量を当てない
 const dirCap=(a:string,b:string)=>{const c=caps.filter(x=>x.from===a&&x.to===b);return c.length===1&&c[0].capacityMW!==null?num(c[0].capacityMW)+' MW':UNKNOWN;};
 const capHtml=actual?`${dirCap(actual.from,actual.to)}<span class="dp-sub">（${esc(shortName(actual.from))}→${esc(shortName(actual.to))}）</span><br>${dirCap(actual.to,actual.from)}<span class="dp-sub">（${esc(shortName(actual.to))}→${esc(shortName(actual.from))}）</span>`:caps.length===1&&caps[0].capacityMW!==null?`${num(caps[0].capacityMW)} MW<span class="dp-sub">（${esc(shortName(caps[0].from))}→${esc(shortName(caps[0].to))}）</span>`:UNKNOWN;
 const tso=lineCapacity?.lines[g.id];
 // 北海道・本州間（北本・新北本）は運用容量が2設備合計、設備容量は線ごとの公表値（2026-10-10）
 const tieNote=tieCapacityNotes[g.name];
 // 回線数だけの公開ファイル：表そのもの（net）がないときに、net と同じ条件（名前・電圧が一致し1行だけ）で使う
 const circs=tohoku&&!net?tohokuCircuits?.lines.filter(r=>normalizeName(r.name)===normalizeName(g.name)&&r.voltageKV===g.voltageKV)??[]:[];
 const circ=circs.length===1&&circs[0].circuitCount!=null?circs[0]:undefined;
 const regionKey=(['hokkaido','tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu'] as const).find(r=>({hokkaido:hokkaidoGeography,tokyo:tokyoGeography,chubu:chubuGeography,hokuriku:hokurikuGeography,kansai:kansaiGeography,chugoku:chugokuGeography,shikoku:shikokuGeography,kyushu:kyushuGeography})[r]?.lines.some(x=>x.id===g.id))??'tohoku';
 const tableLink=regionMapSources[regionKey]?.at(-1);
 // 各社の表の値：対応する行があれば公表値（横線は「公表欄なし」）。公開版（表を同梱しない）は「未確認＋公表資料」
 const tsoText=(v:string|number|null|undefined,unit='')=>v==null?(tso?'<span class="dp-unknown">公表欄なし</span>':!lineCapacity&&!net&&tableLink?UNKNOWN+' '+external(tableLink.url,'公表資料'):UNKNOWN):v==='−'?'<span class="dp-unknown">公表欄なし（−）</span>':esc(typeof v==='number'?num(v)+unit:v);
 const circuits=tso?.circuits??net?.circuitCount??circ?.circuitCount??Number((g.attributes??[]).map(a=>a.value.match(/(\d)回線/)?.[1]).find(Boolean)??NaN);
 // 公表値の比較（東北電力NWとOCCTO）
 let compare='',diff:string[]=[];
 const occCap=actual&&caps.length?caps.find(c=>c.from===actual.from&&c.to===actual.to)??(caps.length===1?caps[0]:undefined):undefined;
 if(net&&occCap){diff=compareCapacity(net,occCap);const same=!diff.length;
  compare=`<details class="dp-compare"><summary>公表値の比較<span class="dp-badge ${same?'dp-ok':'dp-warn'}">${same?'一致':'差異あり'}</span><span class="dp-chev" aria-hidden="true">›</span></summary><div class="dp-compare-table"><span></span><b>東北電力NW</b><b>OCCTO</b><span>運用容量</span><span>${net.capacityMW===null?UNKNOWN:num(net.capacityMW)+' MW'}</span><span>${occCap.capacityMW===null?UNKNOWN:num(occCap.capacityMW)+' MW'}</span><span>制約要因</span><span>${esc(net.constraint||'—')}</span><span>${esc(occCap.constraint||'—')}</span><span>公表日</span><span>${esc(net.published)}</span><span>${esc((occto?.date??day).slice(5).replace('-','/'))}</span></div><p class="dp-sub">差があるときは「注意」にも表示します。公表時点や算定条件が違うため、差があっても誤りとは限りません。</p></details>`;}
 const rows:Row[]=[
  {label:'区間',html:`<span class="dp-chips">${endpointChips(g,actual)}</span>`},
  {label:'運用容量',html:capHtml+(tieNote?`<br><span class="dp-sub">${esc(tieNote.group)}</span>`:'')},
  {label:'設備容量',html:tieNote?`${num(tieNote.equipmentMW)} MW<span class="dp-sub">（${esc(tieNote.equipmentNote)}）</span>${tieNote.plan?`<br><span class="dp-sub">${esc(tieNote.plan)}</span>`:''}`:tso?tsoText(tso.equipmentMW,' MW'):net?.equipmentMW!=null?num(net.equipmentMW)+' MW':tsoText(null)},
 ];
 if(g.status==='建設中'||g.status==='計画中')rows.push({label:'使用開始予定',html:g.plannedStart?esc(g.plannedStart):UNKNOWN});
 const flow:FlowCard|'loading'|'excluded'|'none'=flowLoading===day?'loading':actual?flowCard(actual):g.lineType==='customer'?'excluded':'none';
 const notes=lineNotes(g,actual,[...diff.filter(d=>!/未公表のため/.test(d)),...(offRowNote?[offRowNote]:[])],flowCardNotes(flow));
 const tierKey=g.evidenceTier??'';
 const tierText=LINE_TIER_TEXT[tierKey]??LINE_TIER_MISSING;
 const osmId=g.osmIds.find(i=>i>0);
 const sources:SourceItem[]=[
  actual?{label:'区間・方向',name:'OCCTO 系統情報サービス',date:'No.'+actual.id,url:occto?.sourceUrl}:sourceFromText(attr(g,/^公表区間/),'区間・方向')??{label:'区間・方向',name:'未確認'},
  ...(actual?[{label:'潮流',name:'OCCTO（本アプリで加工）',date:'30分値',url:occto?.sourceUrl}]:[]),
  ...(caps.length?[{label:'運用容量',name:'OCCTO 同日最大需要時',date:(occto?.date??day).slice(5).replace('-','/'),url:occto?.sourceUrl}]:[]),
  ...(tieNote?[{label:'設備容量',name:tieNote.source.name,date:tieNote.source.date,url:tieNote.source.url}]:[]),
  ...(tso?[{label:'設備容量など',name:tso.source??'各社の系統空容量一覧',date:(tso.published??'')+(tso.no?' · No.'+tso.no:''),url:tso.url}]:net?[{label:'設備容量など',name:'東北電力ネットワーク 系統空容量',date:net.published,url:net.sourceUrl}]:tableLink?[{label:'設備容量など',name:'未確認（公表資料：'+tableLink.label+'）',url:tableLink.url}]:[]),
  ...(circ&&!tso?[{label:'回線数',name:'東北電力ネットワーク 系統空容量',date:circ.published??undefined,url:circ.sourceUrl??undefined}]:[]),
  g.publishedRoute?{label:'経路',name:g.publishedRoute.label,date:g.publishedRoute.retrievedAt,url:g.publishedRoute.url}:{label:'経路',name:'© OpenStreetMap contributors',date:(g.osmTimestamp??geography?.osmTimestamp??'').slice(0,10),url:osmId?`https://www.openstreetmap.org/way/${osmId}`:undefined},
  ...(g.statusSource?[{label:'運用状態',name:g.statusSource}]:!statusShown(g)?[]:[{label:'運用状態',name:g.statusConfirmed===false?'未確認（既定値：運用中）':statusLabel(g)}]),
  ...((g.attributes??[]).filter(a=>a.label==='出典').map(a=>({label:'資料',name:a.value.length>60?a.value.slice(0,59)+'…':a.value}))),
 ];
 // 照合の詳細
 const c=g.connections??[];
 const endpointsHtml=`<h4>両端の確認状況</h4><p>${g.referenceReview?esc(g.referenceReview.endpoints):[...new Set(c.flatMap(x=>x.facilities.map(f=>f.name)))].map(esc).join('・')||'対応未確認'}</p>`;
 const checkHtml=c.length?`<h4>経路の接続点検</h4><p>設備の範囲内 ${c.filter(e=>e.status==='facility-area').length} ／ 共有ノード ${c.filter(e=>e.status==='shared-node').length} ／ 未確認 ${c.filter(e=>e.status==='unresolved').length}</p>${c.map(e=>`<button type="button" class="dp-row-button" data-endpoint="${esc(e.node)}">${e.status==='facility-area'?e.facilities.map(f=>esc(f.name)).join(' / '):e.status==='shared-node'?'別の線分と共有ノードで接続':e.otherVoltages?.length?'他電圧・電圧不明の線分に接続（未確認）':'接続未確認の端点'}<span>地図で確認 ›</span></button>`).join('')}<button type="button" class="dp-row-button" id="inspect-physical">${showConnected?'選択した名称に戻す':'地図でたどる（設備までつながる線分を強調）'}<span>›</span></button>`:'';
 const topo=g.topology;const topoHtml=topo?`<h4>分岐と近接する別線</h4><p>同名線分の連続グループ ${esc(topo.namedComponents)}、接続グループ ${topo.networks.length}。共有ノードでつながる別名・無名の線や、近くを通る線は、電気的な接続を示すものではありません。</p>${topo.scope!=='same-name'?`<button type="button" class="dp-row-button" id="inspect-connected">${showConnected?'選択した名称の線分だけ表示':'つながる別名・無名線分も強調'}<span>›</span></button>`:''}${topo.networks.map(n=>`<p class="dp-sub">${n.osmIds.length}線分：${n.names.map(esc).join(' / ')}<br>${n.terminals.map(t=>`端点 ${esc(t.node)}（最寄り：${esc(t.nearest?.name??'なし')}、約${esc(t.nearest?.meters??'—')} m）`).join('<br>')}</p>`).join('')}`:'';
 // 収録線分は同じ way を一度だけ数える（記号でなぞった区間をはさんで同じ way を何度も使う線がある。飛騨信濃直流幹線、2026-11-07）
 const osmHtml=`<h4>OSM 線分・端点・ノード</h4><p>${g.publishedRoute?'公表図の線形（OSMの線分ではありません）：'+esc(g.publishedRoute.featureNames.join('・')):'収録線分 '+osmWays(g).length+'（'+esc(osmWays(g).slice(0,8).join('・'))+(osmWays(g).length>8?' ほか':'')+'）'}${g.publishedRoute?'':osmFillText(g)}<br>データベース時刻：${esc((g.osmTimestamp??geography?.osmTimestamp??'—'))}</p>`;
 const attrsHtml=g.attributes?.length?`<h4>設備の登録情報</h4><dl class="dp-attrs">${g.attributes.map(a=>`<dt>${esc(a.label)}</dt><dd>${esc(a.value)}</dd>`).join('')}</dl>`:'';
 const dc=dcReferences.find(r=>normalizeName(g.name)===r.name);
 const dcHtml=dc?`<h4>公式資料上の区間</h4><p>${esc(dc.from)} → ${esc(dc.to)}（${esc(dc.voltage)}）<br>${external(dc.url,dc.source)}</p>`:'';
 const subtitle=['送電線',`${g.currentType==='dc'?'直流 ':''}${g.voltageKV} kV`,currentLabel(g),Number.isFinite(circuits)?circuits+'回線':''].filter(Boolean).join(' · ');
 const badges:Badge[]=[...(statusShown(g)?[statusBadge(g)]:[]),{text:g.evidenceTier?'確度 '+g.evidenceTier:'確度 —',tone:'muted'},...(g.inferred?.length?[{text:'推測',tone:'warn' as Tone}]:[]),...(flowEstimated(actual)?[{text:'潮流は推定',tone:'warn' as Tone}]:[]),...[constructionBadge(g)].filter((b):b is Badge=>!!b)];
 return {icon:'line',iconColor:routeColor(g),title:g.name,subtitle,badges,flow,
  overview:rowsHtml(rows)+notesButtonHtml(notes)+compare,
  tier:{letter:tierKey||'—',title:tierText[0],text:tierText[1],scale:LINE_TIERS},sources,notes,
  verification:endpointsHtml+checkHtml+topoHtml+osmHtml+dcHtml+attrsHtml};
}
function facilityLines(f:GeoFacility):ConnectedLine[]{
 const lines=(geography?.lines??[]).filter(l=>(l.connections??[]).some(c=>c.facilities.some(x=>x.id===f.id)));
 const seen=new Set<string>();
 return lines.filter(l=>!seen.has(l.id)&&seen.add(l.id)).map(l=>{
  const r=lineActual(l),mw=r?r.values[timeIndex()]??null:null;
  const fn=shortName(normalizeName(f.name));
  const isFrom=r?normalizeName(endpointName(r,r.from)).includes(fn)?true:normalizeName(endpointName(r,r.to)).includes(fn)?false:null:null;
  const other=(l.connections??[]).flatMap(c=>c.facilities).find(x=>x.id!==f.id);
  const u=r&&mw!==null?occtoUsage(r,mw):null;
  return {id:l.id,name:l.name,color:routeColor(l),sub:[`${l.currentType==='dc'?'直流 ':''}${l.voltageKV} kV`,isCaution(l)?'要注意（'+(l.evidenceTier??'—')+'）':other?shortName(other.name)+(isFrom===false?'から':'へ'):''].filter(Boolean).join(' · '),mw:r?mw:null,side:flowSide(mw,isFrom),usage:u,usageColor:usageColor(u),caution:isCaution(l),inferred:!!l.inferred?.length&&!r};
 });
}
// 需要家の詳細（2026-10-11、docs/CUSTOMER_FACILITIES.md）：表示名・名前の確認状況・業種・所有者・受電電圧。補助資料上の名称は画面に出さない
function customerRows(c:NonNullable<GeoFacility['customer']>):Row[]{
 const primary=c.sources.filter(s=>s.kind==='primary'&&s.namesFacility);
 const nameHtml=c.nameStatus==='confirmed'&&primary.length?'一次資料で確認済み<span class="dp-sub">（'+primary.map(s=>esc(s.name)).join('、')+'）</span>':'一次資料で確認できないため「需要家」と表示<span class="dp-sub">（検索した資料は出典に記載）</span>';
 return [{label:'表示名',html:esc(c.displayName)},{label:'名称',html:nameHtml},{label:'業種',html:c.industry?esc(c.industry):UNKNOWN},{label:'所有者',html:c.owner?esc(c.owner):UNKNOWN},{label:'受電電圧',html:c.receivingKV.length?esc(c.receivingKV.join(' / ')+' kV'):UNKNOWN}];
}
function customerSources(f:GeoFacility):SourceItem[]{
 // 実名未確認の需要家は設備ページへのリンクを付けない（url が空。OSMの帰属表示は出典画面の全体の表示で満たす。2026-10-13）
 return [{label:'位置',name:(f.url??'').includes('openstreetmap.org')||(!f.url&&f.id.startsWith('osm-'))?'© OpenStreetMap contributors（補助資料）':'住所・資料から求めた代表点',...(f.url?{url:f.url}:{})},
  ...f.customer!.sources.map(s=>({label:s.kind==='primary'?'一次資料（'+s.category+'）':'補助資料（'+s.category+'）',name:s.name+(s.result?'：'+s.result:''),date:s.checkedAt,url:s.url}))];
}
function facilityView(f:GeoFacility):DetailView{
 const kindsAll=[f.kind,...(f.alsoKinds??[])];
 const e=facilityVoltage(f);
 const cl=facilityLines(f);
 // 直流の電圧（変換所の直流側）は接続する直流の線から（facilityVoltage は交流だけ）
 const dcKV=[...new Set((geography?.lines??[]).filter(l=>l.currentType==='dc'&&(l.connections??[]).some(c=>c.facilities.some(x=>x.id===f.id))).map(l=>l.voltageKV))];
 const vText=[dcKV.length?'直流 '+dcKV.join(' / ')+' kV':'',e.voltages.length?(dcKV.length?'交流 ':'')+e.voltages.join(' / ')+' kV':''].filter(Boolean).join(' ／ ');
 const profile=f.kind==='plant'?plantProfiles.find(p=>p.id===f.id):undefined;
 const src=f.kind==='plant'?plantSourceOf(f.id):undefined,srcLabel=src?PLANT_SOURCES.find(s=>s.key===src)?.label:undefined;
 const osmOut=attr(f,/発電設備出力/);
 // 本アプリの調査で設備ごとに決めた出力（属性「設備出力（本アプリの調査による値）」、2026-11-18。docs/mockups/detail-panel/README.md「発電所」）。一次資料・HJKS の値がないときだけ使う
 const ownerOut=f.kind==='plant'?attr(f,/^設備出力（本アプリの調査による値）$/):undefined,ownerMW=ownerOut?Number(ownerOut.match(/^(\d+(?:\.\d+)?)\s*MW/)?.[1]??NaN):NaN;
 const osmOperator=(attr(f,/^OSM登録$|^事業者/)??'').match(/事業者[：:]\s*([^、。]+)/)?.[1]??attr(f,/^事業者/);
 const retired=f.status==='廃止';
 // 発電所のユニット：HJKS（tools/build-plant-units.mjs）を主に、なければ事業者の公式資料（plant-profiles の units）
 const hj=f.kind==='plant'?plantUnits?.plants[f.id]:undefined;
 // HJKS にない号機（廃止措置中・建設中、一次資料。2026-11-10）は灰色の欄に足す。合計・種別カードには使わない
 const extraUnits=f.kind==='plant'?plantExtraUnits[f.id]??[]:[];
 const plantUnitList:UnitView[]=hj?mergeUnits(hj.units,extraUnits):profile?.units?.length?(profile.units).map(u=>({name:u.name,mw:u.mw,start:u.start,end:null,status:u.status})):mergeUnits([],extraUnits);
 const extraShown=plantUnitList.some(u=>u.extra);
 // 本アプリの調査による出力を出すのは、HJKS・事業者の資料・HJKS外の号機がなく、廃止でないときだけ（カード・注意・出典タブで同じ条件）
 const ownerShown=f.kind==='plant'&&!retired&&!hj&&!profile&&!extraShown&&Number.isFinite(ownerMW);
 const plantRunning=plantUnitList.filter(u=>u.status==='運転中'),plantOff=plantUnitList.filter(u=>u.status!=='運転中');
 const plantTotal=plantUnitList.length?Math.round(plantRunning.reduce((s,u)=>s+u.mw,0)*10)/10:profile?.capacityMW??null;
 const plantOperator=hj?(hj.operators.length?hj.operators.join('・'):hj.units[0]?.company):profile?.operator;
 const d=(s:string|null)=>s?s.replace(/-/g,'/'):'';
 // 種別（2026-10-10）：一次資料（一覧の type・事業者の資料・HJKS）だけから決める。OSMのタグ・名前・地図のマークからは推定しない
 const pt=f.kind==='plant'?plantTypeView({primary:f.plantType??null,profileMethod:profile?.method??null,units:hj?.units.map(u=>({unit:hjksUnitName(u),format:u.format,status:u.status}))??[]}):null;
 const nraOf=(u:UnitView)=>u.status==='運転中'&&!u.extra?nuclearUnitStatus(nuclearStatus,f.id,u.name,new Date()):null;
 // 原子力以外の運転中の HJKS の号機だけに運転状態を付ける（HJKS 停止情報一覧。事業者の資料だけの号機・HJKS 外の号機・原子力には付けない。2026-11-24）
 const hjRaw=new Map((hj?.units??[]).filter(u=>!/^原子力/.test(u.format??'')).map(u=>[hjksUnitName(u),u.unit] as const));
 const outOf=(u:UnitView)=>u.status==='運転中'&&!u.extra&&hjRaw.has(u.name)?unitOutageView(unitOutages,f.id,hjRaw.get(u.name)!,new Date()):null;
 const outageShown=plantUnitList.some(u=>u.status==='運転中'&&!u.extra&&hjRaw.has(u.name));
 const unitRow=(u:UnitView)=>`<div class="${u.status==='運転中'?'':'dp-unit-off'}"><span>${esc(u.name)}${nraOf(u)?`<small class="dp-nra">（${esc(nraOf(u)!)}）</small>`:''}${(o=>o?`<small class="dp-outage dp-outage-${esc(o.tone)}">（${esc(o.text)}）</small>`:'')(outOf(u))}${u.start?`<small> ${esc(d(u.start))}</small>`:''}${u.status==='運転中'&&u.end?`<small> ${esc(d(u.end))}稼動終了予定</small>`:''}</span>${pt?.unitLabels[u.name]?`<span class="dp-unit-type">${esc(pt.unitLabels[u.name])}</span>`:''}<span>${u.status==='運転中'?num(u.mw)+' MW':esc(u.status)+(u.end?' '+esc(d(u.end)):'')+'（'+num(u.mw)+' MW）'}</span></div>`;
 const hjDiff=hj&&profile&&profile.capacityMW!==null&&plantTotal!==null&&Math.abs(plantTotal-profile.capacityMW)>=1?`事業者の公式資料では ${num(profile.capacityMW)} MW（${profile.capacityBasis}）、HJKSの認可出力（運転中ユニットの合計）は ${num(plantTotal)} MWです。HJKSの値を表示しています。`:null;
 const notes=uniqueNotes([hjDiff,...(f.attributes??[]).filter(a=>/^要注意/.test(a.label)).map(a=>a.value),f.statusCheck,
  f.kind==='plant'&&!retired?'設備出力は実際の発電量や送電容量ではありません。':null,ownerShown&&osmOut?`OSM登録の出力は ${osmOut}（本アプリの調査による値を表示しています）。`:null,f.kind!=='plant'?'個別の母線・変圧器の結線は未確認です。':null,
  cl.some(l=>l.inferred)?'接続する送電線のうち「推測」は、接続先を推定したものです。':null,profile&&!retired&&profile.note?profile.note:null,profile?.unitsNote??null,profile&&osmOut&&profile.capacityMW!==null&&!osmOut.includes(String(profile.capacityMW))?`出力に差があります（一次資料 ${num(profile.capacityMW)} MW／OSM登録 ${osmOut}）。一次資料を優先しています。`:null]);
 let overview='';
 if(f.kind==='plant'){
  // 号機別：HJKSの認可出力（ユニットのまま、2026-10-09）を主に、なければ事業者の公式資料（段階③）。運転中だけを合計し、運転終了・建設中は灰色で合計に含めない
  const unitRows=plantUnitList.length?`<div class="dp-units">${plantRunning.map(unitRow).join('')}</div>${plantOff.length?`<details class="dp-units-off"><summary>${esc([...new Set(plantOff.map(u=>u.status))].join('・'))} ${plantOff.length}ユニット（合計に含めず）</summary><div class="dp-units">${plantOff.map(unitRow).join('')}</div></details>`:''}`:`<p class="dp-sub">号機別の内訳：<span class="dp-unknown">一次資料に記載なし</span></p>`;
  const card=retired?'':hj||profile||extraShown?`<div class="dp-capacity"><span class="dp-cap-label">設備出力${hj?'（認可出力）':''}</span><div class="dp-cap-value">${plantUnitList.length&&!plantRunning.length?'<span class="dp-unknown">—（運転中の号機なし）</span>':plantTotal===null?UNKNOWN:`<b>${num(plantTotal)}</b> MW`}</div><p class="dp-sub">実際の発電量ではありません。</p>${unitRows}</div>`
   :ownerShown?`<div class="dp-capacity dp-capacity-osm"><span class="dp-cap-label">設備出力</span><div class="dp-cap-value"><b>${num(ownerMW)}</b> MW</div><p class="dp-sub">直流・交流の別は未確認。実際の発電量ではありません。号機別の内訳：${UNKNOWN}</p></div>`
   :`<div class="dp-capacity dp-capacity-osm"><span class="dp-cap-label">設備出力</span><div class="dp-cap-value">${osmOut?`<b>${esc(osmOut.replace(/\s*MW$/i,''))}</b> MW`:UNKNOWN}</div>${osmOut?'<span class="dp-badge dp-warn">OSM登録値・一次資料未確認</span>':''}<p class="dp-sub">実際の発電量ではありません。号機別の内訳：${UNKNOWN}</p></div>`;
  const typeSub=pt?[...pt.sub,...(retired?['全号機廃止']:[]),...(pt.unknown?['一次資料で確認できていません（OSMの登録・名前からは推定しません）']:[])]:[];
  const typeCard=pt?`<div class="dp-capacity dp-type${pt.partial||pt.unknown?' dp-capacity-osm':''}${retired?' dp-type-retired':''}"><span class="dp-cap-label">種別</span><div class="dp-type-value">${pt.unknown?'<span class="dp-unknown">未確認</span>':pt.lines.map(l=>`<div>${esc(l.label)}</div>`).join('')}</div>${typeSub.length?`<p class="dp-sub">${esc(typeSub.join(' · '))}</p>`:''}</div>`:'';
  overview=typeCard+card+connectedLinesHtml(cl,cl.some(l=>l.mw!==null)?timeText().replace(' · 30分値',' 実績'):'')+rowsHtml([
   ...(retired?[{label:'廃止時期',html:f.retiredAt?esc(f.retiredAt.replace(/-/g,'/'))+(f.retiredAtNote?'<span class="dp-sub">（'+esc(f.retiredAtNote)+'）</span>':'')+(f.statusConfirmed===false?'<span class="dp-sub">（HJKSのみ・各社の公表は未確認）</span>':''):UNKNOWN},{label:'発電方式',html:srcLabel?esc(srcLabel):UNKNOWN},{label:'設備出力',html:'<span class="dp-unknown">—（廃止）</span>'}]:[]),
   {label:'事業者',html:plantOperator?esc(plantOperator):UNKNOWN},{label:'資料確認日',html:hj?esc(plantUnits!.retrievedAt)+'<span class="dp-sub">（HJKS）</span>':profile?esc(profile.sources[0]?.checkedAt??'2026-09-22'):extraShown?esc(extraUnits[0].checkedAt):UNKNOWN}])+notesButtonHtml(notes);
 }else if(f.kind==='customer'&&f.customer){
  overview=connectedLinesHtml(cl,cl.some(l=>l.mw!==null)?timeText().replace(' · 30分値',' 実績'):'')+rowsHtml(customerRows(f.customer))+notesButtonHtml(notes);
 }else{
  // 変圧器・バンクの行に各社の公表一覧（CSV・ZIP のダウンロード）へのリンクは置かない（2026-11-04）
  const bank=e.banks.length&&substationTable?esc(bankSummary(e.banks)):UNKNOWN;
  const rows:Row[]=[...(f.kind==='converter'||kindsAll.includes('converter')?[{label:'変換設備容量',html:UNKNOWN}]:[]),{label:'電圧階級',html:vText?esc(vText):UNKNOWN},...(f.kind==='substation'?[{label:'変圧器・バンク',html:bank}]:[])];
  if(f.kind!=='substation'&&osmOperator)rows.push({label:'事業者',html:esc(osmOperator)});
  overview=connectedLinesHtml(cl,cl.some(l=>l.mw!==null)?timeText().replace(' · 30分値',' 実績'):'')+rowsHtml(rows)+notesButtonHtml(notes);
 }
 const subtitle=[kindsAll.map(k=>kinds[k]).join('・'),f.kind==='plant'?srcLabel??'':vText,f.kind==='plant'?(plantOperator??'事業者 未確認'):''].filter(Boolean).join(' · ');
 const ft=facilityTierOf(f);
 const badges:Badge[]=[retired?{text:f.statusConfirmed===false?'廃止（HJKSのみ・未確認）':'廃止',tone:'retired'}:statusShown(f)?statusBadge(f):null,{text:'確度 '+ft,tone:'muted'}].filter((b):b is Badge=>!!b);
 const banner=retired?{title:profile?.capacityBasis??'廃止',text:profile?.note??'発電設備は運転していません。接続線は線ごとの運用状態で表示します。',tone:'retired' as const}:undefined;
 // url のない設備（OSM の区画がなく位置推定で置いたもの）でも詳細を出す（2026-11-18）
 const osm=(f.url??'').includes('openstreetmap.org')||(!f.url&&f.id.startsWith('osm-'));
 // 一次資料も地図データもなく、本アプリの判断で置いた設備（url なし・確度 E。2026-11-10、アマテラス白石ソーラーパーク）：位置・名称の出所をそのとおりに書く
 const ownerPlace=!osm&&!f.url&&ft==='E';
 const sources:SourceItem[]=f.customer?customerSources(f):[
  {label:'位置',name:ownerPlace?(attr(f,/^位置の根拠$/)?'国土地理院 空中写真（照合の詳細の「位置の根拠」）':'本アプリの調査（一次資料未確認）'):osm?'© OpenStreetMap contributors':'住所・資料から求めた代表点',url:f.url},
  {label:'名称',name:ownerPlace?'本アプリの調査（一次資料未確認）':attr(f,/名称・位置の根拠|名称の訂正/)?'地図データに名称を当てたもの（照合の詳細）':osm?'OpenStreetMap の登録名':'公表資料'},
  ...(e.banks.length?[...new Map(e.banks.map(b=>[b.url,b])).values()].map(b=>({label:'変圧器',name:b.sourceLabel,date:b.published??undefined})):[]),
  ...(profile?profile.sources.map(s=>({label:'発電所情報',name:'運営会社の一次資料',date:s.checkedAt,url:s.url})):[]),
  ...(ownerShown?[{label:'設備出力',name:'本アプリの調査（一次資料未確認）'}]:[]),
  ...(hj?[{label:'ユニット別出力',name:'日本卸電力取引所 発電情報公開システム（HJKS）',date:plantUnits!.retrievedAt+'取得',url:plantUnits!.source.url}]:profile?.unitsSource?[{label:'号機別出力',name:'運営会社の公式資料',date:profile.unitsSource.checkedAt,url:profile.unitsSource.url}]:[]),
  ...(unitOutages&&outageShown?[{label:'号機の運転状態',name:outagesStale(unitOutages,new Date())?'取得できていません（最終取得 '+unitOutages.retrievedAt.slice(0,10)+'。運転状態は表示していません）':unitOutages.source.name+'（最終更新 '+unitOutages.latestUpdate.replace('T',' ').replace(/-/g,'/')+'。停止の登録がない号機には状態を書いていません。運転中とは限りません）',date:unitOutages.retrievedAt.slice(0,10)+'取得',url:unitOutages.source.url}]:[]),
  ...(nuclearStatus&&NRA_PLANT_IDS[f.id]?[{label:'号機の運転状態',name:nuclearStale(nuclearStatus,new Date())?'取得できていません（最終取得 '+nuclearStatus.retrievedAt.slice(0,10)+'。運転状態は表示していません）':nuclearStatus.source.name+'（'+nuclearStatus.pageUpdated.replace(/-/g,'/')+' 更新）',date:nuclearStatus.retrievedAt.slice(0,10)+'取得',url:nuclearStatus.source.url}]:[]),
  ...(extraShown?[...new Map(extraUnits.map(u=>[u.url,u])).values()].map(u=>({label:'号機（廃止措置中・建設中）',name:u.source,date:u.checkedAt,url:u.url})):[]),
  ...(retired?[{label:'廃止の根拠',name:f.statusSource??'未確認'}]:f.statusSource?[{label:'運用状態',name:f.statusSource}]:!statusShown(f)?[]:[{label:'運用状態',name:f.statusConfirmed===false?'未確認（既定値：運用中）':statusLabel(f)}]),
 ];
 const basis=[e.banks.length?'公表変圧器：'+bankSummary(e.banks):'',e.lineVoltages.length?'接続する収録線路：'+e.lineVoltages.join('/')+'kV':'',e.osmVoltages.length?'OSM登録：'+e.osmVoltages.join('/')+'kV':''].filter(Boolean);
 const verification=`<h4>電圧区分の根拠</h4><p>${basis.length?basis.map(esc).join('<br>'):'なし'}</p><h4>併設の設備</h4><p>${kindsAll.length>1?esc(kindsAll.map(k=>kinds[k]).join('・')):'なし'}</p><h4>位置の確からしさ</h4><p>${osm?'地点はOSMの点、または設備の区画の中心です。入口や実測座標ではありません。':ownerPlace?'地点は本アプリの調査で置いた代表点です（一次資料未確認）。敷地の範囲・入口ではありません。':'地点は住所・資料から求めた代表点です。敷地の範囲・入口ではありません。'}${attr(f,/位置の根拠/)?'<br>'+esc(attr(f,/位置の根拠/)!):''}</p><h4>母線</h4><p>個別の母線・変圧器の結線は未確認です。地図の線が設備の区画に届くことは、電気的な接続の証明ではありません。</p>${f.attributes?.length?`<h4>設備の登録情報</h4><dl class="dp-attrs">${f.attributes.map(a=>`<dt>${esc(a.label)}</dt><dd>${esc(a.value)}</dd>`).join('')}</dl>`:''}`;
 const icon:DetailView['icon']=f.kind;
 const iconColor=f.kind==='plant'?(PLANT_SOURCES.find(s=>s.key===src)?.color??'#a04f14'):f.kind==='converter'?'#972d9d':f.kind==='switchyard'?'#266951':f.kind==='customer'?CUSTOMER_COLOR:'#244c7c';
 return {icon,iconColor:retired?'#5b6b73':iconColor,title:f.name,subtitle,badges,banner,overview,
  tier:{letter:ft,title:FACILITY_TIER_TEXT[ft][0],text:FACILITY_TIER_TEXT[ft][1],scale:FACILITY_TIERS},sources,notes,verification};
}
function occtoOnlyView(r:ActualLine):DetailView{
 const caps=capacitiesFor(r),fwd=caps.filter(c=>c.from===r.from&&c.to===r.to);
 const flow=flowCard(r);
 const notes=uniqueNotes(['使用率は同日最大需要時の容量に対する参考値です。',...flowCardNotes(flow),'OCCTOの区間名・両端を地図上の線とまだ対応付けていません。',/符号を反転/.test(r.note??'')?r.note:null]);
 return {icon:'occto',iconColor:'#4F5B63',title:r.name,subtitle:`公表区間 · ${r.voltageKV} kV · 地図の線なし`,badges:[{text:'地図未対応',tone:'muted'}],
  banner:{text:'OCCTO の公表区間です。地図上の線とはまだ対応付けていないため、地図には表示されません。',tone:'muted'},flow,
  overview:rowsHtml([{label:'区間',html:`${esc(r.from)} → ${esc(r.to)}<br><span class="dp-sub">公表の正方向</span>`},{label:'運用容量',html:fwd.length===1&&fwd[0].capacityMW!==null?num(fwd[0].capacityMW)+' MW':UNKNOWN},{label:'制約要因',html:fwd.length===1&&fwd[0].constraint?esc(fwd[0].constraint):UNKNOWN}])+notesButtonHtml(notes),
  tier:{letter:'—',title:'確度 —','text':'地図の線と対応付けていないため、確度はありません。',scale:LINE_TIERS},
  sources:[{label:'区間・潮流',name:'OCCTO 系統情報サービス（本アプリで加工）',date:'No.'+r.id,url:occto?.sourceUrl},{label:'運用容量',name:'OCCTO 同日最大需要時',date:(occto?.date??day).slice(5).replace('-','/'),url:occto?.sourceUrl}],notes,verification:''};
}
// 閉じたら選択の記録も消す（同じ線を選び直したとき、注意は閉じた状態・先頭から始める）
function hideDetail(detail: HTMLElement) { detailKey = ''; detail.hidden = true; }
function renderDetail() {
  const detail = $('#detail');
  if (!selectedId||mapPreview) { hideDetail(detail); return; }
  // OCCTOの一覧から開いた行：地図の線に対応するものは送電線の詳細に統合する
  if (mode === 'actual') {
    const r = currentActual(); if (!r) { selectedId = null; hideDetail(detail); return; }
    const geo = (geography?.lines ?? []).filter(g => candidateGeometry(r, [g]).length);
    const g = geo.find(x => lineActual(x)?.id === r.id) ?? geo[0];
    if (g) { mode = 'geo'; $<HTMLSelectElement>('#data-mode').value = 'geo'; picked = null; selectedId = g.id; showConnected = false; renderList(); drawNetwork(); }
  }
  const key = mode + ':' + selectedId; const same = key === detailKey; if (!same) { detailKey = key; detailTab = 'overview'; notesOpen = false; }
  detail.hidden = false;
  let view: DetailView | null = null;
  if (mode === 'geo') { const g = geography!.lines.find(l => l.id === selectedId); if (!g) { selectedId = null; hideDetail(detail); return; } view = lineView(g); }
  else if (mode === 'actual') { const r = currentActual(); if (r) view = occtoOnlyView(r); }
  else if (mode === 'facility') { const f = geography!.facilities.find(f => f.id === selectedId); if (!f) { selectedId = null; hideDetail(detail); return; } view = facilityView(f); }
  const top = same ? detail.scrollTop : 0;
  if (view) detail.innerHTML = detailHtml(view, detailTab);
  else if (mode === 'forecast') renderForecastDetail(detail);
  detail.classList.toggle('dp-panel', !!view);
  wireDetail(detail);
  if (same) detail.scrollTop = top;
}
function wireDetail(detail: HTMLElement) {
  detail.querySelectorAll<HTMLButtonElement>('[data-dp-tab]').forEach(b => b.onclick = () => { detailTab = b.dataset.dpTab as 'overview' | 'sources'; const top = detail.scrollTop; renderDetail(); detail.scrollTop = top; detail.querySelector<HTMLButtonElement>(`[data-dp-tab="${detailTab}"]`)?.focus(); });
  detail.querySelectorAll<HTMLButtonElement>('[data-dp-notes]').forEach(b => { const list = b.nextElementSibling as HTMLElement; const show = () => { list.hidden = !notesOpen; b.setAttribute('aria-expanded', String(notesOpen)); }; show(); b.onclick = () => { notesOpen = !notesOpen; show(); }; });
  detail.querySelectorAll<HTMLButtonElement>('[data-goto-facility]').forEach(b => b.onclick = () => gotoFacility(b.dataset.gotoFacility!));
  detail.querySelectorAll<HTMLButtonElement>('[data-goto-line]').forEach(b => b.onclick = () => gotoLine(b.dataset.gotoLine!));
  detail.querySelectorAll<HTMLButtonElement>('[data-endpoint]').forEach(b => b.onclick = () => { const point = geography?.lines.find(l=>l.id===selectedId)?.connections?.find(e=>e.node===Number(b.dataset.endpoint)); if(point) map.setView(point.position,15); });
  const physical = detail.querySelector<HTMLButtonElement>('#inspect-physical');
  if (physical) physical.onclick = () => { showConnected = !showConnected; renderDetail(); highlightSelected(); focusSelection(); };
  const inspect = detail.querySelector<HTMLButtonElement>('#inspect-connected');
  if (inspect) inspect.onclick = () => { showConnected = !showConnected; renderDetail(); highlightSelected(); focusSelection(); };
  const close = detail.querySelector<HTMLButtonElement>('#real-detail-close');
  if (close) close.onclick = () => { selectedId = null; renderSelection(); };
  detail.querySelectorAll<HTMLButtonElement>('[data-official]').forEach(b => b.onclick = () => { mode = b.dataset.recordMode === 'forecast' ? 'forecast' : 'actual'; $<HTMLSelectElement>('#data-mode').value = mode; selectedId = b.dataset.official!; query = ''; $<HTMLInputElement>('#real-search').value = ''; render(); });
}
// 予想潮流（ローカル調査用の東北の公表表、公開版にはない）：従来の画面のまま
function renderForecastDetail(detail: HTMLElement) {
  const line = currentForecast(); if (!line) { selectedId = null; hideDetail(detail); return; }
  const percent = forecastUsage(line);
  detail.innerHTML = `<div class="detail-top"><span class="eyebrow">FORECAST · No.${esc(line.id)}</span><button id="real-detail-close" class="icon-button" aria-label="詳細を閉じる">×</button></div><h2>${esc(line.name)}</h2><div class="detail-tags"><span>${esc(line.voltageKV)} kV</span><span>予想潮流</span><span>ローカル調査用</span></div><p class="small-copy">${esc(line.published)} · 現在の実測値ではありません</p><div class="usage-card"><div>公表表の容量に対する予想潮流<strong style="color:${colors[band(percent)]}">${percent === null ? '—' : percent.toFixed(1)}<small>${percent === null ? '' : '%'}</small></strong></div><div class="usage-track"><span style="width:${Math.min(100, percent ?? 0)}%;background:${colors[band(percent)]}"></span></div></div><dl class="data-facts"><dt>予想潮流</dt><dd>${number(line.forecastMW)} MW</dd><dt>運用容量</dt><dd>${number(line.capacityMW)} MW</dd><dt>設備容量</dt><dd>${number(line.equipmentMW)} MW</dd><dt>回線数</dt><dd>${esc(line.circuitCount)}</dd><dt>制約要因</dt><dd>${esc(line.constraint)}</dd></dl><div class="direction-text"><b>公表資料の正方向</b><span>${esc(line.direction)}</span></div>${line.note ? `<p class="definition-change">公表備考：${esc(line.note)}</p>` : ''}${candidateNote(line)}<div class="detail-note">${external(official!.sources.forecast.url, '東北電力ネットワーク：原CSV')}</div>`;
}

function renderTime() {
  renderDateOptions();
  renderFreshness();
  // 設備モードでも地図の潮流は描き続けるので、時刻の操作を出す（2026-11-24：PC で設備をクリックすると時刻パネルが消えていた）
  const timeline = !!official && flowBasis !== 'forecast' && mode !== 'forecast';
  $('#actual-time-controls').hidden = !timeline;
  $('#time-explanation').hidden = flowBasis !== 'forecast';
  // 時刻の操作も予想の注記もないとき（公表データの未読み込み、予想潮流の表示で流れる色の基準が予想でないとき）は、パネルを出さない（2026-11-22：地図下部の白枠と「輪郭を強調した線は…」の文を削除）。
  // その場合も携帯で「潮流」を開いたときは出す（real.css の .no-timeline）
  $('#real-time').hidden = false; // 初期の HTML では読み込み前の空のパネルを出さないため hidden
  $('#real-time').classList.toggle('no-timeline', !timeline && flowBasis !== 'forecast');
  $('#time-explanation').textContent = flowBasis === 'forecast' ? `${official?.forecast.published} · 予想値 / リアルタイムではありません` : '';
  if (timeline) {
    const indices = dayIndices();
    hourIndex = Math.max(0, Math.min(hourIndex,47));
    $<HTMLInputElement>('#actual-hour').max = '47';
    $<HTMLInputElement>('#actual-hour').value = String(hourIndex);
    $<HTMLInputElement>('#actual-hour').disabled = !indices.length;
    {const dates=availableDates(),k=dates.indexOf(day);$<HTMLButtonElement>('#time-prev').disabled=!indices.length||(hourIndex===0&&(k<0||k>=dates.length-1));$<HTMLButtonElement>('#time-next').disabled=!indices.length||(k<=0&&(!occtoDays[0]||hourIndex>=latestIndex(occtoDays[0])));}
    $('#actual-time-label').textContent = `${String(hourIndex>>1).padStart(2,'0')}:${hourIndex%2?'30':'00'} JST${occto?'':flowLoading===day?'（読み込み中）':flowLoadFailed===day?'（読み込みに失敗）':'（対象日未収録）'}`;
  }
}
// 全体の描き直し（地域・電圧・表示設定・検索・表示モード・流れる色の基準が変わった時）
function render() { renderNetwork(); }
function renderNetwork() {
  if(booting)return;
  if(pilot?.active){pilot.setFacilities(visibleKinds.has('substation'));pilot.render();return;}
  renderTime(); renderList(); drawNetwork(); renderDetail();
  renderSummary();
}
// 選択の変更：強調表示・一覧と設備マーカーの選択状態・詳細パネルだけ
function renderSelection() {
  if(booting)return;
  if(pilot?.active){pilot.render();return;}
  document.querySelectorAll<HTMLElement>('#real-results [data-record]').forEach(b=>b.classList.toggle('selected',b.dataset.record===selectedId));
  syncFacilityMarkers();
  {const byId=new Map(facilityList.map(f=>[f.id,f]));for(const [id,m] of facilityMarkers){m.getElement()?.classList.toggle('facility-selected',id===selectedId);const f=byId.get(id);if(f)m.setZIndexOffset(markerZ(f));}}
  highlightSelected(); renderDetail();
}
// 時刻・潮流の変更：時刻欄・一覧の数値・粒子・詳細パネルだけ（線・設備は描き直さない）
function renderFlow() {
  if(booting)return;
  if(pilot?.active){pilot.render();return;}
  renderTime(); renderListValues(); drawFlowOverlay(lastShowing); renderDetail(); renderSummary();
  if(flowLoading===day){$('#flow-key-status').textContent='潮流データを読み込み中（'+day+'）';$('#flow-basis-method').textContent='―';$('#flow-basis-count').textContent='表示中の区間：―';}
  else if(flowLoadFailed===day&&!occto){$('#flow-key-status').textContent='潮流データの読み込みに失敗（'+day+'）';$('#flow-basis-method').textContent='―';$('#flow-basis-count').textContent='表示中の区間：―';}
}
function renderSummary() {
  $('#dataset-summary').textContent = mode === 'actual' ? `${official?.actual.lines.length ?? 0}路線 · ${official?.actual.times.length.toLocaleString() ?? 0}時刻。${flowBasis==='occto'?'OCCTO収録日 '+(occto?.date??day)+'（取得済みの直近30日以内）。容量は同日最大需要時の参考値。':'2024年度実績。当時の容量は未確認。'}` : mode === 'forecast' ? `同一の公表表にある予想潮流と容量を表示。地図上の送電線への割当は確認中。` : `地理データ：${geography?.lines.length ?? 0}件 / 設備：${geography?.facilities.length ?? 0}件。対象は${regions[region].voltages.join("/")}kV・関連DC。`;
  if(!voltages.size)$('#dataset-summary').textContent='電圧フィルタですべて非表示にしています。対象電圧のボタンから再表示できます。';
}
let trunkKvs:number[]=[];
function initVoltage() {
 trunkKvs=[...new Set([...regions[region].voltages,...(geography?.lines.filter(l=>l.currentType==='dc').map(l=>l.voltageKV)??[])])].sort((a,b)=>b-a);
 voltages=regionVoltages.get(region)??new Set(trunkKvs);syncDisplaySettings();
}
function syncDisplaySettings(){
 const lower=!!pilot?.active,kvs=lower?pilot!.metadata.voltages:trunkKvs,enabled=lower?pilot!.settings.voltages:voltages;
 $('#real-voltage').innerHTML=kvs.map(v=>`<button class="voltage-chip ${enabled.has(v)?'active':''}" data-real-kv="${esc(v)}" aria-pressed="${enabled.has(v)}">${esc(!lower&&v===187&&!geography?.lines.some(l=>l.voltageKV===187&&l.currentType==='ac')?'187 kV（AC・線路未収録）':voltageFilterLabel(v,lower?pilot!.electricalLines:geography?.lines??[]))}</button>`).join('');
 $('#mobile-voltage').innerHTML=$('#real-voltage').innerHTML;
 $('#settings-voltage-legend').innerHTML=kvs.map(voltageKV=>{const dc=!lower&&!!geography?.lines.some(l=>l.voltageKV===voltageKV&&l.currentType==='dc');const color=electricalColor({voltageKV,currentType:dc?'dc':'ac'},lower?'lower':'trunk');return `<span><i style="border-top:3px solid ${color}"></i>${dc?'DC ':''}${esc(voltageKV)} kV${!lower&&voltageKV===187&&!geography?.lines.some(l=>l.voltageKV===187&&l.currentType==='ac')?'（線路未収録）':''}</span>`;}).join('');
 document.querySelectorAll<HTMLButtonElement>('[data-real-kv]').forEach(b=>b.onclick=()=>{const kv=Number(b.dataset.realKv);if(pilot?.active)pilot.toggleVoltage(kv);else{voltages.has(kv)?voltages.delete(kv):voltages.add(kv);selectedId=null;}syncDisplaySettings();render();});
 document.querySelectorAll<HTMLInputElement>('[data-kind]').forEach(b=>b.closest('label')!.hidden=!(lower?pilot!.metadata.facilityKinds:trunkDisplay.facilityKinds).includes(b.dataset.kind!));
 document.querySelectorAll<HTMLButtonElement>('[data-mobile-kind]').forEach(b=>b.hidden=!(lower?pilot!.metadata.facilityKinds:trunkDisplay.facilityKinds).includes(b.dataset.mobileKind!));
 syncKindButtons();
}
// 地図データ（各地域の trunk）は起動時に一斉に読み始め（prefetchTrunks）、各 load*() は届いた順ではなく以前と同じ順番で反映する（北海道の changePlans の後に東京が足すため）。
// キャッシュ可能な URL（?v=、src/data-catalog.ts）で読み、no-store は付けない（2026-10-10 表示速度の改善）
const trunkRequests=new Map<string,Promise<Response>>();
// 公開版にないデータ（datasetUrl が例外）も、以前と同じく各 load*() の try で扱えるよう Promise の失敗にする
const safeFetch=(id:string)=>{try{return fetch(datasetUrl(catalog!,id));}catch(e){return Promise.reject(e);}};
function trunkFetch(id:string){let p=trunkRequests.get(id);if(!p){p=safeFetch(id);p.catch(()=>{});trunkRequests.set(id,p);}return p;}
function prefetchTrunks(){for(const r of ['hokkaido','tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu'])trunkFetch(r+'-trunk');}
async function loadTokyo(){
 try{const r=await trunkFetch('tokyo-trunk');if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const d=await r.json();if(d.schemaVersion!==1||d.datasetId!=='tokyo-500-v6')throw Error('Invalid Tokyo dataset');tokyoGeography=d;changePlans=[...new Map([...changePlans,...(d.changePlans??[])].map(p=>[p.id,p])).values()];}catch{tokyoGeography=null;}
}
async function loadChubu(){
 try{const r=await trunkFetch('chubu-trunk');if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const d=await r.json();if(d.schemaVersion!==1||d.datasetId!=='chubu-500-v1')throw Error('Invalid Chubu dataset');chubuGeography=d;}catch{chubuGeography=null;}
}
async function loadHokuriku(){
 try{const r=await trunkFetch('hokuriku-trunk');if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const d=await r.json();if(d.schemaVersion!==1||d.datasetId!=='hokuriku-trunk-v1')throw Error('Invalid Hokuriku dataset');hokurikuGeography=d;}catch{hokurikuGeography=null;}
}
async function loadKansai(){
 try{const r=await trunkFetch('kansai-trunk');if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const d=await r.json();if(d.schemaVersion!==1||d.datasetId!=='kansai-trunk-v1')throw Error('Invalid Kansai dataset');kansaiGeography=d;}catch{kansaiGeography=null;}
}
async function loadChugoku(){
 try{const r=await trunkFetch('chugoku-trunk');if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const d=await r.json();if(d.schemaVersion!==1||d.datasetId!=='chugoku-trunk-v1')throw Error('Invalid Chugoku dataset');chugokuGeography=d;}catch{chugokuGeography=null;}
}
async function loadShikoku(){
 try{const r=await trunkFetch('shikoku-trunk');if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const d=await r.json();if(d.schemaVersion!==1||d.datasetId!=='shikoku-trunk-v1')throw Error('Invalid Shikoku dataset');shikokuGeography=d;}catch{shikokuGeography=null;}
}
async function loadKyushu(){
 try{const r=await trunkFetch('kyushu-trunk');if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const d=await r.json();if(d.schemaVersion!==1||d.datasetId!=='kyushu-trunk-v1')throw Error('Invalid Kyushu dataset');kyushuGeography=d;}catch{kyushuGeography=null;}
}
async function loadHokkaido(){
 try{const r=await trunkFetch('hokkaido-trunk');if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))return;const d=await r.json();if(d.schemaVersion!==1||d.datasetId!=='hokkaido-remaining-187-v16')throw Error('Invalid Hokkaido dataset');hokkaidoGeography=d;changePlans=d.changePlans??[];}catch{hokkaidoGeography=null;changePlans=[];}
}
function regionCoverage(){
 if(region==='tokyo'&&!tokyoGeography)return '東京初回データはこの配信では未提供です。';
 if(region==='chubu'&&!chubuGeography)return '中部初回データはこの配信では未提供です。';
 if(region==='hokuriku'&&!hokurikuGeography)return '北陸初回データはこの配信では未提供です。';
 if(region==='kansai'&&!kansaiGeography)return '関西初回データはこの配信では未提供です。';
 if(region==='chugoku'&&!chugokuGeography)return '中国初回データはこの配信では未提供です。';
 if(region==='shikoku'&&!shikokuGeography)return '四国初回データはこの配信では未提供です。';
 if(region==='kyushu'&&!kyushuGeography)return '九州初回データはこの配信では未提供です。';
 if(region==='hokkaido'&&!hokkaidoGeography)return '北海道初回データはこの配信では未提供です。';
 if(region==='tie')return tieDays.length?regions.tie.coverage:'連系線の潮流データはこの配信では未提供です。';
 if(region==='national')return '全国（利用可能な収録済み範囲：東北'+(hokkaidoGeography?'＋北海道の限定収録範囲':'')+(tokyoGeography?'＋東京の限定収録範囲':'')+(chubuGeography?'＋中部の限定収録範囲':'')+(hokurikuGeography?'＋北陸の限定収録範囲':'')+(kansaiGeography?'＋関西の限定収録範囲':'')+(chugokuGeography?'＋中国の限定収録範囲':'')+(shikokuGeography?'＋四国の限定収録範囲':'')+(kyushuGeography?'＋九州の限定収録範囲':'')+'）。'+(pilot?'下位は宮城の限定検証範囲のみ。':'');
 return regions[region].coverage;
}
// 基幹系統+連系線の電圧の内訳。例外の線（東清水FCの東京側154kV）を含む地域は「FC接続154kV」を足す（2026-10-14）
const trunkRangeLabel=(sep:string,suffix:string)=>regions[region].voltages.join(sep)+suffix+(geography?.lines.some(l=>l.trunkException)?'・FC接続154kV':'');
function syncRegionSources(){
 const d=regions[pilot?.active?'tohoku':region];
 const sourceGroup=(id:'tohoku'|'hokkaido'|'tokyo'|'chubu'|'hokuriku'|'kansai'|'chugoku'|'shikoku'|'kyushu')=>'<details><summary>'+regions[id].label+'の一次情報</summary>'+regions[id].sources.map(s=>externalLink(s.url,s.label)).join('')+'</details>';
 // 2026-10-10：「このエリアの一次情報」は見出しだけ残し、中身は畳む（開いている時に地域を変えても開いたまま）
 $('.primary-links').innerHTML='<summary>このエリアの一次情報</summary>'+occtoLink()+'<span>'+esc(regionSourceNote)+'</span>'+(region==='national'&&!pilot?.active?(hokkaidoGeography?sourceGroup('hokkaido'):'')+sourceGroup('tohoku')+(tokyoGeography?sourceGroup('tokyo'):'')+(chubuGeography?sourceGroup('chubu'):'')+(hokurikuGeography?sourceGroup('hokuriku'):'')+(kansaiGeography?sourceGroup('kansai'):'')+(chugokuGeography?sourceGroup('chugoku'):'')+(shikokuGeography?sourceGroup('shikoku'):'')+(kyushuGeography?sourceGroup('kyushu'):''):d.sources.map(s=>externalLink(s.url,s.label)).join(''));
 // 系統変更予定は文字のリンクにし、押すと地図の上に一覧の表を出す（2026-11-03）
 $('.primary-links').insertAdjacentHTML('beforeend','<button id="change-plans-open" class="change-plans-open" aria-controls="change-plans-panel" aria-expanded="false">系統変更予定の一覧</button>');
 $('#change-plans-open').setAttribute('aria-expanded',String(!$('#change-plans-panel').hidden));
 $('#change-plans-open').onclick=()=>openPlans();
 if(!$('#change-plans-panel').hidden)renderPlans();
}
// OCCTO のリンクは矢印（↗）を付けない（2026-11-03）
function occtoLink(){return externalLink(actualFlowSource.url,actualFlowSource.label).replace(' ↗</a>','</a>');}
// 表の対象（計画に記録済みの assetId）を、いま地図に読み込んでいる線・設備に引く。下位系統の表示中・読み込み中は引かない
function planResolver():((assetId:string)=>PlanTarget|null)|null{
 if(booting||pilot?.active||!geography)return null;
 const g=geography;
 return id=>{const l=g.lines.find(l=>l.id===id||l.assetId===id);if(l)return {kind:'line',id:l.id};const f=g.facilities.find(f=>f.id===id||f.assetId===id);return f?{kind:'facility',id:f.id}:null;};
}
function renderPlans(){
 $('#change-plans-content').innerHTML=plansTableMarkup(changePlans,region,planResolver(),Date.now(),pilot?.active?'下位系統の表示中は地図で選べません':mapLoadFailed?'地図を読み込めませんでした':'確認中');
 $('#change-plans-hint').hidden=true;
 document.querySelectorAll<HTMLButtonElement>('#change-plans-content .plan-more').forEach(b=>b.onclick=()=>{const row=document.getElementById(b.getAttribute('aria-controls')!);if(!row)return;row.hidden=!row.hidden;b.setAttribute('aria-expanded',String(!row.hidden));});
 document.querySelectorAll<HTMLButtonElement>('#change-plans-content .plan-target').forEach(b=>b.onclick=()=>{
  const id=b.dataset.planId!;
  if(b.dataset.planKind==='line'){
   // 対象電圧などで隠している線は選んでも見えないため、案内だけ出す（絞り込みは変えない）
   if(!(geography?.lines??[]).some(l=>l.id===id&&voltageShown(l)&&visibleCurrents.has(l.currentType??'unknown')&&(showCaution||!isCaution(l))))return hiddenHint(b);
   gotoLine(id);
  }else{
   // 設備の種類のチェックで隠している設備も同じく案内だけ
   const f=geography?.facilities.find(f=>f.id===id);if(f&&![f.kind,...(f.alsoKinds??[])].some(k=>visibleKinds.has(k)))return hiddenHint(b);
   gotoFacility(id);
  }
  if(matchMedia('(max-width:760px)').matches)closePlans(false);
 });
}
function hiddenHint(b:HTMLElement){const hint=$('#change-plans-hint');hint.textContent=b.textContent+'は、いまの表示設定（対象電圧・設備の種類など）で隠れています。表示設定で表示してから選んでください。';hint.hidden=false;}
function openPlans(){
 // スマホでは一次情報欄（設備を探す）を閉じて地図の上の表を見せる
 $('.sidebar').classList.remove('mobile-open');$('#real-browse').textContent='⌕ 設備を探す';
 $('#change-plans-panel').hidden=false;$('#change-plans-open').setAttribute('aria-expanded','true');renderPlans();$('#change-plans-title').focus();
}
function closePlans(restoreFocus=true){
 $('#change-plans-panel').hidden=true;document.getElementById('change-plans-open')?.setAttribute('aria-expanded','false');
 if(restoreFocus){const open=document.getElementById('change-plans-open');if(open&&open.offsetParent)open.focus();}
}
// 全国の地図データ（各地域の重ね合わせ）。連系線の表示はここから連系線潮流実績の対象の線だけを取り出す
const nationalView=():Geography=>({...baseGeography!,lines:uniqueAssets([...withoutTokyoOverlap(baseGeography!.lines,tokyoGeography?.lines??[]),...(hokkaidoGeography?.lines??[]),...withoutTokyoOverlap(tokyoGeography?.lines??[],chubuGeography?.lines??[],FC_KEEP),...(chubuGeography?.lines??[]),...(hokurikuGeography?.lines??[]),...(kansaiGeography?.lines??[]),...(chugokuGeography?.lines??[]),...(shikokuGeography?.lines??[]),...(kyushuGeography?.lines??[])]),facilities:uniqueAssets([...baseGeography!.facilities,...(hokkaidoGeography?.facilities??[]),...(tokyoGeography?.facilities??[]),...(chubuGeography?.facilities??[]),...(hokurikuGeography?.facilities??[]),...(kansaiGeography?.facilities??[]),...(chugokuGeography?.facilities??[]),...(shikokuGeography?.facilities??[]),...(kyushuGeography?.facilities??[])])});
const tieView=():Geography=>{
 const nat=nationalView(),records=tieDays[0]?.actual.lines??[];
 // 名前のない区間でも、lineAliases（flowNames）で行に対応付けた線は含める（北本直流幹線。抜けると上北変換所まで経路が届かない。2026-11-08）
 const lines=recordLines(nat.lines,records);
 const ids=new Set(lines.flatMap(l=>(l.connections??[]).flatMap(c=>c.facilities.map(f=>f.id))));
 return {...nat,lines,facilities:nat.facilities.filter(f=>ids.has(f.id))};
};
function syncRegion(){
 if(!baseGeography)return;
 // 全国表示はページの元の題名のまま（検索結果の題名が短くならないように。2026-11-24）。地域は「でんきの道 / 地域名」
 const d=regions[region];document.title=region==='national'?'全国の送電線と潮流を地図で可視化｜でんきの道':'でんきの道 / '+d.label;
 geography=region==='tokyo'?{...(tokyoGeography??baseGeography),lines:tokyoGeography?.lines??[],facilities:tokyoGeography?.facilities??[]}:region==='chubu'?chubuView():region==='hokuriku'?{...(hokurikuGeography??baseGeography),lines:hokurikuGeography?.lines??[],facilities:hokurikuGeography?.facilities??[]}:region==='kansai'?{...(kansaiGeography??baseGeography),lines:kansaiGeography?.lines??[],facilities:kansaiGeography?.facilities??[]}:region==='chugoku'?{...(chugokuGeography??baseGeography),lines:chugokuGeography?.lines??[],facilities:chugokuGeography?.facilities??[]}:region==='shikoku'?{...(shikokuGeography??baseGeography),lines:shikokuGeography?.lines??[],facilities:shikokuGeography?.facilities??[]}:region==='kyushu'?{...(kyushuGeography??baseGeography),lines:kyushuGeography?.lines??[],facilities:kyushuGeography?.facilities??[]}:region==='tohoku'?tohokuView():region==='tie'?tieView():region==='hokkaido'?{...(hokkaidoGeography??baseGeography),lines:hokkaidoGeography?uniqueAssets([...dcScopeLines,...hokkaidoGeography.lines]):[],facilities:hokkaidoGeography?uniqueAssets([...baseGeography.facilities.filter(f=>dcFacilityIds.has(f.id)),...hokkaidoGeography.facilities]):[]}:nationalView();
 const coverage=regionCoverage();
 const dcControls=document.querySelector<HTMLElement>('[aria-label="送電方式（地理ルート）"]');if(dcControls){const note=dcControls.querySelector('p');if(note)note.textContent=region==='tokyo'?'東京初回範囲にDC線路は未収録です。':region==='chubu'?'中部初回範囲にDC線路は未収録です。':region==='hokuriku'?'北陸初回範囲にDC線路は未収録です。':region==='kansai'?'直流は阿南紀北直流幹線（四国関西間連系、潮流未反映）のみ収録。':region==='chugoku'?'中国初回範囲にDC線路は未収録です。':region==='shikoku'?'直流は阿南紀北直流幹線（四国関西間連系、潮流未反映）のみ収録。':region==='kyushu'?'九州初回範囲にDC線路は未収録です。':`直流登録 ${geography.lines.filter(l=>l.currentType==='dc').length}件。全区間の接続と端点は確認中。`;const button=dcControls.querySelector<HTMLButtonElement>('button');if(button)button.hidden=region==='tokyo'||region==='chubu'||region==='hokuriku'||region==='kansai'||region==='chugoku'||region==='shikoku'||region==='kyushu';}
 $('#region-select option[value=tokyo]').textContent=tokyoGeography?'東京':'東京（この配信では未提供）';
 $('#region-select option[value=chubu]').textContent=chubuGeography?'中部':'中部（この配信では未提供）';
 $('#region-select option[value=hokuriku]').textContent=hokurikuGeography?'北陸':'北陸（この配信では未提供）';
 $('#region-select option[value=kansai]').textContent=kansaiGeography?'関西':'関西（この配信では未提供）';
 $('#region-select option[value=chugoku]').textContent=chugokuGeography?'中国':'中国（この配信では未提供）';
 $('#region-select option[value=shikoku]').textContent=shikokuGeography?'四国':'四国（この配信では未提供）';
 $('#region-select option[value=kyushu]').textContent=kyushuGeography?'九州':'九州（この配信では未提供）';
 $('#region-select option[value=hokkaido]').textContent=hokkaidoGeography?'北海道':'北海道（この配信では未提供）';
 $('#real-fit').setAttribute('aria-label','選択地域の収録範囲へ');
 $('.real-banner').innerHTML='<b>'+esc(d.label)+'</b><span>'+esc(coverage)+'</span>';
 syncRegionSources();
 $('.real-legend .legend-bands').innerHTML=d.voltages.map(voltageKV=>`<span><i style="background:${voltageColor({voltageKV,currentType:'ac'})}"></i>${voltageKV} kV${voltageKV===187&&!geography?.lines.some(l=>l.voltageKV===187&&l.currentType==='ac')?'（線路未収録）':''}</span>`).join('')+`<span><i style="background:${voltageColor({voltageKV:250,currentType:'dc'})}"></i>DC</span><span id="legend-trunk-exception" hidden><i style="background:${voltageColor({voltageKV:154,currentType:'ac'})}"></i>154 kV（FC交流側接続）</span><span><i class="legend-planned"></i>建設中・計画中（長い破線）</span><span><span class="facility-retired legend-retired-plant">${facilitySymbol('plant')}</span>廃止発電所</span>`;
 // ⓘの収録範囲：全国は何も出さない（「収録済みの地域」は 2026-11-03 に削除）。地域を選んだときは文を textContent で入れる
 {const info=$('#coverage-info');
  if(region==='national')info.replaceChildren();
  else{const p=document.createElement('p');p.textContent=coverage;info.replaceChildren(p);}}
 // 接続未確認の端点：選んだエリアの地理データで数える（以前は東北の読み込み時の数のまま、2026-10-04）
 {const gaps=new Set((geography?.lines??[]).flatMap(l=>(l.connections??[]).filter(e=>e.status==='unresolved').map(e=>`${l.voltageKV}-${e.node}`)));$('#connection-coverage').replaceChildren('接続を確認できていない端点（'+d.label+'）：'+gaps.size+'か所（電圧別に数えた数）',document.createElement('br'),'OSMに登録されていない区間を含め、すべての設備を網羅しているかは確認中です。');}
 const range=document.querySelector<HTMLSelectElement>('#pilot-mode-select');if(range){range.querySelector<HTMLOptionElement>('option[value=trunk]')!.title=trunkRangeLabel('/','kV・DC');const low=range.querySelector<HTMLOptionElement>('option[value=lower]')!;low.disabled=false;low.title=LOWER_LABEL;range.value=pilot?.active?'lower':'trunk';}
 initVoltage();selectRegionTime(followLatest);render();
 if(!hokkaidoGeography&&region==='hokkaido')$('#dataset-summary').textContent=coverage;
}
$('#region-select').onchange=e=>{
 regionVoltages.set(region,new Set(voltages));if(!pilot?.active)regionViews.set(region,{center:map.getCenter(),zoom:map.getZoom()});
 const next=(e.target as HTMLSelectElement).value as RegionId;if((next==='hokkaido'||next==='tokyo')&&pilot?.active)togglePilot(false);
 region=next;selectedId=null;query='';$<HTMLInputElement>('#real-search').value='';syncRegion();
 // 2026-11-09：全国に切り替えたときは今の位置（中心・拡大率）を保つ。ほかの地域は前回の位置か全体へ移る
 if(region==='national'&&!pilot?.active){/* 位置を保つ */}
 else{const view=regionViews.get(region);if(view&&!pilot?.active)map.setView(view.center,view.zoom,{animate:false});else fitAll();}
};
// ⓘ の確度の説明（2026-11-03）。見出しは詳細欄の確度と同じ定数から作る
const tierItems=(t:Record<string,[string,string]>)=>Object.values(t).map(([title])=>'<li>'+esc(title.replace(/^確度 /,''))+'</li>').join('');
$('#tier-info').innerHTML='<p>詳細欄の「確度」は、線・設備の根拠の確かさです。A が最も確かです。</p><ul class="info-list"><li><b>公表資料（一次資料）</b>：一般送配電会社・OCCTO・電源開発・発電事業者・国や自治体の公表資料と、日本卸電力取引所の発電情報公開システム（HJKS）</li><li><b>地図データ</b>：主に OpenStreetMap（OSM）。線の形・設備の位置に使います。国土地理院の地図は補助として位置・経路の確認に使い、送電線の経路の一部はベクトルタイルを加工</li><li><b>補助資料</b>：公表資料ではない資料（OSM・報道など）。線・設備があることや区間を、これだけでしか確かめられないものは確度 E</li></ul><p><b>送電線</b></p><ul class="info-list">'+tierItems(LINE_TIER_TEXT)+'</ul><p><b>変電所・発電所など</b></p><ul class="info-list">'+tierItems(FACILITY_TIER_TEXT)+'</ul><p>どの確度でも、接続先を推定したものは「推測」と表示し、回線・母線の結線までは確認していません。</p>';
const guide=$<HTMLDetailsElement>('#reading-guide');guide.ontoggle=()=>guide.querySelector('summary')!.textContent=guide.open?'見方を閉じる':'見方を開く';
// 携帯では基幹系統／下位系統の切替（#pilot-mode）を出さないので、下位系統のままなら基幹系統に戻す（2026-11-03）
// 発電所の電源の種類の記号見本も、携帯では左（☷）の設備の種類のボタンの下へ移す（右は検索と一次情報だけにするため。2026-11-03）
const plantLegend=$('.legend-plant-sources'),plantLegendNext=plantLegend.nextElementSibling;
const moveRegionControls=()=>{const mobile=matchMedia('(max-width: 760px)').matches;const destination=mobile?$('#mobile-layers'):$('.display-settings');destination.prepend($('#region-controls'));destination.append(guide);if(mobile)$('.mobile-kinds').after(plantLegend);else if(plantLegendNext)plantLegendNext.before(plantLegend);else $('.layer-options').append(plantLegend);if(mobile&&pilot?.active)togglePilot(false);};
window.addEventListener('resize',moveRegionControls);moveRegionControls();

async function load() {
  catalog=await loadCatalog();
  prefetchTrunks();
  // 設備・容量のデータも一斉に読み始める（反映は以前と同じ順番）
  const early=Object.fromEntries(['plant-units','nuclear-status','unit-outages','tohoku-plants','tohoku-capacity','tohoku-circuits','line-capacity','substation-voltages'].map(id=>{const p=safeFetch(id);p.catch(()=>{});return [id,p];}));
  const results = await Promise.allSettled([
    fetch(datasetUrl(catalog,'tohoku-trunk')).then(r => { if (!r.ok) throw new Error('OSM geography missing'); return r.json(); }),
    fetch(datasetUrl(catalog,'tohoku-dc')).then(r => { if (!r.ok) throw new Error('DC geography missing'); return r.json(); }),
    Promise.resolve(null),
    fetch(datasetUrl(catalog,'tohoku-flow-latest'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('OCCTO snapshot missing');return r.json();}),
  ]);
  try{const r=await early['plant-units'];if(r.ok){const d=await r.json();if(d.schemaVersion===1)plantUnits=d;}}catch{/* 無ければ事業者の公式資料・OSMの値 */}
  try{const r=await early['unit-outages'];if(r.ok){const d=await r.json();if(d.schemaVersion===1&&d.units&&typeof d.retrievedAt==='string'&&typeof d.latestUpdate==='string')unitOutages=d;}}catch{/* 無ければ号機の運転状態を出さない */}
  try{const r=await early['nuclear-status'];if(r.ok){const d=await r.json();if(d.schemaVersion===1&&d.plants&&typeof d.retrievedAt==='string')nuclearStatus=d;}}catch{/* 無ければ運転状態を出さない */}
  try{const r=await early['tohoku-plants'];if(r.ok)plantProfiles=(await r.json()).records??[];}catch{/* Unknown plants retain registered information. */}
  try{const r=await early['tohoku-capacity'];if(r.ok)networkCapacity=await r.json();}catch{/* Preserve OCCTO display when source unavailable. */}
  try{const r=await early['tohoku-circuits'];if(r.ok){const d=await r.json();if(d.schemaVersion===1)tohokuCircuits=d;}}catch{/* 無ければ属性の「N回線」だけ */}
  try{const r=await early['line-capacity'];if(r.ok){const d=await r.json();if(d.schemaVersion===1)lineCapacity=d;}}catch{/* 公開版：各社の表は同梱しない（画面は「未確認＋公表資料」） */}
  try{const r=await early['substation-voltages'];if(r.ok){const d=await r.json();if(d.schemaVersion===1)substationTable=d;}}catch{/* 公表変圧器が無くても OSM・接続線路の電圧で表示する。 */}
  if(results[3].status==='fulfilled'){try{const data=results[3].value;occtoDays=applyLatest('tohoku',data.days?data:{days:[data]},[],reviewedTohokuDay);occto=occtoDays[0]??null;}catch{refreshFailed=true;}}
  if (results[0].status === 'fulfilled' && results[0].value.schemaVersion === 1) geography = results[0].value;
  if (!official && occto) official={schemaVersion:1,usage:'OCCTO公表データ',sources:{actual:{url:occto.sourceUrl,retrievedAt:occto.retrievedAt,sha256:''}},actual:occto.actual,forecast:{published:'未収録',records:[]},substations:{published:'未収録',records:[]}};
  let dcInfo = '';
  if (results[1].status === 'fulfilled' && results[1].value?.schemaVersion === 1) {
    const dc: Geography = results[1].value;
    dcInfo = `<p>直流追加範囲：${esc(dc.coverage)}<br/>OSM時刻：${esc(dc.osmTimestamp)}<br/>取得日時：${esc(dc.retrievedAt)}</p>`;
    dc.facilities.forEach(f => dcFacilityIds.add(f.id));dcScopeLines=dc.lines.filter(l=>l.currentType==='dc');
    dc.lines.forEach(g => g.osmTimestamp = dc.osmTimestamp);
    if (geography) { geography.lines = [...geography.lines, ...dc.lines.filter(g => !geography!.lines.some(old => old.id === g.id))]; geography.facilities = [...geography.facilities, ...dc.facilities.filter(f => !geography!.facilities.some(old => old.id === f.id))]; } else geography = dc;
  }
  if (geography) {
    geography.lines = geography.lines.filter(inPrototypeScope);
    geography.coverage = trunkDisplay.coverage;
    geography.facilities = geography.facilities.filter(f => dcFacilityIds.has(f.id) || f.scopeConnected || f.voltages.some(v => trunkDisplay.acVoltages.includes(v)));
  }
  if (official) {
    official.forecast.records.forEach(r=>currentDefinitions.set(r.id,r));
    if(hasLocalResearch) official.actual.lines = official.actual.lines.filter(l=>inPrototypeScope(l) && candidateGeometry(l,geography?.lines ?? []).length>0);
    official.forecast.records = official.forecast.records.filter(l=>inPrototypeScope(l) && candidateGeometry(l,geography?.lines ?? []).length>0);
    official.substations.records = official.substations.records.filter(b => trunkDisplay.acVoltages.includes(b.primaryKV));
    document.querySelectorAll<HTMLOptionElement>('#data-mode option').forEach(o => o.disabled = false);
    if (initial === 'actual' || initial === 'forecast') { mode = initial; $<HTMLSelectElement>('#data-mode').value = mode; }
  }
  if (!geography) { $('#real-map-status').textContent = '地理データが未取得です。公表資料の一覧は表示できますが、線路位置を推定して描画しません。'; $('#real-map-status').hidden = false; if (official) { mode = 'actual'; $<HTMLSelectElement>('#data-mode').value = mode; } }
  $('#real-footer').textContent = official ? '公式データ：このPCの開発画面のみで表示' : '公表潮流は未収録 · OSMの地理データを表示';
  $('#coverage-info').innerHTML = geography ? `<p>${esc(geography.coverage)}</p><p>地理登録 ${geography.lines.length}件、設備 ${geography.facilities.length}件。名称・電圧別にまとめた件数で、電力会社の路線数ではありません。</p><p>東北・新潟OSMデータベース時刻：${esc(geography.osmTimestamp)}<br/>取得日時：${esc(geography.retrievedAt)}</p>` : '<p>地理データ未取得</p>';
  const gaps = new Set((geography?.lines ?? []).flatMap(l => (l.connections ?? []).filter(e => e.status === 'unresolved').map(e => `${l.voltageKV}-${e.node}`)));
  void gaps;
  $('#coverage-info').insertAdjacentHTML('beforeend', dcInfo);
  if (document.querySelector('#dc-coverage')) $('#dc-coverage').textContent = `直流登録 ${geography?.lines.filter(g => g.currentType === 'dc').length ?? 0}件。海底・地中区間を含む全区間の連続性と端点は確認中。`;
  $<HTMLButtonElement>('#show-flow-visual').disabled = !official;
  annualActual=hasLocalResearch ? official?.actual ?? null : null;
  if(!hasLocalResearch){$<HTMLOptionElement>('#flow-basis option[value=actual]').disabled=true;$<HTMLOptionElement>('#flow-basis option[value=forecast]').disabled=true;$<HTMLOptionElement>('#data-mode option[value=forecast]').disabled=true;}
  if(occto){flowBasis='occto';$<HTMLOptionElement>('#flow-basis option[value=occto]').disabled=false;$<HTMLOptionElement>('#flow-basis option[value=occto]').textContent='OCCTO実績';$<HTMLSelectElement>('#flow-basis').value='occto';applyFlowBasis();$('#coverage-info').insertAdjacentHTML('beforeend','<p>'+esc(occto.attribution)+'</p><p>対象日 '+esc(occto.date)+'・取得 '+esc(occto.retrievedAt)+'</p>');}
  document.querySelectorAll('#flow-basis option:not([value=occto]),#data-mode option[value=forecast]').forEach(e=>e.remove()); if(mode==='forecast')mode='geo'; initVoltage(); render(); fitAll();
}
$<HTMLSelectElement>('#data-mode').onchange = e => { mode = (e.target as HTMLSelectElement).value as Mode; selectedId = null; render(); };
$('#real-search').oninput = e => { if(pilot?.active){pilot.search((e.target as HTMLInputElement).value);return;} query = normalizeName((e.target as HTMLInputElement).value.trim()); selectedId = null; render(); };
function syncKindButtons() {
 document.querySelectorAll<HTMLButtonElement>('[data-mobile-kind]').forEach(b => b.setAttribute('aria-pressed', String(visibleKinds.has(b.dataset.mobileKind as GeoFacility['kind']))));
}
document.querySelectorAll<HTMLButtonElement>('[data-mobile-kind]').forEach(b => b.onclick = () => {
 const kind = b.dataset.mobileKind as GeoFacility['kind'];
 visibleKinds.has(kind) ? visibleKinds.delete(kind) : visibleKinds.add(kind);
 document.querySelectorAll<HTMLInputElement>('[data-kind]').forEach(input => input.checked = visibleKinds.has(input.dataset.kind as GeoFacility['kind']));
 syncKindButtons();render();
});
document.querySelectorAll<HTMLInputElement>('[data-kind]').forEach(input => input.onchange = () => { const kind = input.dataset.kind as GeoFacility['kind']; input.checked ? visibleKinds.add(kind) : visibleKinds.delete(kind); syncKindButtons(); if (mode === 'facility') selectedId = null; render(); });
document.querySelectorAll<HTMLInputElement>('[data-current]').forEach(input => input.onchange = () => { const kind = input.dataset.current!; input.checked ? visibleCurrents.add(kind) : visibleCurrents.delete(kind); selectedId = null; render(); });
// 2026-10-10：「要注意の線を表示」「送電線を強調（背景を淡く）」「送電方式」の切り替えは削除。要注意の線は常に表示、強調は常にオン、送電方式は全部表示
// 2026-11-03：「接続未確認の線分だけ表示」も削除（未確認の端点の数はⓘに出す）
$('#flow-basis').onchange = e => {flowBasis=(e.target as HTMLSelectElement).value as typeof flowBasis; applyFlowBasis(); render();};
$('#actual-date').onchange = e => selectOcctoDay((e.target as HTMLSelectElement).value);
$('#latest-flow').onclick=()=>{followLatest=true;selectRegionTime(true);renderFlow();void refreshOccto();};
const FLOW_STORES:Record<FlowKey,{id:string;review:(d:OcctoSnapshot)=>OcctoSnapshot;get:()=>OcctoSnapshot[];set:(v:OcctoSnapshot[])=>void;on:()=>boolean}>={
 tohoku:{id:'tohoku-flow-latest',review:reviewedTohokuDay,get:()=>tohokuDays,set:v=>{tohokuDays=v;},on:()=>true},
 hokkaido:{id:'hokkaido-flow-latest',review:reviewedHokkaidoDay,get:()=>hokkaidoDays,set:v=>{hokkaidoDays=v;},on:()=>!!hokkaidoGeography},
 tokyo:{id:'tokyo-flow-latest',review:reviewedTokyoDay,get:()=>tokyoDays,set:v=>{tokyoDays=v;},on:()=>!!tokyoGeography},
 chubu:{id:'chubu-flow-latest',review:reviewedChubuDay,get:()=>chubuDays,set:v=>{chubuDays=v;},on:()=>!!chubuGeography},
 hokuriku:{id:'hokuriku-flow-latest',review:reviewedHokurikuDay,get:()=>hokurikuDays,set:v=>{hokurikuDays=v;},on:()=>!!hokurikuGeography},
 kansai:{id:'kansai-flow-latest',review:reviewedKansaiDay,get:()=>kansaiDays,set:v=>{kansaiDays=v;},on:()=>!!kansaiGeography},
 chugoku:{id:'chugoku-flow-latest',review:reviewedChugokuDay,get:()=>chugokuDays,set:v=>{chugokuDays=v;},on:()=>!!chugokuGeography},
 shikoku:{id:'shikoku-flow-latest',review:reviewedShikokuDay,get:()=>shikokuDays,set:v=>{shikokuDays=v;},on:()=>!!shikokuGeography},
 kyushu:{id:'kyushu-flow-latest',review:reviewedKyushuDay,get:()=>kyushuDays,set:v=>{kyushuDays=v;},on:()=>!!kyushuGeography},
 tie:{id:'tie-flow-latest',review:d=>d,get:()=>tieDays,set:v=>{tieDays=v;},on:()=>!!baseGeography},
};
const ALL_FLOW_KEYS:FlowKey[]=['tohoku','hokkaido','tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu','tie'];
// 今の表示範囲で使う潮流（selectRegionTime の重ね方と同じ）
const regionFlowKeys=():FlowKey[]=>(region==='national'?ALL_FLOW_KEYS:region==='tie'?['tie' as FlowKey]:[region as FlowKey,'tie' as FlowKey]).filter(k=>FLOW_STORES[k].on());
// 日付の選択肢：今の表示範囲の各潮流の日付・ハッシュの一覧の和（新しい順、30日まで）
const availableDates=()=>[...new Set(regionFlowKeys().flatMap(k=>(flowIndex.get(k)??[]).map(e=>e.date)))].sort().reverse().slice(0,30);
// 2026-11-03：日付は収録している日（最大30日）だけを選ぶ。カレンダーでは他の月・収録外の日も出るため選択肢にした。
// 表示中の日が収録外（2024年度ローカルや読み込み前）のときだけ「（収録外）」で1件足し、空にしない。中身が同じなら作り直さない（5分ごとの更新で開いた選択肢が閉じないように）
const WEEKDAYS='日月火水木金土';
let dateOptionsHtml='';
function renderDateOptions(){
 const select=$<HTMLSelectElement>('#actual-date'),dates=availableDates(),list=dates.includes(day)?dates:[...dates,day].sort().reverse();
 const label=(d:string)=>{const [y,m,n]=d.split('-').map(Number);return d+'（'+WEEKDAYS[new Date(Date.UTC(y,m-1,n)).getUTCDay()]+'）'+(dates.includes(d)?'':'（収録外）');};
 const html=list.map(d=>`<option value="${esc(d)}">${esc(label(d))}</option>`).join('');
 if(dateOptionsHtml!==html){select.innerHTML=html;dateOptionsHtml=html;}
 if(select.value!==day)select.value=day;
}
/** その日の1日分のファイルが要る潮流を並列に読む。要らなければ null。要る時は flowLoading をすぐ立てる（読み込み中の表示） */
function ensureFlowDate(date:string):Promise<void>|null{
 const need=regionFlowKeys().filter(k=>flowIndex.get(k)?.some(e=>e.date===date&&e.hash)&&!flowLoadedHash.get(k)?.has(date));
 if(!need.length)return null;
 flowLoading=date;flowLoadFailed=null;
 return Promise.allSettled(need.map(async k=>{
  const e=flowIndex.get(k)!.find(x=>x.date===date)!,store=FLOW_STORES[k];
  const r=await fetch(datasetUrl(catalog!,store.id).replace(/-latest\.json(\?.*)?$/,'-days/')+date+'.json?v='+e.hash);if(!r.ok)throw Error('day file');
  // 受け取ったバイト列を一覧の hash と照合してから採る（2026-11-24、src/flow-hash.ts）。合わなければ失敗の扱い（読み込み済みにしない）
  const d=validDays<OcctoSnapshot>([store.review(withKeptAt(await verifiedDay(await r.arrayBuffer(),e.hash) as OcctoSnapshot))])[0];
  if(d.date!==date||flowIndex.get(k)?.find(x=>x.date===date)?.hash!==e.hash)return;// 読み込み中に一覧が変わった
  store.set([...store.get().filter(x=>x.date!==date),d].sort((a,b)=>b.date.localeCompare(a.date)));flowLoadedHash.get(k)?.set(date,e.hash);
 })).then(rs=>{for(const x of rs)if(x.status==='rejected')console.info('潮流の日別データを読み込めません（'+date+'）',x.reason);if(rs.some(x=>x.status==='rejected'))flowLoadFailed=date;if(flowLoading===date)flowLoading=null;});
}
/** 日付を切り替える（過去日は読み込み中を表示し、届いたら描き直す） */
function selectFlowDate(date:string){
 day=date;followLatest=false;const p=ensureFlowDate(date);selectRegionTime(false);renderFlow();
 if(p)void p.then(()=>{if(day===date){selectRegionTime(false);renderFlow();}});
}
function selectRegionTime(latest:boolean){
 occtoDays=region==='tokyo'?withTies(tokyoDays,tokyoGeography):region==='chubu'?withTies(chubuDays,chubuView()):region==='hokuriku'?withTies(hokurikuDays,hokurikuGeography):region==='kansai'?withTies(kansaiDays,kansaiGeography):region==='chugoku'?withTies(chugokuDays,chugokuGeography):region==='shikoku'?withTies(shikokuDays,shikokuGeography):region==='kyushu'?withTies(kyushuDays,kyushuGeography):region==='tohoku'?withTies(tohokuDays,tohokuView()):region==='hokkaido'?withTies(hokkaidoDays,geography):region==='tie'?tieDays:combineRegionDays([tohokuDays,hokkaidoDays,tokyoDays,chubuDays,hokurikuDays,kansaiDays,chugokuDays,shikokuDays,kyushuDays,tieDays],[true,true,true,true,true,true,true,true,true,false]);
 if(latest&&occtoDays.length){day=occtoDays[0].date;hourIndex=latestIndex(occtoDays[0]);}
 // 連系線の表示：三重東近江線・越前嶺南線は各地域の公表値からの推定で、OCCTO の連系線の公表より先に値が出る。推定でない線に値のある最新時刻にする（2026-10-10）
 if(latest&&region==='tie'&&occtoDays.length){const d=occtoDays[0],pub=d.actual.lines.filter(l=>!/^推定/.test(l.note??''));for(let i=47;i>=0;i--)if(pub.some(l=>l.values[i]!=null)){hourIndex=i;break;}}
 occto=flowLoading===day?null:occtoDays.find(d=>d.date===day)??null;// 読み込み中は前の日の値を残さない
 if(!official&&occto)official={schemaVersion:1,usage:'OCCTO公表データ',sources:{actual:{url:occto.sourceUrl,retrievedAt:occto.retrievedAt,sha256:''}},actual:occto.actual,forecast:{published:'未収録',records:[]},substations:{published:'未収録',records:[]}};
 if(official)official.actual=occto?.actual??{times:[],originalTimes:[],lines:[]};
 renderDateOptions();flowPathCache.clear();
}
// 2026-11-09：状態ファイル（*-status.json）は読まない（公開物にないため5分ごとに10件の 404 が出ていた）。起動時と5分ごとに各地域の最新日のファイル（計 約300KB、no-store）を並列に読み始め、反映は以前と同じ順番。
// 手元の開発サーバーは最新日のファイルの読み出しで取得を始める（scripts/live-data.mjs）ので、手元でも同じ動きにする
async function refreshOccto(){
 if(refreshing||!catalog)return;refreshing=true;
 const flowOf=(on:unknown,id:string)=>on?fetch(datasetUrl(catalog!,id),{cache:'no-store'}):null;
 const F:Record<string,Promise<Response|null>|null>={tohoku:flowOf(true,'tohoku-flow-latest'),hokkaido:flowOf(hokkaidoGeography,'hokkaido-flow-latest'),tokyo:flowOf(tokyoGeography,'tokyo-flow-latest'),chubu:flowOf(chubuGeography,'chubu-flow-latest'),hokuriku:flowOf(hokurikuGeography,'hokuriku-flow-latest'),kansai:flowOf(kansaiGeography,'kansai-flow-latest'),chugoku:flowOf(chugokuGeography,'chugoku-flow-latest'),shikoku:flowOf(shikokuGeography,'shikoku-flow-latest'),kyushu:flowOf(kyushuGeography,'kyushu-flow-latest'),tie:flowOf(baseGeography,'tie-flow-latest')};
 for(const x of Object.values(F))x?.catch(()=>{});
 try{const r=(await F.tohoku)!;if(!r.ok)throw Error();const data=await r.json();tohokuDays=applyLatest('tohoku',data,tohokuDays,reviewedTohokuDay);refreshFailed=false;}catch{refreshFailed=true;}
 if(hokkaidoGeography){
  try{const r=(await F.hokkaido)!;if(!r.ok)throw Error();const data=await r.json();hokkaidoDays=applyLatest('hokkaido',data,hokkaidoDays,reviewedHokkaidoDay);hokkaidoFailed=false;}catch{hokkaidoFailed=true;}
 }
 if(tokyoGeography){
  try{const r=(await F.tokyo)!;if(!r.ok)throw Error();const data=await r.json();tokyoDays=applyLatest('tokyo',data,tokyoDays,reviewedTokyoDay);tokyoFailed=false;}catch{tokyoFailed=true;}
 }
 if(chubuGeography){
  try{const r=(await F.chubu)!;if(!r.ok)throw Error();const data=await r.json();chubuDays=applyLatest('chubu',data,chubuDays,reviewedChubuDay);chubuFailed=false;}catch{chubuFailed=true;}
 }
 if(hokurikuGeography){
  try{const r=(await F.hokuriku)!;if(!r.ok)throw Error();const data=await r.json();hokurikuDays=applyLatest('hokuriku',data,hokurikuDays,reviewedHokurikuDay);hokurikuFailed=false;}catch{hokurikuFailed=true;}
 }
 if(kansaiGeography){
  try{const r=(await F.kansai)!;if(!r.ok)throw Error();const data=await r.json();kansaiDays=applyLatest('kansai',data,kansaiDays,reviewedKansaiDay);kansaiFailed=false;}catch{kansaiFailed=true;}
 }
 if(chugokuGeography){
  try{const r=(await F.chugoku)!;if(!r.ok)throw Error();const data=await r.json();chugokuDays=applyLatest('chugoku',data,chugokuDays,reviewedChugokuDay);chugokuFailed=false;}catch{chugokuFailed=true;}
 }
 if(shikokuGeography){
  try{const r=(await F.shikoku)!;if(!r.ok)throw Error();const data=await r.json();shikokuDays=applyLatest('shikoku',data,shikokuDays,reviewedShikokuDay);shikokuFailed=false;}catch{shikokuFailed=true;}
 }
 if(kyushuGeography){
  try{const r=(await F.kyushu)!;if(!r.ok)throw Error();const data=await r.json();kyushuDays=applyLatest('kyushu',data,kyushuDays,reviewedKyushuDay);kyushuFailed=false;}catch{kyushuFailed=true;}
 }
 if(baseGeography){
  try{const r=(await F.tie)!;if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw Error();const data=await r.json();tieDays=applyLatest('tie',data,tieDays,d=>d);tieFailed=false;
   // 北本直流幹線は OSM で複数の線分に分かれるので、同じ経路として扱う（tie-flow.json の lineAliases）
   const aliases:Record<string,string[]>=data.lineAliases??{};for(const l of [...(baseGeography?.lines??[]),...dcScopeLines,...(geography?.lines??[])])if(aliases[l.id])l.flowNames=aliases[l.id];invalidateNameIndex();flowPathCache.clear();}catch{tieFailed=true;}
 }
 // 一覧のハッシュが変わって外れた過去日を表示中なら読み直す
 const again=followLatest?null:ensureFlowDate(day);
 selectRegionTime(followLatest);refreshing=false;renderFlow();
 if(again){const d=day;void again.then(()=>{if(day===d){selectRegionTime(false);renderFlow();}});}
}
// 取得時刻は日本時間の「月/日 時:分」（今年でなければ年も付ける）。書式は1回だけ作る
const JST_FORMAT=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit',hourCycle:'h23'});
const jstParts=(d:Date)=>Object.fromEntries(JST_FORMAT.formatToParts(d).map(p=>[p.type,p.value]));
// 2026-11-03：地域ごとの更新状況は開閉式。見出しに区分ごとの件数を出し、最初は閉じる（失敗・更新停止があっても閉じる）。利用者が開閉したらその状態を保つ
let footerOpen:boolean|null=null;
function statusDetails(messages:{text:string;kind:string;missing:boolean}[],row:(text:string,cls:string)=>HTMLElement){
 const n=(k:string)=>messages.filter(m=>m.kind===k).length;
 const details=document.createElement('details'),summary=document.createElement('summary');details.className='footer-status';
 summary.textContent='更新状況：失敗 '+n('fail')+'・更新停止 '+n('stale')+'・欠測 '+messages.filter(m=>m.missing).length+'（'+messages.length+'件）';
 summary.onclick=()=>{footerOpen=!details.open;};
 details.open=footerOpen??false;
 details.append(summary,row('取得した時刻は日本時間','footer-sub'),...messages.map(m=>row(m.text,'footer-row')));
 return details;
}
function renderFreshness(){
 const thisYear=jstParts(new Date()).year;
 const jst=(s:string|null|undefined)=>{const t=s?new Date(s):null;if(!t||!Number.isFinite(t.getTime()))return '未確認';const p=jstParts(t);return (p.year!==thisYear?p.year+'/':'')+p.month+'/'+p.day+' '+p.hour+':'+p.minute;};
 const selectedTime=day+'T'+String(hourIndex>>1).padStart(2,'0')+':'+(hourIndex%2?'30':'00')+':00';
 // 2026-11-09：最新の観測で決める。「更新が止まっています」は利用者が最新を見ているとき（followLatest）だけ。連系線は推定の線を除いて120分
 const report=(label:string,days:OcctoSnapshot[],failed:boolean,tie=false)=>{const d=days.find(d=>d.date===day);const i=d?.actual.times.indexOf(selectedTime)??-1;const missing=!d||i<0||!d.actual.lines.some(l=>Number.isFinite(l.values[i]));const {message,kind}=observedMessage(days,failed,Date.now(),followLatest,tie);return {text:label+'：'+message+'（取得 '+jst(days[0]?.retrievedAt)+'）'+(missing?'／選択時刻は欠測・未取得':''),kind,missing};};
 const messages:{text:string;kind:string;missing:boolean}[]=[];if(region==='national'||region==='tohoku')messages.push(report('東北',tohokuDays,refreshFailed));if((region==='national'||region==='hokkaido')&&hokkaidoGeography)messages.push(report('北海道',hokkaidoDays,hokkaidoFailed));
 if((region==='national'||region==='tokyo')&&tokyoGeography)messages.push(report('東京',tokyoDays,tokyoFailed));
 if((region==='national'||region==='chubu')&&chubuGeography)messages.push(report('中部',chubuDays,chubuFailed));
 if((region==='national'||region==='hokuriku')&&hokurikuGeography)messages.push(report('北陸',hokurikuDays,hokurikuFailed));
 if((region==='national'||region==='kansai')&&kansaiGeography)messages.push(report('関西',kansaiDays,kansaiFailed));
 if((region==='national'||region==='chugoku')&&chugokuGeography)messages.push(report('中国',chugokuDays,chugokuFailed));
 if((region==='national'||region==='shikoku')&&shikokuGeography)messages.push(report('四国',shikokuDays,shikokuFailed));
 if((region==='national'||region==='kyushu')&&kyushuGeography)messages.push(report('九州',kyushuDays,kyushuFailed));
 // 連系線（OCCTO 連系線潮流実績、scripts/update-ties.mjs）
 if(tieDays.length&&occtoDays.some(d=>d.actual.lines.some(l=>l.id.startsWith('tie-'))))messages.push(report('連系線',tieDays,tieFailed,true));
 // 2026-11-03：出典・表示中の実績時刻・地域ごとの更新状況を行に分ける。値は textContent で入れる
 const shown=selectedTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
 const footer=$('#real-footer'),row=(text:string,cls:string)=>{const el=document.createElement('div');el.className=cls;el.textContent=text;return el;};
 footer.replaceChildren(row('出典：OCCTO系統情報サービス（本アプリで加工）','footer-source'),row('区間の照合・参考使用率は本アプリで算出','footer-sub'),row('表示中の実績：'+(shown?+shown[1]+'/'+(+shown[2])+'/'+(+shown[3])+' '+(+shown[4])+':'+shown[5]:selectedTime)+' JST','footer-time'),...(messages.length?[statusDetails(messages,row)]:[]));
}
setInterval(()=>{renderFreshness();},60*1000);
setInterval(()=>void refreshOccto(),5*60*1000);
// 30分ずつ戻る・進む（2026-10-04）。日をまたぐときは前日・翌日の収録分へ。最新より先と最古より前には進まない
function stepTime(delta:number){
 const dates=availableDates();let i=hourIndex+delta,date=day;
 if(i<0){const k=dates.indexOf(day)+1;if(k<=0||k>=dates.length)return;date=dates[k];i=47;}
 if(i>47){const k=dates.indexOf(day)-1;if(k<0)return;date=dates[k];i=0;}
 const snap=occtoDays.find(d=>d.date===date);if(snap&&date===dates[0]&&i>latestIndex(snap))return;
 followLatest=false;hourIndex=i;if(date!==day)selectFlowDate(date);else renderFlow();
}
$('#time-prev').onclick=()=>stepTime(-1);$('#time-next').onclick=()=>stepTime(1);
$('#actual-hour').oninput = e => { followLatest=false;hourIndex = Number((e.target as HTMLInputElement).value); renderFlow(); };
document.querySelectorAll<HTMLButtonElement>('[data-base]').forEach(b => b.onclick = () => changeBase(b.dataset.base!));
$('#real-zoom-in').onclick = () => map.zoomIn(); $('#real-zoom-out').onclick = () => map.zoomOut(); $('#real-fit').onclick = fitAll;
$('#show-flow-visual').onclick = () => {
 const available = official?.actual.lines.filter(l => l.values[timeIndex()] != null) ?? [];
 const record = available.find(l => l.name === '仙台幹線') ?? available[0];
 if (!record) { $('#real-map-status').textContent='この時刻の潮流実績が読み込まれていません。実績日を変更してください。'; $('#real-map-status').hidden=false; return; }
 $('#real-map-status').hidden=true;
 mode='actual'; $<HTMLSelectElement>('#data-mode').value=mode; query=''; $<HTMLInputElement>('#real-search').value='';
 closeMobileLayers();
 select(record.id); $('#detail').scrollTop=0;
};
$('#mobile-flow-toggle').onclick=()=>{if($('#app').classList.contains('mobile-flow-open')){closeMobileFlow();return;}$('#app').classList.add('mobile-flow-open');$('#mobile-flow-toggle').setAttribute('aria-expanded','true');$('#mobile-flow-toggle').textContent='× 潮流を閉じる';};
function closeMobileFlow(){const a=document.activeElement;if(a instanceof HTMLElement&&a.closest('#map-flow-key,#real-time'))a.blur();$('#app').classList.remove('mobile-flow-open');$('#mobile-flow-toggle').setAttribute('aria-expanded','false');$('#mobile-flow-toggle').textContent='潮流';}
// 携帯の左（選択）と右（⌕ 設備を探す）は、片方を開くともう片方を閉じる（2026-11-03）
function closeMobileLayers(){$('#mobile-layers').hidden=true;$('#mobile-layers-toggle').setAttribute('aria-expanded','false');}
function closeMobileBrowse(){$('.sidebar').classList.remove('mobile-open');$('#real-browse').textContent='⌕ 設備を探す';}
$('#mobile-layers-toggle').onclick = () => { const panel=$('#mobile-layers'); panel.hidden=!panel.hidden; $('#mobile-layers-toggle').setAttribute('aria-expanded', String(!panel.hidden)); if(!panel.hidden)closeMobileBrowse(); };
$('#real-browse').onclick = () => { const open = $('.sidebar').classList.toggle('mobile-open'); $('#real-browse').textContent = open ? '× 地図に戻る' : '⌕ 設備を探す'; if(open)closeMobileLayers(); };
// 外側のタップで閉じる（2026-11-22。潮流も閉じる。線・設備のタップ、「選択」「設備を探す」・ⓘ でも閉じ、地図の操作ボタン（拡大縮小・全域・背景地図の切替）では閉じない。src/mobile-panels.ts）
bindOutsideTapClose([{isOpen:()=>$('#app').classList.contains('mobile-flow-open'),inside:'#map-flow-key,#real-time,#mobile-flow-toggle,.map-controls,.basemaps',close:closeMobileFlow},{isOpen:()=>!$('#mobile-layers').hidden,inside:'#mobile-layers,#mobile-layers-toggle',close:closeMobileLayers},{isOpen:()=>$('.sidebar').classList.contains('mobile-open'),inside:'.sidebar,#real-browse',close:closeMobileBrowse}],()=>matchMedia('(max-width:760px)').matches);
$('#change-plans-close').onclick=()=>closePlans();
// Esc は表の中にフォーカスがあるときだけ閉じる（詳細パネル・検索の Esc と重ねない）
$('#change-plans-panel').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closePlans();}});
$('#real-about').onclick = () => { $<HTMLDialogElement>('#real-info').showModal(); };
$('#real-info-close').onclick = () => $<HTMLDialogElement>('#real-info').close();
bindLegal();
new ResizeObserver(() => map.invalidateSize()).observe($('#map'));
void load().then(async()=>{baseGeography=geography;tohokuDays=occtoDays;await loadPilot();await loadHokkaido();await loadTokyo();await loadChubu();await loadHokuriku();await loadKansai();await loadChugoku();await loadShikoku();await loadKyushu();for(const g of [baseGeography,hokkaidoGeography,tokyoGeography,chubuGeography,hokurikuGeography,kansaiGeography,chugokuGeography,shikokuGeography,kyushuGeography])if(g){applyStatus(g.lines);applyStatus(g.facilities);annotateEvidence(g.lines);}applyStatus(dcScopeLines);annotateEvidence(dcScopeLines);shareLowerData();booting=false;syncRegion();fitAll();
 // 計測用の目印（2026-10-10 表示速度の改善）：地図の描画まで＝grid:map-ready、潮流まで描き終えた起動完了＝grid:ready
 performance.mark('grid:map-ready');void refreshOccto().then(()=>performance.mark('grid:ready'));}).catch(error => { booting=false; mapLoadFailed=true; if(!$('#change-plans-panel').hidden)renderPlans(); $('#dataset-summary').textContent = `読込エラー：${error instanceof Error ? error.message : '不明'}`; });




