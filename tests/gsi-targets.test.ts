import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';
import {prepSkip} from './raw-data.mjs';
// 道具のモジュール（JS）は公開リポジトリに入れない（tools/prep）。公開リポジトリの Actions ではないときだけ飛ばすので、テストの中で読み込む（2026-11-01 保留45）
const PREP='tools/prep/gsi-targets.mjs',skip=prepSkip(PREP);
const prep=async()=>await import('../'+PREP);
// 2026-10-24（保留15）：地理院の照合の道具は、地図の判定と同じ照合区分で対象を選ぶ（以前は「要注意（D区分）」だけの線を拾えなかった）。
// 直線の区間に地中は含めない。名古屋都市部の直線（中部PGの公表マップで経路は分かるが使えない、判断C）は照合から外す
const lines=readdirSync('public/data').filter(f=>/-trunk\.json$|^hokkaido-hokuto\.json$/.test(f)).flatMap(f=>JSON.parse(readFileSync('public/data/'+f,'utf8')).lines);
// 送電線（新大分変電所～東大分変電所）は新大分連絡線と重複するので外した（2026-10-25 オーナー指示・承認 保留31）
test('GSI check picks the same tier as the map and skips underground straight parts',{skip},async()=>{
 const {tierOf,straightParts,excludedReason}=await prep();
 for(const l of lines)assert.equal(tierOf(l),evidenceOf(l).tier??null,l.id);
 for(const l of lines)for(const p of straightParts(l)){assert.notEqual(p.construction,'underground',l.id);assert.ok(Array.isArray(p.path)&&p.path.length>=2,l.id);}
 const ex=lines.filter(l=>excludedReason(l));assert.deepEqual(ex.map(l=>l.name).sort(),['下広井南武平町線','南武平町松ヶ枝線','東海下広井線','東海松ヶ枝線','梅森金山線','金山松ヶ枝線'].sort());for(const l of ex){assert.equal(tierOf(l),'D',l.id);assert.ok(/利用規約/.test(excludedReason(l)),l.id);}
 assert.deepEqual(lines.filter(l=>tierOf(l)==='D'&&l.schematic&&l.construction!=='underground'&&!excludedReason(l)&&!l.id.startsWith('tokyo-section-')).map(l=>l.name).sort(),['千葉印西線','浜岡新佐倉線','南大阪泉北線','三宮線'].sort());// 2026-11-17 保留128-4：三宮線（両端は一覧で確定、三宮の位置は推定、経路不明の直線）// 2026-11-17 保留128-3：南大阪泉北線（関西、両端は一覧で確定、経路不明の直線）
});
test('tierOf keeps D for a straight line ending at a numbered tower, like the map',{skip},async()=>{
 const {tierOf}=await prep();
 const base={id:'x',name:'試験線',paths:[[[35,135],[35.01,135.01]]],attributes:[{label:'要注意（D区分）',value:'両端は公表資料で確定'}]};
 const tower={...base,connections:[{facilities:[{id:'a'}]},{facilities:[]}],attributes:[...base.attributes,{label:'端点',value:'#115 の鉄塔'}]};
 const guess={...base,connections:[{facilities:[{id:'a'}]},{facilities:[]}]};
 for(const l of [tower,guess])assert.equal(tierOf(l),evidenceOf(l as any).tier??null);
 assert.equal(tierOf(tower),'D');assert.equal(tierOf(guess),'C');
});
