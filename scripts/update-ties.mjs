// 連系線の潮流を更新する：今日と前日の OCCTO 連系線潮流実績（北本・相馬双葉・周波数変換・関門・本四・阿南紀北・西播東岡山/山崎智頭・関西フェンス）を取り直し、public/data/tie-flow.json を作る。
// 状態は tmp/tie-status.json（他エリアの update-*.mjs と同じ形）。2026-10-03
import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
const jst=d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10);
const now=new Date(),dates=[jst(new Date(now.getTime()-86400000)),jst(now)];
// OCCTOの遡及修正に備え、直近30日のうち取得が最も古い2日も取り直す（2026-10-03）。
// 日ごとの取得時刻は public/data/tie-flow.json の retrievedAt（2026-11-01 公開残件3-B：Actions では原本が残らないので、読み戻した前回分の時刻で選ぶ）
{let prevDays=[];try{prevDays=JSON.parse(readFileSync('public/data/tie-flow.json','utf8')).days??[];}catch{}
 const fetchedAt=d=>prevDays.find(x=>x.date===d)?.retrievedAt??'';
 const window=Array.from({length:28},(_,i)=>jst(new Date(now.getTime()-(i+2)*86400000)));
 dates.unshift(...window.sort((a,b)=>fetchedAt(a).localeCompare(fetchedAt(b))||b.localeCompare(a)).slice(0,2));}
let previous={};try{previous=JSON.parse(readFileSync('tmp/tie-status.json','utf8'));}catch{}
// 画面の「公表元の最新確認済み」は lastSuccessAt を見る（他地域の update-*.mjs と同じ項目）
const status={state:'checking',lastAttemptAt:now.toISOString(),lastSuccessAt:previous.lastSuccessAt??null,publishedAt:previous.publishedAt};writeFileSync('tmp/tie-status.json',JSON.stringify(status));
try{
 for(const [i,d] of dates.entries()){try{execFileSync(process.execPath,['scripts/fetch-occto-tie.mjs',d,'01,02,03,07,08,09,10,15'],{stdio:'inherit',timeout:240000});}catch(e){if(i>=dates.length-2)throw e;console.error('refetch failed',d);}}
 // 2026-10-09：前日の取り直しがOCCTO側の一時的な失敗で落ちると、今日の分も更新されず連系線の潮流が数時間止まっていた。失敗で止めるのは今日の分だけにする（前日は前回取得分を使う）（2026-11-01 に下記へ改めた）
 // 2026-11-01 改め（保留46 A、オーナー承認）：docs/RULES.md 5節「今日と前日の取得に失敗したら配置しない」に合わせ、前日の失敗も失敗にする（ほかの9か所と同じ）。古い2日の失敗は前回分のまま続ける。取得には再試行がある（fetch-occto-tie.mjs）
 execFileSync(process.execPath,['--experimental-strip-types','scripts/tie-flow.mjs'],{stdio:'inherit',timeout:120000});
 const data=JSON.parse(readFileSync('public/data/tie-flow.json','utf8'));
 writeFileSync('tmp/tie-status.json',JSON.stringify({state:'success',lastAttemptAt:now.toISOString(),lastSuccessAt:new Date().toISOString(),publishedAt:data.updatedAt}));
}catch(e){writeFileSync('tmp/tie-status.json',JSON.stringify({...status,state:'failed',message:String(e.message).slice(0,200)}));process.exitCode=1;}
