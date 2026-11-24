import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {referenceFlowPath,flowBranches} from '../src/flow-path.ts';
import {recordLines,candidateGeometry} from '../src/real-domain.ts';
import {withoutTokyoOverlap} from '../src/tokyo-domain.ts';
import {uniqueAssets} from '../src/regions.ts';
// 2026-11-08 オーナー指示：連系線の表示で北本直流幹線の粒子が消える／新信濃FC 中部側連系線（東清水FCも同じ原因）は値があるのに粒子が出ない。
// 全国・連系線の表示と同じ組み立て（src/real.ts の nationalView・tieView）で、連系線のすべての行に潮流の経路が作れることを確かめる
const read=(p:string)=>JSON.parse(readFileSync('public/data/'+p,'utf8'));
const L=(f:string)=>read(f).lines;
const tie=read('tie-flow.json');
const fullDay=(t:any)=>t.days.find((d:any)=>d.actual.lines.length>=13)??t.days[0];
const records=fullDay(tie).actual.lines;
const dc=L('tohoku-dc-osm.json');for(const l of dc)if(tie.lineAliases[l.id])l.flowNames=tie.lineAliases[l.id];
const tohoku=L('tohoku-trunk.json'),base=[...tohoku,...dc.filter((l:any)=>!tohoku.some((o:any)=>o.id===l.id))];
const tokyo=L('tokyo-trunk.json'),chubu=L('chubu-trunk.json');
const FC=['tokyo-fc-shinshinano-60hz','tokyo-fc-hida-shinano-dc','tokyo-fc-higashishimizu-60hz'];
const national=uniqueAssets([...withoutTokyoOverlap(base,tokyo),...L('hokkaido-hokuto.json'),...withoutTokyoOverlap(tokyo,chubu,new Set(FC)),...chubu,...['hokuriku','kansai','chugoku','shikoku','kyushu'].flatMap(r=>L(r+'-trunk.json'))]);
const tieLines=recordLines(national,records);
test('連系線の全行に、全国・連系線の表示で潮流の経路が作れる（北本・新信濃FC・東清水FC を含む）',()=>{
 assert.ok(records.length>=13,'連系線の行がそろった日がある');
 for(const name of ['北本直流幹線','新信濃FC 中部側連系線（OSM無名）','東清水FC 中部側連系線（OSM無名）'])assert.ok(records.some((r:any)=>r.name===name),name+' の行がある');
 for(const r of records){
  assert.ok(referenceFlowPath(r,national,false),'全国：'+r.name);
  assert.ok(referenceFlowPath(r,tieLines,false),'連系線：'+r.name);
 }
});
test('連系線の表示には北本直流幹線の名前のない3区間（lineAliases）も入る。全国の線は ID が重ならない',()=>{
 for(const id of ['osm-797840188-250','osm-797840190-250','osm-797840191-250'])assert.ok(tieLines.some(l=>l.id===id),id);
 assert.ok(tieLines.every(l=>records.some((r:any)=>r.voltageKV===l.voltageKV)),'電圧の合わない線は入らない');
 assert.equal(new Set(national.map((l:any)=>l.id)).size,national.length);
 // 名前のない線は flowNames がなければ行名と同じでも拾わない
 const unnamed={...tieLines[0],id:'x',named:false,name:records[0].name,voltageKV:records[0].voltageKV,flowNames:undefined};
 assert.equal(recordLines([unnamed],records).length,0);
 // 名前のある線は candidateGeometry と同じ結果
 for(const r of records)for(const l of candidateGeometry(r,national))assert.ok(tieLines.includes(l),r.name);
});
test('周波数変換設備の中部側の線は、全国の表示でも削らない（分岐の判定は中部表示と同じ）',()=>{
 const chubuView=uniqueAssets([...chubu,...tokyo.filter((l:any)=>FC.includes(l.id))]);
 for(const id of FC)assert.deepEqual(national.find((l:any)=>l.id===id)?.paths,tokyo.find((l:any)=>l.id===id).paths,id);
 for(const r of records.filter((r:any)=>r.id.startsWith('tie-03-')))assert.deepEqual(flowBranches(r,national),flowBranches(r,chubuView),r.name);
});
