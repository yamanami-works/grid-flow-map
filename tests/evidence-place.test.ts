import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {facilityTierOf} from '../src/evidence.ts';
// 2026-11-17 保留124-7（オーナー回答「推奨で承認」）：地図データの区画のない設備（-place）のうち、名称と位置を国土地理院の地図注記で確かめたものは A。
// 対象は今は3か所。増えるときは、属性「位置の確認」が「国土地理院の地図注記「<設備名>」」で始まることを確かめてからここを直す
test('地理院の注記で名称と位置を確かめた -place の設備だけが A',()=>{
 const a:string[]=[];
 for(const f of readdirSync('public/data').filter(f=>/-trunk\.json$|hokuto\.json$/.test(f)))for(const x of JSON.parse(readFileSync('public/data/'+f,'utf8')).facilities)
  if(!String(x.url).includes('openstreetmap')&&facilityTierOf(x)==='A')a.push(x.id);
 assert.deepEqual(a.sort(),['chubu-place-岐北開閉所','hokkaido-place-足寄発電所','tokyo-place-大鳥発電所'].sort());
 // 位置推定（位置の根拠）が付いたものは注記があっても D のまま
 assert.equal(facilityTierOf({name:'X',url:'',attributes:[{label:'位置の確認',value:'国土地理院の地図注記「X」'},{label:'位置の根拠',value:'推定'}]}),'D');
 // 注記の名前が設備名と違うものは A にしない
 assert.equal(facilityTierOf({name:'X発電所',url:'',attributes:[{label:'位置の確認',value:'国土地理院の地図注記「Xダム」'}]}),'D');
});
// 2026-11-17 保留124（変更レビューの要修正1・2）：分岐点・端を推定した東京の線は「推測」が付く
test('保留124で分岐点を推定した東京の線には推測（inferred）が付く',async()=>{
 const {evidenceOf}=await import('../src/evidence.ts');
 const d=JSON.parse(readFileSync('public/data/tokyo-trunk.json','utf8'));
 for(const id of ['tokyo-section-77','tokyo-section-78','ledger-tokyo-275-1551517537','tokyo-section-129','tokyo-feeder-275-gsi-大鳥','tokyo-feeder-275-gsi-大津岐','tokyo-feeder-500-340294682']){
  const l=d.lines.find((x:any)=>x.id===id);assert.ok(l,id);assert.ok(evidenceOf(l).inferred.length>0,id);}
});
