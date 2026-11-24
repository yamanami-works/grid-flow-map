import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {liveDataMiddleware, localHostOnly} from '../scripts/live-data.mjs';
import {readFileSync} from 'node:fs';
import {createPreviewServer} from '../scripts/preview-server.mjs';

test('canonical live data ignores build snapshots and conditional cache; denies all unlisted paths',async t=>{
 const root=await mkdtemp(join(tmpdir(),'grid-live-'));
 await mkdir(join(root,'public/data'),{recursive:true});await mkdir(join(root,'tmp'));
 const catalog={datasets:[{access:'public',url:'./data/occto-tohoku.json'},{access:'paid',url:'./data/paid.json'}]};
 await writeFile(join(root,'public/data/catalog.json'),JSON.stringify(catalog));
 const file=join(root,'public/data/occto-tohoku.json');await writeFile(file,'{"version":1}');
 let refreshes=0;const middleware=liveDataMiddleware(root,async()=>{refreshes++;});
 const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const url=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(url+'/data/catalog.json')).status,200);
 assert.equal((await (await fetch(url+'/data/occto-tohoku.json')).json()).version,1);
 await writeFile(file,'{"version":2}');
 const updated=await fetch(url+'/data/occto-tohoku.json',{headers:{'If-None-Match':'*','If-Modified-Since':new Date().toUTCString()}});
 assert.equal(updated.status,200);assert.equal((await updated.json()).version,2);assert.match(updated.headers.get('cache-control'),/no-store/);assert.equal(refreshes,2);
 for(const path of ['/data/paid.json','/data/occto-tohoku.json.previous','/data/raw/actual.json','/data/%2e%2e%5ctmp/secret.json','/data//catalog.json'])assert.equal((await fetch(url+path)).status,404,path);
 assert.equal((await (await fetch(url+'/data/occto-status.json')).json()).state,'unknown');
 await writeFile(join(root,'tmp/occto-status.json'),JSON.stringify({state:'failed',lastSuccessAt:'2026-09-23T01:00:00Z'}));
 assert.equal((await (await fetch(url+'/data/occto-status.json')).json()).state,'failed');
 assert.equal((await (await fetch(url+'/data/occto-tohoku.json')).json()).version,2);
});

test('live canonical data and update status remain behind preview authentication',async t=>{
 const root=await mkdtemp(join(tmpdir(),'grid-auth-live-'));
 await mkdir(join(root,'public/data'),{recursive:true});await mkdir(join(root,'build/assets'),{recursive:true});await mkdir(join(root,'build/data'));
 const manifest='{"datasets":[]}';await writeFile(join(root,'public/data/catalog.json'),manifest);await writeFile(join(root,'build/data/catalog.json'),manifest);
 const server=await createPreviewServer({root:join(root,'build'),liveRoot:root,password:'test',expires:Date.now()+60000});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['/data/catalog.json','/data/occto-status.json']){
  assert.equal((await fetch(base+path)).status,401);
  assert.equal((await fetch(base+path,{headers:{authorization:'Basic '+Buffer.from('grid:test').toString('base64')}})).status,200);
 }
});

// 2026-11-24：開発サーバーの Host の照合（DNS リバインディング対策）
test('localHostOnly passes only local host names to the data middleware',()=>{
 const run=host=>{let passed=false,status=200;const res={statusCode:200,setHeader(){},end(){status=this.statusCode;}};
  localHostOnly(()=>{passed=true;})({headers:host===undefined?{}:{host}},res,()=>{});return passed?'pass':status;};
 for(const h of ['localhost:5173','127.0.0.1:4173','[::1]:5173','LOCALHOST:5173','app.localhost:5173','localhost'])assert.equal(run(h),'pass',h);
 for(const h of ['evil.example:5173',undefined,'','localhost.evil.example:5173','localhost.:5173','[::1:5173','127.0.0.1.evil.example','evil.localhost.example'])assert.equal(run(h),403,String(h));
});
test('vite.config wraps the data middleware with localHostOnly in both dev and preview',()=>{
 // vite.config の書き方を変えたら、このテストの文字列も合わせて直す（意図は「包まない use を残さない」こと）
 const s=readFileSync('vite.config.ts','utf8');
 assert.ok(s.includes('configureServer(server){server.middlewares.use(localHostOnly(liveDataMiddleware('),'dev');
 assert.ok(s.includes('configurePreviewServer(server){server.middlewares.use(localHostOnly(liveDataMiddleware('),'preview');
 assert.ok(!s.includes('use(liveDataMiddleware('),'包まない use が残っていない');
});
