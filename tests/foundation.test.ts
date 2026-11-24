import test from 'node:test';
import assert from 'node:assert/strict';
import {canUse,displayFeature,voltageColor} from '../src/access-policy.ts';
import {datasetUrl} from '../src/data-catalog.ts';
test('free detail and flow remain available; paid and expired access fail closed',()=>{
 assert.ok(canUse('capacity-detail',null));assert.ok(canUse('flow',null));
 assert.ok(!canUse('capacity-overlay',null));assert.ok(!canUse('distribution-map',{features:['distribution-map'],expiresAt:'invalid'}));
 assert.ok(!canUse('distribution-map',{features:['distribution-map'],expiresAt:'2020-01-01'},Date.now()));
 assert.ok(!('capacity' in displayFeature));
 assert.ok(!canUse('capacity-overlay',{features:['capacity-overlay'],expiresAt:'2999-01-01'}));
 assert.ok(canUse('distribution-map',{features:['distribution-map'],expiresAt:'2030-01-01'},0));
});
test('catalog cannot expose paid data or unsafe paths via public client',()=>{
 const m:any={schemaVersion:1,datasets:[{id:'x',access:'public',feature:'trunk-map',url:'./data/a.json'}]};
 assert.equal(datasetUrl(m,'x'),'./data/a.json');
 m.datasets[0].feature='distribution-map';assert.throws(()=>datasetUrl(m,'x'));
 m.datasets[0].feature='trunk-map';m.datasets[0].url='./data/../secret.json';assert.throws(()=>datasetUrl(m,'x'));
});
test('existing voltage and DC colors remain stable',()=>{
 assert.equal(voltageColor({voltageKV:500}),'#1558ac');assert.equal(voltageColor({voltageKV:275}),'#00816f');assert.equal(voltageColor({voltageKV:250,currentType:'dc'}),'#b02fa5');
});
