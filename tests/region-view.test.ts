import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
// 地域の切替の位置（2026-11-09 オーナー指示）：全国に切り替えたときは今の位置を保つ。ほかの地域は前回の位置か全体へ移る
test('全国に切り替えたときは地図の位置を動かさない',()=>{
 const real=readFileSync('src/real.ts','utf8');
 const start=real.indexOf("$('#region-select').onchange=");assert.ok(start>=0,'地域の切替の処理がある');
 const body=real.slice(start,real.indexOf('\n};',start));
 const keep=body.indexOf("if(region==='national'&&!pilot?.active){/* 位置を保つ */}");assert.ok(keep>=0,'全国の分岐がある');
 const other=body.indexOf("else{const view=regionViews.get(region);if(view&&!pilot?.active)map.setView(view.center,view.zoom,{animate:false});else fitAll();}");
 assert.ok(other>keep,'ほかの地域は前回の位置（regionViews）か全体（fitAll）へ移る処理が、全国の分岐の後に残る');
 assert.ok(body.indexOf('regionViews.set(region,')<keep,'切替前の位置の保存は残る');
 assert.equal(body.split('setView(').length-1,1,'setView は他の地域の分岐の1か所だけ');
 assert.equal(body.split('fitAll()').length-1,1,'fitAll は他の地域の分岐の1か所だけ');
});
