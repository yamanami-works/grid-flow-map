import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCapacity} from '../src/capacity-comparison.ts';
test('capacity comparison distinguishes value, direction, constraint and missing values',()=>{
 const a={capacityMW:100,direction:'A→B',constraint:'熱容量'},b={capacityMW:100,from:'A',to:'B',constraint:'熱容量'};
 assert.deepEqual(compareCapacity(a,b),[]);
 assert.equal(compareCapacity(a,{...b,capacityMW:90}).length,1);
 assert.equal(compareCapacity(a,{...b,from:'B',to:'A'}).length,1);
 assert.equal(compareCapacity(a,{...b,capacityMW:null}).length,1);
 assert.equal(compareCapacity(a,{...b,constraint:'安定度'}).length,1);
});
