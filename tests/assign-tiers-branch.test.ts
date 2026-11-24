import test from 'node:test';import assert from 'node:assert/strict';
import {classify} from '../scripts/assign-tiers.mjs';
// 2026-11-10 保留106（オーナー回答「案B」）：「途中で分岐する無名線分」は線が通る区間だけで判定する。way がその先へ続く点（線の端から2km超）も分岐に数える
// 節点は北へ 0.05度（約5.5km）ずつ並べる
const P=(k:number)=>[35+0.05*k,135];
function idx(ways:{id:number,nodes:number[],tags?:any}[]){
 const W=new Map(ways.map(w=>[w.id,{...w,tags:{power:'line',voltage:'275000',...(w.tags??{})}}])),deg=new Map<number,Set<number>>(),nodes=new Map<number,number[]>();
 for(const w of W.values())for(const n of w.nodes){nodes.set(n,P(n));if(!deg.has(n))deg.set(n,new Set());deg.get(n)!.add(w.id);}
 return {ways:W,deg,nodes};
}
const line=(segs:[number,number[]][])=>{const paths=segs.map(([,ns])=>ns.map(P));return {id:'t',name:'試験線',voltageKV:275,osmIds:segs.map(([id])=>id),paths,
 attributes:[{label:'公表区間',value:'試験'}],connections:[{position:paths[0][0],facilities:[{id:'a',name:'甲変電所'}]},{position:paths.at(-1)!.at(-1),facilities:[{id:'b',name:'乙変電所'}]}]};};
const fb=new Map();
test('使わない区間の分岐は数えない（B）',()=>{
 // way 1 は節点 1〜9。線は 1〜5 だけ使い、端は 1 と 5。節点 8 に別の線（way 2）が付く。way 1 が先へ続く点（5）は線の端なので数えない
 const r=classify(line([[1,[1,2,3,4,5]]]),idx([{id:1,nodes:[1,2,3,4,5,6,7,8,9]},{id:2,nodes:[8,20]}]),fb);
 assert.equal(r.tier,'B',JSON.stringify(r.reasons));
});
test('使う区間の分岐は数える（C）',()=>{
 const r=classify(line([[1,[1,2,3,4,5]]]),idx([{id:1,nodes:[1,2,3,4,5]},{id:2,nodes:[3,20]}]),fb);
 assert.equal(r.tier,'C');assert.ok(r.reasons.includes('途中で分岐する無名線分'));
});
test('way が線の途中でその先へ続く点は分岐に数える（C）',()=>{
 // 線は way 1 の 1〜3 から way 3 の 3→13〜15 へ移る。way 1 は 3 の先（4・5）へ続く。点 3 は両端から2km超
 const r=classify(line([[1,[1,2,3]],[3,[3,13,14,15]]]),idx([{id:1,nodes:[1,2,3,4,5]},{id:3,nodes:[3,13,14,15]}]),fb);
 assert.equal(r.tier,'C');assert.ok(r.reasons.includes('途中で分岐する無名線分'));
});
test('経路の点と way の節点が照合できなければ止める',()=>{
 const l=line([[1,[1,2,3]]]);l.paths=[[[0,0],[0,1]]];
 assert.throws(()=>classify(l,idx([{id:1,nodes:[1,2,3]}]),fb),/照合できない/);
});
