import test from 'node:test';
import assert from 'node:assert/strict';
import {latestIndex} from '../src/occto-time.ts';
test('latest public time skips unpublished slots and accepts zero and reverse flow',()=>{
 const snapshot={actual:{times:['00:00','00:30','01:00','01:30'],lines:[{values:[10,0,null,null]},{values:[null,-20,null,null]}]}};
 assert.equal(latestIndex(snapshot),1);
 snapshot.actual.lines[0].values[2]=0;
 assert.equal(latestIndex(snapshot),2);
});
