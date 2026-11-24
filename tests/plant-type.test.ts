import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {plantTypeView,fromHjks} from '../src/plant-type.ts';
// 2026-10-10 オーナー指示：種別は一次資料で確認したものだけ（OSMのタグからは推定しない）。docs/mockups/detail-panel/README.md「発電所の種別」
test('何も一次資料がなければ「未確認」（地図のマークやOSMの値は入力にない）',()=>{
 const v=plantTypeView({});assert.equal(v.unknown,true);assert.deepEqual(v.lines,[]);
});
test('HJKSの大分類だけなら点線（形式・炉型未確認）',()=>{
 const v=plantTypeView({units:[{unit:'1号機',format:'水力',status:'運転中'},{unit:'2号機',format:'水力',status:'運転中'}]});
 assert.deepEqual(v.lines.map(l=>l.label),['水力']);assert.equal(v.partial,true);assert.ok(v.sub.includes('形式（水路式・ダム式・揚水）未確認'));
 const n=plantTypeView({units:[{unit:'1号機',format:'原子力',status:'運転中'}]});assert.ok(n.sub.includes('炉型（BWR・ABWR・PWR）未確認'));
});
test('一次資料の具体的な値がHJKSと食い違わなければそれを使う（揚水・PWR）',()=>{
 const h=plantTypeView({primary:{label:'水力（揚水）'},units:[{unit:'1号機',format:'水力',status:'運転中'}]});
 assert.deepEqual(h.lines,[{label:'水力（揚水）',partial:false}]);assert.equal(h.partial,false);
 const p=plantTypeView({primary:{label:'原子力（PWR）'},units:[{unit:'3号機',format:'原子力',status:'運転中'}]});
 assert.deepEqual(p.lines.map(l=>l.label),['原子力（PWR）']);assert.ok(p.sub.includes('加圧水型軽水炉'));
 const a=plantTypeView({profileMethod:'原子力（ABWR）'});assert.ok(a.sub.includes('改良型沸騰水型軽水炉'));assert.ok(!a.sub.includes('沸騰水型軽水炉'));
 // 号機で炉型が違う発電所は、書かれた炉型をすべて書かれた順に出す（2026-10-18）
 assert.deepEqual(plantTypeView({profileMethod:'原子力（BWR・PWR）'}).sub.slice(0,2),['沸騰水型軽水炉','加圧水型軽水炉']);
 assert.deepEqual(plantTypeView({profileMethod:'原子力（BWR・ABWR）'}).sub.slice(0,2),['沸騰水型軽水炉','改良型沸騰水型軽水炉']);
 assert.deepEqual(plantTypeView({profileMethod:'原子力（GCR）'}).sub.slice(0,1),['黒鉛減速炭酸ガス冷却炉']);
 // ガス火力の方式（2026-10-19）：HJKS の「火力（ガス）」と燃料が一致すれば一次資料の値で確定表示
 // 燃料のない「火力」だけの資料より、HJKS の燃料（1種類）を使う。detail・note のある一次資料は替えない（2026-10-19）
 assert.deepEqual(plantTypeView({profileMethod:'火力',units:[{unit:'5号',format:'火力（石炭）',status:'運転中'},{unit:'1号',format:'火力（石油）',status:'運転終了'}]}).lines.map(l=>l.label),['石炭']);
 assert.deepEqual(plantTypeView({primary:{label:'火力',detail:'燃料は未確認'},units:[{unit:'1号',format:'火力（石炭）',status:'運転中'}]}).lines.map(l=>l.label),['火力']);
 assert.deepEqual(plantTypeView({primary:{label:'火力',note:'燃料は資料で未確認'},units:[{unit:'1号',format:'火力（石炭）',status:'運転中'}]}).lines.map(l=>l.label),['火力']);
 for(const label of ['LNG（コンバインドサイクル）','ガス（コンバインドサイクル）','LNG（汽力）']){
  const g=plantTypeView({primary:{label},units:[{unit:'1号機',format:'火力（ガス）',status:'運転中'}]});
  assert.deepEqual(g.lines,[{label,partial:false}]);assert.equal(g.partial,false);
 }
});
test('号機で種別が違えばユニット別に並べ、代表値で上書きしない',()=>{
 const v=plantTypeView({profileMethod:'火力',units:[{unit:'1号機',format:'火力（石炭）',status:'運転中'},{unit:'5号機',format:'火力（石油）',status:'運転中'}]});
 assert.deepEqual(v.lines.map(l=>l.label),['石炭','石油']);assert.deepEqual(v.unitLabels,{'1号機':'石炭','5号機':'石油'});assert.ok(v.sub.includes('号機ごとの種別は設備出力の内訳を参照'));
 // 一次資料の値がHJKSと燃料で食い違えば、HJKS（ユニット別）を使う
 const w=plantTypeView({profileMethod:'石炭火力',units:[{unit:'1号機',format:'火力（ガス）',status:'運転中'}]});assert.deepEqual(w.lines.map(l=>l.label),['ガス']);
});
test('HJKSの「その他」・空欄は種別にしない',()=>{
 assert.equal(fromHjks('その他'),null);assert.equal(fromHjks(null),null);
 assert.equal(plantTypeView({units:[{unit:'単独',format:'その他',status:'運転中'}]}).unknown,true);
});
test('種別カードの出典は、種別の根拠の印（forType）のある資料だけ。印がなければ全部（2026-10-19）',()=>{
 const fac=(f:string,id:string)=>JSON.parse(readFileSync(`public/data/${f}.json`,'utf8')).facilities.find((x:any)=>x.id===id);
 const kurobe=fac('kansai-trunk','osm-way-197821471');
 assert.equal(kurobe.plantType.source,'関西電力 水力発電所一覧（2026年7月末時点）');
 assert.match(kurobe.attributes.find((a:any)=>a.label==='出典（発電方式）').value,/ファクトブック2020/);// 発電方式の出典には全部残す
 assert.match(fac('chubu-trunk','osm-way-832823488').plantType.source,/水力発電所一覧.*奥美濃水力発電所/);
});
