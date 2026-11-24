// 原子力の号機の運転状態（原子力規制委員会「発電所の現在の運転状況」、scripts/fetch-nra-status.mjs が1日1回取得。2026-11-10）。
// 地図の発電所（設備ID）と規制委の見出しの id の対応は、ここに書いたものだけ（名前の推測で付けない）。
// 号機は「n号機」（全角数字はそろえる）で照合し、番号のない号機（HJKS の「単独」）は規制委の「-」に当てる。対応しない号機には付けない。
export type NuclearStatus = {schemaVersion: 1; source: {name: string; url: string}; pageUpdated: string; retrievedAt: string; sha256: string; plants: Record<string, Record<string, string>>};
export const NRA_PLANT_IDS: Record<string, string> = {
  'way/640607782': 'tomari', 'osm-way-605420907': 'thhigashidori', 'osm-way-1341021071': 'onagawa', 'osm-way-104409614': 'fukushima2',
  'osm-way-216480979': 'kashiwazaki', 'osm-relation-1527911': 'tokai2', 'japc-tokai-1': 'tokai', 'osm-way-806310370': 'hamaoka',
  'osm-way-255763556': 'shika', 'osm-way-449155824': 'tsuruga', 'osm-way-605420905': 'mihama', 'osm-way-605382252': 'ooi',
  'osm-way-456491990': 'takahama', 'osm-way-605382253': 'shimane', 'osm-way-456491989': 'ikata', 'osm-way-172644773': 'genkai', 'osm-way-215429864': 'sendai',
};
/** 取得が古い（日本時間で2日より前）ときは運転状態を出さない */
export const STALE_DAYS = 2;
export function nuclearStale(d: NuclearStatus, now: Date): boolean {
  const t = Date.parse(d.retrievedAt);
  return !Number.isFinite(t) || now.getTime() - t > STALE_DAYS * 86400000;
}
/** 号機の運転状態。対応がない・古いときは null */
export function nuclearUnitStatus(d: NuclearStatus | null, facilityId: string, unitName: string, now: Date): string | null {
  if (!d || nuclearStale(d, now)) return null;
  const id = NRA_PLANT_IDS[facilityId], units = id ? d.plants[id] : undefined;
  if (!units) return null;
  const n = unitName.normalize('NFKC').match(/(\d+)\s*号機$/)?.[1];
  return (n ? units[n + '号機'] : units['-']) ?? null;
}
