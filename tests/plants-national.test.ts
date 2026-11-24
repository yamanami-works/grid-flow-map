import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {publicText} from '../scripts/public-wording.mjs';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
// 基幹系統に接続する発電所の電源線（tools/prep/adopt-plants-national.mjs、2026-10-06 オーナー指示「基幹系統に接続する発電所とその電源線を極力描いて」）
const FILES:Record<string,string>={tohoku:'tohoku-trunk',hokkaido:'hokkaido-hokuto',tokyo:'tokyo-trunk',chubu:'chubu-trunk',hokuriku:'hokuriku-trunk',kansai:'kansai-trunk',chugoku:'chugoku-trunk',shikoku:'shikoku-trunk',kyushu:'kyushu-trunk'};
test('plant feeder lines are C-tier, inferred names are marked, both ends exist, and no line reuses a drawn OSM way',()=>{
 const src=read('docs/research/plants-adopted.json');let n=0;
 // 2026-11-17 保留124-3：安曇水力発電所の電源線（plant-tokyo-275-315662803）は梓川線に統合して承認済み削除リストへ。取り込み元にはあるが地図にはない
 const removed=new Set(read('tests/baseline/approved-removals.json').filter((a:any)=>a.kind==='lines').map((a:any)=>a.file+' '+a.id));
 // 2026-11-18 保留130-6：北陸の「新成出水力発電所の電源線（推定）」（plant-hokuriku-275-1028287103）は同じ ID のまま関西のデータへ移し、新北陸幹線（成出～城端）に改名した。関西の電源線としては数えない
 const movedIn=new Set(read('docs/research/kansai-130-from-hokuriku.json').lines.map((l:any)=>l.id));
 for(const [r,f] of Object.entries(FILES)){const d=read(`public/data/${f}.json`);const mine=d.lines.filter((l:any)=>l.id.startsWith('plant-')&&!(r==='kansai'&&movedIn.has(l.id)));assert.equal(mine.length,src.regions[r].lines.filter((l:any)=>!removed.has(f+'.json '+l.id)).length,r);
  const others=new Set(d.lines.filter((l:any)=>!l.id.startsWith('plant-')).flatMap((l:any)=>l.osmIds.map(Math.abs)));
  for(const l of mine){n++;assert.ok(l.attributes.some((a:any)=>a.label.startsWith('要注意（C区分')),l.name);
   if(l.name.includes('（推定）'))assert.ok(l.attributes.some((a:any)=>a.label==='要注意（C区分・推定）')&&l.attributes.some((a:any)=>a.label==='推定の内容'),l.name);
   for(const c of l.connections)for(const x of c.facilities)assert.ok(d.facilities.some((y:any)=>y.id===x.id),l.name+' '+x.id);
   // 2026-10-16 例外：way 1082612598 はOSMで4回線・2つの線名の併記。鹿島パワー線と「鹿島変電所から北への線（名称未確認）」が併架とみなして共有する
   for(const id of l.osmIds)if(!(l.id==='plant-tokyo-275-1082612595'&&Math.abs(id)===1082612598))assert.equal(others.has(Math.abs(id)),false,l.name+' '+id);
    else assert.deepEqual(d.lines.filter((x:any)=>!x.id.startsWith('plant-')&&x.osmIds.map(Math.abs).includes(1082612598)).map((x:any)=>x.id),['tokyo-feeder-275-300345941'],'1082612598 を共有してよいのは1本だけ');}}
 assert.ok(n>=5);// 2026-11-18 保留130-6：新成出の電源線を関西へ移して改名（新北陸幹線（成出～城端））して6→5。// 2026-11-17 保留127 K1：常陸那珂火力線を No.15 に統合して7→6。// 2026-11-17 保留124-3：安曇水力発電所の電源線を梓川線に統合して8→7// 2026-10-06 北海道の幌加・芽登第一・本別の線は公表の他社線（送114・110・108）として描き直した
 // 鉄道事業者の発電所・蓄電池は描かない
 assert.ok(src.skipped.some((s:any)=>/鉄道/.test(s.reason))&&src.skipped.some((s:any)=>/蓄電池/.test(s.reason)));
});
// 2026-10-16 オーナー承認：線のない発電所の「系統との接続」は手作業の表（docs/research/plant-connection-notes.json）から当て、項目は1つだけ
// 2026-10-17：沼原発電所だけは、根拠がOSMの位置関係ではなくオーナー提示の概要図
test('plant connection notes are applied once per plant, and the target facility and line end still exist',()=>{
 const t=read('docs/research/plant-connection-notes.json');const FILE:any={hokkaido:'hokkaido-hokuto',tokyo:'tokyo-trunk',kyushu:'kyushu-trunk'};
 assert.equal(t.entries.length,11);assert.deepEqual(t.entries.filter((e:any)=>e.decision==='unconfirmed').map((e:any)=>e.name).sort(),['Hirono IGCC Power Plant','Nakoso IGCC Power Plant']);
 for(const e of t.entries){assert.equal(e.exception,e.decision==='connected'&&(e.meters>150||e.lineEndInsideTarget===false),e.name+' exception');
  const d=read(`public/data/${FILE[e.region]}.json`);const f=d.facilities.find((x:any)=>x.id===e.facilityId);assert.ok(f,e.name);
  const a=f.attributes.filter((x:any)=>x.label==='系統との接続');assert.equal(a.length,1,e.name);if(e.replaceLabel)assert.ok(!f.attributes.some((x:any)=>x.label===e.replaceLabel),e.name+' 古い注記が残る');assert.equal(a[0].value,publicText(e.note),e.name);
  assert.ok(/OSMの位置関係のみ/.test(e.note)||(e.facilityId==='osm-way-658953552'&&/発電設備の概要図/.test(e.note)),e.name);if(e.exception)assert.ok(/例外/.test(e.note),e.name);
  // 2026-11-17 保留127 K1：常陸那珂火力線（plant-）は No.15 に統合。注記はビルドの途中（統合の前）に当てるので、地図では統合先の線で確かめる
  const l=d.lines.find((x:any)=>x.id===(e.mergedInto??e.lineId));assert.ok(l&&l.connections.some((c:any)=>c.node===e.lineEndNode&&c.facilities.some((x:any)=>x.id===e.toFacilityId)),e.name);}
});
