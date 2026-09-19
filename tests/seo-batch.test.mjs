import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { analyze, applyMetadata, assertPublished, assertVersionBaseline, dateWindows, fetchRows } from '../scripts/seo-batch.mjs';

test('uses final 28-day PT windows with a three-day lag', () => {
  assert.deepEqual(dateWindows(new Date('2026-09-19T12:00:00Z')), { current: { startDate: '2026-08-20', endDate: '2026-09-16' }, previous: { startDate: '2026-07-23', endDate: '2026-08-19' } });
});

test('paginates and distinguishes absent rows from zero metrics', async () => {
  let calls = 0;
  const result = await fetchRows('token', { startDate: '2026-01-01', endDate: '2026-01-28' }, ['page'], async (_url, options) => {
    calls += 1; const { startRow, rowLimit, dataState } = JSON.parse(options.body); assert.equal(dataState, 'final');
    return { ok: true, json: async () => startRow === 0 ? { rows: Array.from({ length: rowLimit }, (_, i) => ({ keys: [`p${i}`], clicks: 0, impressions: 0 })) } : {} };
  });
  assert.equal(calls, 2); assert.equal(result.present, true); assert.equal(result.rows.length, 25000);
});

test('an initial response without rows is missing rather than zero', async () => {
  const result = await fetchRows('token', { startDate: '2026-01-01', endDate: '2026-01-28' }, ['page'], async () => ({ ok: true, json: async () => ({}) }));
  assert.equal(result.present, false); assert.deepEqual(result.rows, []);
});

function snapshot({ present = true, currentCtr = .01, previousCtr = .03, position = 5 } = {}) {
  const url = 'https://jamiblossom.com/'; const keys = ['자미두수 무료 계산', url, 'kor', 'mobile'];
  return { current: { pages: { present, rows: [{ keys: [url], impressions: 1000, clicks: 10, ctr: .01, position }] }, detail: { present, rows: [{ keys, impressions: 500, clicks: 5, ctr: currentCtr, position }] } }, previous: { pages: { present, rows: [{ keys: [url], impressions: 1000, clicks: 30, ctr: .03, position }] }, detail: { present, rows: [{ keys, impressions: 500, clicks: 15, ctr: previousCtr, position: position + .5 }] } } };
}

test('requires both periods and conservative comparable signal', () => {
  assert.equal(analyze(snapshot()).status, 'draft');
  assert.equal(analyze(snapshot({ present: false })).status, 'missing-data');
  assert.equal(analyze(snapshot({ currentCtr: .025 })).status, 'insufficient-signal');
});

test('rejects a noisy low-volume click change', () => {
  const data = snapshot();
  Object.assign(data.current.detail.rows[0], { impressions: 100, clicks: 7, ctr: .07 });
  Object.assign(data.previous.detail.rows[0], { impressions: 100, clicks: 10, ctr: .10 });
  assert.equal(analyze(data).status, 'insufficient-signal');
});

test('metadata edit preserves every byte after head and escapes values', () => {
  const body = '<body><h1>keep</h1></body></html>';
  const html = '<html><head><title>A</title><meta name="description" content="A"><meta property="og:title" content="A"><meta property="og:description" content="A"><meta name="twitter:title" content="A"><meta name="twitter:description" content="A"></head>' + body;
  const output = applyMetadata(html, { title: 'A & B', description: '"quoted" & safe' });
  assert.equal(output.slice(output.indexOf('</head>') + 7), body);
  assert.match(output, /A &amp; B/); assert.match(output, /&quot;quoted&quot; &amp; safe/);
});

test('identical curated metadata is a no-op and publication checks bind HTML to its manifest', () => {
  const variant = { title: 'Same', description: 'Same description' };
  const html = '<html><head><title>Same</title><meta name="description" content="Same description"><meta property="og:title" content="Same"><meta property="og:description" content="Same description"><meta name="twitter:title" content="Same"><meta name="twitter:description" content="Same description"></head><body>same</body></html>';
  assert.equal(applyMetadata(html, variant), html);
  const hash = createHash('sha256').update(html).digest('hex');
  const version = { release: 'seo-test', files: { 'index.html': hash } };
  assert.doesNotThrow(() => assertVersionBaseline(version, 'index.html', hash));
  assert.doesNotThrow(() => assertPublished(html, version, 'index.html', hash, 'seo-test'));
  assert.throws(() => assertPublished(html + 'x', version, 'index.html', hash, 'seo-test'), /published-verification-failed/);
});
