import test from 'node:test';
import assert from 'node:assert/strict';
import {externalLink,escapeHtml} from '../src/safe-html.ts';
test('source URLs cannot execute scripts and data stays escaped',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','https://user:secret@example.com/','//evil.test','java\nscript:alert(1)'])assert.doesNotMatch(externalLink(url,'source'),/<a /);
 assert.match(externalLink('https://example.com/?q="','<img onerror=alert(1)>'),/&lt;img/);
 assert.equal(escapeHtml('\" onmouseover=\"x'), '&quot; onmouseover=&quot;x');
});
