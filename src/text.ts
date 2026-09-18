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
  const moving = data.stars?.map((stars, index) => {
    const palace = palaces?.[index];
    return `${palace ? `${palace.name}(${palace.earthlyBranch})` : `${index + 1}궁`}: ${stars.length ? stars.map((star) => star.name).join(', ') : '-'}`;
  }).join(' / ') || '-';
  return `${label}: ${data.heavenlyStem}${data.earthlyBranch} ${data.name} / 운한 명궁의 본명 궁: ${scopeCurrentPalace(data, palaces)} / 궁 배치(인궁부터): ${palaceNames} / 사화(록·권·과·기 순): ${mutagen} / 궁별 이동성: ${moving}`;
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
    lines.push(scopeText('나이', chart.horoscope.age, chart.palaces));
    if (chart.horoscope.childhood) lines.push(scopeText('동한', chart.horoscope.childhood, chart.palaces));
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

export function buildSajuFullText(chart: Chart): string {
  const s = chart.saju;
  const pillars = [['시주', s.hour], ['일주', s.day], ['월주', s.month], ['년주', s.year]] as const;
  const lines = [
    '=== 만세력 사주 상세 ===',
    `양력: ${chart.solarDate} / 음력: ${chart.lunarDate} / 간지일: ${chart.chineseDate}`,
    `시각: ${chart.time} (${chart.timeRange})`,
  ];
  for (const [label, p] of pillars) {
    lines.push(
      `[${label}] ${p.cn}(${p.ko})`,
      `천간십성: ${p.shiShenGan} / 지지십성: ${p.shiShenBranch}`,
      `지장간: ${p.hideGan}(${p.hideGanKo}) / 지장간십성: ${p.shiShenZhi.join(', ') || '-'}`,
      `12운성: ${p.diShi} / 납음: ${p.nayin} / 공망: ${p.xunKong || '-'}`,
    );
  }
  lines.push(
    '',
    `태원: ${s.taiYuan} / 납음: ${s.taiYuanNaYin}`,
    `태식: ${s.taiXi} / 납음: ${s.taiXiNaYin}`,
    `명궁: ${s.mingGong} / 납음: ${s.mingGongNaYin}`,
    `신궁: ${s.shenGong} / 납음: ${s.shenGongNaYin}`,
    `일주 공망: ${s.dayXunKong}`,
    `대운 진입: ${s.daYunStartSolarDateTime.replace('T', ' ')}`,
    `현재 기준: ${s.daYunReferenceDateTime.replace('T', ' ')}`,
    '',
    '=== 대운 ===',
  );
  s.daYun.forEach((item, index) => lines.push(
    `${index === s.currentDaYunIndex ? '[현재] ' : ''}${item.ganZhiKo || item.ganZhi} / ${item.startAge}~${item.endAge}세 / ${item.startSolarDateTime?.replace('T', ' ') || item.startYear}부터 ${item.endSolarDateTimeExclusive?.replace('T', ' ') || item.endYear} 전까지`,
  ));
  return lines.join('\n');
}

export function buildInterpretationPrompt(kind: 'saju' | 'ziwei', fullExport: string, question = '', duan = false): string {
  const method = kind === 'saju' && duan
    ? '단건업 계열 맹파의 체용·빈주·주공(做功) 관점을 검토하되, 공망(空亡)과 주공을 혼동하지 말고 검증된 규칙 근거가 없으면 가설 또는 보류로 표시하세요. 허가된 원문을 조회했다고 주장하지 마세요.'
    : kind === 'saju'
      ? '격국·용신을 단정하거나 점수화하지 말고 원국의 실제 십성, 지장간, 합충형파해와 대운 경계를 근거로 해석하세요.'
      : '각 궁을 본궁·두 삼합궁·대궁·협궁·짝성·차성안궁과 함께 읽고, 비성사화와 현재 운한의 층위를 원국과 구분하세요.';
  return [
    '아래 계산 데이터를 빠뜨리거나 새로 만들어내지 말고 상세하게 풀이하세요.',
    method,
    '관찰된 데이터 → 해석 규칙 → 추론 순서로 쓰고, 서로 충돌하는 신호와 반례도 함께 제시하세요.',
    '출생 정보가 불완전하거나 규칙의 학파 차이가 있으면 단정하지 말고 불확실성과 추가 확인 질문을 밝히세요.',
    kind === 'ziwei' ? '12궁을 각각 독립된 소제목으로 모두 다룬 뒤 삼방사정, 사화, 대한·세운·월운·일운·시운을 종합하세요.' : '네 기둥, 월령, 일간, 십성, 지장간, 12운성, 납음·공망, 현재 대운을 차례로 다루고 근거 없는 연운은 만들지 마세요.',
    question.trim() ? `\n사용자 질문:\n${question.trim()}` : '',
    `\n계산 데이터:\n${fullExport}`,
  ].filter(Boolean).join('\n');
}
