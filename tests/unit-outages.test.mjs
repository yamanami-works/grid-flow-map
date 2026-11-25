// 原子力以外の号機の運転状態（HJKS 停止情報一覧、scripts/hjks-outages.mjs・scripts/fetch-hjks-outages.mjs・src/unit-outages.ts）。2026-11-24 保留149。
// HJKS の CSV の原本はリポジトリに入れない。同じ形の小さな CSV をここで組み立てて試す。
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCsv,buildUnitOutages,validateUnitOutages,HEADER,HJKS_NAME,HJKS_URL} from '../scripts/hjks-outages.mjs';
import {fetchOutagesCsv,mapUnits} from '../scripts/fetch-hjks-outages.mjs';
import {unitOutageView} from '../src/unit-outages.ts';

const NOW=new Date('2026-11-24T12:00:00+09:00');
const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
// データの行は末尾にカンマが付く（実物と同じ）
const row=({code='10001',unit='１号機',kind='計画停止',from='2026/11/15 22:00',to='2026/11/26',fmt='火力（ガス）',cause='原因',up='2026/11/24 09:00'}={})=>
 ['東京','会社',code,'A発電所',fmt,unit,'600000',kind,kind==='出力低下'?'低下・その他':'停止・定期検査等',kind==='出力低下'?'100000':'',from,'あり',to,cause,up].map(q).join(',')+',';
const filler=n=>Array.from({length:n},(_,i)=>row({code:'Z'+i,up:'2026/11/01 00:00'}));
const csv=rows=>[HEADER.join(','),...rows,...filler(1000)].join('\r\n')+'\r\n';
const UNITS=[{facilityId:'f1',code:'10001',unit:'１号機',format:'火力（ガス）'},{facilityId:'f1',code:'10001',unit:'２号機',format:'火力（ガス）'},{facilityId:'f2',code:'20001',unit:'単独',format:'水力'},{facilityId:'n1',code:'30001',unit:'１号機',format:'原子力（BWR）'}];

test('CSV：引用符の中の改行・"" を読める',()=>{
  assert.deepEqual(parseCsv('a,"b\r\nc","d""e"\r\n1,2,3\r\n'),[['a','b\r\nc','d"e'],['1','2','3']]);
  assert.throws(()=>parseCsv('a,"b'),/引用符/);
});

test('照合：コード＋ユニット名の完全一致だけ・区分と日付だけを出す・原子力は除く',()=>{
  const b=buildUnitOutages(csv([row(),row({unit:'1号機'}),row({code:'20001',unit:'単独',kind:'出力低下',from:'2026/11/20 00:00',to:''}),row({code:'30001',fmt:'原子力（BWR）'})]),UNITS,NOW);
  assert.deepEqual(b.units,{f1:{'１号機':{kind:'計画停止',from:'2026-11-15',to:'2026-11-26'}},f2:{'単独':{kind:'出力低下',from:'2026-11-20',to:null}}});
  assert.equal(b.latestUpdate,'2026-11-24T09:00');
  assert.ok(!JSON.stringify(b.units).includes('原因'));
});

test('今の判定：これからの予定・復旧予定日を過ぎた登録・9999年は出さない。今日が復旧予定日なら出す',()=>{
  const b=buildUnitOutages(csv([row({from:'2026/11/24 13:00'}),row({unit:'２号機',to:'2026/11/23'}),row({unit:'２号機',from:'9999/12/27 15:00'}),row({code:'20001',unit:'単独',to:'2026/11/24'})]),UNITS,NOW);
  assert.deepEqual(Object.keys(b.units),['f2']);
  assert.equal(b.skipped9999,1);
});

test('復旧予定日が9999年は「復旧予定未定」として出す',()=>{
  const b=buildUnitOutages(csv([row({to:'9999/12/31'})]),UNITS,NOW);
  assert.deepEqual(b.units.f1['１号機'],{kind:'計画停止',from:'2026-11-15',to:null});
  assert.equal(b.recovery9999,1);
});

test('優先順：計画外停止＞計画停止＞出力低下',()=>{
  const b=buildUnitOutages(csv([row({kind:'出力低下'}),row({kind:'計画外停止',to:''}),row()]),UNITS,NOW);
  assert.equal(b.units.f1['１号機'].kind,'計画外停止');
});

test('形が違えば失敗：見出し・知らない区分・日付の形・行が少ない',()=>{
  assert.throws(()=>buildUnitOutages(csv([]).replace('停止区分','区分'),UNITS,NOW),/見出し/);
  assert.throws(()=>buildUnitOutages(csv([row({kind:'停止'})]),UNITS,NOW),/区分/);
  assert.throws(()=>buildUnitOutages(csv([row({from:'2026-11-15'})]),UNITS,NOW),/停止日時/);
  assert.throws(()=>buildUnitOutages(csv([row({to:'11/26'})]),UNITS,NOW),/復旧予定日/);
  assert.throws(()=>buildUnitOutages([HEADER.join(','),row()].join('\n'),UNITS,NOW),/少ない/);
});

const data=(units={})=>({schemaVersion:1,source:{name:HJKS_NAME,url:HJKS_URL},latestUpdate:'2026-11-24T09:00',retrievedAt:'2026-11-24T10:00:00+09:00',sha256:'a'.repeat(64),units});
test('配信データの検証：決まった形・語だけ',()=>{
  validateUnitOutages(data({'tokyo-place-日本製鉄鹿島火力発電所':{'単独':{kind:'計画停止',from:'2026-11-15',to:null}}}));
  assert.throws(()=>validateUnitOutages({...data(),source:{name:HJKS_NAME,url:'https://hjks.jepx.or.jp/hjks/outages'}}),/形が違う/);
  assert.throws(()=>validateUnitOutages(data({f1:{'１号機':{kind:'停止',from:'2026-11-15',to:null}}})),/号機・状態/);
  assert.throws(()=>validateUnitOutages(data({f1:{'<b>':{kind:'計画停止',from:'2026-11-15',to:null}}})),/号機・状態/);
  assert.throws(()=>validateUnitOutages(data({f1:{'１号機':{kind:'計画停止',from:'2026-11-15',to:null,cause:'x'}}})),/号機・状態/);
});

test('画面の語：年付きの日付・登録なしと古いときは出さない',()=>{
  const d=data({f1:{'１号機':{kind:'計画外停止',from:'2025-12-01',to:null},'２号機':{kind:'計画停止',from:'2026-11-15',to:'2026-11-26'}}});
  assert.deepEqual(unitOutageView(d,'f1','１号機',NOW),{text:'計画外停止中 2025/12/01〜 復旧予定未定',tone:'unplanned'});
  assert.deepEqual(unitOutageView(d,'f1','２号機',NOW),{text:'計画停止中 2026/11/15〜 復旧予定2026/11/26',tone:'stop'});
  assert.equal(unitOutageView(d,'f1','３号機',NOW),null);
  assert.equal(unitOutageView(d,'f1','１号機',new Date('2026-11-27T12:00:00+09:00')),null);
  assert.equal(unitOutageView(null,'f1','１号機',NOW),null);
  // 取得後に復旧予定日を過ぎた登録は出さない（停止中とは言えない）
  assert.equal(unitOutageView(d,'f1','２号機',new Date('2026-11-27T01:00:00+09:00')),null);
});

test('取得：ページの Cookie と _csrf を付けて CSV を送信で受け取る（ほかの Cookie・形の違う _csrf は使わない）',async()=>{
  const calls=[];const tok='0123abcd-0000-4000-8000-0123456789ab';
  const fake=async(url,init={})=>{calls.push({url,init});
    if(!init.method)return new Response(`<form><input type="hidden" name="_csrf" value="${tok}"></form>`,{status:200,headers:[['set-cookie','JSESSIONID=ABC123; Path=/hjks; HttpOnly'],['set-cookie','other=x'],['set-cookie','bad=a b']]});
    return new Response('x',{status:200,headers:{'content-type':'text/csv;charset=MS932'}});};
  await fetchOutagesCsv({fetchImpl:fake});
  assert.equal(calls[1].init.method,'POST');
  assert.equal(calls[1].init.headers.Cookie,'JSESSIONID=ABC123; other=x');
  const body=new URLSearchParams(calls[1].init.body);
  assert.equal(body.get('csv'),'csv');assert.equal(body.get('_csrf'),tok);assert.equal(body.get('plantcd'),'');
  const noSession=async()=>new Response('<form></form>',{status:200,headers:[['set-cookie','other=x']]});
  await assert.rejects(fetchOutagesCsv({fetchImpl:noSession}),/Cookie/);
  const noCsrf=async(url,init={})=>new Response('<form></form>',{status:200,headers:[['set-cookie','JSESSIONID=ABC']]});
  await assert.rejects(fetchOutagesCsv({fetchImpl:noCsrf}),/_csrf/);
  const html=async(url,init={})=>init.method?new Response('<html>',{status:200,headers:{'content-type':'text/html'}}):fake(url,init);
  await assert.rejects(fetchOutagesCsv({fetchImpl:html}),/CSV ではない/);
});

test('地図の号機：運転中の HJKS の号機だけ。配信中のデータは検証を通り、原子力の号機を含まない',()=>{
  assert.deepEqual(mapUnits({plants:{a:{units:[{code:'1',unit:'１号機',status:'運転中',format:'水力'},{code:'1',unit:'２号機',status:'運転終了'}]}}}),[{facilityId:'a',code:'1',unit:'１号機',format:'水力'}]);
  const d=validateUnitOutages(JSON.parse(readFileSync('public/data/unit-outages.json','utf8')));
  const pu=JSON.parse(readFileSync('public/data/plant-units.json','utf8').replace(/^﻿/,''));
  for(const [fid,units] of Object.entries(d.units))for(const name of Object.keys(units)){
    const u=pu.plants[fid]?.units.find(x=>x.unit===name);
    assert.ok(u&&u.status==='運転中'&&!/^原子力/.test(u.format??''),fid+' '+name);
  }
});

test('照合のキー：1つの設備の運転中の号機で、コードが違うのに同じユニット名のものはない（設備 ID＋ユニット名で取り違えない）',()=>{
  const pu=JSON.parse(readFileSync('public/data/plant-units.json','utf8').replace(/^﻿/,''));
  for(const [fid,p] of Object.entries(pu.plants)){const seen=new Map();for(const u of p.units){if(u.status!=='運転中')continue;assert.ok(!seen.has(u.unit)||seen.get(u.unit)===u.code,fid+' '+u.unit);seen.set(u.unit,u.code);}}
});

test('MS932 の読み取り：Node の TextDecoder（full-icu）で shift_jis が使える',()=>{
  assert.equal(new TextDecoder('shift_jis',{fatal:true}).decode(Uint8Array.from([0x92,0xe2,0x8e,0x7e])),'停止');
});
