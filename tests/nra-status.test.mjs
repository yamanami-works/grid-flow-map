// 原子力の運転状態の読み取り（scripts/nra-status.mjs）と画面の照合（src/nuclear-status.ts）。2026-11-10 保留110。
// 規制委のページの原本はリポジトリに入れない（docs/RULES.md 5節）。同じ形の小さな HTML をここで組み立てて試す。
import test from 'node:test';import assert from 'node:assert/strict';
import {parseNraStatus,validateNuclearStatus,KNOWN_PLANTS,STATUSES,NRA_URL,NRA_NAME} from '../scripts/nra-status.mjs';
import {nuclearUnitStatus,NRA_PLANT_IDS} from '../src/nuclear-status.ts';
const page=(plants,summary)=>`<p>最終更新日：2026年10月29日</p><ul>${STATUSES.map(s=>`<li><dl><dt class="status">${s}<span class="t-note">（注1）</span>\n</dt><dd>1 発電所</dd><dd>${summary[s]??0} 基</dd></dl></li>`).join('')}</ul>`+
 Object.entries(plants).map(([id,u])=>`<h3 id="${id}">会社　発電所の現在の運転状況</h3>\n<ul class="plant__info">\n${Object.entries(u).map(([n,s])=>`  <li>${n} : <span class="status_status-x">${s}</span></li>`).join('\n')}\n</ul>`).join('\n');
const all=()=>Object.fromEntries(KNOWN_PLANTS.map(id=>[id,{'1号機':'停止中'}]));
const count=p=>{const c={};for(const u of Object.values(p))for(const s of Object.values(u))c[s]=(c[s]??0)+1;return c;};
test('規制委のページ：決まった id・号機・状態の語だけを読み、概況の基数と照合する',()=>{
 const p=all();p.onagawa={'1号機':'廃止措置中','2号機':'運転中','3号機':'停止中'};p.tokai2={'-':'停止中'};
 const r=parseNraStatus(page(p,count(p)));
 assert.equal(r.pageUpdated,'2026-10-29');assert.deepEqual(r.plants.onagawa,p.onagawa);assert.deepEqual(r.plants.tokai2,{'-':'停止中'});
});
test('規制委のページ：形が違えば失敗（基数の不一致・知らない語・知らない発電所・欠け）',()=>{
 const p=all();
 assert.throws(()=>parseNraStatus(page(p,{...count(p),停止中:1})),/基数/);
 const q=all();q.tomari={'1号機':'点検中'};assert.throws(()=>parseNraStatus(page(q,count(q))),/知らない状態/);
 const r={...all(),unknownplant:{'1号機':'停止中'}};assert.throws(()=>parseNraStatus(page(r,count(r))),/知らない発電所/);
 const s=all();delete s.sendai;assert.throws(()=>parseNraStatus(page(s,count(s))),/発電所の数/);
 assert.throws(()=>parseNraStatus('<p>なし</p>'),/最終更新日/);
});
const data={schemaVersion:1,source:{name:NRA_NAME,url:NRA_URL},pageUpdated:'2026-10-29',retrievedAt:'2026-11-10T16:55:30+09:00',sha256:'0'.repeat(64),plants:{onagawa:{'2号機':'運転中','3号機':'停止中'},tokai2:{'-':'停止中'},tsuruga:{'1号機':'廃止措置中','2号機':'停止中'}}};
test('画面の照合：号機の番号（全角も）で当て、番号のない号機は「-」、古い取得・対応のない発電所は出さない',()=>{
 validateNuclearStatus(data);const now=new Date('2026-11-11T09:00:00+09:00');
 assert.equal(nuclearUnitStatus(data,'osm-way-1341021071','女川原子力発電所２号機',now),'運転中');
 assert.equal(nuclearUnitStatus(data,'osm-way-1341021071','女川原子力発電所3号機',now),'停止中');
 assert.equal(nuclearUnitStatus(data,'osm-relation-1527911','単独',now),'停止中');
 assert.equal(nuclearUnitStatus(data,'osm-way-449155824','2号機',now),'停止中');
 assert.equal(nuclearUnitStatus(data,'osm-way-1341021071','女川原子力発電所9号機',now),null);
 assert.equal(nuclearUnitStatus(data,'osm-way-xxxx','1号機',now),null);
 assert.equal(nuclearUnitStatus(data,'osm-way-1341021071','2号機',new Date('2026-11-13T09:00:00+09:00')),null);
 // 東海（tokai）と東海第二（tokai2）を取り違えない
 assert.equal(NRA_PLANT_IDS['osm-relation-1527911'],'tokai2');assert.equal(NRA_PLANT_IDS['japc-tokai-1'],'tokai');
 for(const id of Object.values(NRA_PLANT_IDS))assert.ok(KNOWN_PLANTS.includes(id),id);
});
test('配信データの形：ページの文字列が入らない（決まった id・号機・状態の語だけ）',()=>{
 assert.throws(()=>validateNuclearStatus({...data,plants:{onagawa:{'2号機':'<b>運転中</b>'}}}));
 assert.throws(()=>validateNuclearStatus({...data,plants:{'<x>':{'1号機':'運転中'}}}));
 assert.throws(()=>validateNuclearStatus({...data,retrievedAt:'2026-11-10'}));
 assert.throws(()=>validateNuclearStatus({...data,source:{...data.source,name:'<任意の文字列>'}}));
});
