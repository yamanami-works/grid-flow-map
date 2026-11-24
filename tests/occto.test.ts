import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityReferenceUsage as usage} from '../src/occto-domain.ts';
const record={name:'線',voltageKV:275,from:'A',to:'B'};
const cap={...record,capacityMW:100};
test('OCCTO capacity must match effective direction, not just line name',()=>{assert.equal(usage(record,50,[cap]),50);assert.equal(usage(record,-50,[cap]),null);assert.equal(usage(record,-50,[{...cap,from:'B',to:'A'}]),50);});
test('OCCTO missing/ambiguous capacity cannot be low usage',()=>{assert.equal(usage(record,0,[cap]),0);for(const caps of [[],[cap,cap],[{...cap,capacityMW:0}],[{...cap,capacityMW:null}],[{...cap,voltageKV:500}]])assert.equal(usage(record,10,caps),null);});
