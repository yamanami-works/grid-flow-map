import test from 'node:test';import assert from 'node:assert/strict';
import {uniqueNotes,notesSummary,flowSide,flowCardHtml,detailHtml,rowsHtml,UNKNOWN,type DetailView} from '../src/detail-panel.ts';
// 詳細パネル（2026-10-09 オーナー指示の再設計）
test('notes are de-duplicated, empty ones dropped, and summarised as 注意 n件',()=>{
 const n=uniqueNotes(['使用率は参考値です。','',null,'使用率は 参考値です。','個別の回線は未確認です。']);
 assert.deepEqual(n,['使用率は参考値です。','個別の回線は未確認です。']);
 assert.equal(notesSummary(n),'注意 2件 · 使用率は参考値です ほか');
 assert.equal(notesSummary([]),'');
});
test('inflow/outflow follows the published direction and the sign; unknown side stays null',()=>{
 assert.equal(flowSide(100,true),'流出');assert.equal(flowSide(100,false),'流入');
 assert.equal(flowSide(-100,true),'流入');assert.equal(flowSide(-100,false),'流出');
 assert.equal(flowSide(100,null),null);assert.equal(flowSide(0,true),null);assert.equal(flowSide(null,true),null);
});
test('unknown values render as grey 未確認, never as 0',()=>{
 const card=flowCardHtml({mw:null,from:'A',to:'B',time:'t',usage:null,usageColor:'#8b96a0',capacityMW:null,spark:[],sparkIndex:0});
 assert.ok(card.includes(UNKNOWN));assert.ok(!/>0<\/b>/.test(card));
 const reverse=flowCardHtml({mw:-1280,from:'上北',to:'岩手',time:'t',usage:61,usageColor:'#d99a29',capacityMW:2100,spark:[1,null,-2],sparkIndex:2});
 assert.ok(reverse.includes('<b>1,280</b> MW'));assert.ok(reverse.indexOf('岩手')<reverse.indexOf('上北'),'negative flow runs to→from');
 assert.ok(rowsHtml([{label:'設備容量',html:UNKNOWN}]).includes('dp-unknown'));
});
test('panel has 概要/出典 tabs with 44px-target controls and the sources tab holds tier, sources, notes and the verification details',()=>{
 const v:DetailView={icon:'line',iconColor:'#1558AC',title:'十和田幹線',subtitle:'送電線 · 500 kV',badges:[{text:'確度 B',tone:'muted'}],flow:'none',overview:'<p>o</p>',
  tier:{letter:'B',title:'確度 B',text:'t',scale:[{letter:'A',label:'a'},{letter:'B',label:'b'}]},sources:[{label:'潮流',name:'OCCTO',url:'https://www.occto.or.jp/'}],notes:['n1'],verification:'<p>v</p>'};
 const o=detailHtml(v,'overview');assert.ok(o.includes('aria-selected="true" data-dp-tab="overview"'));assert.ok(o.includes('<p>o</p>'));assert.ok(!o.includes('照合の詳細'));
 const s=detailHtml(v,'sources');assert.ok(s.includes('項目ごとの出典'));assert.ok(s.includes('注意 1件'));assert.ok(s.includes('照合の詳細'));assert.ok(s.includes('dp-tier-on">B'));
 assert.ok(s.includes('href="https://www.occto.or.jp/"'));
});
// 符号を反転した日だけ、潮流の欄の値・両端の下に1行（2026-11-04 オーナー承認 保留69）
test('潮流の欄：signFlipped のときだけ「向きはOCCTO公表値から反転（当サイトの判定）」の1行を出す', async ()=>{
 const base={mw:-1068,from:'南条変電所',to:'敦賀火力発電所',time:'t',usage:74,usageColor:'#d99a29',capacityMW:1447,spark:[],sparkIndex:0};
 const LINE='向きはOCCTO公表値から反転（当サイトの判定）';
 assert.ok(flowCardHtml({...base,signFlipped:true}).includes(LINE));
 assert.ok(!flowCardHtml(base).includes(LINE));
 // real.ts は note の「符号を反転」で判定する。SIGN_CHECKS の理由の文と食い違わないこと
 for(const r of ['hokuriku','tohoku','chugoku','kansai','kyushu','shikoku','tokyo']){const {SIGN_CHECKS}=await import('../src/'+r+'-domain.ts');for(const c of SIGN_CHECKS)assert.match(c.why,/符号を反転/,r+' '+c.line);}
 const {readFileSync}=await import('node:fs');
 assert.match(readFileSync('src/real.ts','utf8'),/\/符号を反転\/\.test\(r\.note\?\?''\)\?\{signFlipped:true\}/);
});
