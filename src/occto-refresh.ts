import {latestIndex} from './occto-time.ts';
type Day={date:string;actual:{times:string[];lines:{values:(number|null)[]}[]}};
export function validDays<T extends Day>(days:T[]):T[]{
 if(!Array.isArray(days)||days.some(d=>!d.actual?.lines?.length||d.actual.times.length!==48||d.actual.lines.some(l=>l.values.length!==48||l.values.some(v=>v!==null&&!Number.isFinite(v)))))throw Error('Invalid flow history');
 const result=days.filter(d=>d.actual.lines.some(l=>l.values.some(Number.isFinite))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
 if(!result.length)throw Error('No valid observations');
 return result;
}
export function followsLatest(days:Day[],date:string,index:number){return !days.length||date===days[0].date&&index===latestIndex(days[0]);}
// 2026-11-09：更新の状態は、読み込んだ最新日の観測で決める。状態ファイル（*-status.json）は公開物にないので読まない。
// 最新の観測コマ（日本時間。+09:00 を付けて解釈し、見る人の時刻帯に依存しない）と現在時刻の差が閾値を超えたら「更新が止まっています」。出すのは利用者が最新を見ているときだけ。閾値は docs/RULES.md 4節
export const STALE_MINUTES={region:90,tie:120};
type ObservedDay={date:string;actual:{times:string[];lines:{note?:string;values:(number|null)[]}[]}};
/** 値のある最新のコマ（"YYYY-MM-DDTHH:MM:SS"、日本時間）。published なら推定の線（note が「推定」で始まる線）を除く。合わせた日の commonLatest は使わない */
export function latestObserved(days:ObservedDay[],published=false):string|null{
 for(const d of [...days].sort((a,b)=>b.date.localeCompare(a.date))){
  const lines=d.actual.lines.filter(l=>!published||!/^推定/.test(l.note??''));
  for(let i=d.actual.times.length-1;i>=0;i--)if(lines.some(l=>l.values[i]!==null&&Number.isFinite(l.values[i])))return d.actual.times[i];
 }
 return null;
}
/** 優先順：配信データの取得の失敗 → 最新を見ていて閾値を超えた（または観測なし）→ 最新の観測。tie は連系線（推定の線を除き、閾値は120分） */
export function observedMessage(days:ObservedDay[],failed:boolean,now:number,following:boolean,tie=false):{message:string;kind:'fail'|'stale'|'ok'}{
 const m=latestObserved(days,tie)?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
 const shown=m?'最新の観測 '+(+m[2])+'/'+(+m[3])+' '+(+m[4])+':'+m[5]:'観測なし';
 if(failed)return {message:'配信データの取得に失敗。最後の正常データを表示（'+shown+'）',kind:'fail'};
 const age=m?now-Date.parse(m[0]+':00+09:00'):NaN;
 if(following&&!(age<=(tie?STALE_MINUTES.tie:STALE_MINUTES.region)*60e3))return {message:'更新が止まっています（'+shown+'）',kind:'stale'};
 return {message:shown,kind:'ok'};
}

// 潮流の分割読み込み（2026-10-10）：最新日のファイル（days＝最新日、index＝日付・ハッシュの一覧）を、読み込み済みの日に重ねる。
// 一覧から消えた日と、一覧のハッシュが読み込んだ時と変わった日（遡及修正）は読み込み済みから外す（次に表示する時に読み直す）
export type FlowIndexEntry={date:string;hash:string};
export function mergeLatest<T extends Day>(data:{days:T[];index:FlowIndexEntry[]},current:T[],loaded:Map<string,string>,review:(d:T)=>T){
 const index=data.index.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&/^[0-9a-f]{12}$/.test(e.hash)),hashes=new Map<string,string>();
 const latest=validDays<T>(data.days.map(review));
 for(const d of latest)hashes.set(d.date,index.find(e=>e.date===d.date)?.hash??'');
 const kept=current.filter(d=>!hashes.has(d.date)&&index.some(e=>e.date===d.date&&e.hash===loaded.get(d.date)));
 for(const d of kept)hashes.set(d.date,loaded.get(d.date)!);
 return {days:[...latest,...kept].sort((a,b)=>b.date.localeCompare(a.date)),index,hashes};
}
