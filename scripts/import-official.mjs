import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseActualCsv, parseCapacityCsv } from './csv.mjs';
const root = new URL('../data/raw/', import.meta.url);
const read = async file => new TextDecoder('shift_jis', { fatal: true }).decode(await readFile(new URL(file, root)));
const actual = parseActualCsv(await read('tohoku-line-2024.csv'));
const forecast = parseCapacityCsv(await read('tohoku-capacity-lines.csv'));
const substations = parseCapacityCsv(await read('tohoku-capacity-substations.csv'), 'substation');
const sources = {};
for (const [key, file] of Object.entries({ actual: 'tohoku-line-2024.csv', forecast: 'tohoku-capacity-lines.csv', substations: 'tohoku-capacity-substations.csv' })) sources[key] = JSON.parse(await readFile(new URL(`${file}.source.json`, root), 'utf8'));
const output = new URL('../data/processed/', import.meta.url);
await mkdir(output, { recursive: true });
// Historical observations deliberately keep capacity null. No join from 2026 capacity to 2024 flow.
await writeFile(new URL('official-research.json', output), JSON.stringify({ schemaVersion: 1, usage: 'local-research-only', sources, actual, forecast, substations }));
const report = { assetCount: actual.lines.length, timestamps: actual.times.length, first: actual.times[0], last: actual.times.at(-1), missing: actual.lines.reduce((sum, line) => sum + line.values.filter(v => v === null).length, 0), forecastCount: forecast.records.length, bankCount: substations.records.length, changedDefinitions: actual.lines.flatMap(line => {
  const current = forecast.records.find(r => r.id === line.id);
  return current && (current.name !== line.name || current.direction !== `${line.from}→${line.to}` || current.voltageKV !== line.voltageKV) ? [{ id: line.id, historical: `${line.name}: ${line.from}→${line.to}`, current: `${current.name}: ${current.direction}` }] : [];
}) };
await writeFile(new URL('official-report.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
