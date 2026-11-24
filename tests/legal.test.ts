// 利用規約・プライバシーポリシー・免責・データソース（2026-11-16 保留117）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEGAL_DOCS,LEGAL_ORDER,legalLinksHtml,LEGAL_DIALOG_HTML,CONTACT_FORM_URL,OCCTO_URL} from '../src/legal.ts';
import {DISPLAY_MARKS} from '../scripts/check-publish.mjs';

const ALLOWED_LINKS=[CONTACT_FORM_URL,OCCTO_URL,'https://www.openstreetmap.org/copyright','https://maps.gsi.go.jp/development/ichiran.html','https://maps.gsi.go.jp/development/vt.html'];
const all=LEGAL_ORDER.map(k=>LEGAL_DOCS[k].body).join('\n');

test('3つの文書とリンクがある',()=>{
 assert.deepEqual(LEGAL_ORDER.map(k=>LEGAL_DOCS[k].title),['利用規約','プライバシーポリシー','免責・データソース']);
 const html=legalLinksHtml();
 assert.equal((html.match(/<button type="button" class="legal-link" data-legal="(terms|privacy|disclaimer)">/g)??[]).length,3);
 assert.match(LEGAL_DIALOG_HTML,/<dialog id="legal-dialog"/);assert.match(LEGAL_DIALOG_HTML,/id="legal-close"/);
});
test('外部からの読み込みがなく、外へのリンクは決めたものだけ',()=>{
 assert.doesNotMatch(all,/<(img|script|iframe|object|embed|link|style|form|input)\b/i);
 assert.doesNotMatch(all,/\son\w+=/i);
 const hrefs=[...all.matchAll(/href="([^"]*)"/g)].map(m=>m[1]);
 assert.ok(hrefs.length>0);
 for(const h of hrefs)assert.ok(ALLOWED_LINKS.includes(h),'許可していないリンク：'+h);
 for(const m of all.matchAll(/<a\b[^>]*>/g))assert.match(m[0],/rel="noopener noreferrer"/);
});
test('事実の記載がルールと合う（Cookie・解析なし、潮流は OCCTO のみ、空欄なし）',()=>{
 assert.match(LEGAL_DOCS.privacy.body,/Cookie、アクセス解析、広告、位置情報/);
 assert.match(LEGAL_DOCS.disclaimer.body,/OCCTO の公表実績だけ/);
 assert.match(LEGAL_DOCS.disclaimer.body,/0 で埋めず/);
 assert.doesNotMatch(all,/［|○月/);
 assert.doesNotMatch(all,/両端は分かるが/,'直線には推定の端点もある（RULES 3節）');
});
test('画面：サイドバー最下部と ⓘ にリンクを置き、ⓘ の免責から詳しい文書へ',()=>{
 const src=readFileSync('src/real.ts','utf8');
 assert.match(src,/id="real-footer">読み込み中…<\/div><nav class="legal-links sidebar-legal"[^>]*>\$\{legalLinksHtml\(\)\}<\/nav><\/aside>/);
 assert.match(src,/data-legal="disclaimer">詳しくは免責・データソース<\/button>/);
 assert.match(src,/\$\{legalLinksHtml\(\)\}<\/nav><h3>お問い合わせ<\/h3>/);
 assert.match(src,/<\/dialog>\$\{LEGAL_DIALOG_HTML\}`;/);
 assert.ok(src.includes(CONTACT_FORM_URL),'問い合わせフォームの URL が ⓘ と同じ');
 assert.match(src,/\nbindLegal\(\);/);
});

// 2026-11-16 保留118（オーナー指示「案２でかっこの文は残して」）：出典表示は免責・データソースだけ、ⓘ の免責は1行
test('出典の画面：出典表示は免責・データソースに、ⓘ には免責1行と詳しくはリンク',()=>{
 const src=readFileSync('src/real.ts','utf8'),info=src.slice(src.indexOf('<dialog id="real-info">'),src.indexOf('</dialog>',src.indexOf('<dialog id="real-info">')));
 const d=LEGAL_DOCS.disclaimer.body;
 for(const [mark,label] of DISPLAY_MARKS)if(mark!=='判断には使わないでください')assert.ok(d.includes(mark),label+'が免責・データソースにない：'+mark);
 assert.ok(info.includes('<div class="callout"><p class="callout-text">このアプリは、公表資料と OpenStreetMap などをもとにした参考表示です（接続先の推測を含みます）。系統運用や電力取引などの判断には使わないでください。</p><button type="button" class="legal-link callout-more" data-legal="disclaimer">'),'ⓘ の免責は1行と詳しくはリンク');
 for(const s of ['保証しません','個人の作成物','ベクトルタイル','背景地図：国土地理院','ODbL 1.0 で提供','openstreetmap.org','occto.or.jp'])assert.ok(!info.includes(s),'ⓘ に重複が残る：'+s);
});
