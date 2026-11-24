// 発電所の属性にある「出力・運転状態・号機構成は未照合」などの文言を、確認できた項目に合わせて置き換える（2026-10-19 オーナー承認）。
// - HJKS（public/data/plant-units.json）に号機がある発電所：「（10万kW以上の号機の出力は HJKS で確認）」を添える（号機構成は未照合のまま）。
// - HJKS になく、一次資料（docs/research/plant-primary-sources.json）の detail に出力（kW）がある発電所：「…（出力は一次資料で確認）」を添える。
// - 廃止が確認済み（status「廃止」・statusConfirmed:true）の発電所は、「運転状態は未照合」を「廃止」に置き換える（原子力は「廃止（廃止措置中）」。2026-10-20 オーナー承認）。未確認の廃止は変えない。
// - 「現在の事業者は未照合」は変えない。元の採用データ（docs/research の *-adopted.json など）は書き換えず、builder の取り込みの最後（scripts/jpower.mjs）で置き換える。
import {readFileSync,existsSync} from 'node:fs';
const UNITS='public/data/plant-units.json',PRIMARY='docs/research/plant-primary-sources.json';
export function outputNote(value,{hjks,primary}){
  if(!hjks&&!primary)return value;
  // HJKS に載るのは認可出力10万kW以上の号機だけなので、号機構成は未照合のまま残す（2026-10-19 変更レビュー）
  const tail=hjks?'（10万kW以上の号機の出力は HJKS で確認）':'（出力は一次資料で確認）';
  return value
    .replace(/発電所出力・運転状態は未照合(?!（(10万kW以上|出力は一次))/g,'発電所の運転状態は未照合'+tail)
    .replace(/出力・運転状態・号機構成は未照合(?!（(10万kW以上|出力は一次))/g,'運転状態・号機構成は未照合'+tail)
    .replace(/(?<!発電所の)出力・運転状態は未照合(?!（(10万kW以上|出力は一次))/g,'運転状態は未照合'+tail)
    .replace(/運転状態・号機構成(・現在の事業者)?は未照合(?!（(10万kW以上|出力は一次))/g,(m,owner)=>'運転状態・号機構成'+(owner??'')+'は未照合'+tail)
    // 括弧が続くときは1つにまとめる（2026-10-20 オーナー承認）
    .replace(/（(10万kW以上の号機の出力は HJKS で確認|出力は一次資料で確認)）（発電所出力を送電容量として扱わない）/g,'（$1。発電所出力は送電容量として扱わない）');
}
export function retiredNote(value,{nuclear}){
  const w='廃止'+(nuclear?'（廃止措置中）':'');
  return value
    // 廃止の発電所では、HJKS の出力は廃止前の号機のものと分かるようにする（2026-10-20 オーナー承認）
    .replace(/(?<!廃止前の)10万kW以上の号機の出力は HJKS で確認/g,'廃止前の10万kW以上の号機の出力は HJKS で確認')
    .replace(/出力・運転状態・号機構成は未照合/g,w+'。出力・号機構成は未照合')
    .replace(/(?:発電所)?出力・運転状態は未照合/g,w+'。出力は未照合')
    .replace(/(?:発電所の)?運転状態・号機構成(・現在の事業者)?は未照合/g,(m,owner)=>w+'。号機構成'+(owner??'')+'は未照合')
    .replace(/(?:発電所の)?運転状態は未照合（((?:廃止前の10万kW以上の号機の出力は HJKS で確認|出力は一次資料で確認)(?:。発電所出力は送電容量として扱わない)?)）/g,(m,x)=>/^廃止前/.test(x)&&!nuclear?w+'（'+x+'）':w+'。'+x)
    .replace(/(?:発電所の)?運転状態は未照合/g,w);
}
export function applyOutputNotes(facilities){
  const units=existsSync(UNITS)?JSON.parse(readFileSync(UNITS,'utf8').replace(/^﻿/,'')).plants:{};
  const prim=existsSync(PRIMARY)?JSON.parse(readFileSync(PRIMARY,'utf8')).plants:{};
  let n=0;
  for(const f of facilities){if(f.kind!=='plant'&&!(f.alsoKinds??[]).includes('plant'))continue;
    const hjks=(units[f.id]?.units??[]).length>0,primary=/\d[\d,.]*\s*(万)?kW/.test(prim[f.id]?.detail??'');
    const retired=f.status==='廃止'&&f.statusConfirmed===true,nuclear=/^原子力/.test(f.plantType?.label??'');
    for(const a of f.attributes??[]){let v=outputNote(String(a.value),{hjks,primary});if(retired)v=retiredNote(v,{nuclear});if(v!==a.value){a.value=v;n++;}}}
  return n;
}
