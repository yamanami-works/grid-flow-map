import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const extras=(await readdir('data/raw')).filter(f=>/^osm-trunk-neighbors-\d+\.json$/.test(f)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
const files=['osm-trunk.json',...extras], elements=new Map(),sources=[],times=[];
for(const file of files) {
  const bytes=await readFile(`data/raw/${file}`),meta=JSON.parse(await readFile(`data/raw/${file}.source.json`,'utf8'));
  if(createHash('sha256').update(bytes).digest('hex')!==meta.sha256) throw new Error(`Source mismatch ${file}`);
  const raw=JSON.parse(bytes.toString('utf8'));
  if(raw.remark) throw new Error('Incomplete input');
  raw.elements.forEach(e=>elements.set(`${e.type}-${e.id}`,e));
  sources.push({file,...meta});times.push(raw.osm3s.timestamp_osm_base);
}
times.sort();
const text=JSON.stringify({osm3s:{timestamp_osm_base:times[0]===times.at(-1)?times[0]:`${times[0]} – ${times.at(-1)}`},elements:[...elements.values()]});
await writeFile('data/raw/osm-trunk-expanded.json',text);
await writeFile('data/raw/osm-trunk-expanded.json.source.json',JSON.stringify({url:sources[0].url,retrievedAt:sources.at(-1).retrievedAt,sha256:createHash('sha256').update(text).digest('hex'),license:'ODbL-1.0',sources},null,2));
console.log({files:files.length,elements:elements.size});
