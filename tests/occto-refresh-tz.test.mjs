// 2026-11-09 保留92：見る人の時刻帯に依存しないこと（TZ を変えた子プロセスで同じ結果になる）
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));// app の外から実行しても src を読めるように
const code="import('./src/occto-refresh.ts').then(m=>{const t=Array.from({length:48},(_,i)=>'2026-11-09T'+String(i>>1).padStart(2,'0')+':'+(i%2?'30':'00')+':00');const d=[{date:'2026-11-09',actual:{times:t,lines:[{values:t.map((_,i)=>i<=8?1:null)}]}}];const now=Date.parse('2026-11-08T20:30:00Z');console.log(JSON.stringify([m.observedMessage(d,false,now,true),m.observedMessage(d,false,now+1000,true)]));})";
test('TZ=UTC・America/Los_Angeles・Asia/Tokyo で同じ判定',()=>{
 const out=['UTC','America/Los_Angeles','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--experimental-strip-types','-e',code],{cwd,env:{...process.env,TZ},encoding:'utf8'}).trim());
 assert.equal(new Set(out).size,1,out.join('\n'));
 assert.deepEqual(JSON.parse(out[0]).map(x=>x.kind),['ok','stale']);
});
