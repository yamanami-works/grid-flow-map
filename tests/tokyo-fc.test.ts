import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reviewedTokyoDay} from '../src/tokyo-domain.ts';import {referenceFlowPath} from '../src/flow-path.ts';
import {typicalDay} from '../scripts/flow-shape.mjs';// いつもの表の形の最新の日（保留93。最新日だけ形が違う日に落ちないように）
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
import {rawSkip} from './raw-data.mjs';
const fc=read('docs/research/tokyo-500-fc-adopted.json');
// 原本（data/raw）を使うテストは、公開リポジトリの Actions では原本がないときだけ飛ばす（tests/raw-data.mjs、2026-11-01 保留44）
test('FC and plant-line edges follow acquired ways of the same current type and voltage',{skip:rawSkip('data/raw/tokyo-500/north.json','data/raw/tokyo-500/south.json','data/raw/tokyo-500-support/lines.json','data/raw/tokyo-500-support/fc-lines.json')},()=>{
 const S='data/raw/tokyo-500-support/';const raw=[...read('data/raw/tokyo-500/north.json').elements,...read('data/raw/tokyo-500/south.json').elements,...read(S+'lines.json').elements,...read(S+'fc-lines.json').elements];
 const nodes=new Map(raw.filter(e=>e.type==='node').map(n=>[n.id,[n.lat,n.lon]]));
 const dc=(w:any)=>w.tags.frequency==='0'||/直流/.test(w.tags.name??'');
 const edges=new Set(raw.filter(w=>w.type==='way'&&['line','cable'].includes(w.tags?.power)).flatMap(w=>w.nodes.slice(1).map((n:number,i:number)=>(dc(w)?'dc':'ac')+'|'+JSON.stringify([nodes.get(w.nodes[i]),nodes.get(n)].sort()))));
 for(const l of fc.lines)for(const p of l.paths)for(let i=1;i<p.length;i++)assert.ok(edges.has(l.currentType+'|'+JSON.stringify([p[i-1],p[i]].sort())),l.name);
});
test('only explicitly approved lines may be DC; converters and plants are typed',()=>{
 const approval=read('config/tokyo-approval.json'),d=read('public/data/tokyo-trunk.json');
 for(const l of d.lines)if(l.currentType!=='ac')assert.equal(approval.lineCurrentTypes[l.assetId],l.currentType,l.name);
 assert.deepEqual(Object.keys(approval.lineCurrentTypes),['tokyo-fc-hida-shinano-dc']);
 assert.deepEqual(d.facilities.filter((f:any)=>f.kind==='converter').map((f:any)=>f.name).sort(),['佐久間周波数変換所','新信濃変電所','東清水変電所','飛騨変換所'].sort());
 // 2026-10-03 オーナー判断：東清水線は建設中として描く（status '建設中'、使用開始予定2027年1月）
 assert.deepEqual(d.lines.filter((l:any)=>/東清水線/.test(l.name)).map((l:any)=>[l.id,l.status]),[['tokyo-plan-東清水線','建設中']]);
 const base=new Set(read('public/data/tohoku-trunk-osm.json').facilities.map((f:any)=>f.id));
 for(const f of d.facilities.filter((f:any)=>f.kind==='plant'&&!base.has(f.id)))assert.ok(f.attributes.some((a:any)=>/送電容量として扱わない|出力・運転状態は未照合|は未照合（(10万kW以上の号機の)?出力/.test(a.value)),f.name);// 2026-10-19：確認できた項目は「…は未照合（10万kW以上の号機の出力は HJKS で確認）」などに置き換わる
});
test('佐久間東幹線(中) flows only on No.83 and 飛騨信濃 DC has no flow',()=>{
 const day=reviewedTokyoDay(typicalDay(read('public/data/tokyo-flow.json')));
 const a=day.actual.lines.find(a=>a.name==='佐久間東幹線'&&a.from==='新富士変電所')!;assert.ok(a);
 const p=referenceFlowPath(a,fc.lines,false)!;assert.ok(p);const n83=fc.lines.find((l:any)=>l.id==='tokyo-section-83');
 const keys=new Set(n83.paths.flat().map((q:number[])=>q.join(',')));assert.ok(p.every(q=>keys.has(q.join(','))));
 assert.ok(!day.actual.lines.some(a=>/飛騨|信濃直流/.test(a.name)));
});
test('plants without a connecting line or voltage follow only the plant toggle; other facilities keep the voltage rule',async()=>{
 const {facilityElectricalVisible}=await import('../src/display-settings.ts');
 const none=new Set<number>(),ac=new Set(['ac']);
 assert.equal(facilityElectricalVisible({id:'p',kind:'plant',voltages:[]},[],none,ac),true);
 assert.equal(facilityElectricalVisible({id:'s',kind:'substation',voltages:[]},[],none,ac),false);
 assert.equal(facilityElectricalVisible({id:'p2',kind:'plant',voltages:[500]},[],new Set([500]),ac),false);
});
test('新信濃 is drawn as both frequency converter and substation; other converters keep one role',()=>{
 const d=read('public/data/tokyo-trunk.json');const multi=d.facilities.filter((f:any)=>f.alsoKinds);
 assert.deepEqual(multi.map((f:any)=>[f.name,f.kind,f.alsoKinds]),[['新信濃変電所','converter',['substation']]]);
});
test('東清水 FC Tokyo side: 富士川線・田代幹線 (154kV, C tier) from 東清水 to 新富士; 東清水線 is a change plan and drawn as under construction',()=>{
 const d=read('public/data/tokyo-trunk.json');const l=d.lines.find((x:any)=>x.id==='tokyo-fc-higashishimizu-154');assert.ok(l);assert.equal(l.voltageKV,154);
 assert.deepEqual(l.connections.map((c:any)=>c.facilities[0].name),['東清水変電所','新富士変電所']);assert.ok(l.attributes.some((a:any)=>a.label==='要注意（C区分）'));
 assert.ok(d.lines.some((x:any)=>x.name==='東清水線'&&x.status==='建設中'));assert.ok(d.changePlans.some((p:any)=>p.id==='tokyo-plan-higashishimizu-2026'&&p.targets[0].assetIds[0]==='tokyo-plan-東清水線'));
 assert.equal(read('config/tokyo-approval.json').lineVoltages[l.assetId],154);
});
// 2026-10-14 オーナー指示：東清水FCの東京側154kVは、基幹系統+連系線と154/66kV（下位系統）の両方に表示する。
// 例外の正本は config/tokyo-approval.json の trunkExceptionLines。ビルドが線に trunkException:'fc-ac-side' を書き写し、画面は目印だけを見る
test('trunk exception: marked lines match the approval list exactly',()=>{
 const approval=read('config/tokyo-approval.json'),d=read('public/data/tokyo-trunk.json');
 assert.deepEqual(approval.trunkExceptionLines,['tokyo-fc-higashishimizu-154']);
 assert.deepEqual(d.lines.filter((l:any)=>l.trunkException).map((l:any)=>l.id).sort(),[...approval.trunkExceptionLines].sort());
 for(const l of d.lines.filter((l:any)=>l.trunkException))assert.equal(l.trunkException,'fc-ac-side',l.id);
 const l=d.lines.find((x:any)=>x.id==='tokyo-fc-higashishimizu-154');
 assert.equal(l.attributes.find((a:any)=>a.label==='電圧・表示（暫定）')?.value,'基幹系統+連系線と154/66kVの両方で表示');
});
test('trunk filter shows the 東清水 154kV line without adding 154 to the voltages, and adds no 154kV-only facility',async()=>{
 const {trunkVoltageShown,facilityElectricalVisible}=await import('../src/display-settings.ts');const {regions}=await import('../src/regions.ts');
 const d=read('public/data/tokyo-trunk.json');
 const kvs=new Set<number>([...regions.tokyo.voltages,...d.lines.filter((l:any)=>l.currentType==='dc').map((l:any)=>l.voltageKV)]);assert.ok(!kvs.has(154));
 const shown=d.lines.filter((l:any)=>trunkVoltageShown(l,kvs)),plain=d.lines.filter((l:any)=>kvs.has(l.voltageKV));
 assert.deepEqual(shown.filter((l:any)=>!plain.includes(l)).map((l:any)=>l.id),['tokyo-fc-higashishimizu-154']);
 // 両端（東清水・新富士）は今の電圧ルールで表示される。154kVの線だけでつながる設備はない
 const ac=new Set(['ac','dc','unknown']),ex=d.lines.filter((l:any)=>l.trunkException);
 const ends=new Set(ex.flatMap((l:any)=>l.connections.flatMap((c:any)=>c.facilities.map((f:any)=>f.id))));assert.equal(ends.size,2);
 for(const id of ends){const f=d.facilities.find((x:any)=>x.id===id);assert.ok(facilityElectricalVisible(f,d.lines,kvs,ac),f.name);
  assert.ok(d.lines.some((l:any)=>!l.trunkException&&kvs.has(l.voltageKV)&&l.connections.some((c:any)=>c.facilities.some((x:any)=>x.id===id))),f.name+' has only the 154kV line');}
 // 中部ビュー（FC_LINES）には足さない
 assert.ok(!/tokyo-fc-higashishimizu-154/.test(readFileSync('src/real.ts','utf8').match(/const FC_LINES=\[[^\]]*\]/)![0]));
});
test('the 154/66kV (lower) view still receives the 東清水 154kV line and its two end facilities',()=>{
 // src/real.ts の shareLowerData と同じ選び方（東京の187kV未満の交流線と、その端の設備）
 const d=read('public/data/tokyo-trunk.json');
 const lower=d.lines.filter((l:any)=>l.voltageKV<187&&(l.currentType??'ac')==='ac');
 assert.deepEqual(lower.map((l:any)=>l.id),['tokyo-fc-higashishimizu-154']);
 const ids=new Set(lower.flatMap((l:any)=>l.connections.flatMap((c:any)=>c.facilities.map((f:any)=>f.id))));
 assert.deepEqual(d.facilities.filter((f:any)=>ids.has(f.id)).map((f:any)=>f.name).sort(),['新富士変電所','東清水変電所'].sort());
 assert.match(readFileSync('src/real.ts','utf8'),/function shareLowerData\(\)\{\r?\n if\(!pilot\|\|!tokyoGeography\)return;\r?\n const lower=tokyoGeography\.lines\.filter\(l=>l\.voltageKV<187&&\(l\.currentType\?\?'ac'\)==='ac'\);/);
});
