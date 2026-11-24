import test from 'node:test';
import assert from 'node:assert/strict';
import {lineWidth,particleWidth,lineWidthProfile} from '../src/line-style.ts';
import {selectionStrokes} from '../src/selection-style.ts';
import {hitWidth} from '../src/line-hit.ts';
test('regional widths bind to asset identity, not selected region or voltage alone',()=>{
 const hk=[{id:'hk275',assetId:'a'},{id:'hk187',assetId:'b'}];
 for(const region of ['hokkaido','national','tohoku']){
  for(const [id,kv,w] of [['hk275',275,6],['hk187',187,3.5]] as const){
   const profile=lineWidthProfile({id},hk);
   assert.equal(lineWidth(kv,profile,'ac'),w,region);
   assert.equal(particleWidth(kv,profile,'ac'),w*.75);
   assert.equal(hitWidth(w,kv),w*3);
   assert.equal(selectionStrokes(kv,'ac',profile)[0].weight,w+7);
  }
  assert.equal(lineWidth(275,lineWidthProfile({id:'tohoku'},hk),'ac'),3.5);
 }
 assert.equal(lineWidthProfile({id:'shared',assetId:'a'},hk),'hokkaido');
 assert.equal(lineWidth(275,'hokkaido','unknown'),3.5);
 assert.equal(lineWidth(250,'hokkaido','dc'),2.8);
 assert.deepEqual([500,275,154,66].map(k=>lineWidth(k)),[6,3.5,2.8,2]);
});
