import type { Facility, FacilityKind, Source, TransmissionLine, Position } from './domain';

// All names, coordinates, capacities and flows below are synthetic.
// Do not replace only the labels with real asset names: verify topology and signs first.
export const demoSource: Source = {
  kind: 'demo', name: '操作確認用の仮想データ（実在設備ではありません）', publishedAt: '2026-09-20',
};
export const timestamps = Array.from({ length: 24 }, (_, hour) => `2026-09-20T${String(hour).padStart(2, '0')}:00:00+09:00`);
const facility = (id: string, name: string, kind: FacilityKind, position: Position, capacity: number | null): Facility =>
  ({ id, name: `仮想・${name}`, kind, position, operatingCapacityMW: capacity, source: demoSource });
export const facilities: Facility[] = [
  facility('a', '北部変電所', 'substation', [40.64, 140.83], 2400),
  facility('b', '北東発電所', 'plant', [40.37, 141.39], null),
  facility('c', '岩手変電所', 'substation', [39.57, 141.13], 2100),
  facility('d', '秋田変電所', 'substation', [39.58, 140.29], 1800),
  facility('e', '内陸開閉所', 'switchyard', [39.03, 140.99], null),
  facility('f', '宮城変電所', 'substation', [38.38, 140.77], 3000),
  facility('g', '沿岸発電所', 'plant', [38.40, 141.38], null),
  facility('h', '山形変電所', 'substation', [38.33, 140.25], 1600),
  facility('i', '福島変電所', 'substation', [37.56, 140.46], 2800),
  facility('j', '新潟変電所', 'substation', [37.77, 139.22], 1900),
  facility('k', '南部開閉所', 'switchyard', [36.98, 140.17], null),
  facility('l', '地域変電所', 'substation', [38.06, 140.91], 160),
  facility('m', '市街変電所', 'substation', [38.23, 140.98], 80),
];
facilities.find(f => f.id === 'b')!.ratedOutputMW = 1200;
facilities.find(f => f.id === 'g')!.ratedOutputMW = 1600;
export const facilityById = new Map(facilities.map(f => [f.id, f]));
function line(id: string, name: string, kv: number, from: string, to: string, capacity: number | null, base: number | null, via: Position[] = []): TransmissionLine {
  return {
    id, name: `仮想・${name}`, voltageKV: kv, from, to,
    path: [facilityById.get(from)!.position, ...via, facilityById.get(to)!.position],
    geometryQuality: 'demo', source: demoSource,
    samples: timestamps.map((at, hour) => ({
      at, capacityMW: capacity,
      mw: base === null ? null : Math.round(base * (0.82 + 0.18 * Math.cos((hour - 12) * Math.PI / 12))),
      source: demoSource,
    })),
  };
}
export const lines: TransmissionLine[] = [
  line('T01', '北東幹線', 500, 'a', 'c', 2400, 1020, [[40.20, 140.96], [39.96, 141.12]]),
  line('T02', '北部電源線', 275, 'b', 'a', 1500, 1160, [[40.57, 141.20]]),
  line('T03', '秋田連絡線', 275, 'a', 'd', 1400, 850, [[40.20, 140.45]]),
  line('T04', '東北中央幹線', 500, 'c', 'e', 2600, 2250, [[39.32, 141.04]]),
  line('T05', '宮城幹線', 500, 'e', 'f', 3000, 2160, [[38.72, 140.84]]),
  line('T06', '秋田山形線', 275, 'd', 'h', 1500, -680, [[39.01, 140.18], [38.63, 140.16]]),
  line('T07', '沿岸電源線', 275, 'g', 'f', 1800, 1540, [[38.52, 141.09]]),
  line('T08', '山形連絡線', 154, 'h', 'f', 700, -250),
  line('T09', '南東北幹線', 500, 'f', 'i', 3200, 1420, [[37.98, 140.57]]),
  line('T10', '新潟連絡線', 275, 'h', 'j', 1600, 1010, [[38.09, 139.79]]),
  line('T11', '南部幹線', 500, 'i', 'k', 3000, 2690, [[37.25, 140.32]]),
  line('T12', '地域供給線', 66, 'f', 'l', 220, null, [[38.18, 140.79]]),
  line('T13', '市街供給線', 33, 'l', 'm', null, 35),
  line('T14', '地域連絡線', 22, 'm', 'f', 90, 0),
];
// Include a missing hour explicitly: missing data must never be interpolated silently.
lines[3].samples[3].mw = null;
export const kindLabels: Record<FacilityKind, string> = { substation: '変電所', switchyard: '開閉所', plant: '発電所' };
