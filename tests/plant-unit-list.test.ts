import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {mergeUnits,hjksUnitName} from '../src/plant-unit-list.ts';
import {plantExtraUnits} from '../src/plant-extra-units.ts';
// 2026-11-10 オーナー承認（保留105）：HJKS にない号機（廃止措置中・建設中）を一次資料から足す。HJKS の「単独」は番号で出す
const hj=JSON.parse(readFileSync('public/data/plant-units.json','utf8')).plants;
test('島根：1号機（廃止措置中）・2号機（運転中、HJKS）・3号機（建設中）の3つ',()=>{
 const l=mergeUnits(hj['osm-way-605382253'].units,plantExtraUnits['osm-way-605382253']);
 assert.deepEqual(l.map(u=>u.name+':'+u.status),['2号機:運転中','1号機:廃止措置中','3号機:建設中']);
 assert.deepEqual(l.filter(u=>u.status==='運転中').map(u=>u.mw),[820],'合計は運転中の号機だけ');
});
test('HJKS に同じ番号の号機があれば足さない（全角数字もそろえる）',()=>{
 const l=mergeUnits([{unit:'１号機',mw:1,start:null,end:null,status:'運転終了',plant:'X'}],[{name:'1号機',mw:2,start:null,status:'廃止措置中',source:'s',url:'u',checkedAt:'2026-11-10'}]);
 assert.equal(l.length,1);assert.equal(l[0].status,'運転終了');
});
test('一次資料の号機は HJKS の号機と重ならない（5発電所）',()=>{
 assert.deepEqual(Object.keys(plantExtraUnits).length,5);
 for(const [id,xs] of Object.entries(plantExtraUnits)){const l=mergeUnits(hj[id]?.units??[],xs);assert.equal(l.filter(u=>u.extra).length,xs.length,id);for(const u of xs)assert.ok(['廃止措置中','建設中'].includes(u.status)&&u.url.startsWith('https://')&&u.checkedAt,id);}
 assert.equal(hjksUnitName({unit:'単独',plant:'敦賀2号機'}),'2号機');assert.equal(hjksUnitName({unit:'単独',plant:'東海第二'}),'単独');
});
