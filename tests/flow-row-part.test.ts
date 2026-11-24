import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {rowSegments,offRowAt,offRowEnds,referenceFlowPath} from '../src/flow-path.ts';
import {candidateGeometry} from '../src/real-domain.ts';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';
// 2026-11-08 オーナー指示（保留90）：鹿島線の新野田〜筑波南、江東線の葛南〜江東は OCCTO の行がない区間。地図でその区間を押したときは詳細の潮流を「未収録」にする
const read=(p:string)=>JSON.parse(readFileSync('public/data/'+p,'utf8'));
const lines=read('tokyo-trunk.json').lines;
// 行は固定した2行（OCCTO東京の公表の書き方）で検査する。最新日のデータに依存しない（配置前の npm test が日によって失敗しないように）
const fixed=[['鹿島線','鹿島','筑波南'],['江東線','新京葉','葛南']].map(([name,from,to],i)=>({id:'fixture-'+i,name,voltageKV:275,from,to,note:'',values:[100]}));
const records=reviewedTokyoDay({date:'2026-11-08',actual:{times:['2026-11-08T00:00:00'],lines:fixed},capacities:[]} as any).actual.lines;
const line=(id:string)=>lines.find((l:any)=>l.id===id);
const row=(name:string)=>records.find((r:any)=>r.name===name);
const mid=(a:[number,number],b:[number,number]):[number,number]=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
for(const [id,name,ends,offEnds] of [['tokyo-section-45','鹿島線',['鹿島','筑波南'],['新野田変電所','筑波南変電所']],['tokyo-section-134','江東線',['新京葉','葛南'],['葛南変電所','江東変電所']]] as const){
 test(`${name}：行（${ends.join('→')}）の経路に載る線分と載らない線分に分かれる`,()=>{
  const g=line(id),r=row(name);assert.ok(g&&r);
  assert.deepEqual([r.from,r.to],ends.map(e=>e+'変電所'));
  assert.ok(candidateGeometry(r,[g]).length,'行と線が対応する');
  assert.ok(referenceFlowPath(r,lines,false),'経路が作れる');
  const on=rowSegments(r,lines,g)!,total=g.paths.reduce((n:number,p:any[])=>n+p.length-1,0);assert.ok(on&&on.size>0&&on.size<total,'一部の線分だけ経路に載る');
  assert.deepEqual([...offRowEnds(r,lines,g)!].sort(),[...offEnds].sort(),'行の外の区間の両端');
  g.paths.forEach((p:[number,number][],i:number)=>{for(let j=0;j+1<p.length;j++)assert.equal(offRowAt(r,lines,g,mid(p[j],p[j+1])),!on.has(i+':'+j),`線分 ${i}:${j} の中点を押す`);});
  // 行の外の線分は新野田（江東）側だけ：線の端の設備の近くを押す
  const far=g.connections.find((c:any)=>c.facilities.some((f:any)=>f.name===offEnds.find(e=>!ends.some(x=>e.startsWith(x))))).position;assert.equal(offRowAt(r,lines,g,far),true,'行の外の端の近くは行の外');
 });
}
test('flowTaps のない線・経路が作れない行では行の外と決めない',()=>{
 const r=reviewedTokyoDay({date:'2026-11-08',actual:{times:['2026-11-08T00:00:00'],lines:[{id:'fixture-x',name:'東京北線',voltageKV:275,from:'新野田',to:'北東京',note:'',values:[100]}]},capacities:[]} as any).actual.lines[0];const g=lines.find((l:any)=>!l.flowTaps&&candidateGeometry(r,[l]).length);assert.ok(g,'東京北線の線がある');
 assert.equal(offRowAt(r,lines,g,g.paths[0][0]),false);
 const k=line('tokyo-section-45'),bad={...row('鹿島線'),from:'存在しない',id:'x-none'};
 assert.equal(rowSegments(bad,lines,k),null);assert.equal(offRowAt(bad,lines,k,k.paths[0][0]),false);assert.equal(offRowEnds(bad,lines,k),null);
});
