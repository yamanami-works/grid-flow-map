import test from 'node:test';
import assert from 'node:assert/strict';
import {endpointConflict} from '../src/flow-quality.ts';
test('different endpoints are held; reversed direction is not a conflict',()=>{
 const r={name:'試験幹線',voltageKV:275,from:'甲変電所',to:'乙変電所'};
 assert.equal(endpointConflict(r,[{...r,direction:'甲変電所→発電所'}]),true);
 assert.equal(endpointConflict(r,[{...r,direction:'乙変電所→甲変電所'}]),false);
});
test('勿来幹線：OCCTOの1行（須賀川→いわき）は東北NWの勿来幹線＋勿来支線にまたがるため端点不一致として除外しない',()=>{
 const lines=[{name:'勿来幹線',voltageKV:275,direction:'須賀川変電所→発電所'},{name:'勿来支線',voltageKV:275,direction:'勿来幹線分岐→いわき変電所'}];
 assert.equal(endpointConflict({name:'勿来幹線',voltageKV:275,from:'須賀川変電所',to:'いわき変電所'},lines),false);
 assert.equal(endpointConflict({name:'勿来幹線',voltageKV:275,from:'須賀川変電所',to:'新いわき開閉所'},lines),true);
});
