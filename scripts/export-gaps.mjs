import { readFile, writeFile } from 'node:fs/promises';
const datasets=await Promise.all(['trunk','dc'].map(async kind=>JSON.parse(await readFile(`public/data/tohoku-${kind}-osm.json`,'utf8'))));
const seen=new Set(),gaps=[];
for(const geo of datasets) for(const line of geo.lines) for(const endpoint of line.connections??[]) {
  const key=`${line.voltageKV}-${endpoint.node}`;
  if(endpoint.status!=='unresolved'||seen.has(key)) continue;
  seen.add(key);gaps.push({name:line.name,voltageKV:line.voltageKV,...endpoint});
}
await writeFile('public/data/connection-gaps.json',JSON.stringify({license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',sources:datasets.map(g=>({hash:g.sourceHash,time:g.osmTimestamp})),gaps},null,2));
console.log(`Unresolved endpoint/voltage pairs: ${gaps.length}`);
