import './styles.css';
import { calculateZiweiChart, loadJamiBlossomWasm, PALACE_GRID_AREAS, TIME_BRANCH_OPTIONS, seoulNowParts, timeToIndexFromTime } from 'jamiblossom';
import type { Chart, ChartRequest, Palace, SajuPillar } from 'jamiblossom';

type Tab = 'ziwei' | 'saju' | 'info';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('앱 루트가 없습니다.');

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const field = (labelText: string, input: HTMLElement, hint?: string): HTMLLabelElement => {
  const label = el('label', 'field');
  label.append(el('span', 'field-label', labelText), input);
  if (hint) label.append(el('small', 'field-hint', hint));
  return label;
};

const numberInput = (name: string, value: string, min: string, max: string): HTMLInputElement => {
  const input = el('input');
  input.type = 'number'; input.name = name; input.value = value; input.min = min; input.max = max;
  input.required = true; input.inputMode = 'numeric';
  return input;
};

const header = el('header', 'hero');
header.append(
  el('p', 'eyebrow', 'JAMI BLOSSOM'),
  el('h1', '', '무료 만세력 · 자미두수'),
  el('p', 'lede', '사주 원국과 대운, 자미두수 12궁의 전체 계산 데이터를 확인합니다.'),
);

const layout = el('main', 'layout');
const panel = el('section', 'input-panel');
panel.setAttribute('aria-labelledby', 'input-title');
const inputTitle = el('h2', '', '출생 정보'); inputTitle.id = 'input-title';
const form = el('form', 'birth-form');

const calendar = el('select'); calendar.name = 'calendar';
for (const [value, label] of [['solar', '양력'], ['lunar', '음력']]) {
  const option = el('option', '', label); option.value = value; calendar.append(option);
}
const year = numberInput('year', '1990', '100', '2200');
const month = numberInput('month', '1', '1', '12');
const day = numberInput('day', '1', '1', '31');
const dateRow = el('div', 'date-fields');
dateRow.append(field('년', year), field('월', month), field('일', day));
const time = el('input'); time.type = 'time'; time.name = 'time'; time.value = '12:00'; time.required = true;
const timeBranch = el('select'); timeBranch.name = 'timeBranch';
for (const optionData of TIME_BRANCH_OPTIONS) {
  const option = el('option', '', `${optionData.label}${optionData.note ? `(${optionData.note})` : ''} · ${optionData.range}`);
  option.value = optionData.time; timeBranch.append(option);
}
timeBranch.value = '11:30';
timeBranch.addEventListener('change', () => { time.value = timeBranch.value; form.dispatchEvent(new Event('input')); });
time.addEventListener('input', () => {
  const index = timeToIndexFromTime(time.value);
  const option = TIME_BRANCH_OPTIONS.find((item) => item.index === index);
  if (option) timeBranch.value = option.time;
});
const gender = el('select'); gender.name = 'gender';
for (const [value, label] of [['male', '남성'], ['female', '여성']]) {
  const option = el('option', '', label); option.value = value; gender.append(option);
}
const leap = el('input'); leap.type = 'checkbox'; leap.name = 'leap';
const leapWrap = el('label', 'check'); leapWrap.append(leap, el('span', '', '윤달'));
const ziMode = el('select'); ziMode.name = 'ziMode';
for (const [value, label] of [['split', '야자시·조자시 분리'], ['fixed', '자시를 같은 날짜로 고정']]) {
  const option = el('option', '', label); option.value = value; ziMode.append(option);
}
const calendarField = field('달력 기준', calendar);
const timeField = field('출생 시각', time);
const timeBranchField = field('시진으로 선택', timeBranch, '자시·축시 등 시진을 고르면 대표 시각이 자동 입력됩니다.');
const genderField = field('성별', gender);
const ziModeField = field('자시 기준', ziMode);
const submit = el('button', 'primary', '명반 계산하기'); submit.type = 'submit';
const formNote = el('p', 'form-note', '한국 표준시의 지역시 차이를 반영해 입력 시각을 30분 앞당겨 시진을 정합니다. 출생 정보와 계산 결과는 이 기기 밖으로 전송하지 않습니다.');
form.append(calendarField, dateRow, timeField, timeBranchField, genderField, ziModeField, leapWrap, submit, formNote);
panel.append(inputTitle, form);

const resultPanel = el('section', 'result-panel');
const status = el('div', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
const tabs = el('div', 'tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '결과 보기');
const content = el('div', 'result-content');
resultPanel.append(status, tabs, content);
layout.append(panel, resultPanel);
root.append(header, layout, el('footer', '', 'Jami Blossom · 계산 결과는 전통 역학의 원국 자료이며 중요한 결정의 유일한 근거로 사용하지 마세요.'));

let activeTab: Tab = location.hash === '#ziwei' ? 'ziwei' : 'saju';
let chart: Chart | null = null;
let calculatedKey = '';
let lastRequest: ChartRequest | null = null;
let isCalculating = false;

const requestFromForm = (): ChartRequest => {
  const flow = seoulNowParts();
  return {
    calendar: calendar.value as 'solar' | 'lunar', date: `${year.value}-${month.value}-${day.value}`,
    time: time.value, gender: gender.value, language: 'ko-KR',
    isLeapMonth: calendar.value === 'lunar' && leap.checked,
    ziTimeMode: ziMode.value as 'split' | 'fixed', flowDate: flow.date, flowTime: flow.time,
  };
};

const requestKey = () => JSON.stringify({ calendar: calendar.value, date: `${year.value}-${month.value}-${day.value}`, time: time.value, gender: gender.value, isLeapMonth: calendar.value === 'lunar' && leap.checked, ziTimeMode: ziMode.value });

const renderStatus = (kind: 'loading' | 'ready' | 'error' | 'stale', message: string) => {
  status.className = `status ${kind}`; status.textContent = message;
};

const renderTabs = () => {
  tabs.replaceChildren();
  const labels: Array<[Tab, string]> = [['saju', '만세력'], ['ziwei', '자미두수']];
  labels.forEach(([id, label]) => {
    const button = el('button', activeTab === id ? 'active' : '', label);
    button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(activeTab === id));
    button.addEventListener('click', () => { activeTab = id; history.replaceState(null, '', id === 'ziwei' ? '#ziwei' : location.pathname); renderTabs(); renderResult(); });
    tabs.append(button);
  });
};

const star = (name: string, mutagen?: string | null, brightness?: string) => {
  const chip = el('span', mutagen ? 'star mutagen' : 'star', name);
  const brightnessLabel: Record<string, string> = { '[+3]': '묘', '[+2]': '왕', '[+1]': '득', '[0]': '리', '[-1]': '평', '[-2]': '불', '[-3]': '함' };
  if (brightness) { chip.title = `밝기 ${brightness}`; chip.append(el('small', '', brightnessLabel[brightness] || brightness)); }
  if (mutagen) chip.append(el('b', '', mutagen));
  return chip;
};

const palaceCard = (palace: Palace, sourceIndex: number, related: Set<number>, currentDecadal: number | null, select: () => void) => {
  const card = el('article', `palace-card${related.has(sourceIndex) ? ' related' : ''}${currentDecadal === sourceIndex ? ' current-decadal' : ''}`);
  card.style.gridArea = PALACE_GRID_AREAS[palace.earthlyBranch] || `p${sourceIndex}`; card.tabIndex = 0;
  card.addEventListener('click', select); card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') select(); });
  const heading = el('div', 'palace-heading');
  heading.append(el('span', 'palace-index', String(sourceIndex + 1)), el('h3', '', palace.name || '이름 없음'), el('span', 'ganji', `${palace.heavenlyStem}${palace.earthlyBranch}`));
  const badges = el('div', 'badges');
  if (palace.isBodyPalace) badges.append(el('span', '', '신궁'));
  if (palace.isOriginalPalace) badges.append(el('span', '', '래인궁'));
  if (currentDecadal === sourceIndex) badges.append(el('span', 'current-label', '현재 대한'));
  const stars = el('div', 'stars');
  const addGroup = (label: string, items: HTMLElement[]) => {
    if (!items.length) return; const group = el('div', 'star-group'); group.append(el('strong', '', label), ...items); stars.append(group);
  };
  addGroup('주성', palace.majorStars.map((item) => star(item.name, item.mutagen, item.brightness)));
  addGroup('보좌성', palace.minorStars.map((item) => star(item.name, item.mutagen, item.brightness)));
  addGroup('잡성', palace.adjectiveStars.map((item) => star(item.name)));
  if (!stars.childElementCount) stars.append(el('span', 'empty', '주요 별 없음'));
  const cycle = el('p', 'cycle', [palace.changsheng12, palace.boshi12, palace.jiangqian12, palace.suiqian12].filter(Boolean).join(' · '));
  card.append(heading, badges, stars, cycle);
  return card;
};

const renderZiwei = (value: Chart) => {
  const wrap = el('div');
  const grid = el('div', 'palace-grid');
  let selected = value.palaces.findIndex((palace) => palace.earthlyBranch === value.earthlyBranchOfSoulPalace);
  if (selected < 0) selected = 0;
  const detail = el('section', 'relation-detail');
  const redraw = () => {
    const relation = value.surrounded.find((item) => item.self === selected);
    const related = new Set<number>(relation ? [relation.self, ...relation.trine, relation.opposite] : [selected]);
    grid.querySelectorAll('.palace-card').forEach((node) => node.remove());
    const currentDecadal = value.horoscope?.decadal?.index ?? null;
    value.palaces.slice(0, 12).forEach((palace, index) => grid.append(palaceCard(palace, index, related, currentDecadal, () => { selected = index; redraw(); })));
    const names = relation ? [relation.self, ...relation.trine, relation.opposite].map((index) => value.palaces[index]?.name || '-') : [];
    const selectedPalace = value.palaces[selected];
    const fly = value.flies.find((item) => item.from === selected);
    const routes = fly?.routes.map((route) => `${route.mutagenKo}: ${route.toPalace || '해당 없음'}`).join(' · ') || '비성 경로 없음';
    const stage = selectedPalace.stage ? `${selectedPalace.stage.from}–${selectedPalace.stage.to}세` : '-';
    const movingStars = value.horoscope
      ? [value.horoscope.childhood, value.horoscope.decadal, value.horoscope.yearly, value.horoscope.monthly, value.horoscope.daily, value.horoscope.hourly]
        .filter((scope): scope is NonNullable<typeof scope> => Boolean(scope))
        .map((scope) => `${scope.name} ${scope.stars?.[selected]?.map((item) => item.name).join('·') || '-'}`).join(' · ')
      : '-';
    detail.replaceChildren(
      el('strong', '', `${selectedPalace?.name || '-'} 삼방사정`), el('span', '', names.join(' · ')),
      el('span', '', `대한 ${stage} · 소한 ${selectedPalace.ages.join(', ') || '-'}`),
      el('span', '', `비성사화 ${routes}`),
      el('span', '', `선택궁 운성 ${movingStars}`),
    );
  };
  const center = el('section', 'chart-center');
  center.append(
    el('p', 'eyebrow', '원국 요약'),
    el('h2', '', `${value.sign || '별자리 정보 없음'} · ${value.zodiac || '띠 정보 없음'}`),
    el('p', '', `${value.fiveElementsClass || '-'} · 명주 ${value.soul || '-'} · 신주 ${value.body || '-'}`),
    el('dl', 'summary-list'),
  );
  const dl = center.querySelector('dl')!;
  [['명궁', value.earthlyBranchOfSoulPalace], ['신궁', value.earthlyBranchOfBodyPalace], ['시진', value.timeRange || value.time]].forEach(([term, desc]) => {
    dl.append(el('dt', '', term), el('dd', '', desc || '-'));
  });
  if (value.horoscope) {
    const layers = [value.horoscope.age, value.horoscope.childhood, value.horoscope.decadal, value.horoscope.yearly, value.horoscope.monthly, value.horoscope.daily, value.horoscope.hourly]
      .filter((scope): scope is NonNullable<typeof scope> => Boolean(scope));
    const table = el('table', 'flow-table');
    const head = el('tr'); ['운', '간지', '위치', '사화'].forEach((label) => head.append(el('th', '', label))); table.append(head);
    layers.forEach((scope) => {
      const row = el('tr');
      const position = value.palaces[scope.index] ? `${value.palaces[scope.index].name}(${value.palaces[scope.index].earthlyBranch})` : '-';
      const mutagen = ['록', '권', '과', '기'].map((label, index) => `${label} ${scope.mutagen[index] || '-'}`).join(' · ');
      [scope.name, `${scope.heavenlyStem}${scope.earthlyBranch}`, position, mutagen].forEach((cell) => row.append(el('td', '', cell)));
      table.append(row);
    });
    center.append(table);
  }
  grid.append(center); redraw(); wrap.append(grid, detail); content.append(wrap);
};

const pillarCard = (label: string, pillar: SajuPillar) => {
  const card = el('article', 'pillar');
  card.append(
    el('p', 'pillar-label', label), el('strong', '', pillar.ko || pillar.cn), el('span', '', pillar.cn),
    el('dl', 'pillar-data'),
  );
  const dl = card.querySelector('dl')!;
  const rows = [
    ['천간 십성', pillar.shiShenGan], ['지지 십성', pillar.shiShenBranch],
    ['지장간', `${pillar.hideGanKo || pillar.hideGan} ${pillar.shiShenZhi.join('·')}`],
    ['오행', pillar.wuxing], ['12운성', pillar.diShi], ['납음', pillar.nayin],
  ];
  rows.forEach(([term, desc]) => dl.append(el('dt', '', term), el('dd', '', desc || '-')));
  return card;
};

const renderSaju = (value: Chart) => {
  const wrap = el('div', 'saju-view');
  wrap.append(el('p', 'section-kicker', '사주 원국'));
  const pillars = el('div', 'pillars');
  pillars.append(pillarCard('년주', value.saju.year), pillarCard('월주', value.saju.month), pillarCard('일주', value.saju.day), pillarCard('시주', value.saju.hour));
  wrap.append(pillars, el('h3', '', '대운 흐름'));
  const yunMeta = el(
    'p',
    'order-note',
    `${value.saju.yunStartDesc || '대운 시작 시점 정보 없음'} · ${value.saju.isForward ? '순행' : '역행'}`,
  );
  const daYun = el('div', 'dayun-list');
  value.saju.daYun.forEach((item, index) => {
    const card = el('article', index === value.saju.currentDaYunIndex ? 'dayun current' : 'dayun');
    card.append(el('strong', '', item.ganZhiKo || item.ganZhi || '대운 시작 전'), el('span', '', `${item.startAge}–${item.endAge}세`), el('small', '', `${item.startYear}–${item.endYear}`));
    if (item.startSolarDateTime) card.append(el('small', '', `${item.startSolarDateTime.replace('T', ' ')}부터`));
    if (index === value.saju.currentDaYunIndex) card.prepend(el('b', 'current-label', '현재 대운'));
    daYun.append(card);
  });
  const extras = el('dl', 'info-list');
  [
    ['태원', `${value.saju.taiYuan} · ${value.saju.taiYuanNaYin}`], ['태식', `${value.saju.taiXi} · ${value.saju.taiXiNaYin}`],
    ['명궁', `${value.saju.mingGong} · ${value.saju.mingGongNaYin}`], ['신궁', `${value.saju.shenGong} · ${value.saju.shenGongNaYin}`],
    ['일주 공망', value.saju.dayXunKong], ['첫 대운 절입', value.saju.daYunStartSolarDateTime.replace('T', ' ')],
    ['현재 기준 시각', value.saju.daYunReferenceDateTime.replace('T', ' ')],
  ].forEach(([term, desc]) => extras.append(el('dt', '', term), el('dd', '', desc || '-')));
  wrap.append(extras, yunMeta, daYun, el('p', 'interpretation-note', '위 표는 계산된 원국과 운의 자료입니다. 길흉이나 사건을 임의로 덧붙이지 않습니다.'));
  content.append(wrap);
};

const renderInfo = (value: Chart) => {
  const dl = el('dl', 'info-list');
  const req = lastRequest;
  if (!req) return;
  const rows = [
    ['입력 달력', req.calendar === 'solar' ? '양력' : '음력'], ['입력 날짜', req.date],
    ['양력 환산', value.solarDate], ['음력 환산', value.lunarDate], ['간지 날짜', value.chineseDate], ['엔진 시각', value.timeRange || value.time],
    ['시각 보정', '입력 시각에서 -30분 보정해 시진 결정'], ['자시 기준', req.ziTimeMode === 'split' ? '야자시·조자시 분리 (sect 1)' : '자시 고정 (sect 2)'],
  ];
  rows.forEach(([term, desc]) => dl.append(el('dt', '', term), el('dd', '', desc || '-')));
  content.append(dl);
};

const renderResult = () => {
  content.replaceChildren();
  if (!chart) { content.append(el('div', 'empty-state', '출생 정보를 계산하면 이곳에 결과가 나타납니다.')); return; }
  if (activeTab === 'ziwei') renderZiwei(chart);
  else if (activeTab === 'saju') renderSaju(chart);
  else renderInfo(chart);
};

const calculate = async () => {
  isCalculating = true; submit.disabled = true; renderStatus('loading', '로컬 엔진을 불러와 명반을 계산하고 있습니다…');
  const request = requestFromForm();
  const submissionKey = requestKey();
  try {
    let result: Chart;
    let engine: Awaited<ReturnType<typeof loadJamiBlossomWasm>> | null = null;
    try {
      engine = await loadJamiBlossomWasm();
    } catch (wasmError) {
      console.warn('WASM 초기화 실패, JavaScript 엔진으로 계산합니다.', wasmError);
    }
    if (engine) {
      result = engine.calculate(request);
    } else {
      result = calculateZiweiChart(request);
    }
    chart = result; lastRequest = request; calculatedKey = submissionKey;
    if (requestKey() === calculatedKey) {
      renderStatus('ready', `${request.date} ${request.time} 기준 명반 계산을 마쳤습니다.`);
    } else {
      renderStatus('stale', '계산 중 입력값이 바뀌었습니다. 현재 결과는 이전 입력 기준입니다. 다시 계산해 주세요.');
    }
    renderResult();
  } catch (error) {
    chart = null; lastRequest = null; calculatedKey = '';
    const message = error instanceof Error ? error.message : String(error);
    renderStatus('error', `계산할 수 없습니다: ${message}`); renderResult();
  } finally { isCalculating = false; submit.disabled = false; }
};

form.addEventListener('submit', (event) => { event.preventDefault(); void calculate(); });
form.addEventListener('input', () => {
  leap.disabled = calendar.value !== 'lunar';
  day.max = calendar.value === 'lunar' ? '30' : '31';
  if (!chart) return;
  if (requestKey() !== calculatedKey) {
    renderStatus('stale', '입력값이 바뀌었습니다. 현재 결과는 이전 입력 기준입니다. 다시 계산해 주세요.');
  } else if (!isCalculating && lastRequest) {
    renderStatus('ready', `${lastRequest.date} ${lastRequest.time} 기준 명반 계산을 마쳤습니다.`);
  }
});

renderTabs(); renderResult(); leap.disabled = true; void calculate();
