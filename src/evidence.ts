// 照合区分（evidenceTier）と推定接続（inferred）を線に付ける（2026-10-03 指摘4b、定義は docs/EVIDENCE_TIERS.md）。
// データの「照合区分」項目と接続の記録から決める。公開用の東北データは書き換えないので、読み込み時に全地域へ同じ規則で当てる。
import type {EvidenceTier, GeoLine, InferredPoint} from './real-domain.ts';
const TIER = /^([ABCDE])区分/;
// 接続・分岐・対応付けを推定した旨の記述（潮流の推定など、接続以外の「推定」は含めない）
// 「〜接続は推定しない」のような否定の文は除く（2026-10-18。「推定はしない」のように間に語が入る形や「推定しなかった」「推定できない」は対象外で、推測のまま）
export const CONNECTION_GUESS = /(分岐|接続|合流|起点|端点|対応付け|鉄塔|号は).{0,40}(推定(?!し(ない|ていない|ません)|せず|されない)|とみなし)|(推定(?!し(ない|ていない|ません)|せず|されない)|とみなし).{0,20}(分岐|接続|合流|起点|端点)/;
const CONNECTION_LABELS = new Set(['分岐点の推定', '注記', '公表区間との対応', '地理参照', '端点の根拠', '名称・経路の照合', '根拠', '注記（経路）']);
export function evidenceOf(line: GeoLine): {tier?: EvidenceTier; inferred: InferredPoint[]} {
  const label = line.attributes?.find(a => a.label === '照合区分')?.value.match(TIER)?.[1] as EvidenceTier | undefined;
  const fallback = line.attributes?.some(a => a.label.startsWith('要注意（E区分')) ? 'E' : line.attributes?.some(a => a.label.startsWith('要注意（D区分')) ? 'D' : line.attributes?.some(a => a.label.startsWith('要注意（C区分')) ? 'C' : undefined;
  const ends = line.connections ?? [];
  // D区分は両端が設備（公表資料の端点）で確定しているものだけ。端が推定の分岐点なら C
  let tier: EvidenceTier | undefined = label ?? fallback;
  if (tier === 'D' && !ends.every(e => e.facilities?.length || /#\d+/.test(line.name + JSON.stringify(line.attributes ?? [])))) tier = 'C';
  const notes = (line.attributes ?? []).filter(a => CONNECTION_LABELS.has(a.label) && CONNECTION_GUESS.test(a.value)).map(a => a.value);
  const inferred: InferredPoint[] = [];
  // 公表区間を描いた線だけが対象（東北のOSMの線のまとまりは、端が別の線につながるだけで分岐点を推定したものではない）
  const section = line.referenceReview?.status === 'section' || !!line.attributes?.some(a => a.label === '公表区間' || a.label === '公表区間との対応');
  if (section) for (const e of ends) if (e.status === 'shared-node' && !e.facilities?.length)
    inferred.push({point: e.position, basis: notes.find(n => /分岐|合流|起点|鉄塔|号は/.test(n)) ?? '公表資料の分岐端点を、分岐元の線との共有OSMノード（または最寄り点）とみなした。位置は推定。'});
  if (!inferred.length && notes.length) inferred.push({point: null, basis: notes[0]});
  return {tier, inferred};
}
export function annotateEvidence(lines: GeoLine[]): GeoLine[] {
  for (const l of lines) { const e = evidenceOf(l); l.evidenceTier = e.tier; if (e.inferred.length) l.inferred = e.inferred; else delete l.inferred; }
  return lines;
}

// 設備（変電所・開閉所・変換所・発電所）の確度（2026-10-09）。
// A＝名称と位置を国土地理院の地図の注記（または事業者の公表所在地）で確認、B＝公表名と地図データの区画名が一致、
// C＝地図データのみ（名前のない区画に名称を当てたものを含む）、D＝位置を推定で配置（住所の代表点・ダムなどで代用、提供された座標を含む）。
// E＝補助資料のみ（2026-10-11、最低区分）：設備の存在・役割の根拠が補助資料（OSM・報道など）だけ。データの evidenceTier か「要注意（E区分）」で指定する。
type FacilityLike = {name?: string; url?: string; attributes?: {label: string; value: string}[]; evidenceTier?: EvidenceTier};
export function facilityTierOf(f: FacilityLike): EvidenceTier {
  const has = (re: RegExp) => !!f.attributes?.some(a => re.test(a.label));
  const val = (re: RegExp) => (f.attributes ?? []).filter(a => re.test(a.label)).map(a => a.value).join(' ');
  if (f.evidenceTier) return f.evidenceTier;
  if (has(/^要注意（E区分/)) return 'E';
  // 地図データの区画がない設備（-place）でも、名称と位置を国土地理院の地図注記で確かめたもの（属性「位置の確認」が「国土地理院の地図注記「<設備名>」」で始まる）は A
  // （2026-11-17）。位置推定（位置の根拠・要注意（位置…））の付いたものは D のまま
  if (!f.url?.includes('openstreetmap') && f.name && !has(/^位置の根拠$|^要注意（位置/) && val(/^位置の確認$/).startsWith(`国土地理院の地図注記「${f.name}」`)) return 'A';
  if (!f.url?.includes('openstreetmap') || has(/^位置の根拠$|^要注意（位置/)) return 'D';
  if (/発表の所在地.*一致|公表の所在地.*一致/.test(val(/確認/))) return 'A';
  const named = has(/^要注意（C区分/) || has(/名称・位置の根拠|名称の訂正|名称の根拠/);
  if (has(/^位置の確認$/) && !named) return 'A';
  return named ? 'C' : 'B';
}
