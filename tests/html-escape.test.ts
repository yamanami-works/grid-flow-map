// 画面の HTML の組み立てで、配信データの値を必ずエスケープする（2026-11-02 保留52、セキュリティレビュー C。docs/RULES.md 5節「画面の安全」）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {escapeHtml} from '../src/safe-html.ts';
import {facilitySymbol, plantSourceOf} from '../src/facility-symbol.ts';

test('escapeHtml：< > & " \' を文字として表し、null・undefined は空', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  assert.equal(escapeHtml(275), '275');
  assert.equal(escapeHtml(null), ''); assert.equal(escapeHtml(undefined), '');
});
test('発電所の種別：表に自分の項目としてある ID だけ引き、知らない種別でも記号の描画は落ちない', () => {
  for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'no-such-plant']) assert.equal(plantSourceOf(id), undefined, id);
  assert.equal(plantSourceOf('japc-tokai-1'), 'nuclear');
  const plain = facilitySymbol('plant', null);
  assert.equal(facilitySymbol('plant', 'no-such' as never), plain, '知らない種別は種別なしの丸');
  assert.equal(facilitySymbol('plant', '__proto__' as never), plain);
  assert.match(facilitySymbol('plant', 'hydro'), /plant-hydro/);
});

// 静的な検査：HTML を組み立てる行（< か > を含む行）の ${…} は、エスケープなどの安全な関数1つだけの式か、下の許可リスト（1つずつ確かめた分類付き）にあるものだけ。
// 変数名1つだけの式（${k}・${v} など）も対象。許可リストにあって使われなくなった式も失敗にする（リストを古いまま残さない）。
// 限界：1行の中の ${…} だけを見る（行をまたぐテンプレート・'+…+' の連結は見ない）。中に { } を含む式と 200 文字を超える式は見ない。
//   安全な関数は「式がその関数の呼び出しで始まり、)+ を含まない」で判定するので、esc(a) ? b : c・num(a) || b・esc(a).replace(…) のような式も通る（後ろの部分は見ていない）。
//   許可はファイルごとの式の文字列で照合するので、同じ式を同じファイルの別の HTML の行で使っても通る（分類が変わるときは式を変えて書く）。
const SAFE_CALL = /^(esc|num|number|external|externalLink|mw|this\.button|this\.capacity|this\.bank|facilitySymbol|badgeHtml|flowCardHtml|sparkSvg|tsoText|dirCap)\(/;
const safe = (e: string) => (SAFE_CALL.test(e) && !/\)\s*\+/.test(e)) || e === 'UNKNOWN' || /^[\w.?]+\.length$/.test(e) || /^[\w.]+\.toFixed\(\d\)$/.test(e) || /^[\w.]+\.map\((esc|unitRow|badgeHtml)\)\.join\([^)]*\)$/.test(e);
const CODE = 'コード内の固定値・計算した数値・条件で選ぶ固定の文字列（データの値は条件にだけ使う）';
const TEXT = 'HTML でなく文字として設定される（textContent・Leaflet の title/alt/className・線の選択の textContent・Set の鍵）';
const DOWN = '組み立てた先でエスケープされる（row() の名前・補足、this.button のラベル、detail-panel の notes・subtitle・sub、esc(notesSummary)・esc(timingText)）';
const HTML = '中の値を esc してから組み立てた HTML、または esc 済みの HTML を返す関数（external・endpointChips・candidateNote・this.bank など）';
const BUILT = '同じ関数の中で、esc 済みの値・数値・固定の文字列から組み立てた HTML の変数';
const ALLOW: Record<string, Record<string, string>> = {
  'src/real.ts': {
    "primarySources.map(source => externalLink(source.url, source.label)).join('')": HTML,
    'occtoLink()': HTML,
    'legalLinksHtml()': HTML, // src/legal.ts の固定文だけで組み立てたボタン（2026-11-16 保留117）
    'LEGAL_DIALOG_HTML': HTML, // src/legal.ts の固定文の dialog（中身は開くときに固定文を入れる）
    "s.label": CODE,
    "voltageKV": CODE,
    "label": CODE,
    "type": CODE,
    "type === 'seamlessphoto' ? 'jpg' : 'png'": CODE,
    "Object.hasOwn(kinds, k) ? k : 'unknown'": CODE,
    "Object.hasOwn(kinds, f.kind) ? f.kind : 'unknown'": TEXT,
    "roles.length > 1 ? ' facility-multi' : ''": CODE,
    "selectedId===f.id?' facility-selected':''": CODE,
    "f.status==='廃止'?' facility-retired':''": CODE,
    "f.name": TEXT,
    "line.name": TEXT,
    "line.voltageKV": TEXT,
    "currentLabel(line)": CODE,
    "selectedId === id ? 'selected' : ''": CODE,
    "color": CODE,
    "caution ? '<span class=\"caution-tag\">要注意</span>' : ''": CODE,
    "value": BUILT,
    "currentLabel(g)": CODE,
    "g.voltageKV": DOWN,
    "matches.length===1?' · 実績参考値':''": CODE,
    "l.voltageKV": DOWN,
    "l.id": DOWN,
    "[f.kind, ...(f.alsoKinds ?? [])].map(k => kinds[k]).join('・')": DOWN,
    "voltageText(f)": DOWN,
    "m": DOWN,
    "refState === 'matching' ? '一致' : refState === 'conflicting' ? '不一致' : '未登録・未確認'": CODE,
    "review": BUILT,
    "count": CODE,
    "m[2]": CODE,
    "m[3]": CODE,
    "m[4].padStart(2,'0')": CODE,
    "m[5]": CODE,
    "same?'dp-ok':'dp-warn'": CODE,
    "same?'一致':'差異あり'": CODE,
    "net.capacityMW===null?UNKNOWN:num(net.capacityMW)+' MW'": CODE,
    "occCap.capacityMW===null?UNKNOWN:num(occCap.capacityMW)+' MW'": CODE,
    "endpointChips(g,actual)": HTML,
    "g.referenceReview?esc(g.referenceReview.endpoints):[...new Set(c.flatMap(x=>x.facilities.map(f=>f.name)))].map(esc).join('・')||'対応未確認'": HTML,
    "c.filter(e=>e.status==='facility-area').length": CODE,
    "c.filter(e=>e.status==='shared-node').length": CODE,
    "c.filter(e=>e.status==='unresolved').length": CODE,
    "e.status==='facility-area'?e.facilities.map(f=>esc(f.name)).join(' / '):e.status==='shared-node'?'別の線分と共有ノードで接続':e.otherVoltages?.length?'他電圧・電圧不明の線分に接続（未確認）':'接続未確認の端点'": HTML,
    "showConnected?'選択した名称に戻す':'地図でたどる（設備までつながる線分を強調）'": CODE,
    "showConnected?'選択した名称の線分だけ表示':'つながる別名・無名線分も強調'": CODE,
    // 2026-11-06 保留79：直線補完となぞった区間（tracedParts）を分けて数える。根拠の文は osmFillText の中で esc を通す
    "g.publishedRoute?'':osmFillText(g)": HTML,
    "g.publishedRoute?'公表図の線形（OSMの線分ではありません）：'+esc(g.publishedRoute.featureNames.join('・')):'収録線分 '+osmWays(g).length+'（'+esc(osmWays(g).slice(0,8).join('・'))+(osmWays(g).length>8?' ほか':'')+'）'": HTML,
    "u.status==='運転中'?'':'dp-unit-off'": CODE,
    "u.status==='運転中'?num(u.mw)+' MW':esc(u.status)+(u.end?' '+esc(d(u.end)):'')+'（'+num(u.mw)+' MW）'": HTML,
    "profile.capacityBasis": DOWN,
    "osmOut": DOWN,
    "hj?'（認可出力）':''": CODE,
    "unitRows": BUILT,
    "osmOut?'<span class=\"dp-badge dp-warn\">OSM登録値・一次資料未確認</span>':''": CODE,
    "pt.partial||pt.unknown?' dp-capacity-osm':''": CODE,
    "retired?' dp-type-retired':''": CODE,
    "basis.length?basis.map(esc).join('<br>'):'なし'": HTML,
    "kindsAll.length>1?esc(kindsAll.map(k=>kinds[k]).join('・')):'なし'": HTML,
    "osm?'地点はOSMの点、または設備の区画の中心です。入口や実測座標ではありません。':ownerPlace?'地点は本アプリの調査で置いた代表点です（一次資料未確認）。敷地の範囲・入口ではありません。':'地点は住所・資料から求めた代表点です。敷地の範囲・入口ではありません。'": CODE,
    "attr(f,/位置の根拠/)?'<br>'+esc(attr(f,/位置の根拠/)!):''": HTML,
    "detailTab": CODE,
    "colors[band(percent)]": CODE,
    "percent === null ? '—' : percent.toFixed(1)": CODE,
    "percent === null ? '' : '%'": CODE,
    "Math.min(100, percent ?? 0)": CODE,
    "candidateNote(line)": HTML,
    "String(hourIndex>>1).padStart(2,'0')": CODE,
    "hourIndex%2?'30':'00'": CODE,
    "occto?'':flowLoading===day?'（読み込み中）':flowLoadFailed===day?'（読み込みに失敗）':'（対象日未収録）'": CODE,
    "enabled.has(v)?'active':''": CODE,
    "enabled.has(v)": CODE,
    "dc?'DC ':''": CODE,
    "!lower&&voltageKV===187&&!geography?.lines.some(l=>l.voltageKV===187&&l.currentType==='ac')?'（線路未収録）':''": CODE,
    "geography.lines.filter(l=>l.currentType==='dc').length": CODE,
    "voltageKV===187&&!geography?.lines.some(l=>l.voltageKV===187&&l.currentType==='ac')?'（線路未収録）':''": CODE,
    "e.node": TEXT,
    "geography?.lines.filter(g => g.currentType === 'dc').length ?? 0": CODE,
    "error instanceof Error ? error.message : '不明'": TEXT,
  },
  'src/miyagi-pilot.ts': {
    "l.name": TEXT,
    "l.voltageKV": TEXT,
    "counts.lines": CODE,
    "counts.facilities": CODE,
    "electricalColor(l,'lower')": CODE,
    "f.id===this.data.upper.facilityId?'上位275kVとの接続設備':f.upperReference?'154/66kV接続 · 上位経路未収録':'変電所 · バンクは別詳細'": CODE,
    "pilotVoltageColor(k)": CODE,
    "body": BUILT,
    "line.name==='山下線'?this.button(j.id,'途中分岐：蛇田支線 → 蛇田'):''": HTML,
    "this.data.lines.filter(l=>l.from===facility.id||l.to===facility.id).map(l=>this.button(l.id,l.name+' '+l.voltageKV+'kV')).join(' ')": HTML,
    "banks.map(b=>this.bank(b)).join('')": HTML,
    "this.data.lines.filter(l=>l.name==='山下線'||l.name==='蛇田支線').map(l=>this.button(l.id,l.name)).join(' ')": HTML,
  },
  'src/detail-panel.ts': {
    "p.month": CODE,
    "p.day": CODE,
    "p.hour": CODE,
    "p.minute": CODE,
    "short": DOWN,
    "notes.length > 1 ? ' ほか' : ''": CODE,
    "on ? 'L' : 'M'": CODE,
    "x(i).toFixed(1)": CODE,
    "y(v).toFixed(1)": CODE,
    "d": BUILT,
    "x(index).toFixed(1)": CODE,
    "y(cur).toFixed(1)": CODE,
    "arrow": CODE,
    "f.signFlipped ? '<p class=\"dp-sub dp-flow-flip\">向きはOCCTO公表値から反転（当サイトの判定）</p>' : ''": CODE,
    "f.usage === null ? '使用率 未確認' : '使用率 ' + f.usage.toFixed(0) + '%'": CODE,
    "pct": CODE,
    "f.usageColor": CODE,
    "f.usageColor === '#fff' || f.usageColor === '#ffffff' ? '#1B2328' : f.usageColor": CODE,
    "f.usage > 100 ? '<span class=\"dp-over\">運用容量超過</span>' : ''": CODE,
    "f.capacityMW === null ? '—' : num(f.capacityMW) + ' MW'": CODE,
    "value": BUILT,
    "dir": BUILT,
    "bar": BUILT,
    "usage": BUILT,
    "r.label": HTML,
    "r.html": HTML,
    "l.color": CODE,
    "l.side ? ' ' + l.side : ''": CODE,
    "l.usageColor === '#fff' ? '#4F5B63' : l.usageColor": CODE,
    "TONE_CLASS[b.tone]": CODE,
    "v.iconColor": CODE,
    "ICON[v.icon]": CODE,
    "v.banner.tone === 'retired' ? 'dp-banner-retired' : ''": CODE,
    "v.flow ? flowCardHtml(v.flow) : ''": HTML,
    "t": CODE,
    "t === tab": CODE,
    "t === 'overview' ? '概要' : '出典'": CODE,
    "head": BUILT,
    "tabs": BUILT,
    "tab": CODE,
    "body": BUILT,
    "t.letter === '—' ? ' dp-tier-none' : ''": CODE,
    "s.letter === t.letter ? 'dp-tier-on' : ''": CODE,
    "s.url ? externalLink(s.url, '').trim().replace('<a ', '<a class=\"dp-source-link\" aria-label=\"' + esc(s.label) + 'の出典を開く\" ') : '<span></span>'": HTML,
    "v.verification": HTML,
  },
  'src/change-plans.ts': {
    "t.label": DOWN,
    "t.raw": DOWN,
    'reviewMark(p,now)': CODE,
    'planBody(p,now)': HTML,
    "t.mapping.includes('OSM')?'<b class=\"plan-caution\">要注意</b>':''": CODE,
    "hit.kind==='facility'?'<small>（設備）</small>':''": CODE,
    'note': BUILT,
    'targetMarkup(t,resolve,pending)': HTML,
    "r.timing.map(t=>esc(t.raw)).join('<br>')||'時期未定'": HTML,
    'i': CODE,
    'rows': BUILT,
  },
};

test('画面の HTML の組み立て：データの値はエスケープを通るか、分類付きの許可リストにあるものだけ', () => {
  for (const [file, allow] of Object.entries(ALLOW)) {
    const found = new Set<string>();
    for (const [i, line] of readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
      if (!/[<>]/.test(line)) continue;
      for (const m of line.matchAll(/\$\{([^{}]{1,200})\}/g)) {
        const e = m[1].trim().replace(/\s+/g, ' ');
        if (!/[A-Za-z_]/.test(e) || safe(e)) continue;
        found.add(e);
        assert.ok(e in allow, `${file}:${i + 1} エスケープなしで埋め込んでいる：\${${e}}（esc で包むか、安全な理由を許可リストに書く）`);
      }
    }
    for (const e of Object.keys(allow)) assert.ok(found.has(e), `${file}：許可リストの ${e} はもう使われていない（リストから外す）`);
  }
});
test('保留52で直した箇所がエスケープのまま残っている', () => {
  const real = readFileSync('src/real.ts', 'utf8'), pilot = readFileSync('src/miyagi-pilot.ts', 'utf8');
  for (const s of ['data-real-kv="${esc(v)}"', "${dc?'DC ':''}${esc(voltageKV)} kV", '${esc(line.voltageKV)} kV · ${curr', '<dd>${esc(line.circuitCount)}</dd>', // '+esc(x.voltageKV)+' は未描画の一覧（2026-11-22 削除）にあった
    `<span class="facility-\${Object.hasOwn(kinds, k) ? k : 'unknown'}">`, "facility-${Object.hasOwn(kinds, f.kind) ? f.kind : 'unknown'}"]) assert.ok(real.includes(s), s);
  for (const s of ['${esc(k)}kV', 'data-pilot-select="${esc(l.id)}"', 'data-pilot-select="${esc(f.id)}"', 'data-pilot-link="${esc(id)}"', '<h3>${esc(b.primaryKV)}/${esc(b.secondaryKV)}kV']) assert.ok(pilot.includes(s), s);
});
