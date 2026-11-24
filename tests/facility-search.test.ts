import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {facilitySearchNames,facilityQueryMatch,normalizeName} from '../src/real-domain.ts';
const q=(s:string)=>normalizeName(s.trim());
test('設備の検索：表示名と別名の名前の部分だけを使う。需要家は表示名だけ（2026-10-18 オーナー指示）',()=>{
 const plant={name:'新しい名前',kind:'plant',attributes:[{label:'別名',value:'旧名発電所（OSMの登録名。説明）'},{label:'運営者',value:'某社'}]};
 assert.deepEqual(facilitySearchNames(plant),['新しい名前','旧名発電所']);
 assert.equal(facilityQueryMatch(plant,q('旧名')),'旧名発電所');assert.equal(facilityQueryMatch(plant,q('新しい')),true);
 assert.equal(facilityQueryMatch(plant,q('OSMの登録名')),null,'説明の部分では当たらない');assert.equal(facilityQueryMatch(plant,q('某社')),null);
 assert.deepEqual(facilitySearchNames({name:'別名なし変電所',kind:'substation',attributes:[]}),['別名なし変電所']);
 assert.deepEqual(facilitySearchNames({name:'需要家',kind:'customer',attributes:[{label:'別名',value:'実名の工場'}]}),['需要家']);
 assert.equal(facilityQueryMatch({name:'Abc Plant',kind:'plant'},q('abc')),true,'大文字と小文字は同じに扱う');
});
// 2026-11-17 保留125：線につながっていない発電所8か所を削除した（保留126 の3か所も同じテストで確かめる）。名前で検索しても当たらない
test('東京データ：保留125・126で削除した発電所は検索に出ない',()=>{
 const fs=JSON.parse(readFileSync('public/data/tokyo-trunk.json','utf8')).facilities;
 for(const id of ['osm-way-943646268','osm-way-1133603221','osm-way-1198135329','osm-way-404901529','osm-way-404901530','osm-way-1161552601','osm-way-1100962066','osm-way-1092461703','osm-way-246750093','osm-way-1135976065','osm-way-180786612','osm-relation-15402384'])assert.equal(fs.find((x:any)=>x.id===id),undefined,id);
 for(const n of ['磯子','南横浜火力','新中袖','袖ケ浦グリーン','KNGPG','Genex','ベイパワー','城山水力','中津川第一','秋元発電所'])assert.equal(fs.some((x:any)=>x.kind==='plant'&&facilityQueryMatch(x,q(n))),false,n);
});
// 2026-11-17 保留124-1：日本テクノ那珂グリーンパワー（「那珂瓦斯」の別名）は線につながっていないので地図から削除した
test('東京データ：「東海発電所」で東海第二発電所が別名で当たる',()=>{
 const fs=JSON.parse(readFileSync('public/data/tokyo-trunk.json','utf8')).facilities;const f=(id:string)=>fs.find((x:any)=>x.id===id);
 assert.equal(f('osm-way-1078429703'),undefined);
 assert.equal(facilityQueryMatch(f('osm-relation-1527911'),q('東海発電所')),'東海発電所');
 assert.equal(facilityQueryMatch(f('japc-tokai-1'),q('東海発電所')),true);
});
