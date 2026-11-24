export type Position = [number, number]; // latitude, longitude
export type FacilityKind = 'substation' | 'switchyard' | 'plant';
export type SourceKind = 'demo' | 'actual' | 'forecast';
export interface Source {
  kind: SourceKind;
  name: string;
  url?: string;
  publishedAt: string;
}
export interface Facility {
  id: string;
  name: string;
  kind: FacilityKind;
  position: Position;
  operatingCapacityMW: number | null;
  ratedOutputMW?: number;
  source: Source;
}
export interface FlowSample {
  at: string;
  mw: number | null; // positive: from -> to; null: unavailable
  capacityMW: number | null; // capacity applicable to THIS observation
  source: Source;
}
export interface TransmissionLine {
  id: string;
  name: string;
  voltageKV: number;
  from: string;
  to: string;
  path: Position[]; // ordered from -> to
  geometryQuality: 'verified' | 'approximate' | 'demo';
  source: Source;
  samples: FlowSample[];
}
export interface Thresholds { low: number; high: number }
export const defaults: Thresholds = { low: 50, high: 80 };
// 2026-10-10：100%超（運用容量を超える）を紫で新設。50%未満／50〜80%／80〜100%／100%超／不明
export const colors = { low: '#17866a', medium: '#d99a29', high: '#d95b53', over: '#8e3fbf', unknown: '#8b96a0' };
export function usage(sample: FlowSample | undefined): number | null {
  if (!sample || sample.mw === null || !Number.isFinite(sample.mw) ||
      sample.capacityMW === null || !Number.isFinite(sample.capacityMW) || sample.capacityMW <= 0) return null;
  return Math.abs(sample.mw) / sample.capacityMW * 100;
}
export function band(percent: number | null, thresholds = defaults): keyof typeof colors {
  if (percent === null || !Number.isFinite(percent)) return 'unknown';
  return percent < thresholds.low ? 'low' : percent < thresholds.high ? 'medium' : percent <= 100 ? 'high' : 'over';
}
export function direction(sample: FlowSample | undefined): -1 | 0 | 1 | null {
  if (!sample || sample.mw === null || !Number.isFinite(sample.mw)) return null;
  return sample.mw === 0 ? 0 : sample.mw > 0 ? 1 : -1;
}
export function isExtraHighVoltage(kv: number): boolean { return Number.isFinite(kv) && kv > 7; }
export function validThresholds(t: Thresholds): boolean {
  return Number.isFinite(t.low) && Number.isFinite(t.high) && t.low > 0 && t.high > t.low && t.high <= 100;
}
export function sampleAt(line: TransmissionLine, at: string): FlowSample | undefined {
  return line.samples.find(sample => sample.at === at);
}
