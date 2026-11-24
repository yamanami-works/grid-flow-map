import {readFile,writeFile} from 'node:fs/promises';
import {tohokuSnapshot} from './tohoku-flow.mjs';
// 第3引数：線の ID を決めるための既存の1日分のファイル（運用容量が未公表の日に ID を変えないため。2026-10-30 保留33）
const date=process.argv[2]??'2026-09-20',dir=`data/raw/occto-${date}`;
const read=async f=>JSON.parse((await readFile(f,'utf8')).replace(/^\uFEFF/,''));
const actual=await read(`${dir}/actual.json`),capacity=await read(`${dir}/capacity.json`);
const geography=await read('public/data/tohoku-trunk-osm.json');
const idCapacities=process.argv[4]?(await read(process.argv[4])).capacities??[]:[];
const sources=await Promise.all(['actual','capacity'].map(k=>read(`${dir}/${k}.json.source.json`)));
const result=tohokuSnapshot(actual,capacity,date,sources,geography,idCapacities);
await writeFile(process.argv[3]??'public/data/occto-tohoku.json',JSON.stringify(result));console.log({date,lines:result.actual.lines.length,capacities:result.capacities.length,times:result.actual.times.length});
