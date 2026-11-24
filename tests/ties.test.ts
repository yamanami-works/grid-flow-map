import test from 'node:test';import {rawSkip,publicCheckout} from './raw-data.mjs';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const data=Object.fromEntries(['chubu','hokuriku','kansai','chugoku','shikoku','kyushu'].map(r=>[r,read(`public/data/${r}-trunk.json`)]));
const TIES:[string,string,string,string,string][]=[
 ['越前嶺南線','hokuriku','kansai','越前変電所','嶺南変電所'],['三重東近江線','chubu','kansai','三重開閉所','東近江開閉所'],
 ['西播東岡山線','kansai','chugoku','西播変電所','東岡山変電所'],['山崎智頭線','kansai','chugoku','山崎開閉所','智頭変電所'],
 ['本四連系線','chugoku','shikoku','東岡山変電所','讃岐変電所'],['阿南紀北直流幹線','shikoku','kansai','阿南変換所','紀北変換所'],
 ['関門連系線','chugoku','kyushu','新山口変電所','北九州変電所'],
];
// 日付が変わった直後は当日分の行がまだそろわない（OCCTOの公表待ち）。行がそろっている直近の日で確かめる（2026-10-06）
const fullDay=(t:any)=>t.days.find((d:any)=>d.actual.lines.length>=10)??t.days[0];
test('each inter-area tie line is in both areas with the same ID, ends at the two areas\' facilities, and carries OCCTO tie flow (estimated for the loop lines)',()=>{
 for(const [name,a,b,fa,fb] of TIES){
  const la=data[a].lines.find((l:any)=>l.name===name),lb=data[b].lines.find((l:any)=>l.name===name);assert.ok(la&&lb,name);
  assert.equal(la.id,lb.id);assert.deepEqual(la.connections.map((c:any)=>c.facilities[0].name),[fa,fb]);
  for(const d of [data[a],data[b]])for(const c of la.connections)assert.ok(d.facilities.some((f:any)=>f.id===c.facilities[0].id),name);
  assert.ok(la.attributes.some((x:any)=>x.label==='要注意（C区分）'));assert.match(la.attributes.find((x:any)=>x.label==='設備の位置付け').value,/潮流は(OCCTO連系線潮流実績|OCCTOが個別に公表しない)/);
 }
});
test('阿南紀北直流幹線 is DC 250kV with its submarine cable dotted; 本四連系線 bridge section is dotted',()=>{
 const dc=data.kansai.lines.find((l:any)=>l.name==='阿南紀北直流幹線');assert.equal(dc.currentType,'dc');assert.equal(dc.voltageKV,250);assert.ok(dc.cableOsmIds.includes(217885659));
 const hs=data.shikoku.lines.find((l:any)=>l.name==='本四連系線');assert.ok(hs.cableOsmIds.includes(618374046));assert.match(hs.cableLabel,/瀬戸大橋添架/);assert.equal(dc.cableLabel,'海底ケーブル区間あり');
});
test('tie flow file: OCCTO rows map onto the tie lines of each end area; loop lines are marked as estimates',async()=>{
 const {referenceFlowPath}=await import('../src/flow-path.ts');
 const t=read('public/data/tie-flow.json');assert.ok(t.days.length>=1);const day=fullDay(t);
 for(const l of day.actual.lines){assert.equal(l.values.length,48);for(const [name,a,b] of TIES.map(x=>[x[0],x[1],x[2]]))if(name===l.name)for(const r of [a,b])assert.ok(referenceFlowPath(l,data[r].lines,false),r+' '+l.name);}
 for(const n of ['三重東近江線','越前嶺南線']){const l=day.actual.lines.find((x:any)=>x.name===n);if(l)assert.match(l.note,/^推定/);}
 assert.ok(day.actual.lines.some((l:any)=>l.name==='関門連系線'));
});
test('eastern ties: 北海道・本州間 on 北本 (OSM split into several ways, joined by lineAliases) and 北斗今別, 相馬双葉幹線 in Tokyo, frequency converters on 3 lines',async()=>{
 const {referenceFlowPath}=await import('../src/flow-path.ts');
 const t=read('public/data/tie-flow.json');const day=fullDay(t);const row=(n:string)=>day.actual.lines.find((l:any)=>l.name===n);
 const dc=read('public/data/tohoku-dc-osm.json');for(const l of dc.lines)if(t.lineAliases[l.id])l.flowNames=t.lineAliases[l.id];
 for(const n of ['北本直流幹線','北斗今別直流幹線（新北本連系）'])assert.ok(referenceFlowPath(row(n),dc.lines,false),n);
 const tk=read('public/data/tokyo-trunk.json');
 for(const n of ['相馬双葉幹線','新信濃FC 中部側連系線（OSM無名）','飛騨信濃直流幹線','東清水FC 中部側連系線（OSM無名）'])assert.ok(referenceFlowPath(row(n),tk.lines,false),n);
 // 相馬双葉幹線は 2026-06-30 から南いわき開閉所ではなく福島幹線山線 No.10（設備のない分岐点）につながる（2026-11-05 保留78）
 assert.deepEqual(tk.lines.find((l:any)=>l.name==='相馬双葉幹線').connections.map((c:any)=>c.facilities[0]?.name??c.status),['南相馬変電所','shared-node']);
 assert.match(row('飛騨信濃直流幹線').note,/合計/);
});

// 相馬双葉幹線の接続変更（2026-11-05 保留78、オーナー回答「この内容で実施」「(b) 鉄塔の座標で描く」）
test('相馬双葉幹線: No.54 から新ルートで福島幹線山線 No.10 へ。旧ルートと南いわき開閉所を含まず、全日の潮流が東京・東北の両方で引ける',async()=>{
 const {referenceFlowPath}=await import('../src/flow-path.ts');const {evidenceOf}=await import('../src/evidence.ts');const {plansForRegion}=await import('../src/change-plans.ts');
 const tk=read('public/data/tokyo-trunk.json'),th=read('public/data/tohoku-trunk.json');
 for(const d of [tk,th]){const l=d.lines.find((x:any)=>x.id==='tie-500-相馬双葉幹線');assert.ok(l);
  assert.deepEqual(l.osmIds,[199522664,-9500001]);
  const B=l.connections[1].position;assert.equal(l.connections[1].status,'shared-node');assert.equal(l.connections[1].facilities.length,0);
  const fuku=tk.lines.find((x:any)=>x.id==='tokyo-section-4');assert.ok(fuku.paths.flat().some((p:number[])=>p[0]===B[0]&&p[1]===B[1]),'B は福島山幹線の点');
  const dm=(p:number[],q:number[])=>Math.hypot((p[0]-q[0])*110574,(p[1]-q[1])*111320*Math.cos(p[0]*Math.PI/180));const r=l.paths[1];const km=r.slice(1).reduce((t:number,x:number[],i:number)=>t+dm(r[i],x),0)/1000;
  assert.ok(km>13.8&&km<16.8,'新区間 '+km);assert.equal(r.length,34);
  const e=evidenceOf(l);assert.equal(e.tier,'C');assert.ok(e.inferred.some(i=>i.point&&i.point[0]===B[0]&&i.point[1]===B[1]),'B は推測の点');
  assert.ok(l.attributes.some((a:any)=>a.label==='経路の根拠'&&/Google マップの航空写真（ズーム17）から 2026-11-05 に読み取った/.test(a.value)&&!/オーナー/.test(a.value)));}
 assert.ok(th.facilities.some((f:any)=>f.id==='osm-way-253566674'),'東北のデータに南いわき開閉所が残る');
 const t=read('public/data/tie-flow.json');let n=0;const missing:string[]=[];for(const d of t.days){const row=d.actual.lines.find((x:any)=>x.id==='tie-02-相馬双葉幹線');if(!row){missing.push(d.date);continue;}n++;
  assert.deepEqual([row.from,row.to],['南相馬変電所','分岐点'],d.date);for(const c of d.capacities.filter((c:any)=>c.id.startsWith('tie-cap-02-')))assert.ok([c.from,c.to].includes('分岐点')&&!JSON.stringify(c).includes('南いわき'),d.date);
  for(const g of [tk,th])assert.ok(referenceFlowPath(row,g.lines,false),d.date);}
 // 公開リポジトリの CI の初回の配置は潮流が数日分から始まる（docs/RULES.md 5節）。そのときだけ、ある日数（行がそろわない最新日は除く）までに緩める。手元は20日
 const newest=t.days.map((d:any)=>d.date).sort().at(-1),avail=t.days.length-(missing.includes(newest)?1:0);
 const need=publicCheckout()?Math.max(1,Math.min(20,avail)):20;assert.ok(n>=need,`相馬双葉幹線の行がある日 ${n}（必要 ${need}、行のない日 ${missing.join('、')||'なし'}）`);
 for(const r of ['tohoku','tokyo'])assert.ok(plansForRegion(tk.changePlans,r).some((p:any)=>p.id==='tohoku-tokyo-somafutaba-2026'&&p.revisions.at(-1).status==='運用開始確認済み'),r);
});
// 旧ルートの点の検査は原本 data/raw/north-ties/souma.json を使う。公開リポジトリの Actions では原本がないときだけ飛ばす（保留78・95、tests/raw-data.mjs）
test('相馬双葉幹線: 旧ルート（原本の way 199522664 の No.54 より先と way 897526309）の点を含まない',{skip:rawSkip('data/raw/north-ties/souma.json')},()=>{
 const raw=read('data/raw/north-ties/souma.json').elements;
 for(const d of [read('public/data/tokyo-trunk.json'),read('public/data/tohoku-trunk.json')]){const l=d.lines.find((x:any)=>x.id==='tie-500-相馬双葉幹線');assert.ok(l);
  const pts=l.paths.flat().map((p:number[])=>p.join(','));
  const old=[...raw.find((e:any)=>e.id===199522664).geometry.slice(49),...raw.find((e:any)=>e.id===897526309).geometry].map((p:any)=>p.lat+','+p.lon);
  assert.ok(!old.some(p=>pts.includes(p)),'旧ルートの点を含まない');}
});
// 東北のデータは連系線・設備を東京のデータから写す（scripts/build-tohoku.mjs）。公開時の文言（scripts/public-wording.mjs）を直したら
// 東京→東北の順に書き出す。写した属性の文が東京と同じか（東北で別に付ける「要注意（C区分）」は除く）を確かめる（2026-11-22 保留143）
test('東北に写した連系線・設備の属性の文は東京と同じ',()=>{
 const tk=read('public/data/tokyo-trunk.json'),th=read('public/data/tohoku-trunk.json');let n=0;
 const pairs=[...th.lines.map((l:any)=>[l,tk.lines.find((x:any)=>x.id===l.id)]),...th.facilities.map((f:any)=>[f,tk.facilities.find((x:any)=>x.id===f.id)])].filter(([,t])=>t);
 for(const [a,b] of pairs)for(const x of b.attributes??[]){if(x.label==='要注意（C区分）')continue;const y=(a.attributes??[]).find((z:any)=>z.label===x.label);if(y){n++;assert.equal(y.value,x.value,a.id+' '+x.label);}}
 assert.ok(n>=5,'比べた属性 '+n);
});
