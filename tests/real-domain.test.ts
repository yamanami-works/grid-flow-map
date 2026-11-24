import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateGeometry, changedDefinition, forecastUsage, geometryCanAnimate } from '../src/real-domain.ts';
import type { ActualLine, ForecastLine, GeoLine } from '../src/real-domain.ts';
const actual: ActualLine = { id: '0006', name: '旧線路', voltageKV: 500, from: 'A', to: 'B', note: '', values: [-25] };
const forecast: ForecastLine = { id: '0006', name: '新線路', voltageKV: 500, direction: 'A→C', circuitCount: 2, equipmentMW: 1000, capacityMW: 500, forecastMW: -600, constraint: '熱容量', note: 'フェンス№6', published: '2026年7月31日作成' };
test('same public ID is not proof of the same historical circuit or direction', () => {
  assert.equal(changedDefinition(actual, forecast), true);
  assert.equal(changedDefinition(actual, { ...forecast, name: actual.name, direction: 'B→A' }), true);
  assert.equal(changedDefinition(actual, { ...forecast, name: actual.name, direction: 'A→B' }), false);
});
test('forecast usage uses same-table values and preserves over-capacity values', () => {
  assert.equal(forecastUsage(forecast), 120);
  assert.equal(forecastUsage({ ...forecast, forecastMW: null }), null);
  assert.equal(forecastUsage({ ...forecast, capacityMW: 0 }), null);
});
test('name matches are candidates, not authority to animate a geographic line', () => {
  const line: GeoLine = { id: 'osm-1', name: '東北電力 試験Ａ線', named: true, voltageKV: 275, paths: [], osmIds: [1] };
  assert.equal(candidateGeometry({ name: '試験A線', voltageKV: 275 }, [line]).length, 1);
  assert.equal(candidateGeometry({ name: '試験A線', voltageKV: 154 }, [line]).length, 0);
  assert.equal(geometryCanAnimate({ status: 'candidate', directionVerified: false, validFor: 'forecast' }, 'forecast'), false);
  assert.equal(geometryCanAnimate({ status: 'reviewed', directionVerified: true, validFor: 'forecast' }, 'actual'), false);
});
import { inPrototypeScope } from '../src/real-domain.ts';
test('prototype admits only 500/275 kV and explicit extra-high-voltage DC', () => {
  for (const voltageKV of [500,275]) assert.equal(inPrototypeScope({voltageKV}),true);
  for (const voltageKV of [154,66,33,250]) assert.equal(inPrototypeScope({voltageKV}),false);
  assert.equal(inPrototypeScope({voltageKV:250,currentType:'dc'}),true);
  assert.equal(inPrototypeScope({voltageKV:6.6,currentType:'dc'}),false);
  assert.equal(inPrototypeScope({voltageKV:NaN,currentType:'dc'}),false);
});
import { referenceStatus } from '../src/real-domain.ts';
test('reference agreement requires every candidate to have matching IDs', () => {
  const l: GeoLine = {id:'x',name:'x',voltageKV:500,paths:[],osmIds:[1],named:true,osmRefs:['0004']};
  assert.equal(referenceStatus('0004',[l]),'matching');
  assert.equal(referenceStatus('0004',[l,{...l,osmRefs:[]}]),'missing');
  assert.equal(referenceStatus('0004',[{...l,osmRefs:['0005']}]),'conflicting');
  assert.equal(referenceStatus('0004',[]),'missing');
});
// 2026-10-10 表示速度の改善：索引を使う照合（17本以上）と、配列を順に調べる照合（16本以下）で結果と並び順が同じ
import {candidateGeometry as cg, invalidateNameIndex as inv} from '../src/real-domain.ts';
test('candidateGeometry の索引は配列を順に調べた結果と同じ（並び順・flowNames・電圧）', () => {
  const mk = (i: number, name: string, kv = 275, extra: object = {}) => ({id: 'l' + i, name, named: true, voltageKV: kv, paths: [], osmIds: [], ...extra}) as any;
  const lines = [...Array.from({length: 20}, (_, i) => mk(i, i % 3 ? '甲線' : '乙 線', i % 2 ? 275 : 500)), mk(90, '丙線', 275, {flowNames: ['甲線']}), mk(91, '甲線', 275, {named: false})];
  for (const r of [{name: '甲線', voltageKV: 275}, {name: '乙線', voltageKV: 500}, {name: '丁線', voltageKV: 275}]) {
    const slow = lines.filter((l: any) => cg(r, [l]).length).map((l: any) => l.id);
    assert.deepEqual(cg(r, lines).map((l: any) => l.id), slow);
  }
  lines[0].flowNames = ['丁線']; inv();
  assert.deepEqual(cg({name: '丁線', voltageKV: 500}, lines).map((l: any) => l.id), ['l0']);
});
