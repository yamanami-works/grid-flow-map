// 発電所の電源の種類を名前・属性の文から決める判定語（tools/build-plant-sources.mjs が使う。tests/plant-source-rules.test.mjs で誤判定を点検）。
// 上から順に当てる。2026-10-10：「原発」が「玉原発電所」「塩原発電所」など「〜原」＋「発電所」に当たり、水力・火力の5か所が原子力になっていた（tools/audit-plants.mjs で検出）。「原発電」は除く。
// 「共同発電」「パワーステーション」は火力の会社名に多い一般的な語なので、当たった発電所はテストで個別に確認している。
export const RULES = [
  ['nuclear', /nuclear|原子力|原発(?!電)/i],
  ['geothermal', /geothermal|地熱/i],
  ['biomass', /biomass|biogas|バイオマス|木質/i],
  ['solar', /solar|太陽光|ソーラー/i],
  ['wind', /wind|風力|ウインド|ウィンド/i],
  ['hydro', /hydro|水力|揚水|ダム/i],
  ['thermal', /\b(coal|gas|oil|diesel)\b|火力|石炭|LNG|ＬＮＧ|コンバインド|共同発電|瓦斯|パワーステーション/i],
];
export const pick = t => { for (const [k, re] of RULES) if (re.test(t)) return k; return null; };
