import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {liveDataMiddleware, localHostOnly} from './scripts/live-data.mjs';
import {CSP} from './scripts/csp.mjs';

export default defineConfig({
  // 公開先のパス（2026-10-31 公開残件3-A）：GitHub Pages の https://<アカウント>.github.io/<リポジトリ>/ でも読めるよう、index.html からの参照を相対パスにする
  base: './',
  publicDir: false,
  server:{fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/data/raw/**','**/data/processed/**','**/data/validation/**','**/data/private/**','**/docs/research/**','**/tmp/**','**/backups/**','**/public/data/**','**/*.previous']}},
  plugins: [{
    // CSP（2026-10-12）：本番ビルドの index.html にだけ入れる（開発サーバーは更新の仕組みが止まるので入れない）。
    // 中身は scripts/csp.mjs。公開前チェック（npm run check:publish）が、あることと許可先を確かめる。
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      // 文字コードの指定の直後（スクリプトより前）に置く
      const charset = '<meta charset="UTF-8" />';
      if (!html.includes(charset)) throw Error('index.html に <meta charset> がない');
      return html.replace(charset, `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`);
    },
  }, {
    name: 'private-preview-marker',
    // 携帯用ビルドの目印（2026-10-11、docs/RULES.md 5節）：build:private のときだけ index.html に入れる。公開前チェック（npm run check:publish）は dist/ にこれがないことを確かめる
    transformIndexHtml(html) {
      return process.env.VITE_PRIVATE_PREVIEW==='true' ? html.replace('<head>', '<head>\n    <meta name="grid-build" content="private-preview">') : html;
    },
  }, {
    name: 'catalog-public-data',
    async generateBundle() {
      // 公開・iOSビルドは distribution:'private-preview' のデータ（各社の変圧器一覧）を含めない。自分用プレビュー（VITE_PRIVATE_PREVIEW）だけが含める（2026-10-03）
      const raw=JSON.parse(await readFile('public/data/catalog.json','utf8'));
      const privateBuild=process.env.VITE_PRIVATE_PREVIEW==='true';
      const manifest={...raw,datasets:raw.datasets.filter((d:{distribution?:string})=>privateBuild||d.distribution!=='private-preview')};
      const files=['data/connection-gaps.json','data/LICENSE.txt',...manifest.datasets.map((d:{url:string;access:string})=>{if(d.access!=='public')throw Error('Protected dataset cannot be bundled');return d.url.replace(/^\.\//,'');})];
      // 原子力の運転状態（purpose:'status'、2026-11-10）にも付ける：scripts/fetch-nra-status.mjs が前回分の読み戻しの照合に使う
      // 潮流の sha256（2026-10-31、docs/RULES.md 5節「前回分の引き継ぎ」）：Actions が公開中のサイトから前回分を読み戻すときの照合に使う。配る中身そのもののハッシュ。画面は使わない
      // 定期取得がビルド中にファイルを書き換えても食い違わないよう、1回だけ読んだバイト列でハッシュを取り、同じバイト列を出力する
      const flowBytes=new Map<string,Buffer>();
      manifest.datasets=await Promise.all(manifest.datasets.map(async(d:{purpose?:string;url:string})=>{if(d.purpose!=='flow'&&d.purpose!=='status')return d;const file=d.url.replace(/^\.\//,''),bytes=await readFile('public/'+file);flowBytes.set(file,bytes);return {...d,sha256:createHash('sha256').update(bytes).digest('hex')};}));
      this.emitFile({type:'asset',fileName:'data/catalog.json',source:JSON.stringify(manifest,null,2)});
      // 携帯用だけのデータ（distribution:'private-preview'）は data/private/ から読む（build:private のときだけここに来る）（2026-10-11：各社の表は許諾を確認するまで public/ の外の data/private/ に置き、build:private のときだけ携帯用ビルドへコピーする。docs/RULES.md 5節）
      const privateFiles=new Set(manifest.datasets.filter((d:{distribution?:string})=>d.distribution==='private-preview').map((d:{url:string})=>d.url.replace(/^\.\//,'')));
      // 潮流の日別ファイル（2026-10-11、scripts/flow-split.mjs）：最新日のファイルの一覧（index）にある日を <名前>-days/<日付>.json として出力する。過去日に切り替えた時に画面が読む
      for(const d of manifest.datasets.filter((d:{id:string})=>/-flow-latest$/.test(d.id))){const latest=d.url.replace(/^\.\//,''),days=latest.replace(/-latest\.json$/,'-days/');for(const e of JSON.parse((flowBytes.get(latest)??await readFile('public/'+latest)).toString('utf8')).index??[])files.push(days+e.date+'.json');}
      for(const file of files)this.emitFile({type:'asset',fileName:file,source:flowBytes.get(file)??await readFile(privateFiles.has(file)?'data/private/'+file.slice('data/'.length):'public/'+file)});
      // 共有用の画像（OGP、2026-11-24）：index.html の og:image が固定の URL で指すので、ハッシュなしの固定名で出す。元は tools/og-image/make-og-image.mjs で作る
      this.emitFile({type:'asset',fileName:'assets/og-image.png',source:await readFile('static/og-image.png')});
    },
    // Host の照合は Vite のものが効かないので localHostOnly で行う（2026-11-24、scripts/live-data.mjs）
    configureServer(server){server.middlewares.use(localHostOnly(liveDataMiddleware()));},
    configurePreviewServer(server){server.middlewares.use(localHostOnly(liveDataMiddleware()));},
  }],
});
