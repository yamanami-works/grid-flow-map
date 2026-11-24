import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../data/raw/', import.meta.url);
await mkdir(root, { recursive: true });
const mode = process.argv[2] ?? 'official';
const isOsm = ['osm','dc','trunk','trunk-relations','trunk-neighbors'].includes(mode);
const sources = mode === 'official' ? [
  ['tohoku-line-2024.csv', 'https://nw.tohoku-epco.co.jp/consignment/system/demand/data/jisseki_kikan01_line_2024_02.csv'],
  ['tohoku-map-2024.pdf', 'https://nw.tohoku-epco.co.jp/consignment/system/demand/pdf/jisseki_kikan01_map_2024_02.pdf'],
  ['capacity-conditions.pdf', 'https://nw.tohoku-epco.co.jp/consignment/system/announcement/pdf/02.pdf'],
  ['tohoku-capacity-lines.csv', 'https://nw.tohoku-epco.co.jp/consignment/system/announcement/data/sys_capa_kikan01_line_202607_02.csv'],
  ['tohoku-capacity-substations.csv', 'https://nw.tohoku-epco.co.jp/consignment/system/announcement/data/sys_capa_kikan01_tr_202607_02.csv'],
  ['announcement.html', 'https://nw.tohoku-epco.co.jp/consignment/system/announcement/'],
] : isOsm ? [[mode === 'trunk-neighbors' ? `osm-trunk-neighbors-${process.argv[3] ?? '1'}.json` : mode === 'trunk-relations' ? 'osm-trunk-relations.json' : mode === 'trunk' ? 'osm-trunk.json' : mode === 'dc' ? 'osm-dc.json' : 'osm-tohoku.json', mode !== 'osm' ? 'https://overpass-api.de/api/interpreter' : 'https://overpass.private.coffee/api/interpreter']] : [];
if (!sources.length) throw new Error('Use official or osm');
// A bounded pilot extraction avoids burdening the shared Overpass server.
// This is Miyagi and adjacent districts, not complete prefectural coverage.
const neighborGeo = mode === 'trunk-neighbors' ? JSON.parse(await readFile(new URL('../public/data/tohoku-trunk-osm.json', import.meta.url), 'utf8')) : null;
const neighborNodes = neighborGeo ? [...new Set(neighborGeo.lines.flatMap(l => (l.connections ?? []).filter(e=>e.status==='unresolved').map(e=>e.node)))] : [];
const query = mode === 'trunk-neighbors' ? `[out:json][timeout:45];node(id:${neighborNodes.join(',')})->.ends;(way(bn.ends)["power"];nwr(around.ends:1200)["power"~"^(substation|plant)$"];);out body geom;` : mode === 'trunk-relations' ? `[out:json][timeout:90];area["ISO3166-2"~"^JP-(02|03|04|05|06|07|15)$"]->.region;way(area.region)["power"~"^(line|cable)$"]["voltage"~"(^|;)(500000|275000)(;|$)"]->.lines;rel(bw.lines);out body;` : mode === 'trunk' ? `[out:json][timeout:90];area["ISO3166-2"~"^JP-(02|03|04|05|06|07|15)$"]->.region;(way(area.region)["power"~"^(line|cable)$"]["voltage"~"(^|;)(500000|275000)(;|$)"];nwr(area.region)["power"~"^(substation|plant)$"];);out body geom;` : mode === 'dc' ? `[out:json][timeout:25];(way["frequency"="0"](40.7,139.7,42.3,141.8);nwr["substation"="converter"](40.7,139.7,42.3,141.8););out body geom;` : `[out:json][timeout:90][bbox:37.7,140.2,39.1,141.8];(way["power"~"^(line|cable)$"]["voltage"];nwr["power"~"^(substation|plant)$"];);out body geom;`;
for (const [file, url] of sources) {
  let bytes;
  try { bytes = await readFile(new URL(file, root)); } catch {
    console.log(`Fetching ${file}`);
    const response = await fetch(isOsm ? `${url}?${new URLSearchParams({ data: query })}` : url, {
      method: 'GET',
      headers: { 'User-Agent': 'TohokuGridMapPrototype/0.2 (local research)', ...(isOsm ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (isOsm) {
      const data = JSON.parse(bytes.toString());
      if (data.remark || !Array.isArray(data.elements)) throw new Error(`Incomplete Overpass result: ${data.remark}`);
    }
    await writeFile(new URL(file, root), bytes);
  }
  const metadataPath = new URL(`${file}.source.json`, root);
  let exists = false;
  try { await readFile(metadataPath); exists = true; } catch {}
  if (!exists) await writeFile(metadataPath, JSON.stringify({ url, retrievedAt: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, ...(isOsm ? { query, license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors' } : { redistribution: 'not-cleared; local research only' }) }, null, 2));
  console.log(`${file}: ${bytes.length} bytes`);
}
