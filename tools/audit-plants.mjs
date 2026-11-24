// 発電所の発電方式チェック（2026-10-09 オーナー指示）。データは書き換えない。
// 使い方（app で実行）: node tools/audit-plants.mjs [--area tohoku|hokkaido|tokyo|chubu|hokuriku|kansai|chugoku|shikoku|kyushu|all]
//   [--plant <名前またはID>]（複数可。名前は正規化して部分一致、複数ヒットなら候補を出して終了）[--detail]（発電所ごとの情報カード）[--out <dir>]
// 出力: <out>/plant-audit-<日付>.json と .txt（既定 ../reports/plant-audit）。--plant のときは <out>/plant/（全体の前回差分の基準は上書きしない）。error があれば終了コード1。
// 比べる値（オーナー判断）：①地図のマーク（src/plant-sources.ts、大区分。根拠は docs/research/plant-sources-basis.json）②設備の属性「発電方式」③事業者の一次資料（public/data/plant-profiles.json の method）
//   ④属性「発電方式（一次資料）」（2026-10-10 追加。docs/research/plant-primary-sources.json から builder が付ける）。
//   HJKS（public/data/plant-units.json、ユニット別の発電形式）を一次資料として照合する。OSMの登録（属性「発電方式（OSM登録）」「OSM登録」の種別）は補助資料。
// 判定：
//   error  HJKSとの不一致（大区分＝火力/原子力/水力など、燃料＝石炭/石油/ガス）
//   warn   ①②③どうしの不一致／混在サイトで燃料レベルの属性（②③）が代表値1つだけ（①は対象外）／名前の方式語と矛盾／
//          HJKSにない発電所で方式が未設定・根拠が名前や一般知識だけ・根拠がOSMのみ（「未確認」）／一般水力と揚水が資料どうしで食い違う
//   info   OSMとの不一致（補助資料）／HJKSの「その他」・空欄のユニット（未確認）／水力で一般・揚水の判定材料がない（「一般/揚水 未確認」）
// 英語・日本語の値の混在はここで読みかえて比べる（データ側は統一しない）。混在サイトはユニット別のまま比べ、代表値で上書きしない。
import fs from 'node:fs';
import path from 'node:path';
import {plantSources} from '../src/plant-sources.ts';

const APP = path.resolve(import.meta.dirname, '..');
const AREAS = ['hokkaido', 'tohoku', 'tokyo', 'chubu', 'hokuriku', 'kansai', 'chugoku', 'shikoku', 'kyushu'];
const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const area = arg('area') ?? 'all';
if (area !== 'all' && !AREAS.includes(area)) throw Error('--area は ' + [...AREAS, 'all'].join('|'));
const OUT = path.resolve(arg('out') ?? path.join(APP, '../reports/plant-audit'));
const DATA = path.join(APP, 'public/data');
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8').replace(/^﻿/, ''));
const ALLOW = JSON.parse(fs.readFileSync(path.join(APP, 'tools/plant-audit-allowlist.json'), 'utf8')).entries;
const BASIS = JSON.parse(fs.readFileSync(path.join(APP, 'docs/research/plant-sources-basis.json'), 'utf8')).plants;
const PROFILES = new Map(read('plant-profiles.json').records.map(r => [r.id, r]));
const UNITS = read('plant-units.json');
const norm = s => String(s ?? '').normalize('NFKC').replace(/\s/g, '');

// 地図の発電所（エリアごとの *-trunk）。複数エリアのデータにある発電所はエリアを両方持つ（2026-10-10：佐久間発電所が東京だけと表示されていた）
const GEO = [['tohoku', 'tohoku-trunk.json'], ['hokkaido', 'hokkaido-hokuto.json'], ['tokyo', 'tokyo-trunk.json'], ['chubu', 'chubu-trunk.json'], ['hokuriku', 'hokuriku-trunk.json'], ['kansai', 'kansai-trunk.json'], ['chugoku', 'chugoku-trunk.json'], ['shikoku', 'shikoku-trunk.json'], ['kyushu', 'kyushu-trunk.json']];
const all = new Map();
for (const [a, f] of GEO) for (const x of read(f).facilities ?? []) { if (!(x.kind === 'plant' || (x.alsoKinds ?? []).includes('plant'))) continue; const o = all.get(x.id); if (!o) all.set(x.id, {...x, area: a, areas: [a]}); else if (!o.areas.includes(a)) { o.areas.push(a); o.area = o.areas.join('・'); } }

// ---- 方式の読みかえ（英語・日本語・OSMの値 → 大区分・燃料・揚水） ----
const MAJOR = {thermal: '火力', hydro: '水力', nuclear: '原子力', biomass: 'バイオマス', solar: '太陽光', wind: '風力', geothermal: '地熱'};
function classify(text) {
  const t = String(text ?? '').normalize('NFKC').toLowerCase();
  if (!t.trim()) return null;
  const fuels = new Set(), out = {major: null, fuels, pumped: null};
  // 「原発」は「市原発電所」「玉原発電所」など「〜原」＋「発電所」に当たるので、後ろが「電」のものは除く（scripts/plant-source-rules.mjs と同じ。2026-10-14）
  if (/原子力|nuclear|fission|原発(?!電)|bwr|pwr/.test(t)) out.major = '原子力';
  else if (/揚水|pumped/.test(t)) { out.major = '水力'; out.pumped = true; }
  else if (/水力|hydro|water|run-of-the-river|流込|調整池|貯水池/.test(t)) { out.major = '水力'; if (/water-storage|run-of-the-river|流込|一般水力/.test(t)) out.pumped = false; }
  else if (/地熱|geothermal/.test(t)) out.major = '地熱';
  else if (/バイオマス|biomass|biogas|木質/.test(t)) out.major = 'バイオマス';
  else if (/太陽光|solar|ソーラー/.test(t)) out.major = '太陽光';
  else if (/風力|wind/.test(t)) out.major = '風力';
  if (/石炭|coal/.test(t)) fuels.add('石炭');
  if (/石油|oil|重原油|重油|原油/.test(t)) fuels.add('石油');
  if (/ガス|gas|lng|コンバインド|combined/.test(t)) fuels.add('ガス');
  if (!out.major && (fuels.size || /火力|thermal|combustion/.test(t))) out.major = '火力';
  return out.major ? out : null;
}
const show = c => c ? c.major + (c.fuels.size ? '（' + [...c.fuels].join('・') + '）' : '') + (c.pumped === true ? '（揚水）' : c.pumped === false ? '（一般）' : '') : '未設定';
const attrOf = (x, re) => (x.attributes ?? []).filter(a => re.test(a.label)).map(a => a.value);
// 名前の方式語（「発電所」だけの名前は判定しない）
const nameWord = n => { const c = classify(n.replace(/発電所|研究所/g, '')); return c && /火力|原子力|水力|揚水|風力|太陽光|ソーラー|地熱|バイオマス|LNG|石炭/.test(n) ? c : null; };

// ---- 発電所の個別指定（--plant） ----
const queries = process.argv.flatMap((v, i) => v === '--plant' ? [process.argv[i + 1] ?? ''] : []).flatMap(q => q.split(',')).map(q => q.trim()).filter(Boolean);
const detail = process.argv.includes('--detail');
let selected = null;
if (queries.length) {
  selected = [];
  for (const q of queries) {
    let hits = [...all.values()].filter(x => x.id === q);
    if (!hits.length) { const part = [...all.values()].filter(x => norm(x.name).includes(norm(q))), exact = part.filter(x => norm(x.name) === norm(q)); hits = exact.length === 1 ? exact : part; }
    if (!hits.length) { console.log(`「${q}」に当たる発電所がありません。`); process.exit(2); }
    if (hits.length > 1) { console.log(`「${q}」に当たる発電所が${hits.length}か所あります。ID か、より詳しい名前で指定してください：`); for (const x of hits) console.log(`  ${x.id}　${x.name}　${x.area}`); process.exit(2); }
    if (!selected.includes(hits[0])) selected.push(hits[0]);
  }
}
const plants = [...all.values()].filter(x => (area === 'all' || x.areas.includes(area)) && (!selected || selected.includes(x)));

// ---- チェック ----
const findings = [], cards = [];
const add = (severity, check, x, message, extra = {}) => findings.push({severity, check, area: x.area, id: x.id, name: x.name, message, ...extra});
const HJKS_SRC = `日本卸電力取引所 発電情報公開システム（HJKS）ユニット一覧（${UNITS.retrievedAt}取得）`;
for (const x of plants) {
  const marker = plantSources[x.id] ? {major: MAJOR[plantSources[x.id]], fuels: new Set(), pumped: null} : null;
  const basis = BASIS[x.id];
  const attrRaw = attrOf(x, /^発電方式$/)[0], attr = classify(attrRaw);
  const prof = PROFILES.get(x.id), profC = classify(prof?.method === '未確認' ? '' : prof?.method);
  // 一次資料の属性（docs/research/plant-primary-sources.json → scripts/plant-primary.mjs、2026-10-10）。細区分「純揚水」「混合揚水」は揚水として読む
  const primRaw = attrOf(x, /^発電方式（一次資料）$/)[0], primC = classify(primRaw), primSrc = attrOf(x, /^出典（発電方式）$/)[0];
  const osmRaw = [...attrOf(x, /^発電方式（OSM登録）$/), ...attrOf(x, /^OSM登録$/).map(v => (v.match(/種別[：:]\s*([^、。]+)/) ?? [])[1]).filter(Boolean)];
  const osm = osmRaw.map(classify).find(Boolean) ?? null;
  const values = [['地図のマーク', marker, `src/plant-sources.ts（根拠：${basis ? {primary: '一次資料（発電方式・HJKS）', osm: 'OSMの登録', name: '名前の方式語', manual: '一般に知られた電源の種類の一覧', detail: '詳細欄の文'}[basis.basis] : '記録なし'}）`], ['属性「発電方式」', attr, `設備の属性「発電方式」：${attrRaw ?? ''}`], ['事業者の資料（method）', profC, prof ? `public/data/plant-profiles.json：${prof.method}（${prof.sources?.[0]?.url ?? '出典URLなし'}）` : ''], ['一次資料の属性', primC, `属性「発電方式（一次資料）」：${primRaw ?? ''}（${primSrc ?? '出典なし'}）`]].filter(v => v[1]);
  const hj = UNITS.plants[x.id];
  const units = hj ? hj.units.map(u => ({unit: u.unit, format: u.format, mw: u.mw, status: u.status, c: classify(u.format === 'その他' ? '' : u.format)})) : [];
  const live = units.filter(u => u.status === '運転中').length ? units.filter(u => u.status === '運転中') : units;
  const known = live.filter(u => u.c);
  const hjMajors = new Set(known.map(u => u.c.major)), hjFuels = new Set(known.flatMap(u => [...u.c.fuels]));
  const hjText = units.length ? live.map(u => `${u.unit} ${u.format ?? '空欄'}`).join('、') : 'HJKSになし';
  const currentText = values.map(([k, c]) => `${k}=${show(c)}`).join('／') || '未設定';
  const base = {current: currentText, hjks: hjText};

  // HJKSとの照合（error）と、混在サイトの代表値（warn）
  if (units.length) {
    const unknown = live.filter(u => !u.c);
    if (unknown.length) add('info', 'HJKS 未確認', x, `HJKSの発電形式が「その他」または空欄のユニット：${unknown.map(u => `${u.unit}（${u.format ?? '空欄'}）`).join('、')}`, base);
    if (known.length) for (const [k, c, src] of values) {
      if (!hjMajors.has(c.major)) { add('error', 'HJKSと不一致', x, `${k}が「${show(c)}」、HJKSは「${[...hjMajors].join('・')}」`, {...base, proposal: `${k}を「${[...hjMajors].join('・')}${hjFuels.size ? '（' + [...hjFuels].join('・') + '）' : ''}」に直す`, source: `${HJKS_SRC}／現在の値の根拠：${src}`}); continue; }
      if (c.fuels.size && hjFuels.size) {
        const extra = [...c.fuels].filter(f => !hjFuels.has(f));
        if (extra.length) add('error', 'HJKSと不一致', x, `${k}の燃料が「${[...c.fuels].join('・')}」、HJKSは「${[...hjFuels].join('・')}」`, {...base, proposal: `${k}の燃料を「${[...hjFuels].join('・')}」に直す（ユニット別：${known.map(u => u.unit + ' ' + [...u.c.fuels].join('・')).join('、')}）`, source: `${HJKS_SRC}／現在の値の根拠：${src}`});
        else if (k !== '地図のマーク' && hjFuels.size > 1 && c.fuels.size < hjFuels.size) add('warn', '代表値のみ', x, `${k}が燃料1つ（${[...c.fuels].join('・')}）だけ。HJKSはユニットごとに「${[...hjFuels].join('・')}」が混在`, {...base, proposal: 'ユニット別に保持（代表値で上書きしない）', source: HJKS_SRC});
      }
    }
  } else {
    // HJKSにない発電所：方式が未設定、根拠が名前・一般知識・詳細欄だけ、根拠がOSMのみ → 未確認
    if (!values.length) add('warn', '未確認', x, '発電方式が未設定（HJKSにもない）', {...base, proposal: '事業者の一次資料で方式を確認'});
    else if (!profC && !attr && !primC) add('warn', '未確認', x, `発電方式の根拠が${basis?.basis === 'osm' ? 'OSMのみ（補助資料）' : basis?.basis === 'manual' ? '一般に知られた電源の種類の一覧だけ（出典なし）' : basis?.basis === 'detail' ? '詳細欄の文だけ' : '名前の方式語だけ（出典なし）'}。HJKSにない`, {...base, proposal: '事業者の一次資料で方式を確認し、出典を付ける'});
  }
  // ①②③どうしの不一致（warn）
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    const [ka, a] = values[i], [kb, b] = values[j];
    const fuelClash = a.fuels.size && b.fuels.size && ![...a.fuels].some(f => b.fuels.has(f));
    if (a.major !== b.major || fuelClash) add('warn', '値どうしの不一致', x, `${ka}「${show(a)}」と${kb}「${show(b)}」が食い違う`, {...base, proposal: units.length ? 'HJKSに合わせて直す' : '一次資料で確認して揃える'});
  }
  // 名前の方式語との矛盾（warn）
  const nw = nameWord(x.name);
  if (nw) for (const [k, c] of [...values, ...(known.length ? [['HJKS', {major: [...hjMajors][0], fuels: hjFuels, pumped: null}]] : [])]) if (c.major !== nw.major && !(nw.major === '火力' && c.major === 'バイオマス')) add('warn', '名前と矛盾', x, `名前（${x.name}）は「${nw.major}」、${k}は「${show(c)}」`, base);
  // OSMとの不一致（info、補助資料）
  if (osm) for (const [k, c] of values) if (osm.major !== c.major || (osm.fuels.size && c.fuels.size && ![...osm.fuels].some(f => c.fuels.has(f)))) add('info', 'OSMと不一致（補助資料）', x, `OSMの登録「${osmRaw.join('／')}」と${k}「${show(c)}」が食い違う`, base);
  // 一般水力・揚水
  const isHydro = values.some(([, c]) => c.major === '水力') || hjMajors.has('水力');
  if (isHydro) {
    const sig = [['事業者の資料', profC?.pumped ?? null], ['一次資料の属性', primC?.pumped ?? null], ['名前', /揚水/.test(x.name) ? true : null], ['OSM', osmRaw.map(classify).find(c => c?.pumped !== null && c?.pumped !== undefined)?.pumped ?? null]].filter(([, v]) => v !== null);
    if (new Set(sig.map(([, v]) => v)).size > 1) add('warn', '一般/揚水 食い違い', x, sig.map(([k, v]) => `${k}=${v ? '揚水' : '一般'}`).join('、'), {...base, proposal: '事業者の一次資料で確認'});
    else if (!sig.length) add('info', '一般/揚水 未確認', x, '一般水力か揚水かの判定材料がない（HJKSは区別しない）', base);
  }
  if (selected && detail) cards.push({id: x.id, name: x.name, area: x.area, kind: [x.kind, ...(x.alsoKinds ?? [])].join('・'), status: x.status ?? '運用中', values: values.map(([k, c, src]) => ({key: k, value: show(c), source: src})), osm: osmRaw.length ? osmRaw.join('／') : '未確認', basis: basis ?? null, hjks: units.length ? units.map(u => `${u.unit} ${u.format ?? '空欄'} ${u.mw}MW ${u.status}`) : ['HJKSになし（未確認）']});
}

// ---- 位置（国土地理院、2026-10-24 オーナー承認。手順は docs/RULES.md 3節「設備の位置」・データの規則の place- の項） ----
// 保存済みの地図注記の照合結果（docs/research/gsi-facility-check.json、scripts/check-gsi-anno.mjs が作る）とデータだけを読む。ネットから取得しない。
const ANNO = (() => { try { return JSON.parse(fs.readFileSync(path.join(APP, 'docs/research/gsi-facility-check.json'), 'utf8')); } catch { return null; } })();
const annoById = new Map((ANNO?.facilities ?? []).map(r => [r.id, r])), annoDate = ANNO?.retrievedAt?.slice(0, 10) ?? null;
const posInfo = new Map();
for (const x of plants) {
  const basis = attrOf(x, /^(名称・)?位置の根拠$/)[0], estimated = attrOf(x, /^要注意（位置推定）$/).length > 0, r = annoById.get(x.id);
  const basisDate = [...String(basis ?? '').matchAll(/\d{4}-\d{2}-\d{2}/g)].map(m => m[0]).sort().at(-1) ?? null;
  const stale = !!(r && annoDate && basisDate && basisDate > annoDate);
  posInfo.set(x.id, {basis: !!basis, estimated, anno: r ? (r.match ? `一致（${r.match.knj}、約${r.match.m}m）` : '名前の注記なし') : '未照合', stale});
  if (x.id.includes('-place-') && !basis) add('warn', '位置', x, 'OSMの区画がない設備（place-）で、属性「位置の根拠」「名称・位置の根拠」がない（docs/RULES.md 3節 データの規則）');
  if (estimated) add('info', '位置', x, '要注意（位置推定）（docs/RULES.md 3節「設備の位置」）');
  if (r && !r.match) add('info', '位置', x, `国土地理院の地図注記の照合（${annoDate}）で、同じ名前の注記が見つからない（範囲は照合結果の rule）${stale ? '（照合が古い：位置の根拠の日付がそれより後）' : ''}`);
}

// ---- 確認済みリスト・差分・出力 ----
let allowlisted = 0;
for (const f of findings) { const e = ALLOW.find(a => a.id === f.id && a.check === f.check); if (!e || f.severity === 'info') continue; f.allowlisted = {reason: e.reason, source: e.source, confirmedAt: e.confirmedAt, was: f.severity}; f.severity = 'info'; f.message = '確認済み（' + e.confirmedAt + '）：' + f.message; allowlisted++; }
const OUTDIR = selected ? path.join(OUT, 'plant') : OUT;
fs.mkdirSync(OUTDIR, {recursive: true});
const now = new Date(), stamp = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(now);
const suffix = (area === 'all' ? '' : '-' + area) + (selected ? '-' + selected.map(x => x.name).join('_').normalize('NFKC').replace(/[\\/:*?"<>|\s（）()]/g, '').slice(0, 60) : '');
const base = `plant-audit-${stamp}${suffix}`;
const ids = plants.map(x => x.id).sort();
let diff = null;
if (!selected) {
  const prevFile = fs.readdirSync(OUT).filter(f => new RegExp(`^plant-audit-\\d{4}-\\d{2}-\\d{2}${suffix.replace(/[-_]/g, '\\$&')}\\.json$`).test(f)).sort().at(-1);
  if (prevFile) { const prev = JSON.parse(fs.readFileSync(path.join(OUT, prevFile), 'utf8')); diff = {previous: prevFile, added: ids.filter(id => !prev.ids.includes(id)), removed: prev.ids.filter(id => !ids.includes(id))}; for (const id of diff.removed) findings.push({severity: 'warn', check: '前回からの消失', area: null, id, name: null, message: `前回（${prevFile}）にあった発電所が消えた`}); }
}
const order = {error: 0, warn: 1, info: 2};
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.check.localeCompare(b.check, 'ja') || String(a.area).localeCompare(String(b.area)) || String(a.name).localeCompare(String(b.name), 'ja'));
const counts = {};
for (const f of findings) { const c = (counts[f.check] ??= {error: 0, warn: 0, info: 0}); c[f.severity]++; }
const totals = {plants: plants.length, withHjks: plants.filter(x => UNITS.plants[x.id]).length, error: findings.filter(f => f.severity === 'error').length, warn: findings.filter(f => f.severity === 'warn').length, info: findings.filter(f => f.severity === 'info').length};
fs.writeFileSync(path.join(OUTDIR, base + '.json'), JSON.stringify({schemaVersion: 1, generatedAt: now.toISOString(), options: {area, plant: queries, detail}, totals, counts, allowlisted, diff, ids, ...(cards.length ? {cards} : {}), findings}, null, 1) + '\n');
const T = [`発電方式チェック ${stamp}（範囲：${area}${selected ? '／発電所の個別指定' : ''}）`, `発電所 ${totals.plants}か所（HJKSあり ${totals.withHjks}）／error ${totals.error}・warn ${totals.warn}・info ${totals.info}（確認済みリストで info にしたもの ${allowlisted}件）`, ''];
for (const c of cards) {
  T.push(`■ 情報カード：${c.name}`, `  ID：${c.id}（${c.area}、${c.kind}、${c.status}）`);
  for (const v of c.values) T.push(`  ${v.key}：${v.value}（${v.source}）`);
  if (!c.values.length) T.push('  発電方式：未確認（未設定）');
  { const p = posInfo.get(c.id); if (p) T.push(`  位置：根拠の記載${p.basis ? 'あり' : 'なし'}${p.estimated ? '・要注意（位置推定）' : ''}・地図注記の照合 ${p.anno}${p.stale ? '（照合が古い）' : ''}`); }
  T.push(`  OSMの登録（補助資料）：${c.osm}`, `  HJKS：`); for (const u of c.hjks) T.push(`    - ${u}`); T.push('');
}
T.push('■ 項目別の件数（error / warn / info）'); for (const [k, c] of Object.entries(counts)) T.push(`  ${k}：${c.error} / ${c.warn} / ${c.info}`);
if (!selected) { const ps = [...posInfo.values()];
  T.push('', '■ 位置（国土地理院。docs/RULES.md 3節「設備の位置」）',
    `  要注意（位置推定） ${ps.filter(p => p.estimated).length}か所、位置の根拠の記載あり ${ps.filter(p => p.basis).length}か所`,
    `  地図注記の照合：${ANNO ? `${annoDate}、照合済み ${ps.filter(p => p.anno !== '未照合').length}か所（名前の注記なし ${ps.filter(p => p.anno === '名前の注記なし').length}・照合が古い ${ps.filter(p => p.stale).length}）／未照合 ${ps.filter(p => p.anno === '未照合').length}か所（照合は scripts/check-gsi-anno.mjs）` : '照合結果なし'}`); }
if (!selected) { T.push('', '■ 前回との差分'); T.push(diff ? `  前回：${diff.previous}／追加 ${diff.added.length}（${diff.added.join('、') || 'なし'}）／消失 ${diff.removed.length}（${diff.removed.join('、') || 'なし'}）` : '  前回のレポートなし（初回）'); }
for (const sev of ['error', 'warn', 'info']) {
  const list = findings.filter(f => f.severity === sev); if (!list.length) continue;
  T.push('', `■ ${sev}（${list.length}件）`);
  for (const f of list) T.push(`  [${f.check}] ${f.area ?? '-'} ${f.name ?? ''}（${f.id}）：${f.message}${f.proposal ? ' → 修正案：' + f.proposal : ''}`);
}
fs.writeFileSync(path.join(OUTDIR, base + '.txt'), T.join('\n') + '\n');
{ const cut = T.findIndex(s => /^■ (error|warn|info)（/.test(s)); console.log((cut < 0 ? T : T.slice(0, cut)).join('\n')); }
console.log(`\n出力：${path.join(OUTDIR, base)}.json / .txt`);
process.exitCode = totals.error ? 1 : 0;
