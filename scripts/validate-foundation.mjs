import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const catalog=await read('public/data/catalog.json'),registry=await read('data/catalog/assets.json');
assert.equal(new Set(registry.assets.map(a=>a.id)).size,registry.assets.length,'Duplicate asset IDs');
const ids=new Set(registry.assets.map(a=>a.id));
const geometryKeys=new Set();
for(const a of registry.assets){assert.ok(a.id.startsWith('asset-'));if(a.parentId)assert.ok(ids.has(a.parentId));for(const b of a.bindings.filter(b=>b.role==='geometry')){assert.ok(!geometryKeys.has(b.externalId),'Geometry assigned twice');geometryKeys.add(b.externalId);}}
assert.equal(new Set(catalog.datasets.map(d=>d.id)).size,catalog.datasets.length);
for(const d of catalog.datasets){
 assert.equal(d.access,'public','Protected data must not be bundled');
 assert.ok(!['distribution-map','capacity-overlay'].includes(d.feature),'Paid datasets must not be bundled');
 assert.match(d.url,/^\.\/data\/[a-z0-9/-]+\.json$/);assert.ok(!d.url.includes('..'));
 // 携帯用だけのデータは data/private/ にある（docs/RULES.md 5節）
 const value=await read((d.distribution==='private-preview'?'data/private/':'public/data/')+d.url.slice('./data/'.length));assert.equal(value.schemaVersion,d.schemaVersion);
 // 東北の直流は永続資産台帳、ほかは各地域の承認ファイル（builderが書く：ハッシュ・線/設備ID・電圧）で照合する（2026-10-03、東北の交流は2026-10-04から承認ファイル）
 if(d.purpose==='geometry'&&d.id==='tohoku-dc')for(const item of [...value.lines,...value.facilities])assert.ok(ids.has(item.assetId),'Unregistered geometry');
 if(d.purpose==='geometry'&&d.id!=='tohoku-dc'){
  const approval=await read(`config/${d.region}-approval.json`),text=await readFile('public/'+d.url.slice(2));
  assert.equal(createHash('sha256').update(text).digest('hex'),approval.sha256,'Unapproved dataset '+d.id);assert.equal(value.datasetId,approval.datasetId,'Dataset ID '+d.id);
  for(const l of value.lines){assert.ok(approval.lineIds.includes(l.assetId),'Unapproved line '+l.assetId);assert.equal(approval.lineVoltages?.[l.assetId],l.voltageKV,'Voltage '+l.assetId);if(l.currentType!=='ac')assert.equal(approval.lineCurrentTypes?.[l.assetId],l.currentType,'Current type '+l.assetId);}
  for(const f of value.facilities)assert.ok(approval.facilityIds.includes(f.assetId),'Unapproved facility '+f.assetId);
  // 基幹系統表示の例外（2026-10-14）：目印の付いた線と、承認ファイルの trunkExceptionLines（正本）が完全に一致すること
  assert.deepEqual(value.lines.filter(l=>l.trunkException).map(l=>l.assetId).sort(),[...(approval.trunkExceptionLines??[])].sort(),'Trunk exception lines '+d.id);
 }
}
// Block accidentally copying a marked paid dataset, including files absent from the manifest.
async function check(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await check(p);else if(e.name.endsWith('.json')){const d=await read(p);assert.ok(d.access!=='protected'&&d.tier!=='paid','Protected file in public bundle: '+p);}}}
await check('public/data');
console.log('Foundation validation passed');
