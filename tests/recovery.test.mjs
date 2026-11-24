import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {windowDates,recoveryDates,refreshTargets,publishFile,refreshBatch,refreshDays} from '../scripts/occto-publication.mjs';
import {readFileSync} from 'node:fs';
test('transport failure prevents publication; next attempt can publish',async()=>{
 let published=0;
 await assert.rejects(refreshBatch(['2026-09-22','2026-09-23'],async date=>{if(date.endsWith('23'))throw Error('connection reset');},async()=>published++));
 assert.equal(published,0);
 await refreshBatch(['2026-09-22','2026-09-23'],async()=>{},async()=>published++);assert.equal(published,1);
});
const day=date=>({date,actual:{times:Array.from({length:48},(_,i)=>`${date}T${String(i>>1).padStart(2,'0')}:${i%2?'30':'00'}:00`),lines:[{id:'a',values:Array(48).fill(1)}]},capacities:[]});
test('rollover and restart recover absent days and finalize yesterday',()=>{
 const dates=windowDates('2026-03-01');assert.equal(dates[1],'2026-02-28');assert.equal(dates.length,30);
 const days=dates.map(day);assert.deepEqual(recoveryDates(dates[0],days),dates.slice(0,2));
 days.splice(5,1);assert.ok(recoveryDates(dates[0],days).includes(dates[5]));
 assert.throws(()=>windowDates('2026-02-30'));
});
test('failed publication retains bytes; fresh process recovers and keeps backup',async()=>{
 const file=join(await mkdtemp(join(tmpdir(),'grid-recovery-')),'flow.json');const days=[day('2026-09-23')];
 await publishFile(file,days);const before=await readFile(file,'utf8');
 const bad=structuredClone(days);bad[0].actual.lines[0].values[0]=null;
 await assert.rejects(publishFile(file,bad));assert.equal(await readFile(file,'utf8'),before);
 bad[0].actual.lines[0].values.pop();await assert.rejects(publishFile(file,bad));assert.equal(await readFile(file,'utf8'),before);
 const {execFileSync}=await import('node:child_process');
 execFileSync(process.execPath,['--input-type=module','-e',`import {publishFile} from ${JSON.stringify(new URL('../scripts/occto-publication.mjs',import.meta.url).href)}; await publishFile(${JSON.stringify(file)},${JSON.stringify([day('2026-09-24'),...days])});`]);
 assert.equal(JSON.parse(await readFile(file,'utf8')).days[0].date,'2026-09-24');assert.equal(await readFile(file+'.previous','utf8'),before);
});
// 2026-10-31 公開残件3-A：東北も古い日の一時的な失敗では公開を止めない。今日の失敗だけは失敗にする
test('refreshDays：今日以外の日の失敗は飛ばして公開し、飛ばした日を返す。今日の失敗は公開しない',async()=>{
 let published=0;const done=[];
 const skipped=await refreshDays(['2026-10-05','2026-10-30','2026-10-31'],async date=>{if(date==='2026-10-05')throw Error('fetch failed\nstack');done.push(date);},async()=>published++,date=>date==='2026-10-31');
 assert.deepEqual(done,['2026-10-30','2026-10-31'],'失敗した日の後も続ける');assert.equal(published,1);
 assert.deepEqual(skipped,[{date:'2026-10-05',message:'fetch failed'}]);
 await assert.rejects(refreshDays(['2026-10-30','2026-10-31'],async date=>{if(date==='2026-10-31')throw Error('connection reset');},async()=>published++,date=>date==='2026-10-31'));
 assert.equal(published,1,'今日の失敗では公開しない');
});
test('東北の更新：必ず成功させる日は今日と前日（他の地域と同じ。保留40）',async()=>{
 const src=await readFile(new URL('../scripts/update-occto.mjs',import.meta.url),'utf8');
 assert.ok(src.includes('},publish,date=>windowDates(end).slice(0,2).includes(date));'));
 const must=date=>windowDates('2026-10-31').slice(0,2).includes(date);
 let published=0;
 await assert.rejects(refreshDays(['2026-10-29','2026-10-30','2026-10-31'],async date=>{if(date==='2026-10-30')throw Error('reset');},async()=>published++,must),/reset/);
 assert.equal(published,0,'前日の失敗では公開しない');
 assert.deepEqual(await refreshDays(['2026-10-29','2026-10-31'],async date=>{if(date==='2026-10-29')throw Error('reset');},async()=>published++,must),[{date:'2026-10-29',message:'reset'}]);
});
// 東北も、ほかの地域・連系線と同じく「今日・前日と、取得が最も古い2日（手元にない日が先）」を取る（2026-11-01 保留48）
test('refreshTargets: today, yesterday and the two oldest-retrieved days (absent first); used by update-occto',()=>{
 const dates=windowDates('2026-03-01');
 assert.deepEqual(refreshTargets(dates[0],[]),dates.slice(0,4));
 const days=dates.map((date,i)=>({...day(date),retrievedAt:`2026-03-01T00:${String(59-i).padStart(2,'0')}:00Z`}));
 days[7].retrievedAt='2026-02-01T00:00:00Z';days[12].retrievedAt='2026-02-02T00:00:00Z';
 assert.deepEqual(refreshTargets(dates[0],days),[dates[0],dates[1],dates[7],dates[12]]);
 days.splice(20,1);
 assert.deepEqual(refreshTargets(dates[0],days),[dates[0],dates[1],dates[20],dates[7]]);
 const src=readFileSync('scripts/update-occto.mjs','utf8');
 assert.ok(src.includes('refreshTargets(end,existing)'));
 assert.ok(!src.includes('recoveryDates'));
});
