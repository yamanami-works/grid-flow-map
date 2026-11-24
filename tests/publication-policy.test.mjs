import test from 'node:test';
import assert from 'node:assert/strict';
import {isProtectedPath,authorizeProtectedRequest} from '../scripts/publication-policy.mjs';
test('preview login is not a paid entitlement or admin authorization',()=>{for(const p of ['/api/paid/map','/api/admin/update','/protected/a.json']){assert.ok(isProtectedPath(p));assert.equal(authorizeProtectedRequest({cookie:'preview'}),false);}assert.equal(isProtectedPath('/data/catalog.json'),false);});
