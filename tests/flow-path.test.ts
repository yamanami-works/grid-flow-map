import assert from 'node:assert/strict';
import test from 'node:test';
import {referenceFlowPath} from '../src/flow-path.ts';
const record={id:'1',name:'線',voltageKV:275,from:'A',to:'B',note:'',values:[10]};
const line={id:'x',name:'線',voltageKV:275,named:true,osmIds:[1],paths:[[[0,0],[0,1],[0,2]]],connections:[{position:[0,0],facilities:[{name:'A'}]},{position:[0,2],facilities:[{name:'B'}]}]};
test('reference path follows actual geometry from public start to end',()=>{assert.deepEqual(referenceFlowPath(record,[line]),line.paths[0]);assert.deepEqual(referenceFlowPath({...record,from:'B',to:'A'},[line]),[...line.paths[0]].reverse());});
test('reference path rejects missing endpoints, gaps and conflicting IDs',()=>{assert.equal(referenceFlowPath({...record,to:'C'},[line]),null);assert.equal(referenceFlowPath(record,[{...line,osmRefs:['2']}]),null);assert.equal(referenceFlowPath(record,[{...line,osmIds:[1,2],paths:[[[0,0],[0,0.5]],[[0,1],[0,2]]]}]),null);});

test('separate source ID namespaces still require geography endpoints',()=>{assert.deepEqual(referenceFlowPath(record,[{...line,osmRefs:['2']}],false),line.paths[0]);assert.equal(referenceFlowPath({...record,to:'C'},[line],false),null);});
