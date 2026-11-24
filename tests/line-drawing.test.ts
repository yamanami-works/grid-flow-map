import test from 'node:test';import assert from 'node:assert/strict';
import {pathDash,isCaution,DOTTED,DASHED_UNKNOWN,osmWays} from '../src/line-drawing.ts';
const base={osmIds:[1,2,-3],paths:[[],[],[]]} as any;
test('owner drawing rules: underground dotted, overhead solid, unknown-route straight dashed, DC follows the same rule (2026-11-07 保留88)',()=>{
 assert.equal(pathDash({...base,cableOsmIds:[2]},1),DOTTED);assert.equal(pathDash({...base,cableOsmIds:[2]},0),'');
 assert.equal(pathDash({...base,schematicParts:[{osmId:-3,construction:'underground'}]},2),DOTTED);
 assert.equal(pathDash({...base,schematicParts:[{osmId:-3,construction:'unknown'}]},2),DASHED_UNKNOWN);
 assert.equal(pathDash({...base,schematicParts:[{osmId:-3,construction:'overhead'}]},2),'');
 assert.equal(pathDash({...base,schematic:true,construction:'unknown'},0),DASHED_UNKNOWN);
 const dc={...base,currentType:'dc'};
 assert.equal(pathDash(dc,0),'');assert.equal(pathDash({...dc,cableOsmIds:[2]},1),DOTTED);
 assert.equal(pathDash({...dc,schematicParts:[{osmId:-3,construction:'unknown'}]},2),DASHED_UNKNOWN);
 assert.equal(pathDash({...dc,status:'建設中'},0),'22 9');
});
test('要注意 is read from the line attributes (C and D tier labels)',()=>{
 assert.ok(isCaution({attributes:[{label:'要注意（C区分）',value:''}]}));assert.ok(isCaution({attributes:[{label:'要注意（D区分・ルート不明）',value:''}]}));
 assert.ok(!isCaution({attributes:[{label:'照合区分',value:'A区分'}]}));assert.ok(!isCaution({}));
});
test('収録線分は同じ way を一度だけ数える（飛騨信濃直流幹線、2026-11-07 保留84）',()=>{
 assert.deepEqual(osmWays({osmIds:[975385169,-9610001,975385169,-9610002,975217737,1330092781]}),[975385169,975217737,1330092781]);
 assert.deepEqual(osmWays({osmIds:[1,2,-3]}),[1,2]);
});
