import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const TERM_MAP = { 대운: ['大運', '大限'], 용신: ['用神'], 격국: ['格局'], 조후: ['調候'], 명궁: ['命宮'], 재백궁: ['財帛'], 관록궁: ['官祿'], 삼방사정: ['三方四正'], 체용: ['體用'], 빈주: ['賓主', '宾主'], 주객: ['賓主', '宾主'], 주공: ['做功'] };
let cache;
export async function loadCorpus(path = new URL('../data/sources/normalized/chunks.jsonl', import.meta.url)) {
  if (!cache) cache = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  return cache;
}
const termsFor = (query) => {
  const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 1);
  for (const [ko, zh] of Object.entries(TERM_MAP)) if (query.includes(ko)) terms.push(...zh);
  return [...new Set(terms)];
};
export async function retrieve({ domain, query, lineage, limit = 6, maxChars = 6000 }) {
  if (domain === 'mangpa' && lineage !== 'duan-jianye') throw new Error('mangpa requires an explicit supported lineage');
  const corpus = (await loadCorpus()).filter((x) => x.domain === domain && (!lineage || x.lineage === lineage));
  if (domain === 'mangpa' && corpus.length === 0) return { sufficient: false, reason: 'No licensed Duan Jianye full text is installed.', citations: [] };
  const terms = termsFor(query);
  const ranked = corpus.map((item) => ({ item, score: terms.reduce((n, term) => n + (item.text.includes(term) ? 1 : 0), 0) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  let chars = 0; const citations = [];
  for (const { item, score } of ranked.slice(0, limit * 3)) {
    if (citations.length >= limit || chars + item.text.length > maxChars) continue;
    citations.push({ ...item, score }); chars += item.text.length;
  }
  const corpusFingerprint = createHash('sha256').update(citations.map((x) => `${x.id}:${x.text}`).join('\n')).digest('hex');
  return { sufficient: citations.length >= 1, reason: citations.length ? null : 'No matching source passage.', citations, characters: chars, corpusFingerprint };
}
