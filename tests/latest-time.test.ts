import test from 'node:test';import assert from 'node:assert/strict';
import {combineRegionDays} from '../src/regions.ts';import {latestIndex} from '../src/occto-time.ts';
// 2026-10-04：全国の「最新時刻」が一番進んだ地域（四国・九州の22:00）になり、21:30までの他の地域が欠測で流れなかった
const day=(id:string,filled:number)=>{const date='2026-10-04';const times=Array.from({length:48},(_,i)=>`${date}T${String(i>>1).padStart(2,'0')}:${i%2?'30':'00'}:00`);
 return {date,retrievedAt:'',sourceUrl:'',attribution:'',actual:{times,originalTimes:times,lines:[{id,name:id,voltageKV:500,from:'a',to:'b',note:'',values:times.map((_,i)=>i<filled?100:null)}]},capacities:[]};};
test('the latest time of combined regions is the latest slot every region has published',()=>{
 const [c]=combineRegionDays([[day('tohoku',44)],[day('kyushu',45)],[day('shikoku',45)]]);
 assert.equal(latestIndex(c),43);assert.ok(c.actual.lines.every(l=>l.values[latestIndex(c)]!==null));
 // 1地域だけなら従来どおりその地域の最新
 assert.equal(latestIndex(day('kyushu',45)),44);
 // 当日分がまだ1件もない地域は待たない
 const [d]=combineRegionDays([[day('tohoku',44)],[day('kyushu',0)]]);assert.equal(latestIndex(d),43);
 // 連系線（取得が数分遅れる）は待たない
 const [e]=combineRegionDays([[day('tohoku',46)],[day('tie',45)]],[true,false]);assert.equal(latestIndex(e),45);
});
