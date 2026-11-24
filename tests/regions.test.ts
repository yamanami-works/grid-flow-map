import test from 'node:test';
import assert from 'node:assert/strict';
import {combineRegionDays,uniqueAssets,type RegionalSnapshot} from '../src/regions.ts';
import {referenceFlowPath} from '../src/flow-path.ts';
import {capacityReferenceUsage} from '../src/occto-domain.ts';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync('public/data/hokkaido-hokuto.json','utf8'));
const sample=(region:string,values:(number|null)[]):RegionalSnapshot=>({date:'2026-09-26',retrievedAt:'2026-09-26T12:00:00Z',sourceUrl:'https://www.occto.or.jp/',attribution:'OCCTO',actual:{times:['2026-09-26T00:00:00','2026-09-26T00:30:00'],originalTimes:[],lines:[{id:region,name:region,voltageKV:275,from:'A',to:'B',note:'',values}]},capacities:[]});
test('national aligns exact timestamps and keeps missing and zero separate',()=>{
 const [d]=combineRegionDays([[sample('tohoku',[1,2])],[sample('hokkaido',[0,null])]]);
 assert.deepEqual(d.actual.lines[1].values.slice(0,3),[0,null,null]);assert.equal(d.actual.lines[0].values[1],2);
 assert.equal(uniqueAssets([{id:'one',assetId:'shared'},{id:'two',assetId:'shared'}]).length,1);
});
test('Hokuto uses existing converter asset and real continuous route in positive direction',()=>{
 assert.equal(data.facilities[0].assetId,'asset-b1927582-d144-4e18-bb32-d18565bd14b1');
 const r={id:'hk',name:'北斗幹線',voltageKV:275,from:'北斗変換所',to:'大野変電所',note:'',values:[]};
 const path=referenceFlowPath(r,data.lines,false);assert.ok(path);assert.ok(path[0][0]>path.at(-1)![0]);
 assert.equal(data.lines.filter((l:any)=>l.name==='北斗幹線').length,1);assert.equal(data.lines[0].paths.length,5);
 assert.equal(capacityReferenceUsage(r,0,[]),null);
 assert.equal(capacityReferenceUsage(r,106.4,[{...r,capacityMW:1064}]),10);
 assert.equal(capacityReferenceUsage(r,-106.4,[{...r,capacityMW:1064}]),null);
});
