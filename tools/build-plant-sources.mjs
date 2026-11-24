// 地図の発電所の電源の種類（水力・火力・原子力・バイオマス・太陽光・風力・地熱）を決めて app/src/plant-sources.ts に書く（2026-10-07 オーナー指示：発電所マークを電源ごとの色と絵に、案B）。
// 決め方（上から順。2026-10-17 から一次資料が最優先）：⓪一次資料（設備の「発電方式（一次資料）」→ HJKS の発電形式。下の fromMethod）①設備の詳細欄のOSM登録の種別（種別：hydro など）と名前 ②OSMの区画の plant:source・名前 ③下の一覧（名前から一般に知られた電源。根拠を書く）。
// 決まらないものは書かない（画面では今の茶色の丸）。builder の後に実行する。
import fs from 'node:fs';
import path from 'node:path';
import { loadUnion } from './lib/osm-union.mjs';
const APP = path.resolve(import.meta.dirname, '..');
const FILES = ['tohoku-trunk', 'hokkaido-hokuto', 'tokyo-trunk', 'chubu-trunk', 'hokuriku-trunk', 'kansai-trunk', 'chugoku-trunk', 'shikoku-trunk', 'kyushu-trunk'];
// 判定語は scripts/plant-source-rules.mjs（テストあり。2026-10-10 に「原発」の誤判定を直して移した）。このツールも 2026-10-10 にルートの tools/ から app/tools/ へ移した（git 管理）
import { pick } from '../scripts/plant-source-rules.mjs';
// 名前だけでは分からないもの（一般に知られた電源の種類）
const MANUAL = {
  泊発電所: ['nuclear', '北海道電力 泊発電所（原子力）'], 東海発電所: ['nuclear', '日本原子力発電 東海発電所（原子力、廃止措置中）'], 佐久間発電所: ['hydro', '電源開発 佐久間発電所（水力）'],
  姫路第一発電所: ['thermal', '関西電力 姫路第一発電所（火力・LNG）'], 姫路第二発電所: ['thermal', '関西電力 姫路第二発電所（火力・LNG）'], 赤穂発電所: ['thermal', '関西電力 赤穂発電所（火力）'],
  宮津エネルギー研究所: ['thermal', '関西電力 宮津エネルギー研究所（旧宮津火力発電所）'], 黒部川第四発電所: ['hydro', '関西電力 黒部川第四発電所（水力）'], 新黒部川第三発電所: ['hydro', '関西電力 新黒部川第三発電所（水力）'], 新黒部川第二発電所: ['hydro', '関西電力 新黒部川第二発電所（水力）'],
  新改発電所: ['hydro', '四国電力 新改発電所（水力）'], 新大分発電所: ['thermal', '九州電力 新大分発電所（火力・LNG）'], '芽登第二発電所（推定）': ['hydro', '電源開発 芽登第二発電所（水力）'],
  // 2026-11-17 保留127 K9：JFE千葉（2019年の東京PGの系統図の名称を OSM の区画に当てた推定）。種類は OSM の出典欄の事業者の発表（補助資料）による
  JFE千葉: ['thermal', 'JFEスチール 東日本製鉄所（千葉地区）の発電所（火力、補助資料による。一次資料未確認）'],
  真岡発電所: ['thermal', 'コベルコパワー真岡 真岡発電所（火力・都市ガス）'], 新中袖発電所: ['thermal', '新中袖発電所（火力・ガス）'], 東京ガスベイパワー: ['thermal', '東京ガスベイパワー（火力・ガス）'], 扇島パワーステーション: ['thermal', '扇島パワーステーション（火力・LNG）'],
};
const { els } = loadUnion(APP);
// 2026-10-17 オーナー指示：マークは一次資料の発電方式を優先する（docs/RULES.md 3節）。①設備の「発電方式（一次資料）」（docs/research/plant-primary-sources.json）
// ②HJKS のユニットの発電形式（public/data/plant-units.json、運転中のユニットを優先、1種類に決まるときだけ）。どちらもなければ、これまでの順（OSMの登録・名前・一覧・詳細欄）
const CHECK = process.argv.includes('--check');
const fromMethod = t => { if (!t) return null; t = String(t);
  if (/^火力（バイオマス/.test(t)) return 'biomass'; if (/^火力|^汽力|^内燃力/.test(t)) return 'thermal'; if (/^(一般)?水力|^揚水/.test(t)) return 'hydro';
  if (/^原子力/.test(t)) return 'nuclear'; if (/^太陽光/.test(t)) return 'solar'; if (/^風力/.test(t)) return 'wind'; if (/^地熱/.test(t)) return 'geothermal'; return null; };
const UNITS = JSON.parse(fs.readFileSync(path.join(APP, 'public/data/plant-units.json'), 'utf8')).plants;
const hjksOf = id => { const u = UNITS[id]?.units ?? []; const live = u.filter(x => x.status === '運転中'); const ks = [...new Set((live.length ? live : u).map(x => fromMethod(x.format)).filter(Boolean))]; return ks.length === 1 ? ks[0] : null; };
const warn = [];
const osmKey = id => { const m = String(id).match(/^(?:osm-)?(way|relation|node)[-/](\d+)$/); return m ? m[1] + '/' + m[2] : null; };
const out = {}, reason = {}, left = [];
for (const f of FILES) { const g = JSON.parse(fs.readFileSync(path.join(APP, `public/data/${f}.json`), 'utf8'));
  for (const x of g.facilities.filter(x => x.kind === 'plant')) { if (out[x.id]) continue;
    const attrs = (x.attributes ?? []).map(a => a.label + '：' + a.value).join(' / ');
    const m = attrs.match(/(?:種別|発電方式（OSM登録）)：\s*([a-z_;]+)/);
    // basis：根拠の種類（2026-10-09 オーナー指示で docs/research/plant-sources-basis.json に記録。tools/audit-plants.mjs が読む）
    //   osm＝OSMの登録（補助資料）、name＝名前の方式語、manual＝下の一覧（一般に知られた電源の種類）、detail＝詳細欄の文
    let k = pick((m ? m[1] + ' ' : '') + x.name), why = '名前・詳細欄の種別', basis = m && pick(m[1]) === k ? 'osm' : 'name';
    if (!k) { const e = els.get(osmKey(x.id)); if (e?.tags) { k = pick([e.tags['plant:source'], e.tags['generator:source'], e.tags.name, e.tags['name:en']].filter(Boolean).join(' ')); why = 'OSMの plant:source・名前'; basis = pick([e.tags['plant:source'], e.tags['generator:source']].filter(Boolean).join(' ')) === k ? 'osm' : 'name'; } }
    if (!k && MANUAL[x.name]) { [k, why] = MANUAL[x.name]; basis = 'manual'; }
    if (!k) { k = pick(attrs); why = '詳細欄'; basis = 'detail'; }
    // 一次資料を優先する。これまでの順で決まった種類と違うときは警告を出す（名前・OSMとの食い違いを人が確かめる）
    const prim = fromMethod((x.attributes ?? []).find(a => a.label === '発電方式（一次資料）')?.value), p = prim ?? hjksOf(x.id);
    if (p) { if (k && k !== p) warn.push(`${x.id} ${x.name}：一次資料 ${p} ／ これまでの順 ${k}（${basis}）`); k = p; basis = 'primary'; why = prim ? '発電方式（一次資料）' : 'HJKSの発電形式'; }
    if (k) { out[x.id] = k; reason[x.id] = {basis, why}; } else left.push(f + ' ' + x.id + ' ' + x.name); } }
const basisText = JSON.stringify({note: '地図の発電所マーク（src/plant-sources.ts）の根拠。app/tools/build-plant-sources.mjs が生成。basis：primary＝一次資料（設備の発電方式（一次資料）、またはHJKSの発電形式。2026-10-17 から最優先）、osm＝OSMの登録（補助資料）、name＝名前の方式語、manual＝一般に知られた電源の種類の一覧、detail＝詳細欄の文', plants: Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([id, s]) => [id, {source: s, ...reason[id]}]))}, null, 1) + '\n';
const counts = {}; for (const k of Object.values(out)) counts[k] = (counts[k] ?? 0) + 1;
const body = Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([id, k]) => `  ${JSON.stringify(id)}: '${k}',`).join('\n');
const tsHead = `// 自動生成（app/tools/build-plant-sources.mjs、${new Date().toISOString().slice(0, 10)}）。発電所の電源の種類。ここにない発電所は「不明」（今の茶色の丸）。\n`;
const tsBody = `export type PlantSource = 'hydro' | 'thermal' | 'nuclear' | 'biomass' | 'solar' | 'wind' | 'geothermal';\nexport const plantSources: Record<string, PlantSource> = {\n${body}\n};\n`;
const TS = path.join(APP, 'src/plant-sources.ts'), BASIS = path.join(APP, 'docs/research/plant-sources-basis.json');
// HJKS にない号機（廃止措置中・建設中）：docs/research/plant-primary-sources.json の unitsNotInHjks から src/plant-extra-units.ts を作る（2026-11-10 オーナー承認 保留105）
const EXTRA = path.join(APP, 'src/plant-extra-units.ts');
const extraSrc = JSON.parse(fs.readFileSync(path.join(APP, 'docs/research/plant-primary-sources.json'), 'utf8')).unitsNotInHjks?.plants ?? {};
const extraOut = Object.fromEntries(Object.entries(extraSrc).sort(([a], [b]) => a.localeCompare(b)).map(([id, p]) => [id, p.units.map(u => { const s = p.sources[u.source]; if (!s?.url || !s.checkedAt) throw Error('unitsNotInHjks の出典 ' + id + ' ' + u.name); if (!['廃止措置中', '建設中'].includes(u.status)) throw Error('unitsNotInHjks の状態 ' + id + ' ' + u.status); return {name: u.name, mw: u.mw, start: u.start ?? null, status: u.status, source: s.name, url: s.url, checkedAt: s.checkedAt}; })]));
const extraBody = `export type PlantExtraUnit = {name: string; mw: number; start: string | null; status: '廃止措置中' | '建設中'; source: string; url: string; checkedAt: string};\nexport const plantExtraUnits: Record<string, PlantExtraUnit[]> = ${JSON.stringify(extraOut, null, 1)};\n`;
const extraHead = '// 自動生成（app/tools/build-plant-sources.mjs）。HJKS にない号機（廃止措置中・建設中）。元は docs/research/plant-primary-sources.json の unitsNotInHjks。\n';
for (const w of warn) console.log('  [警告] ' + w);
// --check：書き込まずに、作り直した結果が今のファイルと同じかだけ確かめる（1行目の生成日は比べない）。違えば終了コード1（tests/plant-marks.test.ts が使う）
if (CHECK) { const cur = fs.readFileSync(TS, 'utf8'), same = cur.slice(cur.indexOf('\n') + 1) === tsBody && fs.readFileSync(BASIS, 'utf8') === basisText && fs.existsSync(EXTRA) && fs.readFileSync(EXTRA, 'utf8') === extraHead + extraBody && warn.length === 0; // 一次資料と食い違う発電所があれば失敗（人が確かめて直す）
  console.log(same ? 'plant-sources：一致' : 'plant-sources：作り直しが必要（node tools/build-plant-sources.mjs を実行）'); process.exit(same ? 0 : 1); }
fs.writeFileSync(BASIS, basisText); fs.writeFileSync(TS, tsHead + tsBody); fs.writeFileSync(EXTRA, extraHead + extraBody);
console.log(counts, 'unknown', left.length); for (const l of left) console.log('  ', l);
