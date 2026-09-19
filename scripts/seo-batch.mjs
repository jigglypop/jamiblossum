import { createHash, createSign } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE = process.env.GSC_SITE_URL || 'sc-domain:jamiblossom.com';
const ORIGIN = 'https://jamiblossom.com';
const PRIVATE_DIR = resolve(process.env.SEO_PRIVATE_DIR || join(ROOT, 'artifacts', 'seo-private'));
const ALLOWED = {
  '/': [
    { id: 'ziwei-palaces', match: /명궁|신궁|삼방사정/, title: '자미두수 명궁·신궁 무료 명반 | 자미블로썸', description: '생년월일과 출생 시간으로 자미두수 명궁·신궁, 12궁 별 배치와 삼방사정을 무료로 확인하세요.' },
    { id: 'ziwei-chart', match: /자미두수.*(무료|계산)|명반.*계산/, title: '자미두수 명반 무료 계산기 | 자미블로썸', description: '출생 정보를 입력하면 명궁·신궁과 12궁 별 배치, 삼방사정을 무료로 확인할 수 있습니다.' }
  ],
  '/guides/ziwei.html': [
    { id: 'ziwei-relations', match: /삼방사정|명궁.*신궁/, title: '자미두수 삼방사정 보는 법 | 명궁·신궁 안내', description: '자미두수 명궁과 신궁을 찾고 12궁의 주성·보조성, 삼방사정을 함께 확인하는 순서를 설명합니다.' },
    { id: 'ziwei-guide', match: /자미두수.*(보는|해석)|명궁|삼방사정/, title: '자미두수 명반 보는 법 | 명궁·신궁·삼방사정 안내', description: '자미두수 12궁 명반에서 명궁과 신궁, 주성·보조성, 삼방사정을 확인하는 순서와 계산 기준을 안내합니다.' }
  ],
  '/guides/manse.html': [
    { id: 'manse-dayun', match: /대운|십성/, title: '만세력 대운·십성 보는 법 | 무료 사주 안내', description: '만세력에서 사주 원국의 네 기둥과 십성·지장간, 대운의 시작과 종료 시각을 확인하는 순서를 안내합니다.' },
    { id: 'manse-guide', match: /만세력|사주.*(원국|대운)/, title: '무료 만세력 보는 법 | 사주 원국·십성·대운 안내', description: '만세력의 연주·월주·일주·시주, 오행·십성·지장간과 대운의 시작·종료 시각을 확인하는 순서와 계산 경계를 안내합니다.' }
  ]
};

const sha256 = value => createHash('sha256').update(value).digest('hex');
const iso = date => date.toISOString().slice(0, 10);
function ptToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00Z`);
}
export function dateWindows(now = new Date()) {
  const end = ptToday(now); end.setUTCDate(end.getUTCDate() - 3);
  const currentStart = new Date(end); currentStart.setUTCDate(currentStart.getUTCDate() - 27);
  const previousEnd = new Date(currentStart); previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd); previousStart.setUTCDate(previousStart.getUTCDate() - 27);
  return { current: { startDate: iso(currentStart), endDate: iso(end) }, previous: { startDate: iso(previousStart), endDate: iso(previousEnd) } };
}

const b64url = value => Buffer.from(value).toString('base64url');
async function accessToken() {
  if (process.env.GSC_ACCESS_TOKEN) return process.env.GSC_ACCESS_TOKEN;
  let credentials;
  if (process.env.GSC_SERVICE_ACCOUNT_JSON) credentials = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON);
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  else throw new Error('missing-credentials: set GSC_ACCESS_TOKEN or GSC_SERVICE_ACCOUNT_JSON/GOOGLE_APPLICATION_CREDENTIALS');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: credentials.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256'); signer.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${signer.sign(credentials.private_key, 'base64url')}`;
  const response = await fetch(credentials.token_uri || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!response.ok) throw new Error(`oauth-failed:${response.status}`);
  return (await response.json()).access_token;
}
async function apiFetch(url, options, attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, options);
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt === attempts - 1) return response;
    await new Promise(resolveDelay => setTimeout(resolveDelay, Math.min(8000, 500 * 2 ** attempt)));
  }
}
export async function fetchRows(token, period, dimensions, fetchPage = apiFetch) {
  const rows = []; const rowLimit = 25000;
  for (let startRow = 0; ; startRow += rowLimit) {
    const response = await fetchPage(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ ...period, dimensions, dataState: 'final', rowLimit, startRow }) });
    if (!response.ok) throw new Error(`gsc-query-failed:${response.status}`);
    const page = (await response.json()).rows;
    if (!Array.isArray(page)) return { rows, present: startRow > 0 };
    rows.push(...page);
    if (page.length < rowLimit) return { rows, present: true };
  }
}
async function collect() {
  if (SITE !== 'sc-domain:jamiblossom.com') throw new Error('unexpected-gsc-property');
  const token = await accessToken(); const windows = dateWindows(); const output = { site: SITE, dataState: 'final', timezone: 'America/Los_Angeles', windows, coverage: 'Search Analytics top rows; anonymized queries may be omitted, so detail totals may differ from page totals.' };
  for (const [name, period] of Object.entries(windows)) output[name] = { pages: await fetchRows(token, period, ['page']), detail: await fetchRows(token, period, ['query', 'page', 'country', 'device']) };
  return output;
}

const metric = row => ({ clicks: Number(row.clicks || 0), impressions: Number(row.impressions || 0), ctr: Number(row.ctr || 0), position: Number(row.position || 0) });
function significantCtrDrop(current, previous) {
  const pooled = (current.clicks + previous.clicks) / (current.impressions + previous.impressions);
  const error = Math.sqrt(pooled * (1 - pooled) * (1 / current.impressions + 1 / previous.impressions));
  return error > 0 && (previous.ctr - current.ctr) / error >= 1.96;
}
export function analyze(snapshot) {
  const noData = ['current', 'previous'].some(period => !snapshot[period]?.pages?.present || !snapshot[period]?.detail?.present);
  if (noData) return { status: 'missing-data', candidate: null };
  const previousPages = new Map(snapshot.previous.pages.rows.map(row => [row.keys[0], metric(row)]));
  const previousDetail = new Map(snapshot.previous.detail.rows.map(row => [row.keys.join('\u0000'), metric(row)]));
  const candidates = [];
  for (const row of snapshot.current.pages.rows) {
    const url = new URL(row.keys[0]);
    if (url.origin !== ORIGIN || url.search || url.hash) continue;
    const path = url.pathname; const currentPage = metric(row); const previousPage = previousPages.get(row.keys[0]);
    if (!ALLOWED[path] || !previousPage || currentPage.impressions < 300 || previousPage.impressions < 300 || previousPage.ctr <= currentPage.ctr || !significantCtrDrop(currentPage, previousPage)) continue;
    for (const detail of snapshot.current.detail.rows) {
      if (detail.keys[1] !== row.keys[0]) continue;
      const current = metric(detail); const previous = previousDetail.get(detail.keys.join('\u0000'));
      if (!previous || current.impressions < 100 || previous.impressions < 100 || current.position > 12 || Math.abs(current.position - previous.position) > 1) continue;
      if (current.impressions / currentPage.impressions < .2 || previous.ctr - current.ctr < .005 || current.ctr > previous.ctr * .8 || previous.clicks < 10 || previous.clicks - current.clicks < 3 || !significantCtrDrop(current, previous)) continue;
      const variant = ALLOWED[path].find(item => item.match.test(detail.keys[0]));
      if (variant) candidates.push({ path, variant, query: detail.keys[0], current, previous, page: currentPage, score: current.impressions * (previous.ctr - current.ctr) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length ? { status: 'draft', candidate: candidates[0] } : { status: 'insufficient-signal', candidate: null };
}

function escapeHtml(value) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function decodeHtml(value) { return value.replace(/&#(\d+);/g, (_all, code) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_all, code) => String.fromCodePoint(Number.parseInt(code, 16))).replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'); }
export function applyMetadata(html, variant) {
  const split = html.match(/^([\s\S]*?<head[^>]*>)([\s\S]*?)(<\/head>[\s\S]*)$/i); if (!split) throw new Error('missing-head');
  let head = split[2]; const title = escapeHtml(variant.title); const description = escapeHtml(variant.description);
  const replace = (regex, value, label, desired) => { const match = head.match(regex); if (!match) throw new Error(`missing-${label}`); if (decodeHtml(match[1]) === desired) return; head = head.replace(regex, value); };
  replace(/<title>([^<]*)<\/title>/i, `<title>${title}</title>`, 'title', variant.title);
  replace(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?\s*>/i, `<meta name="description" content="${description}" />`, 'description', variant.description);
  replace(/<meta\s+property="og:title"\s+content="([^"]*)"\s*\/?\s*>/i, `<meta property="og:title" content="${title}" />`, 'og-title', variant.title);
  replace(/<meta\s+property="og:description"\s+content="([^"]*)"\s*\/?\s*>/i, `<meta property="og:description" content="${description}" />`, 'og-description', variant.description);
  replace(/<meta\s+name="twitter:title"\s+content="([^"]*)"\s*\/?\s*>/i, `<meta name="twitter:title" content="${title}" />`, 'twitter-title', variant.title);
  replace(/<meta\s+name="twitter:description"\s+content="([^"]*)"\s*\/?\s*>/i, `<meta name="twitter:description" content="${description}" />`, 'twitter-description', variant.description);
  const output = split[1] + head + split[3];
  if (html.slice(html.search(/<\/head>/i) + 7) !== output.slice(output.search(/<\/head>/i) + 7)) throw new Error('body-changed');
  return output;
}
export function assertVersionBaseline(version, key, expectedHash) {
  if (version?.files?.[key] !== expectedHash) throw new Error('version-baseline-mismatch');
}
export function assertPublished(html, version, key, expectedHash, expectedRelease) {
  if (sha256(html) !== expectedHash || version?.files?.[key] !== expectedHash || version?.release !== expectedRelease) throw new Error('published-verification-failed');
}
function run(command, args) { const result = spawnSync(command, args, { encoding: 'utf8', shell: false }); if (result.status !== 0) throw new Error(`${command}-failed:${result.stderr.trim()}`); return result.stdout.trim(); }
function deploy(candidate, snapshot, runId) {
  const key = candidate.path === '/' ? 'index.html' : candidate.path.slice(1); const url = ORIGIN + candidate.path;
  const bucket = 'jamiblossom-web-960243570517'; const baselinePath = join(PRIVATE_DIR, `${runId}-baseline.html`);
  const oldEtag = run('aws', ['s3api', 'get-object', '--bucket', bucket, '--key', key, baselinePath, '--query', 'ETag', '--output', 'text']);
  const baseline = readFileSync(baselinePath, 'utf8'); const expectedHash = sha256(baseline); const updated = applyMetadata(baseline, candidate.variant);
  if (updated === baseline) return { status: 'no-op', baselineHash: expectedHash };
  const candidatePath = join(PRIVATE_DIR, `${runId}-${key.replaceAll('/', '-')}`); writeFileSync(candidatePath, updated);
  if (run('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text']) !== '960243570517') throw new Error('unexpected-aws-account');
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  const versionPath = join(PRIVATE_DIR, `${runId}-version.json`); const versionEtag = run('aws', ['s3api', 'get-object', '--bucket', bucket, '--key', 'version.json', versionPath, '--query', 'ETag', '--output', 'text']);
  const version = JSON.parse(readFileSync(versionPath, 'utf8')); assertVersionBaseline(version, key, expectedHash); const release = `seo-${runId}`; version.release = release; version.deployedAtUtc = new Date().toISOString(); version.files[key] = sha256(updated); writeFileSync(versionPath, JSON.stringify(version, null, 2));
  run('aws', ['s3api', 'copy-object', '--bucket', bucket, '--copy-source', `${bucket}/${encoded}`, '--copy-source-if-match', oldEtag, '--key', `rollback/seo/${runId}/${key}`]);
  run('aws', ['s3api', 'copy-object', '--bucket', bucket, '--copy-source', `${bucket}/version.json`, '--copy-source-if-match', versionEtag, '--key', `rollback/seo/${runId}/version.json`]);
  const newEtag = run('aws', ['s3api', 'put-object', '--bucket', bucket, '--key', key, '--body', candidatePath, '--if-match', oldEtag, '--cache-control', 'no-cache,no-store,must-revalidate', '--content-type', 'text/html', '--query', 'ETag', '--output', 'text']);
  try {
    run('aws', ['s3api', 'put-object', '--bucket', bucket, '--key', 'version.json', '--body', versionPath, '--if-match', versionEtag, '--cache-control', 'no-cache,no-store,must-revalidate', '--content-type', 'application/json']);
  } catch (error) {
    const rollbackPath = join(PRIVATE_DIR, `${runId}-rollback.html`); writeFileSync(rollbackPath, baseline);
    run('aws', ['s3api', 'put-object', '--bucket', bucket, '--key', key, '--body', rollbackPath, '--if-match', newEtag, '--cache-control', 'no-cache,no-store,must-revalidate', '--content-type', 'text/html']);
    throw error;
  }
  const invalidationId = run('aws', ['cloudfront', 'create-invalidation', '--distribution-id', 'E1GZVFASVCCZI8', '--paths', candidate.path, '/version.json', '--query', 'Invalidation.Id', '--output', 'text']);
  run('aws', ['cloudfront', 'wait', 'invalidation-completed', '--distribution-id', 'E1GZVFASVCCZI8', '--id', invalidationId]);
  const publishedPath = join(PRIVATE_DIR, `${runId}-published.html`); const publishedVersionPath = join(PRIVATE_DIR, `${runId}-published-version.json`);
  run('curl', ['--fail', '--silent', '--show-error', '--header', 'Cache-Control: no-cache', '--output', publishedPath, `${url}?seo-verify=${runId}`]);
  run('curl', ['--fail', '--silent', '--show-error', '--header', 'Cache-Control: no-cache', '--output', publishedVersionPath, `${ORIGIN}/version.json?seo-verify=${runId}`]);
  assertPublished(readFileSync(publishedPath, 'utf8'), JSON.parse(readFileSync(publishedVersionPath, 'utf8')), key, sha256(updated), release);
  const receipt = { status: 'deployed', runId, page: candidate.path, variant: candidate.variant.id, baselineHash: expectedHash, deployedHash: sha256(updated), invalidationId, verifiedAt: new Date().toISOString(), window: snapshot.windows.current };
  writeFileSync(join(PRIVATE_DIR, `${runId}-receipt.json`), JSON.stringify(receipt, null, 2));
  writeFileSync(join(PRIVATE_DIR, 'state.json'), JSON.stringify({ lastAppliedAt: new Date().toISOString(), page: candidate.path, variant: candidate.variant.id }, null, 2));
  run('aws', ['s3', 'cp', join(PRIVATE_DIR, 'state.json'), `s3://${bucket}/seo-state/last-applied.json`, '--cache-control', 'no-store', '--content-type', 'application/json', '--no-progress']);
  return receipt;
}
function args() { const values = process.argv.slice(2); const value = flag => { const index = values.indexOf(flag); return index >= 0 ? values[index + 1] : undefined; }; return { input: value('--input'), apply: values.includes('--apply'), deploy: values.includes('--deploy') }; }
async function main() {
  mkdirSync(PRIVATE_DIR, { recursive: true }); const lock = join(PRIVATE_DIR, '.lock');
  try { writeFileSync(lock, String(process.pid), { flag: 'wx' }); } catch { throw new Error('seo-batch-already-running'); }
  try {
    const options = args(); const snapshot = options.input ? JSON.parse(readFileSync(resolve(options.input), 'utf8')) : await collect(); const result = analyze(snapshot); const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const report = { generatedAt: new Date().toISOString(), ...snapshot, analysis: result }; const reportPath = join(PRIVATE_DIR, `${runId}-report.json`); writeFileSync(reportPath, JSON.stringify(report, null, 2));
    let outcome = { status: result.status };
    if (options.deploy && options.input) throw new Error('fixture-deploy-forbidden');
    if (options.apply && result.candidate) {
      let state = null; const statePath = join(PRIVATE_DIR, 'state.json');
      if (options.deploy) {
        const head = spawnSync('aws', ['s3api', 'head-object', '--bucket', 'jamiblossom-web-960243570517', '--key', 'seo-state/last-applied.json'], { encoding: 'utf8', shell: false });
        if (head.status === 0) { run('aws', ['s3api', 'get-object', '--bucket', 'jamiblossom-web-960243570517', '--key', 'seo-state/last-applied.json', statePath]); state = JSON.parse(readFileSync(statePath, 'utf8')); }
        else if (!/404|Not Found|NoSuchKey/i.test(head.stderr)) throw new Error(`cooldown-state-failed:${head.stderr.trim()}`);
      }
      if (state?.lastAppliedAt && Date.now() - Date.parse(state.lastAppliedAt) < 28 * 86400000) outcome = { status: 'cooldown' };
      else outcome = options.deploy ? deploy(result.candidate, snapshot, runId) : { status: 'draft-only', page: result.candidate.path, variant: result.candidate.variant.id };
    }
    console.log(JSON.stringify({ status: outcome.status, report: reportPath, page: outcome.page, variant: outcome.variant, invalidationId: outcome.invalidationId }));
  } finally { try { unlinkSync(lock); } catch {} }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
