import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {applyCurrentVoltage} from './current-voltage.mjs';
import {writeFlowSplit,SPLIT_FLOWS} from './flow-split.mjs';
await mkdir('data/catalog',{recursive:true});
// 潮流の分割ファイルをそろえる（scripts/flow-split.mjs、2026-10-10）。更新処理でも書くが、ビルド時に全部を作り直して窓の外の日を消す
for(const name of SPLIT_FLOWS)writeFlowSplit('public/data/'+name+'.json');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const registry=await read('data/catalog/assets.json').catch(error=>{if(error.code!=='ENOENT')throw error;return {schemaVersion:1,assets:[]};});
const activeIds=new Set();
for(const a of registry.assets){const keep=new Map();for(const b of a.bindings){const k=b.source+'|'+b.externalId+'|'+b.role;const o=keep.get(k);if(!o)keep.set(k,b);else if(b.validFrom&&(!o.validFrom||b.validFrom<o.validFrom))o.validFrom=b.validFrom;}a.bindings=[...keep.values()];}
// Underground/submarine segments (OSM power=cable) are drawn dotted; see data/catalog/cable-ways.json.
const cableWays=new Set((await read('data/catalog/cable-ways.json').catch(()=>({wayIds:[]}))).wayIds);
// Keep persisted UUIDs even if a label changes. Never merge by name or reuse deleted IDs.
const byGeometry=new Map(registry.assets.flatMap(a=>a.bindings.filter(b=>b.role==='geometry').map(b=>[b.externalId,a])));
// 東北の交流は2026-10-04に他の地域と同じ1区間＝1本のデータ（scripts/build-tohoku.mjs → tohoku-trunk.json、承認ファイルで照合）へ移した。
// 旧データ tohoku-trunk-osm.json は永続ID・線形の引き継ぎ元として凍結し、配信しない。台帳での照合は直流だけ。
for(const file of ['tohoku-dc-osm.json']){
 const g=await read('public/data/'+file);
 for(const item of [...g.lines,...g.facilities]){
  const reviewedVoltage=item.paths && applyCurrentVoltage(item);
  let asset=byGeometry.get(item.id);
  if(!asset){asset={id:'asset-'+randomUUID(),kind:item.paths?'line':item.kind,name:item.name,aliases:[],parentId:null,region:'tohoku',voltageKV:item.paths?[item.voltageKV]:item.voltages,status:'candidate',bindings:[{source:'osm',externalId:item.id,role:'geometry',status:'candidate',evidence:'既存地理登録単位を移行。電気的な設備・回線との同定は未完了。',validFrom:null,validTo:null}]};registry.assets.push(asset);byGeometry.set(item.id,asset);}
  if(asset.name!==item.name){asset.aliases=[...new Set([...asset.aliases,asset.name])];asset.name=item.name;}
  item.assetId=asset.id;
  if(reviewedVoltage)asset.voltageKV=[item.voltageKV];
  activeIds.add(asset.id);
 }
 for(const l of g.lines){const c=[...new Set(l.osmIds.filter(id=>cableWays.has(id)))];if(c.length)l.cableOsmIds=c;else delete l.cableOsmIds;}
 await writeFile('public/data/'+file,JSON.stringify(g));
}

const norm=s=>s.normalize('NFKC').replace(/\s/g,'');
const review=[];
function bind(source,record,role,validFrom=null){
 let candidates=registry.assets.filter(a=>activeIds.has(a.id)&&a.kind==='line'&&a.voltageKV.includes(record.voltageKV)&&norm(a.name)===norm(record.name));
 // A reviewed public-section line wins over leftover same-name OSM lead-ins (2026-10-01 Tohoku review).
 const sections=candidates.filter(a=>a.bindings.some(b=>b.source==='osm'&&/^tohoku-section-/.test(b.externalId)));if(candidates.length>1&&sections.length===1)candidates=sections;
 if(candidates.length!==1){review.push({source,externalId:record.id,name:record.name,status:candidates.length?'ambiguous':'unmatched'});return;}
 const a=candidates[0];
 // One binding per source record and asset; validFrom keeps the first date it was seen (a per-day copy grew the registry ~35 entries a day).
 // If a source ID later matches a different asset (a changed section definition), that asset gets its own binding.
 const same=a.bindings.find(b=>b.source===source&&b.externalId===record.id);
 if(!same)a.bindings.push({source,externalId:record.id,role,status:'candidate',evidence:'名称・電圧の一意一致。区間・方向の電気的同定は未完了。',validFrom,validTo:null});
 else if(validFrom&&(!same.validFrom||validFrom<same.validFrom))same.validFrom=validFrom;
}
// 東北電力NW の空容量一覧（送電線）は携帯用ビルドだけ（data/private/、2026-11-09 保留95 ⑤-b）。公開リポジトリの Actions（目印あり）でファイルがないときだけ結び付けを飛ばす（既存の結び付けは assets.json に残る）。手元でないときは失敗
{const inPublicCheckout=process.env.GRID_PUBLIC_CHECKOUT==='1'&&process.env.GITHUB_ACTIONS==='true';
 let network=null;try{network=await read('data/private/network-capacity.json');}catch(e){if(!(e.code==='ENOENT'&&inPublicCheckout))throw e;}
 network?.lines.forEach(r=>bind('tohoku-network',r,'equipment'));}
const flow=await read('public/data/occto-tohoku.json');
for(const d of flow.days??[flow])d.actual.lines.forEach(r=>bind('occto',r,'measurement',d.date));
const plants=await read('public/data/plant-profiles.json');
for(const p of plants.records){const a=byGeometry.get(p.id);if(a&&!a.bindings.some(b=>b.source==='plant-operators'&&b.externalId===p.id))a.bindings.push({source:'plant-operators',externalId:p.id,role:'equipment',status:'candidate',evidence:'一次資料プロフィールとの地理ID対応。根拠はplant-profiles.json。',validFrom:null,validTo:null});}
await writeFile('data/catalog/mapping-review.json',JSON.stringify({schemaVersion:1,records:review},null,2));

await writeFile('data/catalog/assets.json',JSON.stringify(registry,null,2));
await writeFile('public/data/asset-registry.json',JSON.stringify({...registry,assets:registry.assets.filter(a=>activeIds.has(a.id))}));
const definitions=[
 ['tohoku-trunk','geometry','trunk-map','tohoku-trunk.json',['osm']],
 ['tohoku-dc','geometry','trunk-map','tohoku-dc-osm.json',['osm']],
 ['tohoku-flow','flow','flow','occto-tohoku.json',['occto']],
 // 東北電力NW の空容量一覧（送電線）：各社の表と同じく携帯用ビルドだけ（2026-11-09 保留95 ⑤-b）。公開版は回線数だけの tohoku-circuits
 ['tohoku-capacity','capacity','capacity-detail','network-capacity.json',['tohoku-network'],'tohoku','private-preview'],
 ['tohoku-circuits','capacity','capacity-detail','tohoku-circuits.json',['tohoku-network'],'tohoku'],
 ['tohoku-plants','equipment','capacity-detail','plant-profiles.json',['plant-operators']],
 ['asset-registry','identity','trunk-map','asset-registry.json',['osm']],
 // 各社の公表変圧器（一次・二次電圧）。scripts/build-substation-voltages.mjs で生成
 // 各社の変圧器一覧の構造化データ：各社の許諾を確認するまで自分用プレビューだけに配布（distribution:'private-preview'、公開・iOSビルドに含めない。2026-10-03）
 ['substation-voltages','equipment','capacity-detail','substation-voltages.json',['tso-capacity'],'national','private-preview'],
 // 東北以外の8地域と連系線（2026-10-03 オーナー判断：全10地域を同じ扱いで公開・iOSビルドに含める）。各 builder・update が public/data に書く
 ['hokkaido-trunk','geometry','trunk-map','hokkaido-hokuto.json',['osm'],'hokkaido'],
 ...['tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu'].map(r=>[r+'-trunk','geometry','trunk-map',r+'-trunk.json',['osm'],r]),
 ...['hokkaido','tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu'].map(r=>[r+'-flow','flow','flow',r+'-flow.json',['occto'],r]),
 ['tie-flow','flow','flow','tie-flow.json',['occto'],'national'],
 // 画面が起動時に読む最新日だけのファイル（日付・ハッシュの一覧付き）。過去日は <名前>-days/<日付>.json?v=<ハッシュ>（2026-10-10 潮流の分割読み込み）
 ['tohoku-flow-latest','flow','flow','occto-tohoku-latest.json',['occto']],
 ...['hokkaido','tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu'].map(r=>[r+'-flow-latest','flow','flow',r+'-flow-latest.json',['occto'],r]),
 ['tie-flow-latest','flow','flow','tie-flow-latest.json',['occto'],'national'],
 // 未描画の公表区間の一覧（各社の系統空容量一覧の行と描けない理由、scripts/build-undrawn-sections.mjs、2026-10-04）
 ['undrawn-sections','reference','trunk-map','undrawn-sections.json',['tso-capacity'],'national'],
 // 送電線の設備容量・N-1電制・出力制御・回線数（各社の系統空容量一覧を構造化、tools/prep/build-line-capacity.mjs、2026-10-09）。変圧器一覧と同じく各社の許諾を確認するまで自分用プレビューだけ
 ['line-capacity','capacity','capacity-detail','line-capacity.json',['tso-capacity'],'national','private-preview'],
 // 発電所のユニット別の認可出力（JEPX 発電情報公開システム HJKS、tools/prep/build-plant-units.mjs、2026-10-09）。オーナー判断で公開版にも出所明示で掲載
 ['plant-units','equipment','capacity-detail','plant-units.json',['hjks'],'national'],
 // 原子力の号機の運転状態（原子力規制委員会、scripts/fetch-nra-status.mjs が1日1回取得。2026-11-10 保留110）。潮流と同じくハッシュを付けず毎回読む（version なし）
 ['nuclear-status','status','capacity-detail','nuclear-status.json',['nra'],'national'],
 // 原子力以外の号機の運転状態（HJKS 停止情報一覧、scripts/fetch-hjks-outages.mjs が1日1回取得。2026-11-24 保留149）。原子力と同じくハッシュを付けず毎回読む
 ['unit-outages','status','capacity-detail','unit-outages.json',['hjks'],'national'],
];
const datasets=[];
// version：潮流以外（地図・容量・設備）は中身のハッシュの先頭12桁。画面は ?v=<version> 付きで読み、ブラウザのキャッシュを使う（2026-10-10 表示速度の改善）。潮流は付けず毎回読む
// 携帯用だけのデータ（distribution:'private-preview'）は data/private/ にある（2026-10-11 オーナー承認：各社の表は許諾を確認するまで public/ の外の data/private/ に置き、build:private のときだけ携帯用ビルドへコピーする。docs/RULES.md 5節）
// 公開リポジトリの Actions（目印 GRID_PUBLIC_CHECKOUT=1 かつ GITHUB_ACTIONS=true）には自分用データ（data/private）がないので、そのときだけ、ファイルがない private-preview の項目をカタログに載せない（公開ビルドはもともと載せない。2026-11-01 保留44）。手元ではないと今までどおり失敗
const publicCheckout=process.env.GRID_PUBLIC_CHECKOUT==='1'&&process.env.GITHUB_ACTIONS==='true';
for(const [id,purpose,feature,file,sourceIds,region='tohoku',distribution] of definitions){let text;try{text=await readFile((distribution==='private-preview'?'data/private/':'public/data/')+file,'utf8');}catch(e){if(e.code==='ENOENT'&&publicCheckout&&distribution==='private-preview'){console.warn('自分用データがないのでカタログに載せない：'+id);continue;}throw e;}const d=JSON.parse(text);datasets.push({id,region,purpose,feature,access:'public',url:'./data/'+file,schemaVersion:d.schemaVersion,sourceIds,...(purpose!=='flow'&&purpose!=='status'?{version:createHash('sha256').update(text).digest('hex').slice(0,12)}:{}),...(distribution?{distribution}:{})});}
await writeFile('public/data/catalog.json',JSON.stringify({schemaVersion:1,datasets},null,2));
console.log('Foundation:',registry.assets.length,'persistent asset IDs;',datasets.length,'datasets');
