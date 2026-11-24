import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const geo=read('public/data/tohoku-trunk-osm.json'),dc=read('public/data/tohoku-dc-osm.json'),nw=read('data/private/network-capacity.json'),flow=read('data/catalog/tohoku-flow-audit.json');
const norm=s=>s.normalize('NFKC').replace(/\s/g,'');
const rows=nw.lines.map(l=>{
 const matches=geo.lines.filter(g=>g.voltageKV===l.voltageKV&&g.name.split(/[;／/]/).some(n=>norm(n)===norm(l.name)));
 const flows=flow.rows.filter(f=>norm(f.name)===norm(l.name)&&f.voltageKV===l.voltageKV);
 return {sourceId:l.id,name:l.name,voltageKV:l.voltageKV,direction:l.direction,sourceUrl:l.sourceUrl,published:l.published,geometryStatus:matches.length?'名称電圧一致の表示候補あり':'地理ルート未照合',assetIds:matches.map(g=>g.assetId),electricalConnection:'未確認',unresolvedEndpoints:matches.flatMap(g=>(g.connections??[]).filter(e=>e.status==='unresolved').map(e=>e.node)),flowStatus:flows.map(f=>f.status).join(',')||'OCCTO対応未収録'}; // 設備容量・運用容量は書かない（各社の空容量一覧の値は公開しない。2026-11-09 保留95 ⑤-5）
});
const result={checkedAt:new Date().toISOString(),scope:'東北NW空容量一覧500/275kV。公式系統図の全記号と一対一の手動照合は未完了。名称一致は同一設備の確定ではない。',officialRows:rows.length,withGeometryCandidates:rows.filter(r=>r.assetIds.length).length,withoutGeometryCandidates:rows.filter(r=>!r.assetIds.length).length,rows};
writeFileSync('data/catalog/tohoku-coverage.json',JSON.stringify(result,null,2));
const cell=s=>String(s??'未公表').replaceAll('|','／');
writeFileSync('docs/TOHOKU_COVERAGE_REGISTER.md',`# 東北の収録状況・未解決事項\n\n確認日：${result.checkedAt.slice(0,10)}。対象：東北6県・新潟、500/275kVと北海道連系DC。\n\n公式空容量一覧${rows.length}件中、名称・電圧一致の地理候補あり${result.withGeometryCandidates}件、未照合${result.withoutGeometryCandidates}件。候補なしは「実際に設備が存在しない」「地図に一切ない」とは断定しない。別名や無名線分の可能性がある。\n\n${result.scope}\n\n|公式番号|路線|kV|地図|未確認端点数|潮流対応|一次資料|\n|---|---|---:|---|---:|---|---|\n`+rows.map(r=>`|${r.sourceId}|${cell(r.name)}|${r.voltageKV}|${r.geometryStatus}|${r.unresolvedEndpoints.length}|${r.flowStatus}|[原表](${r.sourceUrl})|`).join('\n')+`\n\n## 設備と直流\n\n交流表示設備${geo.facilities.length}、DC追加設備${dc.facilities.length}件（地域間重複は表示時除外）。変電所全設備の公式台帳との同定は未完了。発電所はplant-profiles.jsonの一次資料・確認日を参照。\n北本直流幹線と北斗今別直流幹線は地理表示・公式区間説明あり。OCCTOの本データセットとの潮流対応・運用容量対応は未完了。\n\n## 未解決事項の扱い\n\n- 公式系統図の全路線・全設備記号の手動突合：未完了。全国拡大でこの状態を「完全収録」と表現しない。\n- 地理経路候補13区間中12区間の両端名称一致は参考確認。電気的接続・回線数・分岐・集約範囲の確定は全区間未完了。\n- 勿来幹線：OCCTOとNW表の対象区間差。地図上の潮流は保留。TOHOKU_FLOW_AUDIT.md参照。\n- 未接続端点はconnection-gaps.jsonの${read('public/data/connection-gaps.json').gaps.length}件を管理。NETWORK_COVERAGE.md参照。\n- 容量未公表・方向不明は推定せず欠測のまま保持。\n\n解消時は一次資料URL・公表日・確認日・担当・変更前後のassetIdを記録し、この一覧を再生成する。生成：node scripts/coverage-register.mjs。\n`);
console.log({officialRows:result.officialRows,matched:result.withGeometryCandidates,unmatched:result.withoutGeometryCandidates});
