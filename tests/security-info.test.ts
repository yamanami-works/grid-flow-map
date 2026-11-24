import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
// ⓘ「セキュリティ上の考え方」（2026-11-22 指示）：資源エネルギー庁「系統情報の公表の考え方」（令和8年4月改定）26ページ（４）の転記
test('ⓘのセキュリティ上の考え方：原文の転記・注51・出典・リンク',()=>{
 const src=readFileSync('src/real.ts','utf8');const i=src.indexOf('<h3>セキュリティ上の考え方</h3>'),j=src.indexOf('<h3>利用規約など</h3>');
 assert.ok(i>0&&j>i&&src.indexOf('<h3>公表データの扱い</h3>')<i,'公表データの扱いの後、利用規約などの前');
 const sec=src.slice(i,j).replace(/<[^>]+>/g,'');
 const body='電力系統は、一般送配電事業者及び配電事業者以外も含め多種多様な利用者（利用を検討する者）が存在することに鑑みれば、その運用も含め広く説明責任が果たされるべきであり、セキュリティという言葉の下で行われてきた旧来の運用・慣行は厳に改められるべきである。そこで、以下のような公安上の必要性などを除き、系統情報は公表することが適当である注51。ただし第三者情報について、社会的要請などに基づいて第三者の合意を得た上で開示する場合には、この限りではない。';
 assert.ok(sec.includes(body));
 assert.ok(sec.includes('○ 国家や地方公共団体の重要な機能を担う施設、機能喪失により広く社会的に影響を与え得ることが懸念される重要施設への供給系統・供給設備に関する情報'));
 assert.ok(sec.includes('○ 第三者情報（特定の電力の供給契約に係る契約条件に係る事項等）'));
 assert.ok(sec.includes('注51 情報の内容によっては、開示・提示に当たって一定の身元確認・秘密保持誓約を求めることなどを妨げるものではない。'));
 assert.ok(sec.includes('「（４）セキュリティの確保」')&&sec.includes('令和8年4月改定')&&sec.includes('2026-11-22 確認'));
 assert.ok(src.slice(i,j).includes('target="_blank" rel="noopener noreferrer" href="https://www.enecho.meti.go.jp/category/electricity_and_gas/electric/summary/regulations/pdf/keitou_kangaekata_20260401.pdf"'));
 assert.ok(!/オーナー|保留\d/.test(src.slice(i,j)));
});
