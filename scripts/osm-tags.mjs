// OSM frequency=0 denotes DC. Missing or mixed frequency is not assumed AC.
export function currentType(tags) {
  const values = String(tags.frequency ?? '').split(';').map(s => s.trim());
  if (values.every(s => s === '0')) return 'dc';
  if (values.every(s => /^\d+(\.\d+)?$/.test(s) && Number(s) > 0)) return 'ac';
  return 'unknown';
}
export function facilityKind(tags) {
  return ['plant','generator'].includes(tags.power) ? 'plant' : tags.substation === 'converter' ? 'converter' : tags.substation === 'switching' ? 'switchyard' : 'substation';
}
