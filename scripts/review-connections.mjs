import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inFacility } from './facility-geometry.mjs';
import { distanceMeters, components, traceToFacilities } from './topology.mjs';
const summary=[];
for (const prefix of ['trunk','dc']) {
  const path=`public/data/tohoku-${prefix}-osm.json`;
  const geo=JSON.parse(await readFile(path,'utf8'));
  const bytes=await readFile(`data/raw/${geo.sourceFile ?? `osm-${prefix}.json`}`);
  if(createHash('sha256').update(bytes).digest('hex')!==geo.sourceHash) throw new Error('Source hash mismatch');
  const raw=JSON.parse(bytes.toString('utf8'));
  const elements=new Map(raw.elements.map(e=>[`${e.type}-${e.id}`,e]));
  const byVoltage=new Map();
  for(const line of geo.lines) {
    const key=`${line.voltageKV}`;
    if(!byVoltage.has(key)) byVoltage.set(key,new Map());
    for(const id of line.osmIds) byVoltage.get(key).set(id,elements.get(`way-${id}`));
  }
  const memberships=new Map();
  for(const [key,ways] of byVoltage) {
    const nodes=new Map();
    for(const way of ways.values()) for(const id of way.nodes) { if(!nodes.has(id)) nodes.set(id,new Set()); nodes.get(id).add(way.id); }
    memberships.set(key,nodes);
  }
  const facilities=geo.facilities.map(f=>({f,element:elements.get(f.id.replace(/^osm-/,''))})).filter(x=>x.element);
  const associated=new Set(),unique=new Map();
  for(const line of geo.lines) {
    const key=`${line.voltageKV}`,nodes=memberships.get(key);
    const ends=new Map();
    for(const id of line.osmIds) {
      const way=elements.get(`way-${id}`);
      for(const index of [0,way.nodes.length-1]) {
        const node=way.nodes[index],p=way.geometry[index],position=[p.lat,p.lon];
        const hits=facilities.filter(x=>inFacility(position,x.element)).map(x=>({id:x.f.id,name:x.f.name}));
        hits.forEach(h=>associated.add(h.id));
        const neighbors=[...nodes.get(node)].filter(n=>n!==id);
        const otherVoltages=raw.elements.filter(e=>e.type==='way' && e.tags?.power && e.nodes?.includes(node) && !byVoltage.get(key).has(e.id)).map(e=>({id:e.id,power:e.tags.power,voltage:e.tags.voltage??null}));
        const nearest=facilities.map(x=>({id:x.f.id,name:x.f.name,meters:Math.round(distanceMeters(position,x.f.position))})).sort((a,b)=>a.meters-b.meters)[0];
        const endpoint={node,position,status:hits.length?'facility-area':neighbors.length?'shared-node':'unresolved',facilities:hits,neighborWays:neighbors,otherVoltages,nearest};
        ends.set(node,endpoint);unique.set(`${key}-${node}`,endpoint);
      }
    }
    line.connections=[...ends.values()];
  }
  // Follow mapped conductor nodes to the first facility footprint. Do not travel
  // through a station to a different outgoing circuit or join by proximity.
  for(const line of geo.lines) {
    const key=`${line.voltageKV}`, ways=byVoltage.get(key), nodes=memberships.get(key);
    line.connectedWayIds=traceToFacilities(line.osmIds,ways,nodes,(_,p)=>facilities.some(x=>inFacility([p.lat,p.lon],x.element)));
  }
  for(const f of geo.facilities) f.scopeConnected=associated.has(f.id);
  geo.connectionSummary={source:prefix,endpoints:unique.size,facilityArea:[...unique.values()].filter(e=>e.status==='facility-area').length,sharedNode:[...unique.values()].filter(e=>e.status==='shared-node').length,unresolved:[...unique.values()].filter(e=>e.status==='unresolved').length,components:[...byVoltage].map(([key,ways])=>({key,count:components([...ways.values()]).length}))};
  summary.push(geo.connectionSummary);
  await writeFile(path,JSON.stringify(geo));
}
await mkdir('data/processed',{recursive:true});
await writeFile('data/processed/connection-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
