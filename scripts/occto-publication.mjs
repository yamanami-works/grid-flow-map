import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {validateFlowDays} from './validate-flow.mjs';
import {writeFlowSplit} from './flow-split.mjs';
export async function refreshBatch(dates,fetchDay,publish){
 for(const date of dates)await fetchDay(date);
 await publish();
}
// 日ごとに取得し、mustSucceed(日付) が偽の日の失敗は飛ばして続ける（その日は前回分を残す。前回分がなければ欠測のまま。0 や仮の値で埋めない）。
// 戻り値：飛ばした日と理由。2026-10-31 公開残件3-A（東北も他の地域と同じく、古い日の一時的な失敗で全体の公開を止めない）
export async function refreshDays(dates,fetchDay,publish,mustSucceed){
 const skipped=[];
 for(const date of dates){try{await fetchDay(date);}catch(e){if(mustSucceed(date))throw e;skipped.push({date,message:String(e.message).split('\n')[0].slice(0,200)});console.error('refetch failed',date,e.message);}}
 await publish();
 return skipped;
}
export function windowDates(end){
 const date=new Date(end+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==end)throw Error('Invalid date');
 return Array.from({length:30},(_,i)=>new Date(date.getTime()-i*86400000).toISOString().slice(0,10));
}
// 東北の更新（update-occto.mjs）では使わない（2026-11-01 オーナー指示で refreshTargets に替えた。保留48）
export function recoveryDates(end,days){
 return windowDates(end).filter((date,i)=>i<2||!days.some(d=>d.date===date&&d.actual?.lines?.some(l=>l.values?.some(Number.isFinite))));
}
// OCCTOは過去の実績値を後から修正するため、直近30日を順に取り直す（2026-10-03 オーナー指示）。
// 毎回の更新（30分ごと）で、今日・前日に加えて「取得が最も古い日」をREFETCH_PER_RUN日ずつ取り直す。2日ずつなら30日をおよそ7〜8時間で一巡する。
export const REFETCH_PER_RUN=2;
export function refetchDates(end,days,k=REFETCH_PER_RUN){
 const window=windowDates(end).slice(2),at=date=>days.find(d=>d.date===date)?.retrievedAt??'';
 return [...window].sort((a,b)=>at(a).localeCompare(at(b))||b.localeCompare(a)).slice(0,k);
}
// 1回の更新で取る日：今日・前日と、直近30日のうち取得が最も古い2日（手元にない日が先）。全地域・連系線で同じ（2026-11-01 保留48）
export function refreshTargets(end,days){
 return [...new Set([...windowDates(end).slice(0,2),...refetchDates(end,days)])];
}
// 運用容量がOCCTO側で未公表（YA000010SW）の応答で取り直したとき、その日に前に取れた運用容量を残す。残した値の取得時刻は capacityRetrievedAt（2026-10-25 オーナー承認 保留23・27）
export function keepCapacities(snap,prev){
 if(!snap.capacities.length&&prev?.capacities?.length){snap.capacities=prev.capacities;snap.capacityRetrievedAt=prev.capacityRetrievedAt??prev.retrievedAt;}
 return snap;
}
export function checkRegression(previous,days){
 validateFlowDays(days);
 for(const old of previous?.days??[]){
  const next=days.find(d=>d.date===old.date);if(!next)continue;
  for(const line of old.actual.lines){
   const match=next.actual.lines.find(l=>l.id===line.id);
   if(!match||line.values.some((v,i)=>Number.isFinite(v)&&!Number.isFinite(match.values[i])))throw Error('Observation regression: '+old.date+' '+line.id);
  }
 }
}
export async function publishFile(file,days){
 let previous=null;
 try{previous=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 checkRegression(previous,days);
 await mkdir(dirname(file),{recursive:true});
 const text=JSON.stringify({schemaVersion:2,days,updatedAt:new Date().toISOString()});
 if(previous){await writeFile(file+'.previous.tmp',JSON.stringify(previous));await rename(file+'.previous.tmp',file+'.previous');}
 await writeFile(file+'.tmp',text);await rename(file+'.tmp',file);
 // 画面用の分割（最新日・日付とハッシュの一覧・1日分ずつ。scripts/flow-split.mjs、2026-10-10）
 writeFlowSplit(file);
}
