import { createHash } from 'node:crypto';
import { retrieve } from './retrieval.mjs';

const memoryCache = new Map();
const inFlight = new Map();
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
const stable = (value) => JSON.stringify(canonicalize(value));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const SYSTEM = {
  saju: '역할: 고전 사주 원문 해설자. 순서: (1) 원국의 확정 사실 (2) 관련 원문과 판본 한계 (3) 질문에 대한 조건부 해석 (4) 불확실성. 격국·용신·조후의 학파를 섞지 말고 단정적 예언이나 의학·법률·투자 판단을 하지 않는다.',
  ziwei: '역할: 고전 자미두수 원문 해설자. 순서: (1) 명궁·신궁·12궁과 성요 배치 (2) 삼방사정 근거 (3) 원문 인용 (4) 판본 및 해석 한계. 사주 이론을 혼입하거나 현대 경험칙을 고전 원문처럼 쓰지 않는다.',
  mangpa: '역할: 단건업 계열 자료 해설자. 허가된 단건업 원문만 사용하며 體用·賓主·做功을 출처별로 분리한다. 허가 원문이 없거나 질문에 맞는 근거가 부족하면 해석을 거부한다.',
};
const SOURCE_PROTOCOL = `출력 구조:
1. 명반 요약: 계산 JSON의 필드만 기술하고 [CHART:field.path]로 표시한다.
2. 원문 근거: 인용문을 짧게 풀어 쓰고 해당 source ID를 붙인다.
3. 종합 해석: 계산 사실과 원문 해석을 명시적으로 구분한다.
4. 질문 답변: 조건부 표현을 사용하고 근거 범위를 넘지 않는다.
5. 한계: 판본, 누락 자료, 해석 불확실성을 밝힌다.
원문에 없는 내용을 원문 저자의 주장으로 만들지 않는다. 계산 사실에는 source ID를 붙이지 않고 CHART 경로를 쓴다.`;
const pillar = (value) => value ? { cn: value.cn, stem: value.stem, branch: value.branch, wuxing: value.wuxing, hideGan: value.hideGan, shiShenGan: value.shiShenGan, shiShenZhi: value.shiShenZhi, diShi: value.diShi, xunKong: value.xunKong } : null;
export async function assemble(request) {
  const { ownerId, domain, question, chart, lineage } = request;
  if (!ownerId || !SYSTEM[domain] || !question || !chart) throw new Error('ownerId, supported domain, question, and chart are required');
  const retrieval = await retrieve({ domain, query: question, lineage });
  if (!retrieval.sufficient) return { status: 'insufficient_sources', reason: retrieval.reason, citations: [] };
  const saju = chart.saju;
  const sajuProjection = saju ? { solarDate: chart.solarDate, lunarDate: chart.lunarDate, year: pillar(saju.year), month: pillar(saju.month), day: pillar(saju.day), hour: pillar(saju.hour), taiYuan: saju.taiYuan, mingGong: saju.mingGong, shenGong: saju.shenGong, isForward: saju.isForward, currentDaYunIndex: saju.currentDaYunIndex, daYun: (saju.daYun ?? []).map((x) => ({ ganZhi: x.ganZhi, startAge: x.startAge, endAge: x.endAge, startYear: x.startYear, endYear: x.endYear })) } : chart;
  const projection = domain === 'saju' ? sajuProjection : domain === 'ziwei' ? { solarDate: chart.solarDate, lunarDate: chart.lunarDate, fiveElementsClass: chart.fiveElementsClass, soul: chart.soul, body: chart.body, soulBranch: chart.earthlyBranchOfSoulPalace, bodyBranch: chart.earthlyBranchOfBodyPalace, palaces: (chart.palaces ?? []).map((p) => ({ name: p.name, branch: p.earthlyBranch, stem: p.heavenlyStem, body: p.isBodyPalace, major: p.majorStars?.map((s) => [s.name, s.brightness, s.mutagen]), minor: p.minorStars?.map((s) => [s.name, s.brightness, s.mutagen]), adjective: p.adjectiveStars?.map((s) => s.name), stage: p.stage })), surrounded: chart.surrounded, current: chart.horoscope ? { age: chart.horoscope.age, childhood: chart.horoscope.childhood, decadal: chart.horoscope.decadal, yearly: chart.horoscope.yearly } : null } : sajuProjection;
  const facts = stable(projection);
  if (facts.length > 12000) throw new Error('Chart projection exceeds the 12000-character input budget.');
  const sources = retrieval.citations.map((x) => `[${x.id}] ${x.text}\nSOURCE ${x.sourceUrl}`).join('\n\n');
  const instructions = `${SYSTEM[domain]}\n\n${SOURCE_PROTOCOL}`;
  const input = `확정 명반 JSON:\n${facts}\n\n사용자 질문:\n${question.slice(0, 1200)}\n\n검색된 원문 자료:\n${sources}`;
  return { status: 'ready', instructions, input, corpusFingerprint: retrieval.corpusFingerprint, citations: retrieval.citations.map(({ id, title, pageTitle, sourceUrl, revisionId }) => ({ id, title, pageTitle, sourceUrl, revisionId })), estimatedInputChars: instructions.length + input.length };
}
export async function handleReading(request, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || 'gpt-5.6-luna', maxOutputTokens = 900 } = {}) {
  const assembled = await assemble(request);
  // Deliberately locked until a durable cross-instance budget/idempotency adapter is implemented.
  const paidEnabled = false;
  if (assembled.status !== 'ready' || !apiKey || !paidEnabled) return { ...assembled, dryRun: !apiKey || !paidEnabled, generationDisabledReason: !apiKey ? 'OPENAI_API_KEY is not configured.' : 'Durable budget guard is not implemented; paid generation is code-locked.', model };
  const cacheKey = hash(stable({ ownerId: request.ownerId, domain: request.domain, question: request.question, chart: request.chart, lineage: request.lineage, corpusFingerprint: assembled.corpusFingerprint, model, template: 1 }));
  if (memoryCache.has(cacheKey)) return { ...memoryCache.get(cacheKey), cached: true };
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
  const operation = (async () => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', signal: controller.signal, headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, instructions: assembled.instructions, input: assembled.input, reasoning: { effort: 'none' }, store: false, max_output_tokens: maxOutputTokens }) });
      if (!response.ok) throw new Error(`Provider error ${response.status}`);
      const payload = await response.json();
      if (payload.status && payload.status !== 'completed') throw new Error(`Provider response status ${payload.status}`);
      const content = (payload.output ?? []).flatMap((item) => item.content ?? []);
      if (content.some((item) => item.type === 'refusal')) throw new Error('Provider refused the request.');
      const text = content.filter((item) => item.type === 'output_text').map((item) => item.text).join('\n').trim();
      if (!text) throw new Error('Provider returned no output_text content.');
      const result = { status: 'complete', text, citations: assembled.citations, model, usage: payload.usage, responseId: payload.id, cached: false };
      memoryCache.set(cacheKey, result);
      console.log(JSON.stringify({ event: 'reading.complete', ownerHash: hash(request.ownerId).slice(0, 16), domain: request.domain, model, usage: payload.usage, cacheKey: cacheKey.slice(0, 16) }));
      return result;
    } finally { clearTimeout(timer); inFlight.delete(cacheKey); }
  })();
  inFlight.set(cacheKey, operation);
  return operation;
}

export const canonicalRequestKey = (request, model = 'gpt-5.6-luna') => hash(stable({ ownerId: request.ownerId, domain: request.domain, question: request.question, chart: request.chart, lineage: request.lineage, model, template: 1 }));

export async function lambdaHandler(event) {
  const ownerId = event?.requestContext?.authorizer?.iam?.userId || event?.requestContext?.identity?.userArn;
  if (!ownerId) return { statusCode: 401, body: JSON.stringify({ error: 'AWS_IAM authentication required' }) };
  try { return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(await handleReading({ ...JSON.parse(event.body || '{}'), ownerId })) }; }
  catch (error) { return { statusCode: 400, body: JSON.stringify({ error: error.message }) }; }
}
