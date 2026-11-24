import test from 'node:test';import assert from 'node:assert/strict';
import {capacityUsageInfo,isWorkCapacity,combinedRowGroups} from '../src/occto-domain.ts';import {flowCardHtml,flowCardNotes} from '../src/detail-panel.ts';
// 2026-10-10 オーナー指示：使用率＝OCCTOの行の潮流÷同じ行の運用容量。逆潮流は正方向の運用容量で参考算出。運用容量がなければ不明（代用しない）
const row={name:'A線',voltageKV:500,from:'甲',to:'乙'};
const caps=[{name:'A線',voltageKV:500,from:'甲',to:'乙',capacityMW:1000}];
test('同じ向きの運用容量で算出し、100%超も切り捨てない',()=>{
 assert.deepEqual(capacityUsageInfo(row,800,caps),{usage:80,capacityMW:1000,reverse:false,from:'甲',to:'乙',capacityState:'ok'});
 assert.equal(capacityUsageInfo(row,1350,caps).usage,135);
});
test('逆潮流は正方向の運用容量で参考算出（reverse）',()=>{
 const r=capacityUsageInfo(row,-500,caps);assert.equal(r.usage,50);assert.equal(r.reverse,true);assert.equal(r.from,'乙');
});
test('運用容量がない・0なら不明（代用しない）。負の値は絶対値で算出（保留76）',()=>{
 assert.equal(capacityUsageInfo(row,500,[]).usage,null);
 assert.equal(capacityUsageInfo(row,500,[{...caps[0],capacityMW:0}]).usage,null);
 assert.equal(capacityUsageInfo(row,600,[{...caps[0],capacityMW:-3000}]).usage,20);
});
// 2026-11-03 オーナー承認（保留67）：潮流の欄はどの線でも同じ形（見出し「潮流 実績」・値・両端・バー・使用率の行）。その線だけの事情は注意（flowCardNotes）に出す
test('分岐を含む行も使用率を出し「行単位の値」は注意に、逆潮流も注意に、100%超は「運用容量超過」',()=>{
 const base={mw:1350,from:'甲',to:'乙',time:'10:00',usage:135,usageColor:'#8e3fbf',capacityMW:1000,spark:[],sparkIndex:0};
 const h=flowCardHtml({...base,reference:['B分岐線']});
 assert.match(h,/135%/);assert.match(h,/運用容量超過/);assert.doesNotMatch(h,/行単位の値|dp-flow-ref|容量比なし/);
 assert.match(flowCardNotes({...base,reference:['B分岐線']})[0],/^OCCTO公表の行単位の値（区間ごとの値ではない）。分岐（B分岐線）/);
 const rev={...base,mw:-500,usage:50,reverse:true};
 assert.doesNotMatch(flowCardHtml(rev),/参考|使用率は参考/);assert.match(flowCardHtml(rev),/<span>潮流 実績<\/span>/);
 assert.match(flowCardNotes(rev).join(),/逆潮流のため、正方向の運用容量で使用率を算出/);
 assert.deepEqual(flowCardNotes('none'),[]);assert.deepEqual(flowCardNotes(base),[]);
});
test('注意の文はエスケープしない素の文（表示側でエスケープ）',()=>{
 const n=flowCardNotes({mw:1,from:'甲',to:'乙',time:'',usage:null,usageColor:'',capacityMW:null,spark:[],sparkIndex:0,combined:['A&B線','C<D線']});
 assert.match(n[0],/A&B線・C<D線/);
});
test('潮流0 MW は欄では「0 MW」、公表値「0」の意味は注意に',()=>{
 const z={mw:0,from:'甲',to:'乙',time:'',usage:0,usageColor:'#fff',capacityMW:500,spark:[],sparkIndex:0};
 assert.match(flowCardHtml(z),/<b>0<\/b> MW/);assert.doesNotMatch(flowCardHtml(z),/空欄＝欠測/);
 assert.ok(flowCardNotes(z).includes('0 MW（OCCTOの公表値が「0」。空欄＝欠測とは別）'));
});

// 2026-10-10 オーナー指示：運用容量0は zero（表示は 2026-11-04 保留77 で容量不明と同じ「未確認 運用容量 0 MW」＋注意。それまでは「停止中/運用容量0」）、負の値は絶対値で算出（2026-11-04 オーナー指示 保留76。それまでは「未確認（負の値で公表）」）、99999以上は設定なしとして分母に使わない
const capOf=(capacityMW:number|null)=>[{name:'A線',voltageKV:500,from:'甲',to:'乙',capacityMW}];
test('運用容量0は zero（停止中の可能性）',()=>{const i=capacityUsageInfo(row,100,capOf(0));assert.equal(i.usage,null);assert.equal(i.capacityState,'zero');assert.equal(capacityUsageInfo(row,-100,capOf(0)).capacityState,'zero');});
test('負の運用容量は negative で、絶対値で使用率を出す（同じ向き・逆向きとも）',()=>{const i=capacityUsageInfo(row,150,capOf(-300));assert.equal(i.usage,50);assert.equal(i.capacityState,'negative');assert.equal(i.capacityMW,-300);assert.equal(i.reverse,false);
 const r=capacityUsageInfo(row,-60,capOf(-300));assert.equal(r.usage,20);assert.equal(r.capacityState,'negative');assert.equal(r.capacityMW,-300);assert.equal(r.reverse,true);});
test('99999以上は設定なし（none）で分母に使わない',()=>{const i=capacityUsageInfo(row,100,capOf(99999));assert.equal(i.usage,null);assert.equal(i.capacityState,'none');assert.equal(i.capacityMW,null);});
test('潮流0は使用率0%',()=>{const i=capacityUsageInfo(row,0,capOf(500));assert.equal(i.usage,0);assert.equal(i.capacityState,'ok');});
test('カード：運用容量0・負の値・なしの表示',()=>{const base={mw:100,from:'甲',to:'乙',time:'10:00',usage:null,usageColor:'#d3d9de',spark:[],sparkIndex:0};
 const zero={...base,capacityMW:0,capacityState:'zero' as const};const ZERO_NOTE='運用容量 0 MW で公表（停止中の可能性）。使用率は未確認です。';
 assert.match(flowCardHtml(zero),/<span class="dp-unknown">未確認<\/span><span class="dp-sub"> 運用容量 0 MW<\/span>/);assert.doesNotMatch(flowCardHtml(zero),/停止中|dp-cap-zero/);
 assert.equal(flowCardNotes(zero).filter(n=>n===ZERO_NOTE).length,1);
 for(const s of ['ok','negative','none'] as const)assert.ok(!flowCardNotes({...base,usage:s==='none'?null:50,capacityMW:s==='none'?null:s==='ok'?200:-200,capacityState:s}).includes(ZERO_NOTE),s);
 const neg={...base,usage:50,usageColor:'#fff',capacityMW:-300,capacityState:'negative' as const};
 assert.match(flowCardHtml(neg),/50%<\/b><span class="dp-sub"> 運用容量 -300 MW 比/);assert.doesNotMatch(flowCardHtml(neg),/未確認|符号の意味/);
 assert.deepEqual(flowCardNotes(neg).filter(n=>n.includes('負の値')),['運用容量が負の値（-300 MW）で公表。符号の意味は OCCTO の項目説明に記載がないため、絶対値（300 MW）で算出した参考値です（当サイトの判断。向きの対応も未確認）。']);
 const none=flowCardHtml({...base,capacityMW:null,capacityState:'none'});assert.match(none,/dp-unknown">未確認/);assert.match(none,/<div class="dp-flow-foot"><span><span class="dp-unknown">未確認<\/span><\/span><\/div>/);assert.doesNotMatch(none,/運用容量なし|適用できる/);});

// 2026-10-10 オーナー指示：（他社）・港北線は分母に使わない、連系線は時刻別の運用容量、作業時の注記、複数線合計の行
test('excluded の容量の行は分母に使わず理由を返す',()=>{const i=capacityUsageInfo(row,100,[{...caps[0],excluded:'理由'}]);assert.equal(i.usage,null);assert.equal(i.capacityState,'none');assert.equal(i.excluded,'理由');});
test('excluded の行と通常の行があれば通常の行を使う',()=>{assert.equal(capacityUsageInfo(row,500,[{...caps[0],capacityMW:2000,excluded:'x'},caps[0]]).usage,50);});
test('時刻別の運用容量（連系線）はその時刻の値で割る',()=>{const c=[{...caps[0],capacityValues:[1000,500,null]}];
 assert.equal(capacityUsageInfo(row,400,c,1).usage,80);assert.equal(capacityUsageInfo(row,400,c,1).timed,true);assert.equal(capacityUsageInfo(row,400,c,2).capacityState,'none');assert.equal(capacityUsageInfo(row,400,c).usage,40);});
test('作業の制約要因',()=>{assert.ok(isWorkCapacity('熱容量（作業）'));assert.ok(!isWorkCapacity('熱容量'));assert.equal(capacityUsageInfo(row,100,[{...caps[0],constraint:'熱容量（作業）'}]).constraint,'熱容量（作業）');});
test('同じ値の並びで線名が違う行を合計の行として束ねる',()=>{const v=[1,2,null];assert.deepEqual(combinedRowGroups([{name:'甲',values:v},{name:'乙',values:[...v]},{name:'丙',values:[0,0,null]},{name:'丁',values:[0,0,null]}]),[['甲','乙']]);});
test('注意：合計・作業・除外・時刻別の注記（欄には出さない）',()=>{const base={mw:100,from:'甲',to:'乙',time:'10:00',usage:null,usageColor:'#d3d9de',capacityMW:null,spark:[],sparkIndex:0};
 const all={...base,combined:['西播東岡山線','山崎智頭線'],workCapacity:'熱容量（作業）',capacityExcluded:'（他社）の行',timedCapacity:true};
 const n=flowCardNotes(all).join(' / ');
 assert.match(n,/OCCTO公表の2線合計の値/);assert.match(n,/作業時の運用容量/);assert.match(n,/（他社）の行/);assert.match(n,/運用容量は時刻別/);
 assert.doesNotMatch(flowCardHtml(all),/合計の値|作業時|（他社）|時刻別/);});
test('残した運用容量（capacityRetrievedAt）は使用率の算出に使い、取得時刻を注意に1行出す（2026-10-30 保留34、2026-11-03 保留67で欄から注意へ）',()=>{
 const kept=[{...caps[0],capacityRetrievedAt:'2026-10-25T01:05:00.000Z'}];
 const r=capacityUsageInfo(row,800,kept);assert.equal(r.usage,80);assert.equal(r.capacityRetrievedAt,'2026-10-25T01:05:00.000Z');
 assert.equal(capacityUsageInfo(row,-500,kept).capacityRetrievedAt,'2026-10-25T01:05:00.000Z');
 assert.equal(capacityUsageInfo(row,800,caps).capacityRetrievedAt,undefined);
 const card={mw:800,from:'甲',to:'乙',time:'10:00',usage:80,usageColor:'#fff',capacityMW:1000,spark:[],sparkIndex:0};
 assert.ok(flowCardNotes({...card,capacityRetrievedAt:r.capacityRetrievedAt}).includes('運用容量は 10/25 10:05 JST 取得の値（その後の取得では OCCTO が未公表）。'));
 assert.doesNotMatch(flowCardHtml({...card,capacityRetrievedAt:r.capacityRetrievedAt}),/取得の値/);assert.deepEqual(flowCardNotes(card),[]);
});
