// OCCTO のサーバーが送らない中間の証明書（2026-11-24。.github/workflows/publish.yml の update-all の手順で NODE_EXTRA_CA_CERTS に渡す）。
// 入手元は GlobalSign の AIA（http://secure.globalsign.com/cacert/gsgccr46ovtlsca2025.crt）。http なので、指紋（SSL Labs の表示と同じ）と
// Node に同梱の根（GlobalSign Root R46）の署名で中身を確かめる。ネットワークは使わない。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import tls from 'node:tls';
import {X509Certificate} from 'node:crypto';

const FILE = 'config/ca/globalsign-gcc-r46-ov-tls-ca-2025.pem';
const FINGERPRINT = 'D1:60:E2:DE:4E:56:CB:10:B6:6C:1C:B0:AD:CB:79:CF:93:C7:8D:CD:9D:B3:0C:20:18:22:02:62:C0:40:63:F9';
const WARN_DAYS = 60;

test('中間の証明書：証明書1つだけ（秘密鍵なし）、指紋が一致し、Node に同梱の GlobalSign Root R46 の署名で検証できる CA', t => {
  assert.ok(fs.existsSync(FILE), FILE);
  const pem = fs.readFileSync(FILE, 'utf8');
  assert.equal((pem.match(/-----BEGIN /g) ?? []).length, 1);
  assert.match(pem, /^-----BEGIN CERTIFICATE-----\r?\n/);
  assert.ok(!/PRIVATE KEY/.test(pem));
  const c = new X509Certificate(pem);
  assert.equal(c.fingerprint256, FINGERPRINT);
  assert.match(c.subject, /CN=GlobalSign GCC R46 OV TLS CA 2025/);
  assert.equal(c.ca, true);
  const root = tls.rootCertificates.map(p => new X509Certificate(p)).find(r => /CN=GlobalSign Root R46/.test(r.subject));
  assert.ok(root, 'Node に同梱の根に GlobalSign Root R46 がある');
  assert.ok(c.checkIssued(root) && c.verify(root.publicKey), 'Root R46 の署名で検証できる');
  // 期限：切れたら取得そのものが失敗して配置は止まるので、テストでは60日前から警告だけ出す（push での配置は止めない）
  const left = (Date.parse(c.validTo) - Date.now()) / 864e5;
  if (left < WARN_DAYS) t.diagnostic(`警告：中間の証明書の期限まで ${Math.floor(left)} 日（${c.validTo}）。OCCTO の証明書の連なりを確かめ、差し替える`);
});
