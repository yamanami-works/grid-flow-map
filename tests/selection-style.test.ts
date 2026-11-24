import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionStrokes} from '../src/selection-style.ts';
import {lineWidth,particleWidth} from '../src/line-style.ts';
import {hitWidth} from '../src/line-hit.ts';
test('selection is a passive neutral outline independent of flow, leaving voltage width and hit width unchanged',()=>{
 for(const kv of [500,275,187,154,66,250])for(const type of ['ac','dc']){
  const [outer,gap]=selectionStrokes(kv,type),w=lineWidth(kv);
  assert.equal(outer.weight,w+7);assert.equal(gap.weight,w+4);
  assert.equal(outer.color,'#34434b');assert.equal(gap.color,'#fff');
  assert.equal(outer.interactive,false);assert.equal(gap.interactive,false);
  assert.equal(outer.dashArray,undefined);assert.equal(outer.lineCap,'butt');
  assert.equal(particleWidth(kv),w*.75);assert.equal(hitWidth(w,kv),w*(kv===66?5:3));
  for(const flow of [0,null,10,60,90])assert.deepEqual(selectionStrokes(kv,type),[outer,gap],String(flow));
 }
});
