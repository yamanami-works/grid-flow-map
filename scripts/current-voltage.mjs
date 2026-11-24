// Reviewed operating voltage, not construction rating or future planned voltage.
// Apply after OSM grouping: historical geometry IDs must not change or merge.
export function applyCurrentVoltage(line) {
  if (line.id !== 'osm-250430938-500') return false;
  if (line.name !== '朝日幹線' || line.osmIds.length !== 1 || line.osmIds[0] !== 250430938) throw new Error('Asahi voltage review scope changed');
  line.voltageKV = 275;
  const label = '現行電圧の照合';
  line.attributes = [...(line.attributes ?? []).filter(a => a.label !== label), {label, value: '現行275kV：東北電力NW設備一覧2026年7月版・0128（西仙台変電所―越後開閉所）とOCCTO公表区間を照合。OSM原記載500kVを訂正。500kV昇圧は2026-06-01公表の将来計画（使用開始2030年度以降）であり未反映。地理ID・経路は保持。'}];
  return true;
}
