import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {reviewedTokyoDay,needsSignFlip,SIGN_CHECKS} from '../src/tokyo-domain.ts';
// 福島幹線(山)の符号の判定（2026-11-07 オーナー回答 保留81。docs/RULES.md 4節）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const L=(name:string,values:(number|null)[],from='新いわき開閉所',to='新福島変電所')=>({name,voltageKV:500,from,to,values});
const c=SIGN_CHECKS[0];
test('判定：並行の東山線が負で山線が正の日だけ、2026-06-30 以降で反転する',()=>{
 assert.equal(SIGN_CHECKS.length,1);assert.equal(c.line,'福島山幹線');assert.match(c.why,/^OCCTOの実績値/);
 assert.equal(needsSignFlip([L('福島山幹線',[2600,2500]),L('福島東幹線山線',[-2100,-2000])],c,'2026-11-06'),true);
 assert.equal(needsSignFlip([L('福島山幹線',[2600,2500]),L('福島東幹線山線',[-2100,-2000])],c,'2026-06-29'),false,'接続変更の前の日');
 assert.equal(needsSignFlip([L('福島山幹線',[-2600]),L('福島東幹線山線',[-2100])],c,'2026-11-06'),false,'OCCTOが直した日（同じ符号）');
 assert.equal(needsSignFlip([L('福島山幹線',[2600]),L('福島東幹線山線',[2100])],c,'2026-11-06'),false,'両方正');
 assert.equal(needsSignFlip([L('福島山幹線',[2600,null]),L('福島東幹線山線',[null,-2000])],c,'2026-11-06'),false,'同じ時刻に両方の値がない');
 assert.equal(needsSignFlip([L('福島山幹線',[2600])],c,'2026-11-06'),false,'並行の線がない');
 // 並行の線の向きの表記が逆なら符号をそろえて比べる
 assert.equal(needsSignFlip([L('福島山幹線',[2600]),L('福島東幹線山線',[2100],'新福島変電所','新いわき開閉所')],c,'2026-11-06'),true);
});
test('公開データ：30日分すべてで福島山幹線を反転し、反転後は東山線と同じ向き・注記付き。ほかの線は変えない',()=>{
 const dir='public/data/tokyo-flow-days';let n=0;
 for(const f of readdirSync(dir)){const raw=read(dir+'/'+f);const day=raw.days?.[0]??raw;if(!(day.date>='2026-06-30'))continue;
  const r=reviewedTokyoDay(day),y=r.actual.lines.find((l:any)=>l.name==='福島山幹線'),e=r.actual.lines.find((l:any)=>l.name==='福島東幹線山線');if(!y||!e)continue;n++;
  const src=day.actual.lines.find((l:any)=>l.name==='福島幹線(山)');
  assert.ok(/符号を反転/.test(y.note),f);assert.deepEqual(y.values,src.values.map((v:number|null)=>v==null?v:-v),f);
  assert.ok(!/符号を反転/.test(e.note),f);
  for(const l of r.actual.lines)if(l.name!=='福島山幹線')assert.ok(!/符号を反転/.test(l.note??''),l.name);
 }
 assert.ok(n>=20,'日が読めていない '+n);
});
