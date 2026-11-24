import test from 'node:test';
import assert from 'node:assert/strict';
import {validDays,followsLatest,observedMessage,latestObserved,STALE_MINUTES} from '../src/occto-refresh.ts';
import {latestIndex} from '../src/occto-time.ts';
const day=(date:string,index:number,value=0)=>({date,actual:{times:Array.from({length:48},(_,i)=>String(i)),lines:[{values:Array.from({length:48},(_,i)=>i===index?value:null)}]}});
test('latest valid publication includes zero, ignores missing days, never fills a line',()=>{
 const a=day('2026-09-23',31),empty=day('2026-09-24',-1);a.actual.lines.push({values:Array(48).fill(null)});
 const result=validDays([empty,a,day('2026-09-22',47)]);
 assert.equal(result[0].date,a.date);assert.equal(latestIndex(result[0]),31);assert.equal(result[0].actual.lines[1].values[31],null);
 assert.throws(()=>validDays([empty]));
});
test('new time and midnight follow only the latest selection; intervening history choice wins',()=>{
 const before=[day('2026-09-23',31),day('2026-09-22',47)];
 assert.equal(followsLatest(before,'2026-09-23',31),true);
 assert.equal(followsLatest(before,'2026-09-23',30),false);
 assert.equal(followsLatest(before,'2026-09-22',47),false);
 const after=validDays([day('2026-09-24',0),...before]);assert.equal(latestIndex(after[0]),0);
});
// 2026-11-09 保留92：更新の状態は最新の観測コマで決める（docs/RULES.md 4節。地域90分・連系線120分）
const times=Array.from({length:48},(_,i)=>String(i>>1).padStart(2,'0')+':'+(i%2?'30':'00')+':00');
const obs=(date:string,index:number,note='')=>({date,actual:{times:times.map(t=>date+'T'+t),lines:[{note,values:Array.from({length:48},(_,i)=>i<=index?100:null)}]}});
const jst=(s:string)=>Date.parse(s+'+09:00');
test('最新の観測から90分ちょうどは正常、超えたら更新停止。0 MW も観測として数える',()=>{
 const d=[obs('2026-11-09',8)];// 04:00
 assert.deepEqual(observedMessage(d,false,jst('2026-11-09T05:30:00'),true),{message:'最新の観測 11/9 4:00',kind:'ok'});
 assert.deepEqual(observedMessage(d,false,jst('2026-11-09T05:30:01'),true),{message:'更新が止まっています（最新の観測 11/9 4:00）',kind:'stale'});
 const zero=obs('2026-11-09',8);zero.actual.lines[0].values[8]=0;assert.equal(observedMessage([zero],false,jst('2026-11-09T04:10:00'),true).kind,'ok');
 assert.equal(STALE_MINUTES.region,90);assert.equal(STALE_MINUTES.tie,120);
});
test('日をまたぐ：新しい日に観測がなければ前日の最後のコマで判定する',()=>{
 const d=[{...obs('2026-11-09',-1)},obs('2026-11-08',47)];// 前日 23:30
 assert.equal(latestObserved(d),'2026-11-08T23:30:00');
 assert.equal(observedMessage(d,false,jst('2026-11-09T01:00:00'),true).kind,'ok');
 assert.equal(observedMessage(d,false,jst('2026-11-09T01:00:01'),true).kind,'stale');
});
test('過去日・過去の時刻を見ているときは更新停止を出さない',()=>{
 assert.equal(observedMessage([obs('2026-11-01',8)],false,jst('2026-11-09T12:00:00'),false).kind,'ok');
});
test('取得の失敗は更新停止より優先する（観測の時刻も示す）。観測がなければ更新停止',()=>{
 assert.deepEqual(observedMessage([obs('2026-11-01',8)],true,jst('2026-11-09T12:00:00'),true),{message:'配信データの取得に失敗。最後の正常データを表示（最新の観測 11/1 4:00）',kind:'fail'});
 assert.deepEqual(observedMessage([],false,jst('2026-11-09T12:00:00'),true),{message:'更新が止まっています（観測なし）',kind:'stale'});
});
test('連系線：推定の線（地域の公表値から作る）を除いて判定し、閾値は120分',()=>{
 const tie={...obs('2026-11-09',8,'OCCTO連系線潮流実績'),};tie.actual.lines.push({note:'推定：OCCTOは個別に公表しない',values:Array.from({length:48},(_,i)=>i<=12?1:null)});// 公表 04:00、推定 06:00
 assert.equal(latestObserved([tie]),'2026-11-09T06:00:00');
 assert.equal(latestObserved([tie],true),'2026-11-09T04:00:00');
 assert.equal(observedMessage([tie],false,jst('2026-11-09T06:00:00'),true,true).kind,'ok');
 assert.equal(observedMessage([tie],false,jst('2026-11-09T06:00:01'),true,true).kind,'stale');
 assert.equal(observedMessage([tie],false,jst('2026-11-09T06:00:01'),true).kind,'ok');// 地域としてなら推定の線を含め 06:00 から90分以内
});
test('全国表示：遅れた地域だけが更新停止になる（地域ごとに自分の最新の観測で判定する）',()=>{
 const now=jst('2026-11-09T06:00:00');
 assert.equal(observedMessage([obs('2026-11-09',11)],false,now,true).kind,'ok');// 05:30
 assert.equal(observedMessage([obs('2026-11-09',7)],false,now,true).kind,'stale');// 03:30
});
