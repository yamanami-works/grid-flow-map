// 未描画の公表区間の一覧（2026-10-04 オーナー指示「描かれていない保留の基幹送電線をすべて記載」）→ public/data/undrawn-sections.json
// 入力：docs/research/tso-line-ledger.json（公表台帳）、ledger-anonymous-adopted.json（推定でも描けなかった行と需要家の線（個別追加待ち））。
// 各社の系統空容量一覧の行（線名・電圧・回線数・公表の端点）と、描けない理由だけを載せる。表そのものは配布しない。
import {readFileSync,writeFileSync} from 'node:fs';
import {publicWording} from './public-wording.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const ledger=read('docs/research/tso-line-ledger.json'),infer=read('docs/research/ledger-anonymous-adopted.json');
const SOURCE={hokkaido:'北海道電力ネットワーク 系統空容量（基幹系統・送電線）',tohoku:'東北電力ネットワーク 系統空容量（基幹系統）',tokyo:'東京電力パワーグリッド 設備一覧',chubu:'中部電力パワーグリッド 系統空容量・予想潮流マッピング',hokuriku:'北陸電力送配電 予想潮流・空容量（基幹系統・送電線）',kansai:'関西電力送配電 空容量一覧（154kV以上・送電線）',chugoku:'中国電力ネットワーク 系統空容量（220kV以上・送電線）',shikoku:'四国電力送配電 系統空容量（基幹系統・送電線）',kyushu:'九州電力送配電 予想潮流・空容量一覧表（送電線）'};
const row=(r,reason)=>({region:r.region,no:String(r.no??''),name:r.name||'（線名なし）',voltageKV:r.kv,circuits:r.circuits??'',direction:r.direction??'',reason,source:SOURCE[r.region]});
const rows=[
 ...infer.notDrawn.map(x=>row(x,/手がかりがない|手がかり/.test(x.reason)?(/^(送電線|他社線)?$/.test(x.name??'')||!x.name?'線名・端点が公表資料で伏せられ、OSMでたどる手がかりがない':'OSMで線名・経路が分からず、端点の設備からもたどれない'):x.reason)),
 ...infer.customer.map(x=>row(x,'需要家の線（一括では描かない。端点の確定に必要なときに個別に追加：2026-10-11 オーナー指示、docs/CUSTOMER_FACILITIES.md）')),
 ...ledger.rows.filter(r=>r.state==='需要家（個別追加待ち）').map(r=>row(r,'需要家の線（一括では描かない。端点の確定に必要なときに個別に追加：2026-10-11 オーナー指示、docs/CUSTOMER_FACILITIES.md）')),
];
// 推定の取り込み（tools/prep/adopt-ledger-infer.mjs）では描けず、builder で個別に対応付けて描いた行（2026-10-18 オーナー承認。四国 No.17・18・28・33・39・42〜44 は 2026-11-10 保留107、東北 0009・0137 は 2026-11-10 保留114・116）。地図の線が名前どおりにあることを確かめて一覧から外す
// 東京 No.32・106・142 は 2019年の東京PG の系統図で端点を確かめ、scripts/tokyo-2019-127.mjs で直線で描いた（2026-11-17 保留127 K7〜K9）
// 関西 No.89・86（2026-11-17 保留128-3）：堺港発電所の電源線（推定）・南大阪泉北線を scripts/kansai-128.mjs で直線で描いた
// 関西 No.50・51・92（2026-11-17 保留128-4）：三宮線・神戸発電所の電源線（推定）を scripts/kansai-128.mjs で直線で描いた
// 関西 No.206（2026-11-18 保留131-2）：新祖山線を scripts/kansai-130.mjs で描いた
// 関西 No.203・205（2026-11-18 保留130）：御母衣北幹線（中部の御母衣幹線を移して改名）・大黒部幹線を scripts/kansai-130.mjs で描いた
// 関西 No.59・60（2026-11-18 保留128-1）：美浜原子力発電所の連系線（推定）として scripts/kansai-128.mjs で描いた
// 関西 No.40（2026-11-19 保留135）：送電線（No.40）（推定）として scripts/kansai-135.mjs で描いた
// 関西 No.39・43・52（2026-11-19 保留136）：以前の姫路第二・高砂火力の連系線を No.39・43 とし、No.52 を scripts/kansai-136.mjs で描いた
// 北海道 No.50・56・57（2026-11-21 保留138）：鶴岡支線・今金中里支線・上八雲支線を scripts/hokkaido-138.mjs で直線で描いた
const BY_BUILDER={'hokkaido|50':['hokkaido-hokuto','hokkaido-138-鶴岡支線','鶴岡支線'],'hokkaido|56':['hokkaido-hokuto','hokkaido-138-今金中里支線','今金中里支線'],'hokkaido|57':['hokkaido-hokuto','hokkaido-138-上八雲支線','上八雲支線'],'kansai|39':['kansai-trunk','kansai-plant-275-way-367261461','送電線（No.39）（推定）'],'kansai|43':['kansai-trunk','kansai-plant-275-way-605382256','送電線（No.43）（推定）'],'kansai|52':['kansai-trunk','kansai-275-way-1580889887','送電線（No.52）（推定）'],'kansai|40':['kansai-trunk','ledger-infer-kansai-275-185027449','送電線（No.40）（推定）'],'kansai|206':['kansai-trunk','kansai-275-way-618344831','新祖山線'],'kansai|203':['kansai-trunk','jpower-275-way-440218167','御母衣北幹線'],'kansai|205':['kansai-trunk','kansai-275-way-256682326','大黒部幹線'],'kansai|59':['kansai-trunk','kansai-plant-500-way-605420905','美浜原子力発電所の連系線（No.59、推定）'],'kansai|60':['kansai-trunk','kansai-plant-275-way-725340694','美浜原子力発電所の連系線（No.60、推定）'],'kansai|50':['kansai-trunk','kansai-275-三宮線','三宮線'],'kansai|51':['kansai-trunk','kansai-275-送電線No.51','神戸発電所の電源線（No.51、推定）'],'kansai|92':['kansai-trunk','kansai-275-送電線No.92','神戸発電所の電源線（No.92、推定）'],'kansai|89':['kansai-trunk','kansai-275-送電線No.89','堺港発電所の電源線（No.89、推定）'],'kansai|86':['kansai-trunk','kansai-275-南大阪泉北線','南大阪泉北線'],'tokyo|32':['tokyo-trunk','tokyo-section-32','送電線No.32（電源線）'],'tokyo|106':['tokyo-trunk','tokyo-section-106','東扇島火力線'],'tokyo|142':['tokyo-trunk','tokyo-section-142','送電線No.142（電源線）'],'shikoku|36':['shikoku-trunk','shikoku-osm-187-722648701','蔭平線'],'shikoku|17':['shikoku-trunk','shikoku-plant-187-way-704208234','西条火力線'],'shikoku|18':['shikoku-trunk','shikoku-187-壬生川線','壬生川線'],'shikoku|28':['shikoku-trunk','shikoku-plant-187-way-605687599','坂出火力線'],'shikoku|33':['shikoku-trunk','shikoku-187-大川支線','大川支線'],'shikoku|39':['shikoku-trunk','shikoku-187-長山線','長山線'],'shikoku|42':['shikoku-trunk','shikoku-187-奈半利川支線','奈半利川支線'],'shikoku|43':['shikoku-trunk','shikoku-plant-187-way-844182805','二又線'],'shikoku|44':['shikoku-trunk','shikoku-187-魚梁瀬線','魚梁瀬線'],'shikoku|38':['shikoku-trunk','ledger-infer-shikoku-187-463775144','阿南幹線'],'kansai|57':['kansai-trunk','kansai-plant-275-way-1029051469','宮津線'],'chugoku|基L39':['chugoku-trunk','chugoku-220-俣野川線','俣野川線'],'chugoku|基L40':['chugoku-trunk','chugoku-220-新鳥取線','新鳥取線'],'chugoku|基L12':['chugoku-trunk','chugoku-220-新小野田火力連絡線','新小野田火力連絡線'],'chugoku|基L14':['chugoku-trunk','chugoku-220-新小野田火力山口線','新小野田火力山口線'],'tohoku|0009':['tohoku-trunk','tohoku-plant-500-way-929016336','0009線'],'tohoku|0137':['tohoku-trunk','tohoku-275-東福島支線','東福島支線']};
for(const [k,[file,id,name]] of Object.entries(BY_BUILDER)){const l=read(`public/data/${file}.json`).lines.find(x=>x.id===id);if(l?.name!==name)throw Error('未描画の一覧：'+k+' の線 '+id+' が「'+name+'」でない');
 const i=rows.findIndex(r=>r.region+'|'+r.no===k);if(i>=0){rows.splice(i,1);continue;}
 // 推定の取り込みを作り直すと、台帳で描画済みの行は notDrawn に入らない（そのときは外す行がなくてよい）
 if(ledger.rows.find(r=>r.region+'|'+r.no===k)?.state!=='描画済み')throw Error('未描画の一覧：'+k+' の行がなく、台帳でも描画済みでない');}
// 台帳（tools/prep/tso-line-ledger.mjs）で描画済みになった行は外す（線名の末尾の「線」の有無などを台帳の照合でそろえたもの。2026-11-16 中部 No.60 岐阜連絡線＝地図の「岐阜連絡」）
// 外すのは、台帳の drawnIds がすべて同じ地域のデータの線であるときだけ（別の地域の同名の線に当たったら止める）。外した行は表示する
{const geo=r=>{const f=r==='hokkaido'?['hokkaido-hokuto']:r==='tohoku'?['tohoku-trunk','tohoku-dc-osm']:[r+'-trunk'];return new Set(f.flatMap(n=>read(`public/data/${n}.json`).lines.map(l=>l.id)));};
 const drawn=new Map(ledger.rows.filter(r=>r.state==='描画済み').map(r=>[r.region+'|'+String(r.no??'')+'|'+r.name,r]));
 for(let i=rows.length-1;i>=0;i--){const r=drawn.get(rows[i].region+'|'+rows[i].no+'|'+rows[i].name);if(!r)continue;const ids=geo(r.region);
  if(!r.drawnIds?.length||!r.drawnIds.every(id=>ids.has(id)))throw Error('未描画の一覧：'+rows[i].region+'|'+rows[i].no+' '+rows[i].name+' の台帳の照合先 '+JSON.stringify(r.drawnIds)+' が同じ地域の線にない');
  console.log('台帳で描画済み（一覧から外す）：',rows[i].region,rows[i].no,rows[i].name,'→',r.drawnIds.join('・'));rows.splice(i,1);}}
const counts=Object.fromEntries(Object.keys(SOURCE).map(k=>[k,{published:ledger.rows.filter(r=>r.region===k).length,undrawn:rows.filter(r=>r.region===k).length}]));
writeFileSync('public/data/undrawn-sections.json',JSON.stringify(publicWording({schemaVersion:1,generatedAt:ledger.generatedAt,basis:'各社の系統空容量一覧（送電線）の基幹電圧の行のうち、地図に描いていないもの。2026-10-04時点。',counts,rows},'undrawn-sections.json'),null,1)+'\n');
console.log('undrawn sections',rows.length);
