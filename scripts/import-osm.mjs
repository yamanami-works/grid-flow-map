import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { currentType, facilityKind } from './osm-tags.mjs';
import { applyCurrentVoltage } from './current-voltage.mjs';
import { createHash } from 'node:crypto';
const dc = process.argv[2] === 'dc';
const trunk = process.argv[2] === 'trunk';
const file = trunk ? 'osm-trunk-expanded.json' : dc ? 'osm-dc.json' : 'osm-tohoku.json';
const input = new URL(`../data/raw/${file}`, import.meta.url);
const data = JSON.parse(await readFile(input, 'utf8'));
const source = JSON.parse(await readFile(new URL(`../data/raw/${file}.source.json`, import.meta.url), 'utf8'));
if (createHash('sha256').update(await readFile(input)).digest('hex') !== source.sha256) throw new Error('OSM source hash mismatch');
if (data.remark || !Array.isArray(data.elements)) throw new Error('Incomplete OSM result');
const groups = new Map(); const facilities = []; let excludedVoltageUnknown = 0;
const voltages = value => [...new Set(String(value ?? '').split(';').map(v => /^\d+$/.test(v.trim()) ? Number(v.trim()) / 1000 : NaN).filter(v => Number.isFinite(v) && v > 7))];
const label = tags => tags['name:ja'] || tags.name || '';
for (const element of data.elements) {
  const tags = element.tags ?? {}, kvs = voltages(tags.voltage);
  if (element.type === 'way' && ['line', 'cable'].includes(tags.power)) {
    if (!kvs.length) { excludedVoltageUnknown++; continue; }
    if (!element.geometry || element.geometry.length < 2 || element.geometry.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) throw new Error(`Invalid way geometry ${element.id}`);
    const name = label(tags);
    for (const kv of kvs.filter(v => !trunk || v === 500 || v === 275)) {
      const key = `${name || `way-${element.id}`}|${kv}|${currentType(tags)}`;
      if (!groups.has(key)) groups.set(key, { id: `osm-${element.id}-${kv}`, name: name || `名称未登録（way ${element.id}）`, named: !!name, voltageKV: kv, osmIds: [], osmRefs: [], paths: [] });
      groups.get(key).osmIds.push(element.id);
      groups.get(key).currentType = currentType(tags);
      if (tags.ref && !groups.get(key).osmRefs.includes(tags.ref)) groups.get(key).osmRefs.push(tags.ref);
      groups.get(key).paths.push(element.geometry.map(p => [p.lat, p.lon]));
    }
  } else if (['substation', 'plant', 'generator'].includes(tags.power)) {
    // Exclude known low-voltage facilities, but retain unknown voltage as explicitly unknown.
    if (tags.power === 'substation' && tags.voltage && !kvs.length) continue;
    if (tags.power === 'plant' && !label(tags)) continue;
    const points = element.geometry ?? element.members?.flatMap(m => m.geometry ?? []) ?? [];
    const position = element.lat !== undefined ? [element.lat, element.lon] : points.length ? [(Math.min(...points.map(p => p.lat)) + Math.max(...points.map(p => p.lat))) / 2, (Math.min(...points.map(p => p.lon)) + Math.max(...points.map(p => p.lon))) / 2] : null;
    if (!position || position.some(n => !Number.isFinite(n))) continue;
    facilities.push({ id: `osm-${element.type}-${element.id}`, name: label(tags) || `${tags.power === 'generator' ? '発電設備' : '名称未登録'}（${element.type} ${element.id}）`, kind: facilityKind(tags), position, voltages: kvs, url: `https://www.openstreetmap.org/${element.type}/${element.id}` });
  }
}
const output = { schemaVersion: 1, coverage: trunk ? '東北6県・新潟県の500/275 kV OSM登録線路。県境をまたぐ線分は範囲外の区間を含みます。未登録区間の網羅性は未確認。' : dc ? '青森・道南の直流線路と変換所の抽出。海底・地中区間や端点の完全性は未確認。' : '宮城県周辺の抽出範囲（北緯37.7–39.1°、東経140.2–141.8°）※東北全域ではありません。境界にかかる線路は範囲外の区間を含みます。', retrievedAt: source.retrievedAt, osmTimestamp: data.osm3s.timestamp_osm_base, license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', sourceUrl: source.url, sourceHash: source.sha256, sourceFile: file, sources: source.sources, lines: [...groups.values()].sort((a, b) => b.voltageKV - a.voltageKV || a.name.localeCompare(b.name, 'ja')), facilities, excludedVoltageUnknown };
for (const line of output.lines) applyCurrentVoltage(line);
const directory = new URL('../public/data/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL(trunk ? 'tohoku-trunk-osm.json' : dc ? 'tohoku-dc-osm.json' : 'tohoku-osm.json', directory), JSON.stringify(output));
await writeFile(new URL('LICENSE.txt', directory), 'Geographical data: © OpenStreetMap contributors\nOpen Database License (ODbL) 1.0\nhttps://opendatacommons.org/licenses/odbl/1-0/\nhttps://www.openstreetmap.org/copyright\n\nThis dataset groups OSM ways by name and voltage without filling gaps. Facility markers use OSM points or geometry bounding-box centres. Topology and official power-flow correspondence are not verified.\n');
console.log(JSON.stringify({ lines: output.lines.length, ways: new Set(output.lines.flatMap(l => l.osmIds)).size, facilities: facilities.length, excludedVoltageUnknown }, null, 2));
