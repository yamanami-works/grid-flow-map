// 各社の系統空容量（変圧器）の公表一覧から、変電所ごとの変圧器の一次・二次電圧を集める（public/data/substation-voltages.json）。
// 入力：data/raw/substation-banks/（中部・東京・北海道）、data/raw/network-capacity/（東北）。地図の設備への当てはめは画面側（src/substation-voltages.ts）。
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {normalizeSubstationName} from '../src/substation-voltages.ts';

const decode=buf=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(buf).replace(/^﻿/,'');}catch{return new TextDecoder('shift_jis').decode(buf);}};
const csvRows=text=>{const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}return rows;};
const kv=s=>{const n=Number(String(s).normalize('NFKC').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>0?n:null;};
const count=s=>{const n=Number(String(s).normalize('NFKC').replace(/[^0-9]/g,''));return Number.isFinite(n)&&n>0?n:null;};
const published=text=>(text.split(/\r?\n/)[0].match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/)??[]).slice(1).map((x,i)=>i?x.padStart(2,'0'):x).join('-')||null;

const regions={},sources=[];
function add(region,sourceIndex,rawName,primaryKV,secondaryKV,units){
 const name=String(rawName).replace(/^'/,'').trim();if(!name||/^\d+$/.test(name)||!primaryKV||!secondaryKV)return; // 東北の表の番号だけの行（名称非公表）は使わない
 const key=normalizeSubstationName(name),table=regions[region]??={};
 const e=table[key]??={names:[],banks:[]};if(!e.names.includes(name))e.names.push(name);
 const b=e.banks.find(x=>x.primaryKV===primaryKV&&x.secondaryKV===secondaryKV&&x.source===sourceIndex);
 if(b){if(units)b.units=(b.units??0)+units;}else e.banks.push({primaryKV,secondaryKV,...(units?{units}:{}),source:sourceIndex});
}
// 表の形式：一次・二次が別の列（中部・北海道・東北）
function simpleTable(region,file,label,url){
 const text=decode(readFileSync(file)),rows=csvRows(text);const h=rows.findIndex(r=>/^変電所\s*No/.test(r[0]??''));if(h<0)throw Error('header not found '+file);
 const i=sources.push({region,label,url,published:published(text),file:file.replace(/^data\/raw\//,'')})-1;
 for(const r of rows.slice(h+1))add(region,i,r[1],kv(r[2]),kv(r[3]),count(r[4]));
}
const sub=JSON.parse(readFileSync('data/raw/substation-banks/source.json','utf8')).sources;
for(const s of sub.filter(s=>s.region==='chubu'&&s.file.endsWith('.csv')))simpleTable('chubu','data/raw/substation-banks/'+s.file,'中部電力パワーグリッド 系統空容量・予想潮流一覧表（変電所）',s.url);
for(const s of sub.filter(s=>s.region==='kyushu'))simpleTable('kyushu','data/raw/substation-banks/'+s.file,'九州電力送配電 予想潮流・空容量一覧表（変圧器）',s.url);
for(const s of sub.filter(s=>s.region==='shikoku'))simpleTable('shikoku','data/raw/substation-banks/'+s.file,'四国電力送配電 系統空容量（変圧器）',s.url);
for(const s of sub.filter(s=>s.region==='chugoku'))simpleTable('chugoku','data/raw/substation-banks/'+s.file,'中国電力ネットワーク 系統空容量（変圧器）',s.url);
for(const s of sub.filter(s=>s.region==='kansai'))simpleTable('kansai','data/raw/substation-banks/'+s.file,'関西電力送配電 空容量一覧（変圧器）',s.url);
for(const s of sub.filter(s=>s.region==='hokuriku'))simpleTable('hokuriku','data/raw/substation-banks/'+s.file,'北陸電力送配電 予想潮流・空容量（変圧器）',s.url);
for(const s of sub.filter(s=>s.region==='hokkaido'))simpleTable('hokkaido','data/raw/substation-banks/'+s.file,'北海道電力ネットワーク 系統空容量（変圧器）',s.url);
for(const f of readdirSync('data/raw/network-capacity').filter(f=>/_tr_/.test(f)).sort())simpleTable('tohoku','data/raw/network-capacity/'+f,'東北電力ネットワーク 系統空容量（変圧器）','https://nw.tohoku-epco.co.jp/consignment/system/announcement/data/'+f);
// 東京：電圧が「500/275」の1列
for(const s of sub.filter(s=>s.region==='tokyo')){
 const text=decode(readFileSync('data/raw/substation-banks/'+s.file)),i=sources.push({region:'tokyo',label:'東京電力パワーグリッド 予想潮流・空容量（変電所）',url:s.url,published:(text.match(/(\d{4})年(\d{2})月(\d{2})日/)??[]).slice(1).join('-')||null,file:'substation-banks/'+s.file})-1;
 for(const r of csvRows(text)){const m=String(r[2]??'').normalize('NFKC').match(/^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/);if(m)add('tokyo',i,r[1],Number(m[1]),Number(m[2]),count(r[3]));}
}
for(const t of Object.values(regions))for(const e of Object.values(t))e.banks.sort((a,b)=>b.primaryKV-a.primaryKV||b.secondaryKV-a.secondaryKV);
const out={schemaVersion:1,basis:'各社の系統空容量（変圧器）の公表一覧。名称は表記ゆれ（（１）等の号機表記・「変電所」）を除いて照合する。',sources,regions};
// 出力は data/private/（2026-10-11 オーナー承認：各社の表は許諾を確認するまで public/ の外の data/private/ に置き、build:private のときだけ携帯用ビルドへコピーする。docs/RULES.md 5節）
mkdirSync('data/private',{recursive:true});writeFileSync('data/private/substation-voltages.json',JSON.stringify(out)+'\n');
console.log(Object.fromEntries(Object.entries(regions).map(([k,v])=>[k,Object.keys(v).length])),'sources',sources.length);
