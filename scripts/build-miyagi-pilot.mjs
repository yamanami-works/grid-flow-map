// Deliberately separate from data:prepare and the public catalog.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCsv,clean,numberOrNull} from './csv.mjs';
import {inFacility} from './facility-geometry.mjs';
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const survey=await readJson('docs/research/miyagi-lower-survey.json');
const raw=new Map();
const osmSources=[];
for(const s of survey.sources){
 const bytes=await readFile(s.path);
 if(createHash('sha256').update(bytes).digest('hex')!==s.sha256)throw Error('Source version changed; re-review mapping: '+s.path);
 raw.set(s.path,bytes);
 if(s.path.includes('/osm-')){const meta=await readJson(s.path+'.source.json');if(meta.sha256!==s.sha256)throw Error('OSM provenance mismatch');osmSources.push({sha256:meta.sha256,url:meta.url,retrievedAt:meta.retrievedAt,license:meta.license,attribution:'© OpenStreetMap contributors',osmTimestamp:JSON.parse(bytes).osm3s?.timestamp_osm_base});}
}
const ways=new Map();
for(const name of ['osm-tohoku','osm-trunk-expanded'])for(const e of JSON.parse(raw.get('data/raw/'+name+'.json')).elements)if(e.type==='way')ways.set(e.id,e);
const assets=(await readJson('data/catalog/assets.json')).assets;
// 取得記録：送電線の表は公開の容量表、変圧器の表は Git 管理外の sources-tr.json（2026-11-02 保留49）
const capacities=await readJson('data/private/network-capacity.json');
capacities.sources=[...capacities.sources,...(await readJson('data/raw/network-capacity/sources-tr.json')).sources];
const facilities=[316796028,104024082,610437485,325433636,104055891,104055902].map(osmWay=>{
 const way=ways.get(osmWay),asset=assets.find(a=>a.bindings.some(b=>b.source==='osm'&&b.externalId==='osm-way-'+osmWay));
 if(!way||!asset)throw Error('Missing existing facility '+osmWay);
 const ring=way.geometry.slice(0,-1);
 return {id:asset.id,name:asset.name,osmWay,position:[ring.reduce((s,p)=>s+p.lat,0)/ring.length,ring.reduce((s,p)=>s+p.lon,0)/ring.length],voltageKV:asset.voltageKV};
});
function observation(file,code,secondary){
 const path='data/raw/network-capacity/sys_capa_'+file+'_202607_02.csv';
 const rows=parseCsv(new TextDecoder('shift_jis').decode(raw.get(path)));
 const matches=rows.slice(2).filter(r=>clean(r[0])===code&&(secondary===undefined||numberOrNull(r[3])===secondary));
 if(matches.length!==1)throw Error('Ambiguous bank/line '+code);
 const row=matches[0],bank=secondary!==undefined,source=capacities.sources.find(s=>s.sha256===survey.sources.find(s=>s.path===path).sha256);
 if(!source)throw Error('Missing retrieval provenance');
 const value=i=>({raw:clean(row[i]),mw:numberOrNull(row[i])});
 return {officialId:code,name:clean(row[1]),primaryKV:numberOrNull(row[2]),...(bank?{secondaryKV:secondary,bankCount:numberOrNull(row[4])}:{circuitCount:numberOrNull(row[3])}),equipmentMW:numberOrNull(row[bank?5:4]),operatingMW:numberOrNull(row[bank?6:5]),available:value(9),upstream:value(10),source:{...source,title:'東北電力ネットワーク '+(file.startsWith('kikan')?'基幹系統':'宮城ローカル系統')+(bank?' 変圧器空容量表':' 送電線空容量表'),target:clean(row[1])+'（公表番号 '+code+'）'+(bank?' '+numberOrNull(row[2])+'/'+secondary+'kV バンク行':' '+numberOrNull(row[2])+'kV 線路'),published:clean(rows[0][0])},matchStatus:'公表区間・名称照合済み／個別回線・母線結線未確認'};
}
function route(ids,start,end,kv){
 const adj=new Map(),coords=new Map();
 for(const id of ids){const w=ways.get(id);if(!w||!w.tags.voltage.split(';').includes(String(kv*1000)))throw Error('Way voltage mismatch');
  w.nodes.forEach((n,i)=>{coords.set(n,[w.geometry[i].lat,w.geometry[i].lon]);if(!adj.has(n))adj.set(n,[]);if(i){adj.get(n).push(w.nodes[i-1]);adj.get(w.nodes[i-1]).push(n);}});
 }
 const queue=[start],seen=new Map([[start,null]]);
 for(let i=0;i<queue.length;i++)for(const next of adj.get(queue[i])??[])if(!seen.has(next)){seen.set(next,queue[i]);queue.push(next);}
 if(!seen.has(end))throw Error('Unconnected audited route');
 const nodes=[];for(let n=end;n!==null;n=seen.get(n))nodes.unshift(n);
 return {wayIds:ids,nodeIds:nodes,points:nodes.map(n=>coords.get(n)),status:'OSM参照経路（共有ノード・設備範囲への到達確認）。回線別の実結線は未確認'};
}
const specs=[
 ['ishinomaki-kanan','河南線',154,'kikan01_line','0564',0,1,[798835129,208006480,325435456],3320942663,3320942561],
 ['ishinomaki-yamashita','山下線',66,'local04_line','4C3A',1,2,[798835066,610437484,798835098],3320925064,7471058396],
 ['ishinomaki-hebita','蛇田支線',66,'local04_line','4C3B',null,3,[610557892],5781140331,5781997553],
];
specs.push(['sendai-nishitaga','西多賀線',66,'local04_line','454A',4,5,[104055865,104055936,106717236,1035563523,1035563526],1227499460,9540150818]);
const lines=specs.map(([key,name,voltageKV,file,code,from,to,ids,start,end])=>{
 const geometry=route(ids,start,end,voltageKV);
 if(key==='sendai-nishitaga')geometry.status='OSM参照経路（共有ノード・両設備範囲への到達確認、八木山線との共架区間を含む）。2回線それぞれ・母線の実結線は未確認';
 if(!inFacility(geometry.points.at(-1),ways.get(facilities[to].osmWay))||from!==null&&!inFacility(geometry.points[0],ways.get(facilities[from].osmWay)))throw Error('Facility reach changed');
 return {id:'pilot-line-'+key,name,currentType:'ac',voltageKV,from:from===null?'pilot-junction-yamashita':facilities[from].id,to:facilities[to].id,publicSection:(from===null?'山下線分岐':facilities[from].name)+' → '+facilities[to].name,geometry,capacity:observation(file,code)};
});
const branchIndex=lines[1].geometry.nodeIds.indexOf(5781140331);
if(branchIndex<0)throw Error('Branch shared node absent');
const banks=[['011','kikan01_tr',154],['406','local04_tr',66],['4C12','local04_tr',6.6],['4C13','local04_tr',6.6],['410','local04_tr',66],['4505','local04_tr',6.6]].map(([code,file,secondary],i)=>({id:'pilot-bank-'+['ishinomaki-275-154','nishiishinomaki-154-66','rikuzennyamashita-66-6','hebita-66-6','minamisendai-154-66','nishitaga-66-6'][i],facilityId:facilities[i].id,...observation(file,code,secondary),scope:'原表の該当電圧バンク行。施設全体ではない。個別バンクごとの内訳・母線結線は未確認'}));
facilities[4].upperReference={lineName:'愛島郡山線',officialId:'0722',voltageKV:154,publicSection:'名取変電所 → 南仙台変電所',source:observation('kikan01_line','0722').source,status:'上位154kVの地理経路は未確認・未収録。南仙台154/66kVバンクの公表行により変圧関係を表示。電気的に孤立した設備を意味しません。個別回線・母線結線は未確認。'};
const data={datasetId:'miyagi-lower-approved',revision:'2026-09-26-metadata-1',display:{rangeLabel:'154/66kV · 宮城検証',region:'宮城',coverageNote:'全県未収録',summary:'公表区間とOSM参照経路を照合。個別回線・母線の実結線は未確認。一致する公表実績がないため潮流アニメーションは表示しません。',voltages:[154,66],facilityKinds:['substation'],capabilities:{capacityOverlay:true,flow:false},bounds:'geometry',connectionLegend:'⇅ 石巻275/154kV・南仙台154/66kV接続 · OSM参照経路'},schemaVersion:1,scope:'宮城・石巻／南仙台・西多賀の検証範囲',rights:'pending',baseline:'backups/ishinomaki-accepted-2026-09-25T12-19-25Z',reviewedAt:survey.checkedAt,facilities,lines,banks,junction:{id:'pilot-junction-yamashita',name:'山下線・蛇田支線 分岐',osmNode:5781140331,position:lines[1].geometry.points[branchIndex],status:'公表分岐関係＋OSM共有ノード。個別回線結線未確認'},upper:{facilityId:facilities[0].id,line:'鳴瀬幹線',voltageKV:275,publicSection:'宮城変電所 → 石巻変電所',officialId:'0122'},sourceMaps:survey.additionalSources.filter(s=>s.local.endsWith('-map.pdf')).map(({local,...s})=>({...s,title:local==='tmp/miyagi-research/miyagi-map.pdf'?'宮城66kV系統図':local==='tmp/miyagi-research/kikan-map.pdf'?'基幹154kV以上系統図':(()=>{throw Error('Unreviewed map source title: '+local)})(),target:'宮城県の接続照合',published:'2026年8月28日作成'})),osmSources:survey.sources.filter(s=>s.path.includes('/osm-')),note:'限定検証。公表容量は接続可否を判定する値ではありません。資料版は最新性未確認。資料更新時は区間・バンク構成を再照合し、対応を自動継承しません。'};
data.osmSources=osmSources;
await mkdir('data/validation',{recursive:true});
await writeFile('data/validation/miyagi-ishinomaki.json',JSON.stringify(data,null,2)+'\n');
console.log('Validation only: 4 lines, 6 existing facilities, 6 bank observations; public catalog unchanged.');
