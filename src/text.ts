import { lunarNominalAgeFromSolarDate, palaceForAge } from './time.js';
import type { AdjectiveStar, Chart, HoroscopeScope, Palace, Star } from './types.js';

const BRIGHTNESS_MAP: Record<string, string> = {
  '[+3]': '묘',
  '[+2]': '왕',
  '[+1]': '득',
  '[0]': '리',
  '[-1]': '평',
  '[-2]': '불',
  '[-3]': '함',
};

export function fmtBright(b: string): string {
  if (!b) return '';
  return BRIGHTNESS_MAP[b] ?? b;
}

export function starStr(s: Star): string {
  const bright = fmtBright(s.brightness);
  const parts = [s.name];
  if (bright) parts[0] += `(${bright})`;
  if (s.mutagen) parts.push(s.mutagen);
  return parts.join(' ');
}

export function adjectiveStarStr(s: AdjectiveStar): string {
  return s.name;
}

const PAIR_STAR_NAMES = [
  '좌보',
  '우필',
  '문창',
  '문곡',
  '천괴',
  '천월',
  '화성',
  '영성',
  '령성',
  '지공',
  '지겁',
  '천마',
  '록존',
];

function allStarNames(p: Palace): string[] {
  return [
    ...p.majorStars.map((s) => s.name),
    ...p.minorStars.map((s) => s.name),
    // 天月 is also translated as 천월, but is not the paired auspicious star 天鉞.
  ];
}

export function pairStarsText(p: Palace | undefined): string {
  if (!p) return '-';
  const names = allStarNames(p).filter((name) =>
    PAIR_STAR_NAMES.some((pair) => name.includes(pair)),
  );
  return names.length ? names.join(', ') : '-';
}

export function palaceBrief(p: Palace | undefined): string {
  if (!p) return '-';
  const major = p.majorStars.length ? p.majorStars.map(starStr).join(', ') : '주성 없음';
  const minor = p.minorStars.length ? ` / 보성: ${p.minorStars.map(starStr).join(', ')}` : '';
  const misc = p.adjectiveStars.length
    ? ` / 잡성: ${p.adjectiveStars.map(adjectiveStarStr).join(', ')}`
    : '';
  return `${p.name}(${p.heavenlyStem}${p.earthlyBranch}) ${major}${minor}${misc}`;
}

export function borrowedStarsText(palaces: Palace[], idx: number): string {
  const palace = palaces[idx];
  if (!palace) return '-';
  if (palace.majorStars.length) return '해당 없음';
  const opposite = palaces[(idx + 6) % 12];
  if (!opposite?.majorStars.length) return '-';
  return `${opposite.name} 대궁 차성: ${opposite.majorStars.map(starStr).join(', ')}`;
}

export function adjacentPalaceText(palaces: Palace[], idx: number): string {
  const left = palaces[(idx + 11) % 12];
  const right = palaces[(idx + 1) % 12];
  return [
    `협궁 좌: ${palaceBrief(left)} / 짝성: ${pairStarsText(left)}`,
    `협궁 우: ${palaceBrief(right)} / 짝성: ${pairStarsText(right)}`,
  ].join('\n');
}

export function buildPalaceText(
  p: Palace,
  palaces: Palace[],
  surrounded: Chart['surrounded'] | null,
  idx: number,
): string {
  const major = p.majorStars.length ? p.majorStars.map(starStr).join(', ') : '-';
  const minor = p.minorStars.length ? p.minorStars.map(starStr).join(', ') : '-';
  const misc = p.adjectiveStars.length ? p.adjectiveStars.map(adjectiveStarStr).join(', ') : '-';
  const su = surrounded?.[idx];
  const trineA = su ? palaces[su.trine[0]] : undefined;
  const trineB = su ? palaces[su.trine[1]] : undefined;
  const opposite = su ? palaces[su.opposite] : undefined;
  const lines = [
    `[${p.name}] ${p.heavenlyStem}${p.earthlyBranch}${p.isBodyPalace ? ' (신궁)' : ''}${p.isOriginalPalace ? ' (래인궁)' : ''}`,
    `주성: ${major}`,
    `보성: ${minor}`,
    `잡성/기타성: ${misc}`,
    `짝성 체크: ${pairStarsText(p)}`,
    `차성안궁: ${borrowedStarsText(palaces, idx)}`,
    `장생12: ${p.changsheng12 || '-'} / 박사12: ${p.boshi12 || '-'}`,
    `장전12: ${p.jiangqian12 || '-'} / 태세12: ${p.suiqian12 || '-'}`,
    p.stage ? `대한: ${p.stage.from}~${p.stage.to}세` : '',
    p.ages?.length ? `소한: ${p.ages.join(', ')}세` : '',
    su ? `삼방사정 본궁: ${palaceBrief(p)}` : '',
    su ? `삼합1: ${palaceBrief(trineA)}` : '',
    su ? `삼합2: ${palaceBrief(trineB)}` : '',
    su ? `대궁: ${palaceBrief(opposite)}` : '',
    adjacentPalaceText(palaces, idx),
  ];
  return lines.filter(Boolean).join('\n');
}

export function scopeText(label: string, data: HoroscopeScope, palaces?: Palace[]): string {
  if (!data) return `${label}: -`;
  const palaceNames = data.palaceNames.length ? data.palaceNames.map((name, index) =>
    palaces?.[index] ? `${palaces[index].earthlyBranch}(본명 ${palaces[index].name})=${name}` : name,
  ).join(', ') : '-';
  const mutagen = data.mutagen.length ? data.mutagen.join(', ') : '-';
  return `${label}: ${data.heavenlyStem}${data.earthlyBranch} ${data.name} / 운한 명궁의 본명 궁: ${scopeCurrentPalace(data, palaces)} / 궁 배치(인궁부터): ${palaceNames} / 사화(록·권·과·기 순): ${mutagen}`;
}

export function scopeCurrentPalace(data: HoroscopeScope, palaces?: Palace[]): string {
  if (!data) return '-';
  // palaceNames[index] is the moving scope's 命宮, not the natal palace's name.
  return palaces?.[data.index]?.name ?? '-';
}

export function scopeGanZhi(data: HoroscopeScope): string {
  if (!data) return '-';
  return `${data.heavenlyStem}${data.earthlyBranch}`;
}

export function isMingGong(p: Palace): boolean {
  return p.name === '명궁' || p.name === '命宫' || p.name === '命宮';
}

export function buildFullText(chart: Chart, selectedIndex: number, currentAge?: number | null): string {
  const s = chart.saju;
  const mingIndex = chart.palaces.findIndex(isMingGong);
  const palaceOrder = Array.from({ length: chart.palaces.length }, (_, i) =>
    mingIndex >= 0 ? (mingIndex + i) % chart.palaces.length : i,
  );
  const lines = [
    `=== 만세력 사주 (절기 기반) ===`,
    `년주: ${s.year.cn}(${s.year.ko})  월주: ${s.month.cn}(${s.month.ko})  일주: ${s.day.cn}(${s.day.ko})  시주: ${s.hour.cn}(${s.hour.ko})`,
    '',
    `양력: ${chart.solarDate}`,
    `시각: ${chart.time} (${chart.timeRange})`,
    `명주: ${chart.soul} / 신주: ${chart.body}`,
    `오행국: ${chart.fiveElementsClass}`,
  ];
  const engineAge = chart.horoscope?.age?.nominalAge;
  const displayAge = engineAge ?? (chart.horoscope && chart.horoscope.ageDivide !== 'birthday'
    ? lunarNominalAgeFromSolarDate(chart.solarDate, chart.horoscope.solarDate) : null) ?? currentAge ?? null;
  const decadal = chart.horoscope?.decadal;
  const currentDecadalPalace = decadal
    ? chart.palaces[decadal.index]
    : palaceForAge(chart.palaces, displayAge);
  if (chart.horoscope) {
    lines.push(`운한 기준일: ${chart.horoscope.solarDate}`);
    lines.push(`대한 나이 기준: ${chart.horoscope.ageDivide === 'birthday' ? '엔진 음력 생일 분계' : '음력 세수(설에 한 살 증가)'}`);
  }
  if (currentDecadalPalace?.stage && displayAge != null &&
      displayAge >= currentDecadalPalace.stage.from && displayAge <= currentDecadalPalace.stage.to) {
    lines.push(
      `현재 대한: ${displayAge}세 / ${currentDecadalPalace.name} / ${currentDecadalPalace.stage.from}~${currentDecadalPalace.stage.to}세${decadal ? ` / ${scopeGanZhi(decadal)}` : ''}`,
    );
  } else if (chart.horoscope?.decadal) {
    lines.push(
      `현재 대한: ${scopeGanZhi(chart.horoscope.decadal)} / ${scopeCurrentPalace(chart.horoscope.decadal, chart.palaces)} / ${chart.horoscope.decadal.name}`,
    );
  }
  const originalPalace = chart.palaces.find((palace) => palace.isOriginalPalace);
  if (originalPalace) {
    lines.push(
      `래인궁: ${originalPalace.name}(${originalPalace.heavenlyStem}${originalPalace.earthlyBranch})`,
    );
  }
  lines.push('', `=== 12궁 ===`);
  for (const i of palaceOrder) {
    lines.push(buildPalaceText(chart.palaces[i], chart.palaces, chart.surrounded, i), '');
  }
  if (chart.flies?.length) {
    lines.push(`=== 비성사화 ===`);
    for (const f of chart.flies) {
      lines.push(
        `${f.fromPalace} -> ${f.routes.map((r) => `${r.mutagenKo}:${r.toPalace || '-'}`).join(' ')}`,
      );
    }
    lines.push('');
  }
  if (chart.horoscope) {
    lines.push(`=== 운한 ===`);
    lines.push(scopeText('대한', chart.horoscope.decadal, chart.palaces));
    lines.push(scopeText('세운/유년', chart.horoscope.yearly, chart.palaces));
    lines.push(scopeText('유월', chart.horoscope.monthly, chart.palaces));
    lines.push(scopeText('유일', chart.horoscope.daily, chart.palaces));
    lines.push(scopeText('유시', chart.horoscope.hourly, chart.palaces));
  }
  if (chart.palaces[selectedIndex]) {
    lines.push('', `=== 선택 궁 상세 ===`);
    lines.push(
      buildPalaceText(chart.palaces[selectedIndex], chart.palaces, chart.surrounded, selectedIndex),
    );
  }
  return lines.join('\n');
}
