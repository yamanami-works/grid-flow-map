import {readdir,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),root='backups/pre-expansion-'+stamp;
const entries=[];
async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(path.includes('/App/public')||path.includes('/Pods')||path.includes('/build'))continue;if(e.isDirectory())await visit(path);else entries.push(path);}}
for(const dir of ['src','scripts','tests','docs','data','public','ios'])await visit(dir);
entries.push('package.json','package-lock.json','tsconfig.json','vite.config.ts','capacitor.config.ts','index.html','README.md','.gitignore');
const manifest=[];
for(const p of entries){const bytes=await readFile(p);const to=root+'/files/'+p;await mkdir(to.slice(0,to.lastIndexOf('/')),{recursive:true});await copyFile(p,to);manifest.push({path:p,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}
await writeFile(root+'/manifest.json',JSON.stringify({createdAt:new Date().toISOString(),excluded:['credentials','node_modules','git','tmp','dist','ios bundled web assets'],files:manifest},null,2));
console.log(root,manifest.length,'files');
