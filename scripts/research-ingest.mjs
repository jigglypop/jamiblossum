import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const downloadedAt = new Date().toISOString();
const works = [
  { id: 'saju-yuanhai-ziping', domain: 'saju', title: '淵海子平', author: '徐大升 編', era: '宋元傳本', rights: 'public-domain-work; Wikisource transcription CC BY-SA', maxPages: 20 },
  { id: 'saju-sanming-tonghui', domain: 'saju', title: '三命通會', author: '萬民英', era: '明', rights: 'public-domain-work; Wikisource transcription CC BY-SA', selectedPages: ['三命通會/卷一', '三命通會/卷二', '三命通會/卷三'] },
  { id: 'saju-ditiansui', domain: 'saju', title: '滴天髓', author: '傳劉基撰; downloaded witness edition unspecified', era: '明清傳本', rights: 'public-domain-work; Wikisource transcription CC BY-SA', maxPages: 40 },
  { id: 'saju-wuxing-dayi', domain: 'saju', title: '五行大義', author: '蕭吉', era: '隋', rights: 'public-domain-work; Wikisource transcription CC BY-SA', selectedPages: ['五行大義/1', '五行大義/2', '五行大義/3', '五行大義/4', '五行大義/5'] },
  { id: 'saju-qiongtong-baojian', domain: 'saju', title: '窮通寶鑑', author: '余春臺 編', era: '清', rights: 'public-domain-work; Wikisource transcription CC BY-SA', maxPages: 30 },
  { id: 'ziwei-quanshu', domain: 'ziwei', title: '紫微斗數全書', author: '傳陳摶; 羅洪先序', era: '明清傳本', rights: 'public-domain-work; Wikisource transcription CC BY-SA', selectedPages: ['紫微斗數全書/卷一', '紫微斗數全書/卷二', '紫微斗數全書/卷三'] },
];

const api = 'https://zh.wikisource.org/w/api.php';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getJson = async (params) => {
  const url = `${api}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': 'JamiBlossomResearch/1.0 (source provenance ingestion)' } });
    if (response.ok) { await sleep(300); return { url, json: await response.json() }; }
    if (response.status !== 429) throw new Error(`${response.status} ${url}`);
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`rate limited ${url}`);
};
const stripHtml = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<sup[\s\S]*?<\/sup>/gi, ' ')
  .replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/\n{3,}/g, '\n\n').trim();
const sha = (text) => createHash('sha256').update(text).digest('hex');
const isSourcePassage = (text) => text.length >= 40 && !/(這份文獻應全部|本頁面可能|維基文庫|Wikisource|取自「|姊妹計劃|姊妹计划|client-js|mw\.loader|全書始\s*\||上一卷|下一卷)/i.test(text);

await mkdir('data/sources/raw', { recursive: true });
await mkdir('data/sources/normalized', { recursive: true });
const catalog = [];
const chunks = [];
for (const work of works) {
  const pages = [];
  const selectedPages = work.selectedPages ?? [work.title];
  for (const title of selectedPages) {
    const sourceUrl = `https://zh.wikisource.org/zh-hant/${encodeURIComponent(title)}`;
    const response = await fetch(sourceUrl, { headers: { 'user-agent': 'JamiBlossomResearch/1.0 (source provenance ingestion)' } });
    if (!response.ok) throw new Error(`${response.status} ${sourceUrl}`);
    const rawHtml = await response.text();
    const contentHtml = rawHtml.match(/<div[^>]+class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*?)<div[^>]+class="[^"]*printfooter/)?.[1] ?? rawHtml;
    const normalized = stripHtml(contentHtml);
    if (normalized.length < 80) throw new Error(`No substantial rendered text for ${title}`);
    const page = { title, revisionId: null, sourceUrl, rawSha256: sha(rawHtml), normalizedSha256: sha(normalized), characters: normalized.length, normalized };
    pages.push(page);
    const blocks = normalized.split(/\n\s*\n/).filter(isSourcePassage);
    const pageKey = sha(title).slice(0, 8);
    blocks.forEach((text, index) => chunks.push({ id: `${work.id}:${pageKey}:${index + 1}`, workId: work.id, domain: work.domain, lineage: 'classical', textRole: 'source-text-candidate', title: work.title, pageTitle: title, sourceUrl: page.sourceUrl, revisionId: null, text }));
  }
  const sourceUrl = `https://zh.wikisource.org/zh-hant/${encodeURIComponent(work.title)}`;
  const rawRecord = { ...work, language: 'zh-Hant', downloadedAt, source: 'Chinese Wikisource rendered pages', transcriptionLicense: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', evidence: 'raw and normalized page SHA-256 plus source URL; page revision was not captured by rendered endpoint', coverage: { renderedPages: pages.length, selectedPageTitles: selectedPages, completeness: 'partial selected/rendered witness; not collated against a critical edition' }, pages };
  await writeFile(`data/sources/raw/${work.id}.json`, JSON.stringify(rawRecord, null, 2));
  catalog.push({ ...work, language: 'zh-Hant', downloadedAt, sourceUrl, transcriptionLicense: rawRecord.transcriptionLicense, licenseUrl: rawRecord.licenseUrl, evidence: rawRecord.evidence, coverage: rawRecord.coverage, checksum: sha(JSON.stringify(pages.map(({ normalized, ...p }) => p))) });
}

catalog.push(
  { id: 'mangpa-duan-mangpai-mingli-2005', domain: 'mangpa', lineage: 'duan-jianye', title: '盲派命理', author: '段建業', publisher: '時輪造化有限公司', year: 2005, isbn: '9789810548766', rights: 'copyrighted-metadata-only', language: 'zh-Hant', sourceUrl: 'https://www.chinyuan.com.tw/all_book/more?id=1228', downloadedAt, coverage: { metadataOnly: true, licensedFullText: false } },
  { id: 'mangpa-duan-lixiang-2011', domain: 'mangpa', lineage: 'duan-jianye', title: '段氏理象學：盲派命理研究', author: '段建業', publisher: '中國商業出版社', year: 2011, isbn: '9787504474575', pages: 244, rights: 'copyrighted-metadata-and-short-catalog-description-only', language: 'zh-Hans', sourceUrl: 'https://item.xhsd.com/items/1010000103122040', libraryCatalogUrl: 'https://opac.hbnu.edu.cn/ILASOPAC/NTRdrBookRetr.do?LeftLanguageKey=CNMARC&LeftLanguageType=language&LeftPubyearKey=2011&LeftPubyearType=pubyear&LeftSubjectKey=%E5%91%BD%E7%9B%B8&LeftSubjectType=subject&LeftTypeKey=0&LeftTypeType=type&PageNum=10&ResearchSearchType=null&SearchKey=B&SearchType=classno&researchSearchKey=null&searchWay=searchWayPrv', downloadedAt, coverage: { metadataOnly: true, licensedFullText: false } },
);
await writeFile('data/sources/catalog.json', JSON.stringify({ schemaVersion: 1, generatedAt: downloadedAt, works: catalog }, null, 2));
await writeFile('data/sources/normalized/chunks.jsonl', `${chunks.map((x) => JSON.stringify(x)).join('\n')}\n`);
console.log(JSON.stringify({ works: catalog.length, classicalChunks: chunks.length, renderedPages: catalog.reduce((n, work) => n + (work.coverage?.renderedPages ?? 0), 0) }));
