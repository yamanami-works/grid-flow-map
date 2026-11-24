import {canUse} from './access-policy.ts';
import type {DatasetManifest} from './data-contracts';
export function datasetUrl(manifest:DatasetManifest,id:string){
 if(manifest.schemaVersion!==1)throw Error('Unsupported dataset catalog');
 const d=manifest.datasets.find(d=>d.id===id);
 if(!d||d.access!=='public'||!canUse(d.feature,null))throw Error('Dataset not available to public client');
 if(!/^\.\/data\/[a-z0-9/-]+\.json$/.test(d.url)||d.url.includes('..'))throw Error('Invalid public dataset URL');
 // 中身のハッシュが付くデータはキャッシュ可能な URL（?v=）で読む（潮流には付かない）
 return d.version&&/^[0-9a-f]{12}$/.test(d.version)?d.url+'?v='+d.version:d.url;
}
export async function loadCatalog():Promise<DatasetManifest>{
 const r=await fetch('./data/catalog.json',{cache:'no-store'});
 if(!r.ok)throw Error('Dataset catalog unavailable');
 const m=await r.json();if(m.schemaVersion!==1||!Array.isArray(m.datasets))throw Error('Invalid dataset catalog');return m;
}
