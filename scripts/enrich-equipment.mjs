import {readFile,writeFile} from 'node:fs/promises';
const fields={'official_name':'登録正式名称','alt_name':'別名','name:en':'英語名','operator':'運営者','owner':'所有者','ref':'登録番号','circuits':'回線数（区間登録値）','cables':'導体数（区間登録値）','frequency':'周波数（Hz）','location':'敷設場所','plant:output:electricity':'発電設備出力（登録値）','generator:output:electricity':'発電機出力（登録値）','plant:source':'発電方式','start_date':'運用開始（登録値）','end_date':'運用終了（登録値）','disused':'使用終了タグ'};
for(const [raw,out] of [['osm-trunk-expanded.json','tohoku-trunk-osm.json'],['osm-dc.json','tohoku-dc-osm.json']]){
 const data=JSON.parse(await readFile('data/raw/'+raw)),geo=JSON.parse(await readFile('public/data/'+out));
 const elements=new Map(data.elements.map(e=>[`${e.type}-${e.id}`,e]));
 const attrs=ids=>Object.entries(fields).flatMap(([key,label])=>{const values=[...new Set(ids.map(id=>elements.get(id)?.tags?.[key]).filter(v=>v&&v!=='yes'||key==='disused'&&v==='yes'))];return values.length?[{label,value:values.join(' / ')}]:[];});
 for(const f of geo.facilities)f.attributes=attrs([f.id.replace(/^osm-/,'')]);
 for(const l of geo.lines)l.attributes=attrs(l.osmIds.map(id=>'way-'+id));
 await writeFile('public/data/'+out,JSON.stringify(geo));
 console.log(out,geo.facilities.filter(f=>f.attributes.length).length,'facilities enriched');
}
