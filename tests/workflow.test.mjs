// .github/workflows/publish.yml が docs/RULES.md 5節「GitHub Actions とリポジトリの保護」「自動配置とデータの検証」を満たすことを文字列で確かめる（2026-11-01 保留46）。
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPLIT_FLOWS} from '../scripts/flow-split.mjs';

const yml = readFileSync('.github/workflows/publish.yml', 'utf8').replace(/\r\n/g, '\n');
/** ジョブ名から次のジョブ（2字下げの行）までの部分 */
const job = name => { const m = yml.match(new RegExp(String.raw`\n  ${name}:\n([\s\S]*?)(?=\n  [a-z-]+:\n|$)`)); assert.ok(m, name); return m[1]; };
const build = job('build'), deploy = job('deploy'), freshness = job('freshness');

test('起動：30分ごと・手動（initial）・main への push だけ。pull_request_target は使わない', () => {
  assert.match(yml, /\n {4}- cron: '7,37 \* \* \* \*'/);
  assert.match(yml, /\n  workflow_dispatch:\n {4}inputs:\n {6}initial:\n[\s\S]*?type: boolean\n {8}default: false/);
  assert.match(yml, /\n  push:\n {4}branches: \[main\]\n/);
  assert.ok(!/pull_request/.test(yml));
});

test('権限：全体は空、build は contents: read、deploy は pages・id-token の書き込みだけ', () => {
  assert.match(yml, /\npermissions: \{\}\n/);
  assert.match(build, /\n {4}permissions:\n {6}contents: read\n {4}env:/);
  assert.match(deploy, /\n {4}permissions:\n {6}pages: write\n {6}id-token: write\n {4}environment:/);
  assert.match(freshness, /\n {4}permissions: \{\}\n/);
  assert.equal((yml.match(/permissions:/g) ?? []).length, 4);
  assert.ok(!/secrets\./.test(yml), 'Secrets を使わない');
});

test('外部アクションは40桁の SHA と版のコメントで固定する', () => {
  const uses = [...yml.matchAll(/uses: (\S+)(.*)/g)];
  assert.deepEqual(uses.map(u => u[1].split('@')[0]), ['actions/checkout', 'actions/setup-node', 'actions/upload-pages-artifact', 'actions/deploy-pages']);
  for (const [, ref, rest] of uses) {
    assert.match(ref, /@[0-9a-f]{40}$/, ref);
    assert.match(rest, /^ # v\d+\.\d+\.\d+$/, ref);
  }
});

test('checkout は資格情報を残さない。Node 22、同時実行は1つで取り消さない、時間の上限あり', () => {
  assert.match(build, /actions\/checkout@\S+.*\n {8}with:\n {10}persist-credentials: false\n/);
  assert.match(build, /node-version: '22'/);
  assert.match(yml, /\nconcurrency:\n  group: publish\n  cancel-in-progress: false\n/);
  assert.match(build, /\n {4}timeout-minutes: 60\n/);
  assert.match(deploy, /\n {4}timeout-minutes: 10\n/);
});

test('目印 GRID_PUBLIC_CHECKOUT は build だけ。initial は手動実行のときだけ効く', () => {
  assert.match(build, /\n {6}GRID_PUBLIC_CHECKOUT: '1'\n/);
  assert.equal((yml.match(/GRID_PUBLIC_CHECKOUT/g) ?? []).length, 1);
  assert.match(build, /INITIAL: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.initial && '--initial' \|\| '' \}\}/);
});

test('前回分の読み戻し先は公開サイトの URL（2026-11-08 アカウント名を yamanami-works に変更、保留91）。旧名は残さない', () => {
  assert.match(build, /\n {6}SITE_URL: https:\/\/yamanami-works\.github\.io\/grid-flow-map\/\n/);
  assert.equal((yml.match(/SITE_URL:/g) ?? []).length, 1);
  assert.ok(!new RegExp('ucc' + '316', 'i').test(yml), '旧アカウント名（このファイルにも旧名を書かないよう分けて書く）');
});

test('build の順序：読み戻し→前回分の写し→取得→検証→テスト→ビルド→公開前チェック→成果物', () => {
  const order = ['npm ci', 'restore-flows.mjs "$SITE_URL" $INITIAL', 'mkdir -p public/data/occto tmp/prev-flows', 'update-all.mjs', 'validate-flows.mjs tmp/prev-flows $INITIAL', 'run: npm test', 'run: npm run build', 'run: npm run check:publish', 'upload-pages-artifact'];
  const at = order.map(s => build.indexOf(s));
  assert.ok(at.every(i => i >= 0), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
});

test('main への push では取得しない（読み戻した前回分で配置）。失敗を続行する手順はない（保留53）', () => {
  assert.ok(!/continue-on-error/.test(yml));
  assert.match(build, /\n {6}- if: github\.event_name != 'push'\n {8}run: node scripts\/update-all\.mjs\n/);
  assert.equal((yml.match(/update-all/g) ?? []).length, 1);
});

test('鮮度は配置を止めない：検証の stale を build の出力にし、定期・手動のときだけ配置の後のジョブで失敗の印を出す（保留53）', () => {
  assert.match(build, /\n {4}outputs:\n {6}stale: \$\{\{ steps\.validate\.outputs\.stale \}\}\n {4}steps:\n/);
  assert.match(build, /\n {6}- id: validate\n {8}run: node scripts\/validate-flows\.mjs tmp\/prev-flows \$INITIAL\n/);
  assert.match(freshness, /^ {4}needs: \[build, deploy\]\n {4}if: needs\.build\.outputs\.stale == 'true' && github\.event_name != 'push'\n/);
  assert.ok(!/uses:/.test(freshness), '外部アクションを使わない');
  assert.match(freshness, /\n {10}exit 1\n?$/);
});

test('前回分として写す潮流は SPLIT_FLOWS と同じ', () => {
  const m = build.match(/for n in ([^;]+); do/);
  assert.ok(m);
  assert.deepEqual(m[1].trim().split(/\s+/), SPLIT_FLOWS);
});

test('配置は build の後、main のときだけ、github-pages 環境で。deploy は deploy-pages だけ（run を持たない）', () => {
  assert.match(deploy, /needs: build\n {4}if: github\.ref == 'refs\/heads\/main'\n/);
  assert.match(deploy, /environment:\n {6}name: github-pages\n/);
  assert.ok(!/\brun:/.test(deploy));
});

test('起動条件はちょうど3つ。run の中で ${{ }} を使わない（式の注入を防ぐ。値は env を通す）', () => {
  const on = yml.match(/\non:\n([\s\S]*?)\n\S/)[1];
  assert.deepEqual([...on.matchAll(/^ {2}([a-z_]+):/gm)].map(m => m[1]), ['schedule', 'workflow_dispatch', 'push']);
  const runs = [...yml.matchAll(/^ {6}(?:- | {2})run: (\|\n(?:\s{10}.*\n?)+|.*)/gm)].map(m => m[1]);
  assert.ok(runs.length >= 8);
  assert.equal(runs.length, (yml.match(/^\s*(- )?run:/gm) ?? []).length, 'run の行をすべて調べる');
  for (const r of runs) assert.ok(!r.includes('${{'), r);
});
