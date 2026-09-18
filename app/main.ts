import './styles.css';
import { PALACE_GRID_AREAS, TIME_BRANCH_OPTIONS, seoulNowParts, timeToIndexFromTime } from 'jamiblossom';
import type { Chart, ChartRequest, Palace, SajuPillar } from 'jamiblossom';

type Tab = 'ziwei' | 'saju';

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
year.dataset.segment = 'year'; month.dataset.segment = 'month'; day.dataset.segment = 'day';
const dateSegments = [year, month, day];
dateSegments.forEach((input) => input.addEventListener('focus', () => input.select()));
year.addEventListener('input', () => {
  const digits = year.value.replace(/\D/g, '');
  if (digits.length >= 8) {
    year.value = digits.slice(0, 4); month.value = String(Number(digits.slice(4, 6))); day.value = String(Number(digits.slice(6, 8)));
    day.focus(); day.select();
  } else if (digits.length === 4) { month.focus(); month.select(); }
});
month.addEventListener('input', () => { if (month.value.replace(/\D/g, '').length >= 2) { day.focus(); day.select(); } });
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
const flowNow = seoulNowParts();
const flowDate = el('input'); flowDate.type = 'date'; flowDate.value = flowNow.date;
const flowTime = el('input'); flowTime.type = 'time'; flowTime.value = flowNow.time;
const flowRow = el('div', 'flow-fields');
flowRow.append(field('운 기준 날짜', flowDate), field('기준 시각', flowTime, '대한·세운·월운·일운·시운을 이 시점으로 계산합니다.'));
const formNote = el('p', 'form-note', '한국 표준시의 지역시 차이를 반영해 입력 시각을 30분 앞당겨 시진을 정합니다. 출생 정보와 계산 결과는 이 기기 밖으로 전송하지 않습니다.');
form.append(calendarField, dateRow, timeField, timeBranchField, genderField, ziModeField, leapWrap, flowRow, formNote);
panel.append(inputTitle, form);

const resultPanel = el('section', 'result-panel');
const status = el('div', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
const tabs = el('div', 'tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '결과 보기');
const content = el('div', 'result-content');
const legend = el('div', 'star-legend'); [['보좌·길성','lucky-star'],['살성','malefic-star'],['록존·천마','special-star'],['록·권·과·기','mutagen-key']].forEach(([label, cls]) => legend.append(el('span', cls, label)));
resultPanel.append(status, tabs, legend, content);
layout.append(panel, resultPanel);
root.append(header, layout, el('footer', '', 'Jami Blossom · 계산 결과는 전통 역학의 원국 자료이며 중요한 결정의 유일한 근거로 사용하지 마세요.'));

let activeTab: Tab = location.hash === '#ziwei' ? 'ziwei' : 'saju';
let chart: Chart | null = null;
let calculatedKey = '';
const worker = new Worker(new URL('./chart.worker.ts', import.meta.url), { type: 'module' });
let requestId = 0;
let chartOverlayCleanup = () => {};

const requestFromForm = (): ChartRequest => {
  return {
    calendar: calendar.value as 'solar' | 'lunar', date: `${year.value}-${month.value}-${day.value}`,
    time: time.value, gender: gender.value, language: 'ko-KR',
    isLeapMonth: calendar.value === 'lunar' && leap.checked,
    ziTimeMode: ziMode.value as 'split' | 'fixed', flowDate: flowDate.value, flowTime: flowTime.value,
  };
};

const requestKey = () => JSON.stringify({ calendar: calendar.value, date: `${year.value}-${month.value}-${day.value}`, time: time.value, gender: gender.value, isLeapMonth: calendar.value === 'lunar' && leap.checked, ziTimeMode: ziMode.value, flowDate: flowDate.value, flowTime: flowTime.value });

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

const star = (name: string, mutagen?: string | null, brightness?: string, tone = '') => {
  const mutagenTone: Record<string, string> = { '록': 'mutagen-lu', '권': 'mutagen-quan', '과': 'mutagen-ke', '기': 'mutagen-ji' };
  const chip = el('span', ['star', tone, mutagen ? 'mutagen' : '', mutagen ? mutagenTone[mutagen] || '' : ''].filter(Boolean).join(' '), name);
  const brightnessLabel: Record<string, string> = { '[+3]': '묘', '[+2]': '왕', '[+1]': '득', '[0]': '리', '[-1]': '평', '[-2]': '불', '[-3]': '함' };
  if (brightness) { const label = brightnessLabel[brightness] || brightness; chip.title = `밝기 ${label} (${brightness})`; chip.append(el('small', `brightness brightness-${brightness.replace(/[^0-9-]/g, '')}`, label)); }
  if (mutagen) chip.append(el('b', '', mutagen));
  return chip;
};

const palaceCard = (palace: Palace, sourceIndex: number, related: Set<number>, currentDecadal: number | null, select: () => void) => {
  const card = el('article', `palace-card${related.has(sourceIndex) ? ' related' : ''}${currentDecadal === sourceIndex ? ' current-decadal' : ''}`);
  card.dataset.palaceIndex = String(sourceIndex);
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
  addGroup('주성', palace.majorStars.map((item) => star(item.name, item.mutagen, item.brightness, 'major-star')));
  addGroup('보좌·길성', palace.minorStars.filter((item) => item.type === 'soft' || item.type === 'helper').map((item) => star(item.name, item.mutagen, item.brightness, 'lucky-star')));
  addGroup('살성', palace.minorStars.filter((item) => item.type === 'tough').map((item) => star(item.name, item.mutagen, item.brightness, 'malefic-star')));
  addGroup('록존·천마', palace.minorStars.filter((item) => item.type === 'lucun' || item.type === 'tianma').map((item) => star(item.name, item.mutagen, item.brightness, 'special-star')));
  addGroup('잡성', palace.adjectiveStars.map((item) => star(item.name, null, undefined, 'adjective-star')));
  if (!stars.childElementCount) stars.append(el('span', 'empty', '주요 별 없음'));
  const cycle = el('p', 'cycle', [palace.changsheng12, palace.boshi12, palace.jiangqian12, palace.suiqian12].filter(Boolean).join(' · '));
  card.append(heading, badges, stars, cycle);
  return card;
};

const renderZiwei = (value: Chart) => {
  const wrap = el('div');
  let flowTable: HTMLTableElement | null = null;
  const grid = el('div', 'palace-grid');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('relation-lines'); svg.setAttribute('aria-hidden', 'true'); grid.append(svg);
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
    requestAnimationFrame(() => {
      svg.replaceChildren();
      if (!relation) return;
      const bounds = grid.getBoundingClientRect();
      const point = (index: number) => {
        const node = grid.querySelector<HTMLElement>(`[data-palace-index="${index}"]`); if (!node) return null;
        const rect = node.getBoundingClientRect(); return `${rect.left - bounds.left + rect.width / 2},${rect.top - bounds.top + rect.height / 2}`;
      };
      const triangle = [relation.self, ...relation.trine].map(point).filter(Boolean);
      if (triangle.length === 3) { const polygon = document.createElementNS(svg.namespaceURI, 'polygon'); polygon.setAttribute('points', triangle.join(' ')); polygon.classList.add('trine-line'); svg.append(polygon); }
      const start = point(relation.self); const end = point(relation.opposite);
      if (start && end) { const line = document.createElementNS(svg.namespaceURI, 'line'); const [x1,y1] = start.split(','); const [x2,y2] = end.split(','); Object.entries({ x1,y1,x2,y2 }).forEach(([key,val]) => line.setAttribute(key,val)); line.classList.add('opposite-line'); svg.append(line); }
    });
  };
  const center = el('section', 'chart-summary');
  center.append(
    el('p', 'eyebrow', '자미두수 명반'),
    el('h2', '', `명궁 · ${value.earthlyBranchOfSoulPalace || '-'}`),
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
    flowTable = table;
  }
  const diagramCenter = el('section', 'chart-center');
  diagramCenter.setAttribute('aria-label', '삼방사정 관계선 영역');
  grid.append(diagramCenter); redraw();
  wrap.append(center, grid, detail);
  if (flowTable) { const flow = el('section', 'flow-detail'); flow.append(el('h3', '', '운의 명궁과 사화'), flowTable); wrap.append(flow); }
  content.append(wrap);
  const resize = new ResizeObserver(redraw); resize.observe(grid);
  const scrollHost = content; scrollHost.addEventListener('scroll', redraw, { passive: true }); window.addEventListener('resize', redraw);
  chartOverlayCleanup = () => { resize.disconnect(); scrollHost.removeEventListener('scroll', redraw); window.removeEventListener('resize', redraw); };
};

const elementClass = (character: string) => {
  if ('甲乙寅卯'.includes(character)) return 'wood';
  if ('丙丁巳午'.includes(character)) return 'fire';
  if ('戊己辰戌丑未'.includes(character)) return 'earth';
  if ('庚辛申酉'.includes(character)) return 'metal';
  if ('壬癸亥子'.includes(character)) return 'water';
  return '';
};

const manseCell = (className: string, value: string, sub?: string) => {
  const cell = el('td', className); cell.append(el('strong', '', value || '-'));
  if (sub) cell.append(el('small', '', sub)); return cell;
};

const renderSaju = (value: Chart) => {
  const wrap = el('div', 'saju-view');
  wrap.append(el('p', 'section-kicker', '사주 원국 · 시일월년'));
  const pillars: Array<[string, SajuPillar]> = [['시주', value.saju.hour], ['일주', value.saju.day], ['월주', value.saju.month], ['년주', value.saju.year]];
  const table = el('table', 'manse-table');
  const headerRow = el('tr'); headerRow.append(el('th', 'row-label', '구분'));
  pillars.forEach(([label]) => headerRow.append(el('th', '', label))); table.append(headerRow);
  const appendRow = (label: string, cells: HTMLTableCellElement[]) => { const row = el('tr'); row.append(el('th', 'row-label', label), ...cells); table.append(row); };
  appendRow('천간 십성', pillars.map(([, pillar]) => manseCell('ten-god', pillar.shiShenGan)));
  appendRow('천간', pillars.map(([, pillar]) => manseCell(`ganji-large ${elementClass(pillar.stem)}`, pillar.stem, pillar.stemKo)));
  appendRow('지지', pillars.map(([, pillar]) => manseCell(`ganji-large ${elementClass(pillar.branch)}`, pillar.branch, pillar.branchKo)));
  appendRow('지지 십성', pillars.map(([, pillar]) => manseCell('ten-god', pillar.shiShenBranch)));
  appendRow('지장간', pillars.map(([, pillar]) => manseCell('hidden-stems', pillar.hideGanKo || pillar.hideGan, pillar.shiShenZhi.join(' · '))));
  appendRow('12운성', pillars.map(([, pillar]) => manseCell('', pillar.diShi)));
  appendRow('공망', pillars.map(([, pillar]) => manseCell('', pillar.xunKong)));
  appendRow('납음', pillars.map(([, pillar]) => manseCell('', pillar.nayin)));
  wrap.append(table, el('h3', '', '원국 보조 정보'));
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
  wrap.append(extras, el('h3', '', '대운 흐름'), yunMeta, daYun, el('p', 'interpretation-note', '위 표는 계산된 원국과 운의 자료입니다. 길흉이나 사건을 임의로 덧붙이지 않습니다.'));
  content.append(wrap);
};

const renderResult = () => {
  chartOverlayCleanup(); chartOverlayCleanup = () => {};
  content.replaceChildren();
  if (!chart) { content.append(el('div', 'empty-state', '출생 정보를 계산하면 이곳에 결과가 나타납니다.')); return; }
  if (activeTab === 'ziwei') renderZiwei(chart);
  else renderSaju(chart);
};

const hasCompleteValidInput = () => {
  if (!/^\d{4}$/.test(year.value) || !month.value || !day.value || !time.value || !flowDate.value || !flowTime.value) return false;
  const y = Number(year.value); const m = Number(month.value); const d = Number(day.value);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (!form.checkValidity()) return false;
  if (calendar.value === 'lunar') return m >= 1 && m <= 12 && d >= 1 && d <= 30;
  const actual = new Date(y, m - 1, d);
  return actual.getFullYear() === y && actual.getMonth() === m - 1 && actual.getDate() === d;
};

const calculate = () => {
renderStatus('loading', '로컬 엔진을 불러와 명반을 계산하고 있습니다…');
  const request = requestFromForm();
  const submissionKey = requestKey();
  const id = ++requestId;
  worker.postMessage({ id, request });
  const onMessage = (event: MessageEvent<{ id: number; chart?: Chart; error?: string; initializationCount?: number }>) => {
    if (event.data.id !== id) return;
    worker.removeEventListener('message', onMessage);
    if (id !== requestId) return;
    document.body.dataset.engineInitializations = String(event.data.initializationCount ?? 0);
    if (event.data.error || !event.data.chart) {
      chart = null; calculatedKey = '';
      renderStatus('error', `계산할 수 없습니다: ${event.data.error || '알 수 없는 오류'}`); renderResult(); return;
    }
    chart = event.data.chart; calculatedKey = submissionKey;
    if (requestKey() === calculatedKey) {
      renderStatus('ready', `${request.date} ${request.time} · 운 기준 ${request.flowDate} ${request.flowTime}`);
    } else {
      renderStatus('loading', '바뀐 입력으로 다시 계산하고 있습니다…');
    }
    renderResult();
  };
  worker.addEventListener('message', onMessage);
};

form.addEventListener('submit', (event) => { event.preventDefault(); if (hasCompleteValidInput()) calculate(); });
form.addEventListener('input', () => {
  leap.disabled = calendar.value !== 'lunar';
  day.max = calendar.value === 'lunar' ? '30' : '31';
  if (!hasCompleteValidInput()) {
    requestId += 1; chart = null; calculatedKey = '';
    renderStatus('loading', '입력을 마치면 즉시 계산합니다.'); renderResult(); return;
  }
  calculate();
});

renderTabs(); renderResult(); leap.disabled = true; calculate();
