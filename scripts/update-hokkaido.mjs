import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {hokkaidoSnapshot} from './hokkaido-flow.mjs';
import {publishFile,windowDates,refetchDates,keepCapacities} from './occto-publication.mjs';
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
await mkdir('tmp',{recursive:true});await mkdir('data/validation',{recursive:true});
let previous={};try{previous=await read('tmp/hokkaido-status.json');}catch{}
const status={state:'checking',lastAttemptAt:new Date().toISOString(),lastSuccessAt:previous.lastSuccessAt??null,publishedAt:previous.publishedAt};
const save=async()=>{await writeFile('tmp/hokkaido-status.json.tmp',JSON.stringify(status));await rename('tmp/hokkaido-status.json.tmp','tmp/hokkaido-status.json');};
await save();
try{
 let old=[];try{old=(await read('public/data/hokkaido-flow.json')).days;}catch{}
 const days=new Map(old.filter(d=>windowDates(date).includes(d.date)).map(d=>[d.date,d]));
 // Recheck yesterday as well: late publication at midnight must not be frozen.
 // さらに直近30日のうち取得が最も古い日を取り直す（OCCTOの遡及修正。古い日の失敗は全体を止めない）
 const stale=refetchDates(date,[...days.values()]);
 for(const target of [...windowDates(date).slice(0,2),...stale]){try{
  const dir='data/raw/occto-hokkaido-'+target;
  execFileSync(process.execPath,['scripts/fetch-occto.mjs',target,'--area','01','--out',dir,'--allow-empty-capacity'],{stdio:'inherit',windowsHide:true,timeout:90000});
  const source=await read(dir+'/actual.json.source.json');
  // 運用容量がOCCTO側で未公表（YA000010SW）の日は実績だけ使う。その日に前に取れた運用容量は残す（2026-10-25 オーナー承認 保留27）
  days.set(target,keepCapacities(hokkaidoSnapshot(await read(dir+'/actual.json'),await read(dir+'/capacity.json'),target,source.retrievedAt),days.get(target)));
 }catch(e){if(!stale.includes(target))throw e;console.error('refetch failed',target,e.message);}}
 await publishFile('public/data/hokkaido-flow.json',[...days.values()].sort((a,b)=>b.date.localeCompare(a.date)));
 status.state='success';status.lastSuccessAt=new Date().toISOString();status.publishedAt=(await read('public/data/hokkaido-flow.json')).updatedAt;await save();
}catch(e){status.state='failed';await save();throw e;}
