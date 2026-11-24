// How a geographic line is drawn, independent of UI state. Rules (2026-09-30/10-01):
// underground = dotted, overhead = solid, straight line of unknown route = dashed (dotted if underground). DC follows the same rule and is told apart by colour only (2026-11-07).
// 要注意 (OSM-only C tier / straight D tier / auxiliary-only E tier) is drawn at the same opacity as A/B tiers (2026-11-07); the tier is shown as「要注意」in the detail panel and list (the tooltip shows only name, voltage and AC/DC: 2026-11-07).
import type {GeoLine} from './real-domain';
export const DOTTED = '1 7', DASHED_UNKNOWN = '10 6';
/** 建設中・計画中の線（2026-10-03）：他の破線と区別する長い破線 */
export const PLANNED_DASH = '22 9';
export const LINE_OPACITY = 0.95, BAND_OPACITY = 0.28;

/** Dash pattern for path i of a line ('' = solid). */
export function pathDash(line: GeoLine, i: number): string {
  if (line.status === '建設中' || line.status === '計画中') return PLANNED_DASH;
  const part = line.schematicParts?.find(p => p.osmId === line.osmIds[i]);
  if (part) return part.construction === 'underground' ? DOTTED : part.construction === 'overhead' ? '' : DASHED_UNKNOWN;
  if (line.cableOsmIds?.includes(line.osmIds[i])) return DOTTED;
  if (line.schematic) return line.construction === 'underground' ? DOTTED : line.construction === 'overhead' ? '' : DASHED_UNKNOWN;
  return '';
}
/** 要注意 lines carry an attribute whose label starts with 要注意 (C/D/E tier). */
export const isCaution = (line: Pick<GeoLine, 'attributes'>) => !!line.attributes?.some(a => a.label.startsWith('要注意'));

// 収録線分（OSM の way）を一度ずつ。記号でなぞった区間（負の仮ID）をはさんで同じ way を何度も使う線がある（飛騨信濃直流幹線、2026-11-07）
export const osmWays = (line: Pick<GeoLine, 'osmIds'>) => [...new Set(line.osmIds.filter(i => i > 0))];
