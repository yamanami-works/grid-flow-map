import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPreviewServer} from '../scripts/preview-server.mjs';
import {hokkaidoSnapshot} from '../scripts/hokkaido-flow.mjs';
const table=rows=>({root:{bizRoot:{table:{table1:{table1:{totalPage:1,rows}}}}}});
const cell=value=>({value});
test('Hokkaido imports zero and missing without positional capacity join or guessed endpoint aliases',()=>{
 const row={sdlNm:cell('函館幹線'),daKv:cell('187'),flowHukuSeiHuku:cell('双葉SWS→北七飯SS')};
 const actual=table([row]);actual.root.bizRoot.header={};
 for(let i=0;i<48;i++){const key='colonLbl'+i;actual.root.bizRoot.header[key]={label:String(i>>1).padStart(2,'0')+':'+(i%2?'30':'00')};row[key]=cell(i===0?'0':i===1?'12':i===2?'   ':'－');}
 const cap=table([{sdlNo:cell('38'),sdlNm:cell('北斗幹線'),daKv1:cell('275'),flowHukuSeiHuku1:cell('北斗変換所→大野変電所'),unyr:cell('1064'),ktiYuin:cell('熱容量')}]);
 const parsed=hokkaidoSnapshot(actual,cap,'2026-09-26','2026-09-26T00:00:00Z');
 assert.deepEqual(parsed.actual.lines[0].values.slice(0,3),[0,12,null]);assert.equal(parsed.actual.lines[0].from,'双葉SWS');assert.equal(parsed.capacities.some(c=>c.name==='函館幹線'),false);
 actual.root.bizRoot.table.table1.table1.totalPage=2;assert.throws(()=>hokkaidoSnapshot(actual,cap,'2026-09-26',''),/Incomplete/);
});
test('Hokkaido data is public catalog data behind the preview login (2026-10-03: all 10 regions published); originals and backups stay blocked',async t=>{
 const root=await mkdtemp(join(tmpdir(),'grid-hokkaido-'));await mkdir(join(root,'data'));await mkdir(join(root,'assets'));await writeFile(join(root,'data/catalog.json'),'{"datasets":[]}');await writeFile(join(root,'index.html'),'app');
 const s=await createPreviewServer({root,password:'test-only',expires:Date.now()+60000,liveRoot:resolve('.')});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>{s.closeAllConnections();s.close();});
 const url='http://127.0.0.1:'+s.address().port,headers={Authorization:'Basic '+Buffer.from('grid:test-only').toString('base64')};
 // 潮流（*-flow.json）は読むと更新が走るので、ここでは線・設備と状態だけを確かめる
 for(const p of ['/data/hokkaido-hokuto.json','/data/hokkaido-status.json']){assert.equal((await fetch(url+p)).status,401);assert.equal((await fetch(url+p,{headers})).status,200,p);}
 for(const p of ['/validation/hokkaido-hokuto.json','/public/data/hokkaido-hokuto.json','/data/hokkaido-flow.json.previous','/data/raw/occto-hokkaido-2026-09-26/actual.json','/config/hokkaido-approval.json','/backups/','/tmp/private-preview-access.json'])assert.equal((await fetch(url+p,{headers})).status,404,p);
});
