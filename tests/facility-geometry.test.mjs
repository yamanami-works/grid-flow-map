import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRing, inFacility } from '../scripts/facility-geometry.mjs';
const square=[{lat:0,lon:0},{lat:0,lon:4},{lat:4,lon:4},{lat:4,lon:0},{lat:0,lon:0}];
test('facility containment does not turn proximity or unclosed rings into connections',()=>{
  assert.equal(inRing([2,2],square),true);
  assert.equal(inRing([0,2],square),true);
  assert.equal(inRing([4.001,2],square),false);
  assert.equal(inRing([2,2],square.slice(0,-1)),false);
});
test('multipolygon holes exclude endpoints',()=>{
  const inner=square.map(p=>({lat:1+p.lat/2,lon:1+p.lon/2}));
  assert.equal(inFacility([2,2],{type:'relation',members:[{role:'outer',geometry:square},{role:'inner',geometry:inner}]}),false);
});
