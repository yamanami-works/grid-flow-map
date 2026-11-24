import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
// 全国表示に入る10データで、同じ設備が重複して表示されないか（2026-10-03 指摘4a）
// 2026-10-04 東北は配信中の tohoku-trunk.json を見る（tohoku-trunk-osm.json は凍結・配信なし）
const FILES=['tohoku-trunk','tohoku-dc-osm','hokkaido-hokuto','tokyo-trunk','chubu-trunk','hokuriku-trunk','kansai-trunk','chugoku-trunk','shikoku-trunk','kyushu-trunk'];
const all=FILES.flatMap(f=>JSON.parse(readFileSync(`public/data/${f}.json`,'utf8')).facilities.map((x:any)=>({...x,file:f,asset:x.assetId??x.id})));
const osmKey=(id:string)=>{const m=String(id).match(/(?:^|osm-|-)(way|relation|node)[-/](\d+)$/);return m?m[1]+'/'+m[2]:null;};
const dist=(a:number[],b:number[])=>Math.hypot((a[0]-b[0])*111000,(a[1]-b[1])*91000);
// 名前の比較：全角・空白・会社名を揃え、発電所の「水力・火力・地下」は同じ発電所の表記ゆれとして除く。種類（変電所・開閉所・発電所…）は区別する
const norm=(n:string)=>n.normalize('NFKC').replace(/\s+/g,'').replace(/^(.*電力(株式会社|送配電|ネットワーク|パワーグリッド)?|JERA|電源開発(株式会社)?)/,'').replace(/(水力|火力|地下)(発電所)$/,'$2');
test('the same OSM area (way/relation/node) never appears under two different asset IDs',()=>{
 const by=new Map<string,Set<string>>();const where=new Map<string,string[]>();
 for(const f of all){const k=osmKey(f.id);if(!k)continue;(by.get(k)??by.set(k,new Set()).get(k)!).add(f.asset);(where.get(k)??where.set(k,[]).get(k)!).push(f.file+':'+f.asset);}
 const bad=[...by].filter(([,s])=>s.size>1).map(([k])=>k+' '+where.get(k)!.join(' / '));assert.deepEqual(bad,[]);
});
test('no two facilities of the same kind and same name (spelling variants aside) lie within 300 m of each other',()=>{
 const bad:string[]=[];
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j];if(a.asset===b.asset||a.kind!==b.kind||norm(a.name)!==norm(b.name))continue;
  const m=dist(a.position,b.position);if(m<300)bad.push(`${a.file}:${a.id}:${a.name} ↔ ${b.file}:${b.id}:${b.name} ${Math.round(m)}m`);}
 assert.deepEqual(bad,[]);
});
