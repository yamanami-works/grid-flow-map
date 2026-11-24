import {readFile,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve(process.argv[2]??''),target=resolve('tmp/restore-drill-'+Date.now());
const manifest=JSON.parse(await readFile(resolve(source,'manifest.json'),'utf8'));
for(const file of manifest.files){
 const original=resolve(source,'files',file.path),restored=resolve(target,file.path);
 if(!original.startsWith(resolve(source,'files')+sep)||!restored.startsWith(target+sep))throw Error('Unsafe manifest path');
 await mkdir(dirname(restored),{recursive:true});await copyFile(original,restored);
 const bytes=await readFile(restored);
 if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Restore mismatch: '+file.path);
}
JSON.parse(await readFile(resolve(target,'data/catalog/assets.json'),'utf8'));
const report={verifiedAt:new Date().toISOString(),source,target,files:manifest.files.length,result:'all hashes match'};
await writeFile('tmp/restore-drill-result.json',JSON.stringify(report,null,2));console.log(report);
