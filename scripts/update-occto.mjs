import {readdir,readFile,rename,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {windowDates,refreshTargets,checkRegression,publishFile,refreshDays,keepCapacities} from './occto-publication.mjs';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
async function history(end){
 const allowed=new Set(windowDates(end));
 const files=(await readdir('public/data/occto')).filter(f=>allowed.has(f.replace(/\.json$/,''))).sort().reverse();
 return Promise.all(files.map(f=>readFile('public/data/occto/'+f,'utf8').then(JSON.parse)));
}
async function publish(){
 const days=await history(today());
 await publishFile('public/data/occto-tohoku.json',days);
 console.log('Published',days.length,'days',today());
}
async function refresh(){
 const end=today(),existing=await history(end);
 // 今日・前日と、直近30日のうち取得が最も古い2日（手元にない日が先）を取る。ほかの地域・連系線と同じ（2026-11-01 オーナー指示、保留48）
 // 今日と前日の失敗は失敗にし（他の地域と同じ。前日は値が出そろう最初の日）、ほかの日の失敗は飛ばす（2026-10-31 公開残件3-A、保留40 オーナー承認）。飛ばした日は状態（tmp/occto-status.json の skipped）に残す
 return refreshDays(refreshTargets(end,existing).reverse(),async date=>{
  // 運用容量がOCCTO側で未公表（YA000010SW）の日は実績だけ使う。その日に前に取れた運用容量は残す（2026-10-30 オーナー承認 保留33）
  execFileSync(process.execPath,['scripts/fetch-occto.mjs',date,'--allow-empty-capacity'],{stdio:'inherit',windowsHide:true,timeout:180000});
  const file=`public/data/occto/${date}.json`,prev=existing.find(d=>d.date===date);
  // 線の ID は運用容量の行から決めるので、容量が空でも ID が変わらないよう、その日（なければ直近の日）の容量の入ったファイルを渡す
  // 窓の中のどの日も容量が空なら渡すファイルがなく ID が occto-i になるが、そのときは checkRegression で止まる（想定どおり）
  const idDay=prev?.capacities?.length?prev:existing.find(d=>d.capacities?.length);
  execFileSync(process.execPath,['scripts/import-occto.mjs',date,file+'.tmp',...(idDay?[`public/data/occto/${idDay.date}.json`]:[])],{stdio:'inherit',windowsHide:true});
  const next=keepCapacities(JSON.parse(await readFile(file+'.tmp','utf8')),prev);
  checkRegression({days:existing},[next]);await writeFile(file+'.tmp',JSON.stringify(next));await rename(file+'.tmp',file);
 },publish,date=>windowDates(end).slice(0,2).includes(date));
}
async function run(){
 await mkdir('tmp',{recursive:true});
 const lock='tmp/occto-update.lock';
 let handle;
 try {handle=await open(lock,'wx');}
 catch(e){
  if(e.code!=='EEXIST')throw e;
  const pid=Number(await readFile(lock,'utf8'));
  if(!pid)return; // another process is still writing its lock
  try{process.kill(pid,0);return;}catch(error){if(error.code!=='ESRCH')return;}
  await unlink(lock);return run();
 }
 await handle.writeFile(String(process.pid));await handle.close();
 let previous={};
 try{previous=JSON.parse(await readFile('tmp/occto-status.json','utf8'));}catch{}
 const state={state:'checking',lastAttemptAt:new Date().toISOString(),lastSuccessAt:previous.lastSuccessAt??null};
 const save=async()=>{await writeFile('tmp/occto-status.json.tmp',JSON.stringify(state));await rename('tmp/occto-status.json.tmp','tmp/occto-status.json');};
 try{
  await save();const skipped=await refresh();
  state.state='success';state.skipped=skipped;state.lastSuccessAt=new Date().toISOString();
  state.publishedAt=JSON.parse(await readFile('public/data/occto-tohoku.json','utf8')).updatedAt;await save();
 }catch(error){state.state='failed';await save();throw error;}
 finally{await unlink(lock);}
}
if(process.argv.includes('--publish'))await publish(); // repackaging is NOT a source check
else {await run().catch(e=>{if(!process.argv.includes('--watch'))throw e;console.error('Refresh failed; previous data retained:',e.message)});if(process.argv.includes('--watch'))setInterval(()=>run().catch(e=>console.error('Refresh failed; previous data retained:',e.message)),30*60*1000);}
