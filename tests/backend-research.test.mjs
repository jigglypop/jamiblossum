import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assemble, canonicalRequestKey, handleReading } from '../server/backend.mjs';

test('catalog has provenance and checksums for six classical works', async () => {
  const catalog = JSON.parse(await readFile('data/sources/catalog.json', 'utf8'));
  const classical = catalog.works.filter((x) => x.lineage !== 'duan-jianye');
  assert.equal(classical.length, 6);
  for (const work of classical) { assert.match(work.sourceUrl, /^https:/); assert.match(work.checksum, /^[a-f0-9]{64}$/); assert.ok(work.coverage.renderedPages >= 1); assert.equal(work.coverage.selectedPageTitles.length, work.coverage.renderedPages); }
});

test('saju assembly is bounded and contains inspectable citations', async () => {
  const result = await assemble({ ownerId: 'owner-a', domain: 'saju', question: '용신과 격국의 원문 근거', chart: { pillars: ['甲子','丙寅','戊辰','庚申'] } });
  assert.equal(result.status, 'ready'); assert.ok(result.estimatedInputChars < 15000); assert.ok(result.citations.length > 0); assert.match(result.input, /SOURCE https:/);
});

test('Duan lineage refuses generation without licensed full text', async () => {
  const result = await handleReading({ ownerId: 'owner-a', domain: 'mangpa', lineage: 'duan-jianye', question: '빈주와 주공', chart: { pillars: [] } }, { apiKey: '' });
  assert.equal(result.status, 'insufficient_sources'); assert.match(result.reason, /licensed Duan Jianye/);
});

test('nested chart fields survive canonicalization and change the cache key', () => {
  const base = { ownerId: 'o', domain: 'saju', question: 'q', chart: { pillars: ['甲子'], nested: { value: 1 } } };
  assert.notEqual(canonicalRequestKey(base), canonicalRequestKey({ ...base, chart: { ...base.chart, nested: { value: 2 } } }));
});

test('real calculated chart produces nonempty compact Saju and Ziwei facts', async () => {
  const { calculateZiweiChart } = await import('../dist/calculate.js');
  const chart = calculateZiweiChart({ calendar: 'solar', date: '1990-01-01', time: '12:00', gender: '남성', language: 'ko-KR' });
  const saju = await assemble({ ownerId: 'o', domain: 'saju', question: '용신 원문', chart });
  const ziwei = await assemble({ ownerId: 'o', domain: 'ziwei', question: '명궁 원문', chart });
  assert.equal(saju.status, 'ready'); assert.match(saju.input, /currentDaYunIndex/); assert.match(saju.input, /甲|乙|丙|丁|戊|己|庚|辛|壬|癸/);
  assert.equal(ziwei.status, 'ready'); assert.match(ziwei.input, /palaces/); assert.ok(ziwei.estimatedInputChars < 15000);
});
