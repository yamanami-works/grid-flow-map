// 利用規約・プライバシーポリシー・免責・データソース（2026-11-16）。
// 2026-11-16：出典表示（OCCTO・OSM と ODbL の提供の案内・地理院タイル・地理院ベクトルタイル）は ⓘ から外し、免責・データソースの表だけに置く（RULES 5節「出典の画面」）。
// 本文は固定文だけ（外部由来の文字列を入れない）。画像・スクリプトなど外部からの読み込みはしない。
// 外へのリンクは、既存の問い合わせフォーム（ⓘ と同じ）と一次資料・ライセンスのページだけ。
// 「本アプリで特筆すべき項目」は案（reports/approvals/evidence-20261116-legal/proposal.html）で色付けした箇所。画面では色分けしない。

export type LegalKind = 'terms' | 'privacy' | 'disclaimer';
export const LEGAL_ENACTED = '2026年11月16日';
export const OCCTO_URL = 'https://www.occto.or.jp/institution/keitoujouhou/index.html';
export const CONTACT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScoZSI0GlK0r3gUO46iH8uY6hTkYfxUbq3HaOp71GKIxVEcvQ/viewform';

const link = (href: string, text: string) => `<a target="_blank" rel="noopener noreferrer" href="${href}">${text} ↗</a>`;

const TERMS = `
<p>この利用規約（以下「本規約」）は、運営者が提供する「でんきの道」（以下「本サービス」）の利用条件を定めるものです。本サービスを利用した方は、本規約に同意したものとみなします。</p>
<h3>第1条（本サービスの内容）</h3>
<p>本サービスは、日本の基幹送電系統の接続関係と潮流を地図上に表示する、無料・登録不要のWebサービスです。</p>
<p>本サービスは公表資料と地図データをもとにした参考表示であり、接続先の推測を含みます。系統運用、電力取引、投資、工事・設備計画などの判断には使わないでください。</p>
<h3>第2条（禁止事項）</h3>
<ol>
<li>法令または公序良俗に反する行為</li>
<li>本サービスのサーバーや通信に過度な負荷をかける行為（短時間の大量アクセス、プログラムによる大量取得など）</li>
<li>本サービスの運営を妨げる行為、不正アクセス</li>
<li>本サービスの内容を、公表資料そのもの・電力会社等の公式情報であるかのように誤認させて利用・再配布する行為</li>
<li>表示された情報を、送電線・変電所・発電所などの設備への立入り、接近、損壊、運用の妨害その他、設備の安全を害する目的で利用すること。設備の周辺は危険です。立ち入らないでください。</li>
</ol>
<h3>第3条（権利・ライセンス）</h3>
<p>本サービスのデータは由来ごとに条件が異なります。OpenStreetMap 由来の地理データは ODbL 1.0（© OpenStreetMap contributors）、本サービスのプログラムは MIT License、OCCTO・国土地理院・一般送配電事業者・発電事業者等の公表資料に由来する内容は各提供元の利用条件によります。再利用するときは、それぞれの条件と出典表示に従ってください（詳しくは「免責・データソース」）。</p>
<h3>第4条（変更・中断・終了）</h3>
<p>運営者は、予告なく本サービスの内容を変更し、提供を中断・終了することがあります。</p>
<p>潮流のデータは定期的に自動取得していますが、提供元の公表の遅れ・様式の変更・取得の失敗により、更新が止まったり遅れたりすることがあります（その場合は画面に「更新停止」等を表示します）。</p>
<h3>第5条（免責）</h3>
<p>本サービスの利用により生じた損害について、運営者の故意または重大な過失による場合を除き、運営者は責任を負いません。詳しくは「免責・データソース」によります。</p>
<h3>第6条（本規約の変更）</h3>
<p>運営者は、必要に応じて本規約を変更できます。変更するときは、変更後の内容と効力が生じる日を、その日より前に本サービス上に表示します。</p>
<h3>第7条（準拠法）</h3>
<p>本規約は日本法に準拠します。</p>
<p class="legal-date">制定日：${LEGAL_ENACTED}</p>`;

const PRIVACY = `
<p>運営者は、本サービスの利用者のプライバシーを尊重し、次のとおり取り扱います。</p>
<h3>1. 取得する情報</h3>
<p>本サービスの地図の画面は、氏名・メールアドレスなどの個人情報を取得しません（お問い合わせフォームで利用者が自ら送る内容は6.のとおり）。会員登録、Cookie、アクセス解析、広告、位置情報（現在地）の取得は行っていません。</p>
<h3>2. 端末への保存</h3>
<p>本サービスが利用者の端末に独自の情報を保存することはありません（ブラウザが通常行う表示用データの一時保存（キャッシュ）を除きます）。</p>
<h3>3. 外部への通信</h3>
<p>本サービスの表示にあたり、次の事業者・機関のサーバーと通信します。その際、利用者の IP アドレス、ブラウザの種類、閲覧したページなどの情報が、通信の仕組み上、各事業者に送られます。これらの情報の取り扱いは各事業者の方針によります。</p>
<ul><li>GitHub, Inc.（本サービスの配信。GitHub Pages）</li><li>国土地理院（背景地図・空中写真の地図画像の配信）</li></ul>
<h3>4. 外部サイトへのリンク</h3>
<p>本サービスから一次資料などの外部サイトへリンクしています。リンク先での情報の取り扱いは、それぞれのサイトの方針によります。</p>
<h3>5. 変更</h3>
<p>本ポリシーは必要に応じて変更します。アクセス解析などを導入する場合は、導入前に本ポリシーを改め、その内容を表示します。</p>
<h3>6. 問い合わせ</h3>
<p>お問い合わせは、次のフォームからお願いします。${link(CONTACT_FORM_URL, 'お問い合わせフォーム（Google フォーム）')}</p>
<p>フォームは Google LLC のサービスで、送信内容は Google のサーバーで扱われます（Google のプライバシーポリシーによります）。いただいた内容は返信と本サービスの改善だけに使い、法令に基づく場合を除き第三者に提供しません。</p>
<p class="legal-date">制定日：${LEGAL_ENACTED}</p>`;

const DISCLAIMER = `
<h3>免責</h3>
<ul>
<li>本サービスの内容の正確性、完全性、最新性、有用性は保証しません。利用により生じた損害について、運営者の故意または重大な過失による場合を除き、運営者は責任を負いません。</li>
<li>本サービスは個人の作成物です。電力広域的運営推進機関（OCCTO）、一般送配電事業者、発電事業者、電源開発、原子力規制委員会、国土地理院その他の機関・事業者とは関係がなく、これらの公式情報ではありません。</li>
<li>送電線の接続先には推測を含みます。推定・推測したものは画面に「（推定）」「推測」などと表示し、根拠の確かさを確度（A〜E）で示しています。確度は位置の精度ではありません。</li>
<li>送電線の経路・設備の位置は、地図データや空中写真による概略で、実際とずれることがあります。直線の線は経路が分からない区間です。端の位置や接続先にも推定のものがあり、詳細パネルの確度で示しています。</li>
<li>潮流は、OCCTO の公表実績だけを取得して表示しています。公表の時点までの値で、リアルタイムではありません。取得できない値は 0 で埋めず、灰色の「未確認」で表示します（公表値が 0 MW のものとは区別しています）。</li>
<li>「参考使用率」は、本サービスが公表値から計算したもので、公表された値ではありません。運用容量の公表がない区間は灰色です。</li>
<li>原子力発電所の号機の運転状態は、原子力規制委員会のページを1日1回取得したものです。規制委の更新は不定期で、最新の状況と異なることがあります。2日より古い値は表示しません。</li>
<li>収録範囲は沖縄を除く9エリアの基幹系統（500・275kV。中国・九州は 220kV、北海道・四国は 187kV も含む）、直流幹線・交直変換所・周波数変換所、地域間連系線、東清水 FC の東京側 154kV（例外）です。範囲外の線・設備や、資料で確認できていない線・設備は表示していないことがあります。</li>
</ul>
<h3>データソース</h3>
<table class="legal-table">
<tr><th>内容</th><th>出典</th></tr>
<tr><td>潮流の実績・運用容量</td><td>電力広域的運営推進機関の ${link(OCCTO_URL, 'OCCTO 系統情報サービス')}。出典と加工表示を付けて収録しています</td></tr>
<tr><td>送電線・設備の名称・接続・空容量など</td><td>各一般送配電事業者・電源開発の公表資料、OCCTO の公表資料（供給計画の取りまとめなど）</td></tr>
<tr><td>発電所の情報</td><td>電源開発・各発電事業者の公表資料、日本卸電力取引所 発電情報公開システム（HJKS）</td></tr>
<tr><td>原子力の運転状態</td><td>原子力規制委員会「発電所の現在の運転状況」</td></tr>
<tr><td>行政の資料</td><td>経済産業省・自治体の公表資料</td></tr>
<tr><td>線の経路・設備の形</td><td>地図の線・設備の位置と形状は © OpenStreetMap contributors をもとに加工したもので、加工したデータも ODbL 1.0 で提供しています（本サイトの data/ から配信）。${link('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors · ODbL')}</td></tr>
<tr><td>背景地図・空中写真・地図記号</td><td>${link('https://maps.gsi.go.jp/development/ichiran.html', '背景地図：国土地理院（地理院タイル）')}</td></tr>
<tr><td>線の経路の一部・設備の位置の根拠</td><td>${link('https://maps.gsi.go.jp/development/vt.html', '送電線の経路の一部：国土地理院 ベクトルタイル（試験公開）を加工')}。地図の注記・空中写真を設備の位置の確認に使用</td></tr>
</table>
<p>線・設備ごとの出典・確認日は、地図で線や設備を選んだときの詳細パネル「出典」に表示しています。資料の作成日・設備の使用開始日・確認した日は、区別して記録するようにしています。</p>
<p class="legal-date">プログラム：MIT License（同梱のライブラリ（Leaflet など）はそれぞれのライセンスによります）</p>`;

export const LEGAL_DOCS: Record<LegalKind, {title: string; body: string}> = {
  terms: {title: '利用規約', body: TERMS},
  privacy: {title: 'プライバシーポリシー', body: PRIVACY},
  disclaimer: {title: '免責・データソース', body: DISCLAIMER},
};
export const LEGAL_ORDER: LegalKind[] = ['terms', 'privacy', 'disclaimer'];

// 文書を開くボタン（data-legal で種類を指定）。サイドバー最下部と ⓘ の最下部で使う
export const legalLinksHtml = () => LEGAL_ORDER.map(k => `<button type="button" class="legal-link" data-legal="${k}">${LEGAL_DOCS[k].title}</button>`).join('');

// 文書の画面（1つの dialog を使い回す）。ⓘ と同じ形（×・Esc で閉じる）
export const LEGAL_DIALOG_HTML = '<dialog id="legal-dialog" aria-labelledby="legal-title"><div class="dialog-top"><h2 id="legal-title"></h2><button id="legal-close" class="icon-button" aria-label="閉じる">×</button></div><div id="legal-body" class="legal-body"></div></dialog>';

export function openLegal(kind: LegalKind, doc: Document = document) {
  const dialog = doc.getElementById('legal-dialog') as HTMLDialogElement | null, d = LEGAL_DOCS[kind];
  if (!dialog || !d) return;
  doc.getElementById('legal-title')!.textContent = d.title;
  const body = doc.getElementById('legal-body')!;
  body.innerHTML = d.body; body.scrollTop = 0;
  if (!dialog.open) dialog.showModal();
}

// data-legal のボタンを押したら開く（ⓘ の中から開いたときは ⓘ を閉じずに重ねて開く）
export function bindLegal(doc: Document = document) {
  doc.addEventListener('click', e => {
    const b = (e.target as Element | null)?.closest?.('[data-legal]') as HTMLElement | null;
    if (b && b.dataset.legal && Object.hasOwn(LEGAL_DOCS, b.dataset.legal)) openLegal(b.dataset.legal as LegalKind, doc);
  });
  const close = doc.getElementById('legal-close');
  if (close) close.onclick = () => (doc.getElementById('legal-dialog') as HTMLDialogElement).close();
}
