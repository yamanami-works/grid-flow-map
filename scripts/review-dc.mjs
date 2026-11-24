import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { components, terminals, distanceMeters } from './topology.mjs';
import { createHash } from 'node:crypto';
const bytes = await readFile('data/raw/osm-dc.json');
const raw = JSON.parse(bytes.toString('utf8'));
const geo = JSON.parse(await readFile('public/data/tohoku-dc-osm.json', 'utf8'));
if (createHash('sha256').update(bytes).digest('hex') !== geo.sourceHash) throw new Error('Topology source does not match geography');
const ids = new Set(geo.lines.flatMap(l => l.osmIds));
const ways = raw.elements.filter(e => e.type === 'way' && ids.has(e.id));
const networks = components(ways).map((group, i) => ({
  id: `dc-component-${i + 1}`, osmIds: group.map(w => w.id),
  names: [...new Set(group.map(w => w.tags['name:ja'] || w.tags.name || '名称未登録'))],
  terminals: terminals(group).map(t => {
    const nearest = geo.facilities.map(f => ({id:f.id, name:f.name, meters:Math.round(distanceMeters(t.position,f.position))})).sort((a,b)=>a.meters-b.meters)[0];
    return {...t, nearest};
  }),
}));
for (const line of geo.lines) {
  line.topology = { namedComponents: components(ways.filter(w => line.osmIds.includes(w.id))).length,
    networks: networks.filter(n => n.osmIds.some(id => line.osmIds.includes(id))) };
}
await writeFile('public/data/tohoku-dc-osm.json', JSON.stringify(geo));
await mkdir('data/processed', {recursive:true});
await writeFile('data/processed/dc-topology.json', JSON.stringify({osmTimestamp:geo.osmTimestamp,networks}, null, 2));
console.log(JSON.stringify(networks,null,2));
