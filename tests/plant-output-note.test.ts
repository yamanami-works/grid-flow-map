import test from 'node:test';import assert from 'node:assert/strict';
import {outputNote,retiredNote} from '../scripts/plant-output-note.mjs';import {readFileSync,readdirSync} from 'node:fs';
// 2026-10-19 オーナー承認：確認できた項目だけを書き添える。HJKS は10万kW以上の号機だけなので号機構成は未照合のまま。現在の事業者は外さない
const H={hjks:true,primary:false},P={hjks:false,primary:true};
test('HJKS に号機がある発電所は、10万kW以上の号機の出力を HJKS で確認と添える',()=>{
 assert.equal(outputNote('発電所の出力は送電線の容量・潮流として扱わない。運転状態・号機構成は未照合。',H),'発電所の出力は送電線の容量・潮流として扱わない。運転状態・号機構成は未照合（10万kW以上の号機の出力は HJKS で確認）。');
 assert.equal(outputNote('種別：水力。出力・運転状態・号機構成は未照合（発電所出力を送電容量として扱わない）。',{hjks:true,primary:true}),'種別：水力。運転状態・号機構成は未照合（10万kW以上の号機の出力は HJKS で確認。発電所出力は送電容量として扱わない）。');
 assert.equal(outputNote('運転状態・号機構成・現在の事業者は未照合。',H),'運転状態・号機構成・現在の事業者は未照合（10万kW以上の号機の出力は HJKS で確認）。');
 assert.equal(outputNote('ここで分かれる。発電所出力・運転状態は未照合。',H),'ここで分かれる。発電所の運転状態は未照合（10万kW以上の号機の出力は HJKS で確認）。');
});
test('一次資料に出力だけがある発電所は、出力の確認を添える',()=>{
 assert.equal(outputNote('出力・運転状態は未照合（発電所出力を送電容量として扱わない）。',P),'運転状態は未照合（出力は一次資料で確認。発電所出力は送電容量として扱わない）。');
 assert.equal(outputNote('運転状態・号機構成は未照合。',P),'運転状態・号機構成は未照合（出力は一次資料で確認）。');
});
test('どちらもなければ変えず、2回かけても変わらない',()=>{
 const v='出力・運転状態・号機構成は未照合（発電所出力を送電容量として扱わない）。';assert.equal(outputNote(v,{hjks:false,primary:false}),v);
 for(const s of ['発電所の出力は送電線の容量・潮流として扱わない。運転状態・号機構成は未照合。',v,'ここで分かれる。発電所出力・運転状態は未照合。','出力・運転状態は未照合。'])for(const o of [H,P]){const once=outputNote(s,o);assert.equal(outputNote(once,o),once);}
});
test('廃止が確認済みの発電所は「運転状態は未照合」を「廃止」にする（原子力は廃止措置中）（2026-10-20）',()=>{
 const N={nuclear:false},Y={nuclear:true};
 assert.equal(retiredNote('運転状態・号機構成は未照合（10万kW以上の号機の出力は HJKS で確認）。',N),'廃止。号機構成は未照合（廃止前の10万kW以上の号機の出力は HJKS で確認）。');
 assert.equal(retiredNote('運転状態・号機構成は未照合（10万kW以上の号機の出力は HJKS で確認。発電所出力は送電容量として扱わない）。',Y),'廃止（廃止措置中）。号機構成は未照合（廃止前の10万kW以上の号機の出力は HJKS で確認。発電所出力は送電容量として扱わない）。');
 assert.equal(retiredNote('運転状態は未照合（出力は一次資料で確認）。',Y),'廃止（廃止措置中）。出力は一次資料で確認。');
 assert.equal(retiredNote('発電所の運転状態は未照合（10万kW以上の号機の出力は HJKS で確認）。',N),'廃止（廃止前の10万kW以上の号機の出力は HJKS で確認）。');
 assert.equal(retiredNote('運転状態・号機構成・現在の事業者は未照合。',N),'廃止。号機構成・現在の事業者は未照合。');
 assert.equal(retiredNote('出力・運転状態・号機構成は未照合（発電所出力を送電容量として扱わない）。',N),'廃止。出力・号機構成は未照合（発電所出力を送電容量として扱わない）。');
 assert.equal(retiredNote('出力・運転状態は未照合（発電所出力を送電容量として扱わない）。',N),'廃止。出力は未照合（発電所出力を送電容量として扱わない）。');
  assert.equal(retiredNote('運転状態は未照合（10万kW以上の号機の出力は HJKS で確認）。',Y),'廃止（廃止措置中）。廃止前の10万kW以上の号機の出力は HJKS で確認。');
 for(const s of ['運転状態・号機構成は未照合（10万kW以上の号機の出力は HJKS で確認）。','運転状態は未照合（出力は一次資料で確認）。','発電所の運転状態は未照合（10万kW以上の号機の出力は HJKS で確認）。'])for(const o of [N,Y]){const once=retiredNote(s,o);assert.equal(retiredNote(once,o),once);}
});
test('配信データで、廃止が確認済みの発電所に「運転状態…は未照合」が残っていない',()=>{
 const left:string[]=[];
 for(const f of readdirSync('public/data').filter(f=>/(trunk|hokuto).json$/.test(f)))for(const x of JSON.parse(readFileSync('public/data/'+f,'utf8')).facilities??[])
  if((x.kind==='plant'||(x.alsoKinds??[]).includes('plant'))&&x.status==='廃止'&&x.statusConfirmed===true)for(const a of x.attributes??[])if(/運転状態[^。]*は未照合/.test(String(a.value)))left.push(f+' '+x.name+' '+a.label);
 assert.deepEqual(left,[]);
});
