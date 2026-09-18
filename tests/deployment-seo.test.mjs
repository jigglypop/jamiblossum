import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('canonical host redirect preserves path and repeated query values', async () => {
  const source = await readFile('deploy/canonical-host-function.js', 'utf8');
  const context = {}; vm.createContext(context); vm.runInContext(source, context);
  const response = context.handler({ request: { uri: '/guides/manse.html', headers: { host: { value: 'WWW.JAMIBLOSSOM.COM' } }, querystring: { q: { value: '사주' }, tag: { multiValue: [{ value: 'a' }, { value: 'b' }] } } } });
  assert.equal(response.statusCode, 301);
  assert.equal(response.headers.location.value, 'https://jamiblossom.com/guides/manse.html?q=%EC%82%AC%EC%A3%BC&tag=a&tag=b');
});

test('SEO pages have unique canonical URLs and sitemap coverage', async () => {
  const files = ['index.html', 'public/guides/manse.html', 'public/guides/ziwei.html'];
  const canonicals = [];
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /<title>[^<]+<\/title>/); assert.match(html, /<meta name="description"/); assert.match(html, /<h1>[^<]+<\/h1>/);
    canonicals.push(html.match(/<link rel="canonical" href="([^"]+)"/)[1]);
  }
  assert.equal(new Set(canonicals).size, 3);
  const sitemap = await readFile('public/sitemap.xml', 'utf8');
  for (const canonical of canonicals) assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
});
