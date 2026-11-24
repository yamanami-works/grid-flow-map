import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {plansForRegion,plansMarkup,plansTableMarkup,planTargetOf,planNeedsReview,type ChangePlan,type PlanTarget} from '../src/change-plans.ts';import {actualFlowSource,regionSourceNote} from '../src/primary-sources.ts';import {externalLink} from '../src/safe-html.ts';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const plans:ChangePlan[]=read('data/validation/hokkaido-change-plans.json').plans;
test('published plans are unique, limited, asset-linked and revision-preserving',()=>{
 assert.equal(plans.length,14);assert.equal(new Set(plans.map(p=>p.id)).size,14);
 const h=read('public/data/hokkaido-hokuto.json'),dc=read('public/data/tohoku-dc-osm.json');const ids=new Set([...h.lines,...h.facilities,...dc.lines,...dc.facilities].map(x=>x.assetId));
 for(const p of plans){assert.ok(p.revisions.length);assert.equal(p.application.status,'未反映');for(const t of p.targets)for(const id of t.assetIds)assert.ok(ids.has(id));for(const r of p.revisions){assert.ok(['2026-03-30','2024-06-27'].includes(r.source.publishedAt!));assert.ok(r.source.url.startsWith('https://www.hepco.co.jp/'));assert.ok(r.source.checkedAt);}}
 assert.deepEqual(h.changePlans,plans);assert.equal(plansForRegion(plans,'tohoku').length,1);assert.equal(plansForRegion(plans,'hokkaido').length,14);assert.equal(plansForRegion(plans,'national').length,14);
 assert.equal(plansForRegion(plans,'tokyo').length,0);assert.match(plansMarkup(plans,'tokyo'),/記録済みの変更予定はありません/);
 // 2026-10-03：北海道は公開データ（catalog の hokkaido-trunk）。系統変更予定の単独ファイルは公開しない
 assert.doesNotMatch(JSON.stringify(read('public/data/catalog.json')),/change-plans/);assert.ok(read('public/data/catalog.json').datasets.some((d:any)=>d.id==='hokkaido-trunk'));
});
test('approximate timing, unknown, postponement and elapsed time never change source state',()=>{
 const p=structuredClone(plans[0]);let r=p.revisions[0];r.timing=[{label:'使用開始',raw:'2027年度',precision:'fiscal-year',year:2027}];
 assert.equal(planNeedsReview(p,Date.parse('2028-03-31T14:59:59Z')),false);assert.equal(planNeedsReview(p,Date.parse('2028-03-31T15:00:00Z')),true);
 assert.match(plansMarkup([p],'national',Date.parse('2029-01-01')),/2027年度/);assert.match(plansMarkup([p],'national',Date.parse('2029-01-01')),/予定時期経過・運用開始未確認/);assert.equal(r.status,'計画中');
 const earlier=structuredClone(r);r={...r,status:'延期',timing:[{label:'使用開始',raw:'未定',precision:'unknown'}]};p.revisions.push(r);assert.equal(planNeedsReview(p,Date.parse('2040-01-01')),false);assert.match(plansMarkup([p],'national'),/延期/);assert.deepEqual(p.revisions[0],earlier);
 const q=structuredClone(plans[1]);q.revisions[0].timing=[{label:'使用開始',raw:'2033年度以降',precision:'fiscal-year',year:2033,qualifier:'on-or-after'}];assert.equal(planNeedsReview(q,Date.parse('2040-01-01')),false);
 assert.equal(plansForRegion([p,q],'national').at(-1)?.id,p.id);
 p.revisions.at(-1)!.status='中止';assert.match(plansMarkup([p],'national'),/中止/);
});
test('plan rendering escapes content and rejects unsafe external URLs',()=>{
 const p=structuredClone(plans[0]);p.targets[0].name='<img src=x onerror=alert(1)>';p.revisions[0].source.url='javascript:alert(1)';const html=plansMarkup([p],'national');assert.ok(!html.includes('<img'));assert.ok(!html.includes('href="javascript:'));assert.match(html,/&lt;img/);
});

test('source reading is not a progress freshness check; published plans remain pending',()=>{
 for(const p of plans){assert.equal(p.latestProgressReview?.checkedAt,null);const html=plansMarkup([p],'national');assert.match(html,/資料を確認した日：2026-09-27/);assert.match(html,/予定・工事進捗の最新性を確認した日：未確認/);assert.match(html,/公表後の予定変更・工事進捗の最新性は未確認/);}
 const g=plans.find(p=>p.id==='plan-hokkaido-otaru-g-branch')!;assert.equal(g.revisions.length,2);assert.equal(g.revisions[0].timing[0].raw,'2029年2月');assert.equal(g.revisions[1].timing[0].raw,'2033年度以降');
 const elapsed=plans.find(p=>p.id==='plan-hokkaido-otaru-bank-2026')!;assert.equal(planNeedsReview(elapsed,Date.parse('2026-09-27')),true);assert.equal(elapsed.revisions[0].status,'工事中');assert.equal(elapsed.application.status,'未反映');
});
// 地図の上の一覧の表（2026-11-03 オーナー承認、保留59）
test('一覧の表：記録済みの assetId が地図に一致する対象だけ押せ、両端だけの対応は押せず、記録の対応と要注意を併記する',()=>{
 const all:ChangePlan[]=[...read('public/data/hokkaido-hokuto.json').changePlans,...read('public/data/tokyo-trunk.json').changePlans];
 assert.equal(all.length,25); // 2026-11-05 相馬双葉幹線の接続変更（保留78）で +1
 const geo=['hokkaido-hokuto','tokyo-trunk','chubu-trunk','tohoku-trunk','tohoku-dc-osm'].map(n=>read(`public/data/${n}.json`));
 const resolve=(id:string):PlanTarget|null=>{for(const g of geo){const l=g.lines.find((l:any)=>l.id===id||l.assetId===id);if(l)return {kind:'line',id:l.id};}for(const g of geo){const f=g.facilities.find((f:any)=>f.id===id||f.assetId===id);if(f)return {kind:'facility',id:f.id};}return null;};
 const html=plansTableMarkup(all,'national',resolve,Date.parse('2026-11-03'));
 assert.equal((html.match(/class="plan-more"/g)??[]).length,25);
 assert.equal((html.match(/class="plan-target"/g)??[]).length,21);
 assert.equal((html.match(/class="plan-map-note"/g)??[]).length,8);
 assert.equal(all.flatMap(p=>p.targets).filter(t=>planTargetOf(t,resolve)).length,21);
 const marumori=all.find(p=>p.id==='tohoku-tokyo-marumori-2026')!.targets[0];assert.ok(marumori.assetIds.some(id=>resolve(id)));assert.equal(planTargetOf(marumori,resolve),null);
 assert.match(html,/<b class="plan-caution">要注意<\/b>対応：OSMの建設中の経路に対応/);
 assert.match(html,/全計画の網羅は保証せず/);assert.match(html,/予定だけで現行地図を更新しません/);assert.match(html,/予定時期経過・運用開始未確認/);
 assert.match(plansTableMarkup(all,'national',null,Date.now(),'確認中'),/（確認中）/);assert.doesNotMatch(plansTableMarkup(all,'national',null),/class="plan-target"/);
 assert.match(plansTableMarkup(all,'kansai',resolve),/記録済みの変更予定はありません/);
});
test('一覧の表：名前・ID・出典はエスケープし、記録のない項目でも止まらない',()=>{
 const p=structuredClone(plans[0]);p.targets[0].name='<img src=x onerror=alert(1)>';p.targets[0].mapping='<b>';p.revisions[0].source.url='javascript:alert(1)';delete p.unknowns;delete p.application;delete p.updateRequired;
 const html=plansTableMarkup([p],'national',()=>({kind:'line',id:'"><script>'}));
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.match(html,/&lt;img/);assert.match(html,/data-plan-id="&quot;&gt;&lt;script&gt;"/);assert.match(html,/対応：&lt;b&gt;/);assert.match(html,/記録なし/);
});
test('一次情報欄：OCCTO のリンクの文言と、地域の資料の前の1行',()=>{
 const real=readFileSync('src/real.ts','utf8');
 assert.match(real,/function occtoLink\(\)\{return externalLink\(actualFlowSource\.url,actualFlowSource\.label\)\.replace\(' ↗<\/a>','<\/a>'\);\}/);
 assert.equal(actualFlowSource.label,'潮流：OCCTO系統情報サービス（公式）');assert.equal(regionSourceNote,'系統情報は一般送配電会社の資料を参照');
 assert.ok(!externalLink(actualFlowSource.url,actualFlowSource.label).replace(' ↗</a>','</a>').includes('↗'));
});
// 参考資料の1行（2026-11-07 オーナー回答 保留83）：計画がない地域でも表の説明の下に出る。https のみ・新しいタブ・noopener
test('系統変更予定の表の説明の下に参考資料「広域整備計画の進捗状況」を出す',()=>{
 for(const html of [plansTableMarkup(plans,'tokyo',null),plansTableMarkup(plans,'hokkaido',null),plansMarkup(plans,'national')]){
  assert.match(html,/<p class="plans-reference">参考資料：<a href="https:\/\/www\.occto\.or\.jp\/assets\/iinkai\/kouikikeitouseibi\/103\/seibi_103_04_01\.pdf" target="_blank" rel="noopener noreferrer"[^>]*>広域整備計画の進捗状況（電力広域的運営推進機関・2026年度第1四半期・2026年9月1日・PDF） ↗<\/a><\/p>/);
  const next=['<table','記録済みの変更予定はありません','<article'].map(k=>html.indexOf(k)).filter(i=>i>=0);assert.ok(next.length&&html.indexOf('plans-reference')<Math.min(...next),'説明の下・表（一覧）の上');
  assert.ok(html.indexOf('状況は公表資料時点です。')<html.indexOf('plans-reference'),'説明の下');
 }
});
// 問い合わせ窓口（2026-11-09 オーナー指示）：情報ダイアログの末尾に Google フォームへのリンク。https のみ・新しいタブ・noopener noreferrer・共有元の引数（usp=）なし
test('情報ダイアログの末尾に問い合わせフォームのリンクを出す',()=>{
 const real=readFileSync('src/real.ts','utf8');
 assert.equal(real.split('docs.google.com').length-1,1,'docs.google.com は1回だけ');
 const a='<a target="_blank" rel="noopener noreferrer" href="https://docs.google.com/forms/d/e/1FAIpQLScoZSI0GlK0r3gUO46iH8uY6hTkYfxUbq3HaOp71GKIxVEcvQ/viewform">お問い合わせフォーム（Google フォーム） ↗</a>';
 assert.ok(real.includes('<h3>お問い合わせ</h3>'+a+'<p>誤りや追加情報要望等をいただければ幸いです。</p><p class="small-copy">Google フォーム（外部サイト）が新しいタブで開きます。送信した内容は Google のサービスで扱われます。</p></dialog>'),'</dialog> の直前');
 assert.ok(!/docs\.google\.com[^"]*usp=/.test(real),'usp= なし');
 // 2026-11-16 保留118：出典のリンクは ⓘ から免責・データソース（src/legal.ts）へ移した
 assert.ok(!real.includes('ベクトルタイル（試験公開）を加工 ↗</a>'),'出典のリンクは ⓘ に置かない');
});
test('地図下部の時刻パネル：文だけの白枠を出さず、携帯で潮流を開いたときは時刻の操作を残す（2026-11-22 保留141）',()=>{
 const real=readFileSync('src/real.ts','utf8'),css=readFileSync('src/real.css','utf8');
 assert.ok(!real.includes('輪郭を強調した線は選択中の送電線'),'「輪郭を強調した線は…」の文は出さない');
 assert.ok(real.includes(`$('#real-time').classList.toggle('no-timeline', !timeline && flowBasis !== 'forecast');`),'時刻の操作がないときは no-timeline');
 assert.ok(css.includes('.real-time.no-timeline{display:none}'),'PC では出さない');
 assert.ok(css.includes('@media(max-width:760px){#app.mobile-flow-open #real-time.no-timeline{display:flex}}'),'携帯で潮流を開いたときは出す');
});
test('地図下部の時刻パネル：設備モードでも時刻の操作を出す（2026-11-24：PC で設備をクリックすると消えていた）',()=>{
 const real=readFileSync('src/real.ts','utf8');
 const body=real.slice(real.indexOf('function renderTime()'),real.indexOf('function render()'));
 assert.ok(body.includes(`const timeline = !!official && flowBasis !== 'forecast' && mode !== 'forecast';`),'予想潮流の表示以外は時刻の操作を出す');
 assert.ok(!body.includes(`mode === 'actual' || mode === 'geo'`),'送電線・潮流実績だけに限る条件は残さない');
});
