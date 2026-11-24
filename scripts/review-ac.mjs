import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { components, terminals, distanceMeters } from './topology.mjs';
const bytes = await readFile('data/raw/osm-trunk-expanded.json');
const raw = JSON.parse(bytes.toString('utf8'));
const geo = JSON.parse(await readFile('public/data/tohoku-trunk-osm.json', 'utf8'));
if (createHash('sha256').update(bytes).digest('hex') !== geo.sourceHash) throw new Error('Topology source mismatch');
const sourceWays = new Map(raw.elements.filter(e => e.type === 'way').map(w => [w.id,w]));
const lines = geo.lines.filter(l => [500,275].includes(l.voltageKV) && l.currentType !== 'dc');
for (const line of lines) {
  // Review each registered name and voltage separately; do not absorb adjacent circuits.
  const groups = components(line.osmIds.map(id => sourceWays.get(id)));
  line.topology = { scope: 'same-name', namedComponents: groups.length, networks: groups.map((group,i) => ({
    id: `${line.id}-component-${i}`, osmIds: group.map(w=>w.id), names:[line.name],
    terminals: terminals(group).map(t=>({...t, nearest:geo.facilities.map(f=>({id:f.id,name:f.name,meters:Math.round(distanceMeters(t.position,f.position))})).sort((a,b)=>a.meters-b.meters)[0]})),
  })) };
}
await writeFile('public/data/tohoku-trunk-osm.json', JSON.stringify(geo));
console.log(JSON.stringify({reviewed:lines.length, fragmented:lines.filter(l=>l.topology.namedComponents>1).length}));
// Keep official references in the local research directory, outside the public bundle.
const official = JSON.parse(await readFile('data/processed/official-research.json','utf8'));
const normalize = s=>s.normalize('NFKC').replace(/\s+/g,'').replace(/^東北電力(?:ネットワーク)?/,'');
const report = official.actual.lines.filter(l=>[500,275].includes(l.voltageKV)).map(record=>({
  id:record.id,name:record.name,voltageKV:record.voltageKV,from:record.from,to:record.to,
  candidates:lines.filter(l=>normalize(l.name)===normalize(record.name)&&l.voltageKV===record.voltageKV).map(l=>({
    id:l.id, refs:l.osmRefs, refStatus: !l.osmRefs?.length ? 'missing' : l.osmRefs.every(ref=>ref===record.id) ? 'matching' : 'conflicting',
    topology:l.topology, directionVerified:false, status:'candidate',
  })),
}));
await mkdir('data/processed',{recursive:true});
await writeFile('data/processed/ac-match-review.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({records:report.length,withCandidates:report.filter(r=>r.candidates.length).length,refMatching:report.filter(r=>r.candidates.some(c=>c.refStatus==='matching')).length,refConflicting:report.filter(r=>r.candidates.some(c=>c.refStatus==='conflicting')).length}));
