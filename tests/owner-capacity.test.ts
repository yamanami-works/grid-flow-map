import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {plantTypeView} from '../src/plant-type.ts';
// 2026-11-18 保留129（オーナー回答「Aは加える。Bは実線のまま。Cは162MWと記載。…」）：アマテラス白石ソーラーファームは種別「太陽光」（宮城県の答申・知事意見）、
// 出力はオーナー説明の値 162MW を点線の枠で出す（出力カードの印「オーナー説明・一次資料未確認」は 2026-11-18 オーナー指示で外した、保留130-1。出典タブの行は残す）。この属性を持つ設備はオーナーが設備ごとに承認したものだけ（docs/mockups/detail-panel/README.md「発電所」）
const read=(f:string)=>JSON.parse(readFileSync('public/data/'+f,'utf8'));
test('本アプリの調査による出力の属性はアマテラス白石ソーラーファームだけ、種別は太陽光',()=>{
 const owners:string[]=[];
 for(const f of readdirSync('public/data').filter(x=>x.endsWith('.json')&&!x.startsWith('catalog'))){let d:any;try{d=read(f);}catch{continue;}
  for(const x of d.facilities??[])if(x.attributes?.some((a:any)=>a.label==='設備出力（本アプリの調査による値）'))owners.push(x.id);}
 assert.deepEqual([...new Set(owners)],['tohoku-place-アマテラス白石ソーラーパーク']);
 const f=read('tohoku-trunk.json').facilities.find((x:any)=>x.id==='tohoku-place-アマテラス白石ソーラーパーク');
 assert.equal(f.name,'アマテラス白石ソーラーファーム');
 assert.match(f.attributes.find((a:any)=>a.label==='設備出力（本アプリの調査による値）').value,/^162MW。.*一次資料未確認.*直流（パネル容量）・交流（連系出力）の別は未確認/);
 assert.match(f.attributes.find((a:any)=>a.label==='出典（発電方式）').value,/jourei-huuryoku6-jyunbi-tousin\.pdf.*2026-11-18確認/);
 const v=plantTypeView({primary:f.plantType,units:[]});
 assert.deepEqual(v.lines,[{label:'太陽光',partial:false}]);assert.ok(v.sub.some(s=>/推定/.test(s)));
});
test('出力カード：本アプリの調査による値は印なし・「直流・交流の別は未確認」付きで、OSM の値のカードの分岐の中だけ',()=>{
 const src=readFileSync('src/real.ts','utf8');
 assert.match(src,/attr\(f,\/\^設備出力（本アプリの調査による値）\$\/\)/);
 assert.match(src,/:ownerShown\?`<div class="dp-capacity dp-capacity-osm"><span class="dp-cap-label">設備出力<\/span><div class="dp-cap-value"><b>\$\{num\(ownerMW\)\}<\/b> MW<\/div><p class="dp-sub">直流・交流の別は未確認/);
 // 出力カードの印は外した（2026-11-18 保留130-1）。出典タブの行は残す
 assert.ok(!src.includes('dp-warn">オーナー説明・一次資料未確認'));
 {const i=src.indexOf(':ownerShown?`'),card=src.slice(i,src.indexOf('</div>`',i));assert.ok(i>0&&card.length<600&&!card.includes('dp-badge'));}
 assert.ok(src.includes("ownerShown?[{label:'設備出力',name:'本アプリの調査（一次資料未確認）'}]"));
 assert.match(src,/const ownerShown=f\.kind==='plant'&&!retired&&!hj&&!profile&&!extraShown&&Number\.isFinite\(ownerMW\)/);
 // HJKS・事業者の資料・HJKS外の号機があるときのカードが先（オーナー説明の値はその次）
 assert.ok(src.indexOf('hj||profile||extraShown?')<src.indexOf(':ownerShown?'));
});
