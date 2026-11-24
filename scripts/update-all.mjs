// 全エリアの地内実績と連系線の潮流を1回だけ更新して終わる（常設配信のスケジューラから30分ごとに呼ぶ入口）。2026-10-03
// 「将来アプリとしてリリースした際に自動で表示されるようにしたい」。docs/IOS_RELEASE_PREPARATION.md 第3節の「30分ごとの単発実行」に合わせる。
// 使い方: node scripts/update-all.mjs   （Windowsタスクスケジューラ・systemd timer・CIのどれからでも同じ）
// - 順番は固定。連系線（update-ties）は三重東近江線の推定に中部・関西の地内実績を使うので最後。
// - 前回の実行が残っていれば何もしない（tmp/update-all.lock、60分で古いとみなす）。
// - 1つ失敗しても残りは続け、最後に失敗があれば終了コード1。結果は tmp/update-all-status.json（外部監視で最終成功時刻を見る）。
import {execFileSync} from 'node:child_process';
import {openSync,closeSync,writeFileSync,readFileSync,unlinkSync,statSync,mkdirSync} from 'node:fs';
const STEPS=['update-occto','update-hokkaido','update-tokyo','update-chubu','update-hokuriku','update-kansai','update-chugoku','update-shikoku','update-kyushu','update-ties'];
mkdirSync('tmp',{recursive:true});
const LOCK='tmp/update-all.lock';
try{const age=Date.now()-statSync(LOCK).mtimeMs;if(age<60*60000){console.log('前回の更新が実行中のため終了',Math.round(age/1000)+'s');process.exit(0);}unlinkSync(LOCK);}catch{}
let fd;try{fd=openSync(LOCK,'wx');writeFileSync(fd,String(process.pid));}catch{console.log('ロックを取得できないため終了');process.exit(0);}
const startedAt=new Date().toISOString(),results=[];
let previous=null;try{previous=JSON.parse(readFileSync('tmp/update-all-status.json','utf8'));}catch{}
try{
 for(const step of STEPS){const t=Date.now();
  try{execFileSync(process.execPath,[`scripts/${step}.mjs`],{stdio:'inherit',timeout:15*60000,windowsHide:true});results.push({step,ok:true,seconds:Math.round((Date.now()-t)/1000)});}
  catch(e){results.push({step,ok:false,seconds:Math.round((Date.now()-t)/1000),message:String(e.message).split('\n')[0].slice(0,200)});}
 }
}finally{
 const ok=results.every(r=>r.ok),finishedAt=new Date().toISOString();
 writeFileSync('tmp/update-all-status.json',JSON.stringify({startedAt,finishedAt,ok,lastFullSuccessAt:ok?finishedAt:previous?.lastFullSuccessAt??null,results},null,2)+'\n');
 closeSync(fd);try{unlinkSync(LOCK);}catch{}
 console.log(ok?'更新完了':'一部失敗：'+results.filter(r=>!r.ok).map(r=>r.step).join('、'));
 if(!ok)process.exitCode=1;
}
