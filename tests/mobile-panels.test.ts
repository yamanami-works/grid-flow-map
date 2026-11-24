import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {isTap,TAP_MAX_MOVE_PX,TAP_MAX_MS,KEEP_OPEN_SELECTOR} from '../src/mobile-panels.ts';
// 2026-11-22 保留142：携帯の「選択」「設備を探す」は外側のタップで閉じる。保留144：潮流も閉じる（地図の操作ボタンでは閉じない）。ドラッグ・ピンチでは閉じない
test('タップの判定：移動量と時間がしきい値以内だけ',()=>{
 assert.ok(isTap(0,0,50));assert.ok(isTap(TAP_MAX_MOVE_PX,0,TAP_MAX_MS));
 assert.ok(!isTap(TAP_MAX_MOVE_PX+1,0,50),'ドラッグ');assert.ok(!isTap(0,0,TAP_MAX_MS+1),'長押し');
 assert.ok(KEEP_OPEN_SELECTOR.includes('dialog[open]')&&KEEP_OPEN_SELECTOR.includes('#detail'),'ダイアログ・詳細の中では閉じない');
});
test('外側タップで閉じるのは「選択」「設備を探す」「潮流」、携帯幅だけ',()=>{
 const real=readFileSync('src/real.ts','utf8');const m=real.match(/bindOutsideTapClose\(\[(.*)\],\(\)=>matchMedia\('\(max-width:760px\)'\)\.matches\);/);
 assert.ok(m,'携帯幅だけで動かす');
 assert.ok(m![1].includes('close:closeMobileLayers')&&m![1].includes('close:closeMobileBrowse'));
 assert.ok(m![1].includes("inside:'#map-flow-key,#real-time,#mobile-flow-toggle,.map-controls,.basemaps',close:closeMobileFlow"),'潮流も閉じる。凡例・時刻・潮流ボタン・地図の操作ボタンの中では閉じない');
});
test('携帯の上段：「選択」の文字、潮流は「選択」の下（マークなし）',()=>{
 const real=readFileSync('src/real.ts','utf8'),css=readFileSync('src/real.css','utf8');
 assert.ok(real.includes('aria-label="選択（地域・電圧・設備の表示設定）" aria-expanded="false" aria-controls="mobile-layers">選択</button>'));
 assert.ok(real.includes('aria-controls="map-flow-key real-time">潮流</button>')&&!real.includes('≋'));
 assert.ok(css.includes('#mobile-flow-toggle{display:block;position:absolute;z-index:490;left:12px;top:66px;'));
 assert.ok(css.includes('#mobile-flow-toggle{top:118px}.mobile-map-filters{top:170px}'),'幅340px以下');
});
