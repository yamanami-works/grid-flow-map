// 北海道の全線に照合区分（確度）があること（2026-11-04 オーナー承認 保留71）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evidenceOf} from '../src/evidence.ts';

const d = JSON.parse(readFileSync('public/data/hokkaido-hokuto.json', 'utf8'));

test('北海道の線はすべて確度 A〜E のどれか（未判定なし）', () => {
  assert.deepEqual(d.lines.filter((l: any) => !evidenceOf(l).tier).map((l: any) => l.id), []);
});

test('保留71で区分を付けた37本：A17・B17・C3、C は要注意（C区分）付き、十勝幹線(恵庭南札線)は B', () => {
  const ids = new Set(['asset-919f35c2-894f-4d1a-a3d0-84b84c8f90d0','asset-8cc91839-66a6-4118-a233-3ce81b7ec038','asset-6e2fe879-7683-4d85-aa60-7dc773535eee','asset-87f93ef7-4bfe-4704-a89e-8454f4282f72','asset-92ad1f6a-9323-4ed6-b7bb-a697c84b7af7','asset-907711ce-ce38-4658-a7fa-5cc436bd0d85','asset-f4d5fd6c-3c2f-4623-9589-d5dbce85e850','asset-084b22bf-dea4-4bbe-b024-ab53097fc772','asset-94887cb2-64a6-4efe-9098-daeb3e9dfea3','asset-06a835a1-784d-498e-a7b3-abacadf22641','asset-4cff430b-f9c6-4f9d-a12c-eda918038250','asset-fcffd4f5-4ffe-478b-bdaa-dda03d3b7ec4','asset-c5861042-b685-469a-a29e-6770cba61b56','asset-28335b35-e3a6-401a-a028-6d594c6bba36','asset-db91af05-2e84-4de3-96ac-86052029d872','asset-6a5091a5-bbd1-4c5a-863b-1d0f125a11d6','asset-3a98f231-13f7-44df-a34b-045b817cb2f5','asset-b605269d-0c7f-47c8-a707-ba35738de13d','asset-8f1eaec6-8e1f-40b0-b04f-99f24e23794a','asset-06902d0f-5bf0-4da9-9727-89ba61d7985f','asset-55f3176d-2a95-49d4-a9d6-b3aceea82bdb','asset-ab89612e-6aad-4615-8f03-c4a79eba985e','asset-b6c482bf-89ea-4af1-aafd-800c0884f8e8','asset-2181fdef-b8c0-40dd-b8a6-6a68f21e1029','asset-fc037a99-dc9c-4e72-918f-02f14f952088','asset-e242b5ef-79b9-413d-8593-4516e40ec4c2','asset-14c027da-ca58-4e70-a611-6af01b71ff54','asset-624802cf-26e1-4299-be4f-25f492574379','asset-b216a2d5-562c-4668-9e2a-f0f8025fcbf6','asset-f4563488-3006-4e1e-9832-e939d507d3d3','asset-d6eaa9c8-daf5-4752-a352-c3994d2d8ad1','asset-71734c06-d489-436b-ba7a-c109da37a9a6','asset-bc3036aa-c86c-4d9e-833a-7ef326fe77c2','asset-1735c8e9-8f36-41d9-93d6-c12d12ffd5ca','asset-1c5c00c2-a0b5-4a05-b91a-7c6ab6355af3','asset-78e433b1-e70d-4337-bb0d-ba6de8d49658','asset-a66cdf27-0e3f-4144-b7ec-98f163722f9b']);
  const added = d.lines.filter((l: any) => ids.has(l.id));
  assert.equal(added.length, 37);
  const count: Record<string, number> = {};
  for (const l of added) { const t = evidenceOf(l).tier!; count[t] = (count[t] ?? 0) + 1; if (t === 'C') assert.ok(l.attributes.some((a: any) => a.label === '要注意（C区分）'), l.id); }
  assert.deepEqual(count, {A: 17, B: 17, C: 3});
  assert.equal(evidenceOf(added.find((l: any) => l.name === '十勝幹線(恵庭南札線)')).tier, 'B');
});

test('後志幹線の2本は推測（#115 の分岐点）が残る', () => {
  for (const l of d.lines.filter((l: any) => /^後志幹線（/.test(l.name))) assert.ok(evidenceOf(l).inferred.length > 0, l.name);
});

test('無名区間が 0.05km 未満の道東幹線・岩松西線は「無名区間 0.1km未満」（保留74）', () => {
  for (const name of ['道東幹線', '岩松西線']) {
    const why = d.lines.find((l: any) => l.name === name).attributes.find((a: any) => a.label === '照合の根拠').value;
    assert.match(why, /無名区間 0\.1km未満/, name);
  }
});
