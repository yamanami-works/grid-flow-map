// RFC 4180 cells, including quoted commas/newlines and a final blank row.
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else throw new Error(`Unexpected quote at ${i}`);
    } else if (!quoted && (c === ',' || c === '\r' || c === '\n')) {
      row.push(cell); cell = '';
      if (c !== ',') { rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export const clean = value => String(value ?? '').replace(/^\uFEFF/, '').replace(/^'/, '').trim();
export function numberOrNull(value) {
  const token = clean(value).replace(/,/g, '');
  if (['', '-', '－', '―', '欠測'].includes(token)) return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(token)) throw new Error(`Invalid numeric cell: ${value}`);
  return Number(token);
}
export function sourceTimestamp(value) {
  const m = clean(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Invalid timestamp: ${value}`);
  const [, year, month, day, hour, minute] = m.map(Number);
  const time = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (hour > 23 || minute !== 0 || time.getUTCFullYear() !== year || time.getUTCMonth() !== month - 1 || time.getUTCDate() !== day) throw new Error(`Invalid date: ${value}`);
  return time.toISOString().slice(0, 19) + '+09:00';
}
export function parseActualCsv(text) {
  const rows = parseCsv(text);
  const header = rows.findIndex(row => clean(row[0]) === '送電線No.');
  if (header < 1 || !rows[header - 1][0].includes('MW') || clean(rows[header + 1][0]) !== '電圧(kV)' || clean(rows[header + 2][0]) !== '送電線名' || clean(rows[header + 3][0]) !== '潮流正方向') throw new Error('Unexpected official CSV headers/units');
  const columns = [];
  for (let col = 1; col < rows[header].length; col++) {
    const id = clean(rows[header][col]); if (!id) continue;
    if (!/^\d{4}$/.test(id)) throw new Error(`Invalid asset ID: ${id}`);
    const direction = clean(rows[header + 3][col]);
    const endpoints = direction.split('→');
    if (endpoints.length !== 2 || endpoints.some(x => !x)) throw new Error(`Invalid direction: ${direction}`);
    columns.push({ col, id, name: clean(rows[header + 2][col]), voltageKV: numberOrNull(rows[header + 1][col]), from: endpoints[0], to: endpoints[1], note: clean(rows[header - 1][col]), values: [] });
  }
  if (new Set(columns.map(c => c.id)).size !== columns.length) throw new Error('Duplicate asset IDs');
  const times = [], originalTimes = [];
  for (const row of rows.slice(header + 4)) {
    if (row.every(cell => !clean(cell))) continue;
    const at = sourceTimestamp(row[0]);
    if (times.length && new Date(at).getTime() - new Date(times.at(-1)).getTime() !== 3600000) throw new Error(`Missing/duplicate/non-hourly timestamp at ${at}`);
    if (columns.some(c => c.col >= row.length)) throw new Error(`Truncated row at ${at}`);
    times.push(at); originalTimes.push(clean(row[0]));
    for (const c of columns) c.values.push(numberOrNull(row[c.col]));
  }
  return { times, originalTimes, lines: columns.map(({ col, ...line }) => line) };
}
export function parseCapacityCsv(text, type = 'line') {
  const rows = parseCsv(text);
  const published = clean(rows[0]?.[0]);
  if (!/^\d{4}年\d{1,2}月\d{1,2}日作成$/.test(published)) throw new Error('Capacity publication date missing');
  const expected = type === 'line' ? ['送電線 No', '送電線名'] : ['変電所 No', '変電所名'];
  if (!expected.every((label, i) => clean(rows[1]?.[i]) === label)) throw new Error('Unexpected capacity headers');
  const records = rows.slice(2).filter(r => clean(r[0])).map(r => {
    const voltageKV = numberOrNull(r[2]);
    if (type === 'line') return { id: clean(r[0]), name: clean(r[1]), voltageKV, circuitCount: numberOrNull(r[3]), equipmentMW: numberOrNull(r[4]), capacityMW: numberOrNull(r[5]), constraint: clean(r[6]), direction: clean(r[7]), forecastMW: numberOrNull(r[8]), note: clean(r[16]), published };
    return { id: clean(r[0]), name: clean(r[1]), primaryKV: voltageKV, secondaryKV: numberOrNull(r[3]), bankCount: numberOrNull(r[4]), equipmentMW: numberOrNull(r[5]), capacityMW: numberOrNull(r[6]), constraint: clean(r[7]), forecastMW: numberOrNull(r[8]), note: clean(r[16]), published };
  });
  return { published, records };
}
