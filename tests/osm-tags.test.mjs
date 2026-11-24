import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentType, facilityKind } from '../scripts/osm-tags.mjs';
test('DC is explicit, missing and mixed frequency cannot become AC or DC', () => {
  assert.equal(currentType({ frequency: '0' }), 'dc');
  assert.equal(currentType({ frequency: '0;0' }), 'dc');
  assert.equal(currentType({ frequency: '50;60' }), 'ac');
  for (const frequency of [undefined, '', '0;50', 'unknown']) assert.equal(currentType({frequency}), 'unknown');
});
test('converter stations and switching stations retain distinct kinds', () => {
  assert.equal(facilityKind({power:'substation',substation:'converter'}), 'converter');
  assert.equal(facilityKind({power:'substation',substation:'switching'}), 'switchyard');
});
