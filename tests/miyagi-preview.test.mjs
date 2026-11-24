import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPreviewServer} from '../scripts/preview-server.mjs';
import {excludedSkip} from './raw-data.mjs';
const check=async(t,enabled)=>{
 const root=await mkdtemp(join(tmpdir(),'grid-pilot-'));await mkdir(join(root,'data'));await mkdir(join(root,'assets'));await writeFile(join(root,'data/catalog.json'),' {"datasets":[]}');await writeFile(join(root,'index.html'),'app');
  const s=await createPreviewServer({root,password:'test-only',expires:Date.now()+60000,miyagiValidationFile:enabled?resolve('data/validation/miyagi-ishinomaki.json'):undefined});
  await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>{s.closeAllConnections();s.close();});
  const url='http://127.0.0.1:'+s.address().port,headers={Authorization:'Basic '+Buffer.from('grid:test-only').toString('base64')},path='/validation/miyagi-ishinomaki.json';
  assert.equal((await fetch(url+path)).status,401);
  const response=await fetch(url+path,{headers});assert.equal(response.status,enabled?200:404);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  if(enabled){const data=await response.json();assert.equal(data.lines.length,4);assert.equal(data.rights,'pending');}
  for(const p of ['/data/validation/miyagi-ishinomaki.json','/validation/other.json','/validation/../PROJECT.md','/data/raw/osm-tohoku.json','/tmp/private-preview-access.json'])assert.equal((await fetch(url+p,{headers})).status,404,p);
  assert.equal((await fetch(url+'/api/paid/map',{headers})).status,403);
};
test('validation requires BOTH explicit operator opt-in and authentication; no purchase grant or directory exposure',async t=>{await check(t,false);});
// 有効にした回は宮城の検証ファイル（公開リポジトリに入れない。保留49・95）を使う。公開リポジトリの Actions では、ないときだけ飛ばす
test('validation is served only when opted in and authenticated',{skip:excludedSkip('data/validation/miyagi-ishinomaki.json')},async t=>{await check(t,true);});
