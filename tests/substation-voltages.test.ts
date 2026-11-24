import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {normalizeSubstationName,voltageEvidence,bankSummary,TABLE_ORDER,type SubstationVoltageTable} from '../src/substation-voltages.ts';

// 各社の表は data/private/（Git の管理外）。手元にないとき（新しく取り出した直後など）は表を使うテストを飛ばす
const PRIVATE='data/private/substation-voltages.json',hasTable=existsSync(PRIVATE);
const table:SubstationVoltageTable=hasTable?JSON.parse(readFileSync(PRIVATE,'utf8')):{schemaVersion:1,regions:{}} as unknown as SubstationVoltageTable;
const fac=(name:string,voltages:number[],kind:'substation'|'switchyard'|'converter'|'plant'='substation')=>({id:'f-'+name,name,kind,position:[0,0] as [number,number],voltages,url:''});

test('表記ゆれ（号機・バンク番号・変電所）を除いて照合する',()=>{
  assert.equal(normalizeSubstationName('犬山変電所（１）'),'犬山');
  assert.equal(normalizeSubstationName('遠江変電所(2)'),'遠江');
  assert.equal(normalizeSubstationName('新野田11・12・14B'),'新野田');
  assert.equal(normalizeSubstationName('戸塚3，4，5'),'戸塚');
  assert.equal(normalizeSubstationName('新富士21B22B'),'新富士');
  assert.equal(normalizeSubstationName("'下北"),'下北');
  assert.equal(normalizeSubstationName('上北変換所'),'上北変換所'); // 変換所は同名の変電所と別設備
});

test('公表変圧器の一次・二次電圧を電圧区分に加える',{skip:!hasTable&&'data/private/ なし'},()=>{
  const e=voltageEvidence(fac('東部変電所',[500]),[],table,TABLE_ORDER.chubu);
  assert.deepEqual(e.voltages,[500,275]);
  assert.match(bankSummary(e.banks),/500\/275kV×4台/);
  const t=voltageEvidence(fac('新栃木変電所',[500]),[],table,TABLE_ORDER.tokyo);
  assert.deepEqual(t.voltages,[500,275,154]);
});

test('地図の設備の電圧と重ならない同名の表は別設備として使わない',{skip:!hasTable&&'data/private/ なし'},()=>{
  const e=voltageEvidence(fac('雫石開閉所',[275],'switchyard'),[],table,TABLE_ORDER.tohoku);
  assert.equal(e.banks.length,0);
  assert.deepEqual(e.voltages,[275]);
});

test('地域の境の設備は隣の会社の表で見つける（新北信は中部）',{skip:!hasTable&&'data/private/ なし'},()=>{
  const e=voltageEvidence(fac('新北信変電所',[275]),[],table,TABLE_ORDER.tohoku);
  assert.match(e.banks[0].sourceLabel,/中部電力/);
  assert.deepEqual(e.voltages,[275,77]);
});

test('接続する収録線路の電圧も根拠にする（発電所は変圧器の表と照合しない）',{skip:!hasTable&&'data/private/ なし'},()=>{
  const line={id:'l',name:'x',voltageKV:500,paths:[],osmIds:[],named:true,connections:[{node:1,position:[0,0] as [number,number],status:'facility-area' as const,facilities:[{id:'f-知多火力発電所',name:''}],neighborWays:[]}]};
  const e=voltageEvidence(fac('知多火力発電所',[],'plant'),[line],table,TABLE_ORDER.chubu);
  assert.deepEqual(e.voltages,[500]);assert.equal(e.banks.length,0);
});
