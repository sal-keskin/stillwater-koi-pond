import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('offline demo contains complete assets without replacement-string corruption', async () => {
  const html = await readFile(new URL('../dist/standalone.html', import.meta.url), 'utf8');
  assert.equal(/<(?:script|link)[^>]+(?:src|href)="\//.test(html), false);
  assert.equal((html.match(/<script type="module">/g) || []).length, 1);
  assert.equal((html.match(/<style>/g) || []).length, 1);
  assert.ok(html.includes('href="data:image/svg+xml,'));
  assert.ok(html.includes('Enable sound'));
  assert.ok(html.includes('AudioContext'));
  assert.equal(html.includes('crossorigin src="/assets/'), false);
});
