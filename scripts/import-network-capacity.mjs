import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCapacityCsv,parseCsv,clean,numberOrNull} from './csv.mjs';
const url='https://nw.tohoku-epco.co.jp/consignment/system/announcement/';
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${r.status} ${url}`);return Buffer.from(await r.arrayBuffer());};
const html=(await get(url)).toString();
const links=[...new Set([...html.matchAll(/href=["']([^"']+\.csv)/g)].map(m=>new URL(m[1],url).href))];
await mkdir('data/raw/network-capacity',{recursive:true});
// 公開するのは送電線の行と送電線の表の取得記録だけ。変圧器の行・空容量の項目は公開しない。変圧器の表の取得記録は Git 管理外の
// data/raw/network-capacity/sources-tr.json に書く（build-miyagi-pilot.mjs が読む）（2026-11-02 保留49）
const lines=[],banks=[],sources=[],trSources=[];
for(const link of links){
 const type=link.includes('_tr_')?'substation':'line',bytes=await get(link),text=new TextDecoder('shift_jis',{fatal:true}).decode(bytes);
 const parsed=parseCapacityCsv(text,type),raw=parseCsv(text).slice(2).filter(r=>clean(r[0]));
 const source={url:link,published:parsed.published,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex')};(type==='line'?sources:trSources).push(source);
 await writeFile('data/raw/network-capacity/'+link.split('/').at(-1),bytes);
 parsed.records.forEach((record,i)=>{
  const kv=type==='line'?record.voltageKV:record.primaryKV;if(kv!==500&&kv!==275)return;
  const {forecastMW,...info}=record;
  const r=raw[i];(type==='line'?lines:banks).push({...info,n1:clean(r[11]),curtailment:clean(r[13]),sourceUrl:link});
 });
}
if(!lines.length||!banks.length)throw Error('Capacity tables missing');
const output=JSON.stringify({schemaVersion:1,sourceUrl:url,retrievedAt:new Date().toISOString(),sources,lines});
await writeFile('data/raw/network-capacity/sources-tr.json',JSON.stringify({note:'東北の変圧器の空容量表の取得記録（公開しない。scripts/import-network-capacity.mjs が書き、build-miyagi-pilot.mjs が読む）',sources:trSources},null,1)+'\n');
// 東北電力NW の空容量一覧（送電線）の構造化データは、各社の表と同じく携帯用ビルドだけ（data/private/、Git の管理外）に置く。
// 公開版には回線数だけを public/data/tohoku-circuits.json で出す（2026-11-09 保留95 ⑤-b オーナー承認）
await mkdir('data/private/history/network-capacity',{recursive:true});
await writeFile('data/private/history/network-capacity/'+createHash('sha256').update(output).digest('hex')+'.json',output);
await writeFile('data/private/network-capacity.json',output);
{const {circuitsFrom}=await import('./tohoku-circuits.mjs');await writeFile('public/data/tohoku-circuits.json',JSON.stringify(circuitsFrom(JSON.parse(output)),null,2)+'\n');}
console.log({sources:sources.length,lines:lines.length,banks:banks.length});
