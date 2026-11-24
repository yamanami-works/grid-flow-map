import {readFile,writeFile,mkdir,readdir,stat,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createPreviewServer} from './preview-server.mjs';
// 認証情報ファイルはリポジトリの外に置く（2026-10-11 オーナー承認、docs/RULES.md 5節）。既定は %LOCALAPPDATA%\powerflow-preview\access.json、
// 環境変数 POWERFLOW_PREVIEW_ACCESS で場所を変えられる。書いたあと icacls で継承を切り、本人だけが読み書きできるようにする（できなければ起動しない）。
// 以前の tmp/private-preview-access.json は読まない（残っていれば削除を促す）。
const ACCESS=process.env.POWERFLOW_PREVIEW_ACCESS||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'powerflow-preview','access.json');
if(await access('tmp/private-preview-access.json').then(()=>true,()=>false))console.warn('注意：以前の認証情報ファイル tmp/private-preview-access.json が残っています。使っていないので削除してください。');
const saved=await readFile(ACCESS,'utf8').then(s=>JSON.parse(s.replace(/^\uFEFF/,''))).catch(()=>null);
const password=saved&&Date.parse(saved.expires)>Date.now()?saved.password:randomBytes(18).toString('base64url');
const expires=saved&&Date.parse(saved.expires)>Date.now()?Date.parse(saved.expires):Date.now()+8*3600000;
// 携帯用の画面（tmp/private-dist）は通常の dist と別ビルド。src の方が新しければ警告する（public/data は潮流の更新で常に新しくなるため対象外）（2026-10-02、画面の変更が携帯に届いていなかった）
const newest=async d=>{let t=0;for(const e of await readdir(d,{withFileTypes:true}).catch(()=>[])){const p=d+'/'+e.name;t=Math.max(t,e.isDirectory()?await newest(p):(await stat(p)).mtimeMs);}return t;};
const built=(await stat('tmp/private-dist/index.html').catch(()=>null))?.mtimeMs??0;
if(await newest('src')>built)console.warn('警告：tmp/private-dist が src より古い（画面の変更が携帯に届かない）。`npm run build:private` で作り直してから起動してください。');
await mkdir(path.dirname(ACCESS),{recursive:true});
await writeFile(ACCESS,JSON.stringify({username:'grid',password,expires:new Date(expires).toISOString()},null,2),{mode:0o600});
if(process.platform==='win32'){
 const me=(process.env.USERDOMAIN?process.env.USERDOMAIN+'\\':'')+process.env.USERNAME;
 try{for(const target of [path.dirname(ACCESS),ACCESS])execFileSync('icacls',[target,'/inheritance:r','/grant:r',me+':F'],{stdio:'ignore',windowsHide:true});}
 catch{console.error('認証情報ファイルの権限を本人だけに絞れませんでした（icacls）。起動を中止します：'+ACCESS);process.exit(1);}
}
console.log('認証情報：'+ACCESS+'（本人だけが読めます）');
const server=await createPreviewServer({root:'tmp/private-dist',password,expires,liveRoot:process.cwd(),miyagiValidationFile:process.argv.includes('--miyagi')?'data/validation/miyagi-ishinomaki.json':undefined,hokkaidoValidation:process.argv.includes('--hokkaido'),tokyoValidation:process.argv.includes('--tokyo'),chubuValidation:process.argv.includes('--chubu'),hokurikuValidation:process.argv.includes('--hokuriku'),kansaiValidation:process.argv.includes('--kansai'),chugokuValidation:process.argv.includes('--chugoku'),shikokuValidation:process.argv.includes('--shikoku'),kyushuValidation:process.argv.includes('--kyushu')});
server.listen(5180,'127.0.0.1',()=>console.log('Authenticated preview listening on 127.0.0.1:5180 (8 hours)'));
// 有効期限で終了する。setTimeout の上限（2^31-1 ms＝約24.8日）を超える待ちは即時に発火するので、上限ごとに区切って掛け直す（2026-10-11）
const MAX_TIMER=2**31-1;
const closeAtExpiry=()=>{const left=expires-Date.now();if(left<=0){server.close(()=>process.exit(0));return;}setTimeout(closeAtExpiry,Math.min(left,MAX_TIMER)).unref();};
closeAtExpiry();
