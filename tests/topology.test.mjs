import { test } from 'node:test';
import assert from 'node:assert/strict';
import { components, terminals, distanceMeters } from '../scripts/topology.mjs';
const way = (id, nodes) => ({id, nodes, geometry:nodes.map(n=>({lat:40+n/1000,lon:140}))});
test('connectivity follows node IDs including shared interior nodes, not proximity', () => {
  assert.equal(components([way(1,[1,2,3]),way(2,[4,2,5]),way(3,[6,7])]).length,2);
  const a=way(1,[1,2]), b={...way(2,[3,4]),geometry:a.geometry};
  assert.equal(components([a,b]).length,2);
});
test('terminal detection respects branches and loops', () => {
  assert.deepEqual(terminals([way(1,[1,2,3]),way(2,[2,4])]).map(t=>t.node).sort(),[1,3,4]);
  assert.equal(terminals([way(1,[1,2,3,1])]).length,0);
  assert.equal(distanceMeters([40,140],[40,140]),0);
  assert.ok(distanceMeters([40,140],[41,140])>111000);
});
import { traceToFacilities } from '../scripts/topology.mjs';
test('tracing stops at a facility and does not absorb an outgoing circuit',()=>{
  const ways=new Map([[1,way(1,[1,2])],[2,way(2,[2,3])],[3,way(3,[3,4])]]);
  const nodes=new Map([[1,new Set([1])],[2,new Set([1,2])],[3,new Set([2,3])],[4,new Set([3])]]);
  assert.deepEqual(traceToFacilities([1],ways,nodes,id=>id===3),[1,2]);
  assert.deepEqual(traceToFacilities([1],ways,nodes,()=>false),[1,2,3]);
});
