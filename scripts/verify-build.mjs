// 公開ビルド（dist/data）に全10地域の線・設備が入っていることを件数とIDで確かめる（2026-10-03 オーナー指示5f）。npm run build の最後に実行。
import {readFileSync,existsSync} from 'node:fs';
import {snapshot,missing,BASELINE_FILES} from './write-baseline.mjs';
import {checkPublish} from './check-publish.mjs';
const base=JSON.parse(readFileSync('tests/baseline/asset-ids.json','utf8')),approved=JSON.parse(readFileSync('tests/baseline/approved-removals.json','utf8'));
const catalog=JSON.parse(readFileSync('dist/data/catalog.json','utf8'));
for(const f of BASELINE_FILES)if(!catalog.datasets.some(d=>d.url==='./data/'+f))throw Error('catalog lacks '+f);
for(const r of ['hokkaido','tokyo','chubu','hokuriku','kansai','chugoku','shikoku','kyushu','tie'])if(!catalog.datasets.some(d=>d.id===r+'-flow'))throw Error('catalog lacks '+r+'-flow');
// 公開ビルドに自分用プレビュー限定のデータ（各社の変圧器一覧）が入っていないこと
if(catalog.datasets.some(d=>d.distribution==='private-preview')||existsSync('dist/data/substation-voltages.json')||existsSync('dist/data/line-capacity.json')||existsSync('dist/data/network-capacity.json'))throw Error('公開ビルドに自分用プレビュー限定のデータ（substation-voltages.json）が含まれている');
const now=snapshot('dist/data'),lost=missing(base,now,approved);
if(lost.length)throw Error('公開ビルドで基準の線・設備が減った：'+lost.slice(0,10).join(' / ')+(lost.length>10?` ほか${lost.length-10}件`:''));
if(now.counts.lines<base.counts.lines||now.counts.facilities<base.counts.facilities-approved.length)throw Error('公開ビルドの件数が基準より少ない：'+JSON.stringify(now.counts)+' < '+JSON.stringify(base.counts));
// 許可リストの照合と潮流の日別ファイルの件数（2026-10-11、docs/RULES.md 5節。禁止リスト・携帯用ビルドの目印などは npm run check:publish）
const listErrors=checkPublish('dist',{listOnly:true});
if(listErrors.length)throw Error('公開ビルドの許可リスト照合に失敗：'+listErrors.slice(0,10).join(' / ')+(listErrors.length>10?` ほか${listErrors.length-10}件`:''));
console.log('Build verification passed',JSON.stringify(now.counts));
