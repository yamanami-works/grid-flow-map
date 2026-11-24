import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createPreviewServer} from '../scripts/preview-server.mjs';
// 2026-10-03 オーナー判断：全10地域を公開データ（public/data・catalog）として扱う。認証プレビューではログインが必要、原本・承認ファイル・旧版は配信しない
test('Tokyo data is public catalog data behind the preview login; originals remain private',async t=>{
 const root=await mkdtemp(join(tmpdir(),'grid-tokyo-'));await mkdir(join(root,'data'));await mkdir(join(root,'assets'));await writeFile(join(root,'data/catalog.json'),'{"datasets":[]}');await writeFile(join(root,'index.html'),'app');
 const s=await createPreviewServer({root,password:'test-only',expires:Date.now()+60000,liveRoot:resolve('.')});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>{s.closeAllConnections();s.close();});
 const url='http://127.0.0.1:'+s.address().port,headers={Authorization:'Basic '+Buffer.from('grid:test-only').toString('base64')};
 for(const p of ['/data/tokyo-trunk.json','/data/tokyo-status.json','/data/tie-status.json']){assert.equal((await fetch(url+p)).status,401);assert.equal((await fetch(url+p,{headers})).status,200,p);}
 for(const p of ['/validation/tokyo-trunk.json','/data/raw/tokyo-prestart/forecast.pdf','/config/tokyo-approval.json','/data/tokyo-flow.json.previous','/backups/','/tmp/private-preview-access.json'])assert.equal((await fetch(url+p,{headers})).status,404,p);
});
