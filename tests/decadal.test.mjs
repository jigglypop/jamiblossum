import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { astro } from 'iztro';
import { Solar } from 'lunar-javascript';
import {
  calculateZiweiChart, buildFullText, scopeCurrentPalace, scopeText,
  nominalAgeFromSolarDate, lunarNominalAgeFromSolarDate, decadalDateRangeFromSolarDate,
  TIME_BRANCH_OPTIONS, timeToIndexFromTime, pairStarsText,
  createJamiBlossomEngine,
} from '../dist/index.js';
import * as wasm from '../dist/wasm-pkg/jamiblossom_core.js';

const birth = { calendar: 'solar', date: '1991-01-12', gender: 'male', timeIndex: 1 };
const at = flowDate => calculateZiweiChart({ ...birth, flowDate });

test('lunar-year decades switch on Lunar New Year, including both decade boundaries', () => {
  for (const [date, age, palace] of [
    ['2024-02-09', 34, '복덕'], ['2024-02-10', 35, '전택'],
    ['2026-02-16', 36, '전택'], ['2026-02-17', 37, '전택'],
    ['2026-09-05', 37, '전택'], ['2034-02-18', 44, '전택'],
    ['2034-02-19', 45, '관록'],
  ]) {
    const chart = at(date);
    assert.equal(chart.horoscope.age.nominalAge, age, date);
    assert.equal(lunarNominalAgeFromSolarDate(birth.date, date), age, date);
    assert.equal(nominalAgeFromSolarDate(birth.date, date), age, date);
    assert.equal(scopeCurrentPalace(chart.horoscope.decadal, chart.palaces), palace, date);
  }
  assert.deepEqual(decadalDateRangeFromSolarDate({ from: 35, to: 44 }, birth.date), {
    fromYear: 2024, toYear: 2033, startDate: '2024-02-10', endExclusive: '2034-02-19',
  });
  assert.equal(lunarNominalAgeFromSolarDate('1991-02-30', '2026-09-05'), null);
  assert.equal(lunarNominalAgeFromSolarDate(birth.date, '1991-01-11'), null);
});

test('report uses engine age and natal palace even when the caller supplies the old solar age', () => {
  const chart = at('2034-02-19');
  const report = buildFullText(chart, chart.horoscope.decadal.index, 44);
  assert.match(report, /현재 대한: 45세 \/ 관록 \/ 45~54세 \/ 기묘/);
  assert.match(report, /운한 명궁의 본명 궁: 관록/);
  assert.match(report, /묘\(본명 관록\)=명궁/);
  assert.equal(scopeCurrentPalace(chart.horoscope.decadal), '-');
  const savedChart = structuredClone(chart);
  delete savedChart.horoscope.age.nominalAge;
  delete savedChart.horoscope.ageDivide;
  assert.match(buildFullText(savedChart, 1, 44), /현재 대한: 45세 \/ 관록 \/ 45~54세/);
});

test('natal chart and all six auspicious connections reproduce the supplied chart', () => {
  const chart = at('2026-09-05');
  assert.equal(chart.earthlyBranchOfSoulPalace, '해');
  assert.equal(chart.earthlyBranchOfBodyPalace, '축');
  assert.equal(chart.fiveElementsClass, '토오국');
  const palace = name => chart.palaces.find(p => p.name === name);
  assert.deepEqual(palace('복덕').majorStars.map(s => [s.name, s.mutagen]), [['태양', '록'], ['태음', '과']]);
  for (const [name, star] of [['복덕', '천괴'], ['재백', '천월'], ['부처', '문창'], ['천이', '문곡'], ['전택', '좌보'], ['부모', '우필']]) {
    assert.ok(palace(name).minorStars.some(s => s.name === star), `${name}/${star}`);
  }
  assert.ok(palace('형제').adjectiveStars.some(s => s.name === '천월'));
  assert.doesNotMatch(pairStarsText(palace('형제')), /천월/);
  assert.match(pairStarsText(palace('재백')), /천월/);
  assert.match(pairStarsText(palace('노복')), /령성/);
});

test('fixed date does not shift across host time zones', () => {
  const moduleUrl = new URL('../dist/calculate.js', import.meta.url).href;
  const code = `import {calculateZiweiChart} from ${JSON.stringify(moduleUrl)};
    const c=calculateZiweiChart(${JSON.stringify({ ...birth, flowDate: '2034-02-19' })});
    console.log(JSON.stringify([c.horoscope.solarDate,c.horoscope.age.nominalAge,c.horoscope.decadal.index]));`;
  for (const zone of ['Asia/Seoul', 'UTC', 'America/Los_Angeles']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ['2034-2-19', 45, 1], zone);
  }
});

test('JS and checked-in WASM agree for solar, lunar and explicit time inputs', () => {
  wasm.initSync({ module: readFileSync(new URL('../dist/wasm-pkg/jamiblossom_core_bg.wasm', import.meta.url)) });
  const engine = createJamiBlossomEngine(wasm);
  for (const request of [
    { ...birth, flowDate: '2026-09-05' },
    { ...birth, timeIndex: undefined, time: '02:00', flowDate: '2026-09-05' },
    { ...birth, calendar: 'lunar', date: '1990-11-27', flowDate: '2026-09-05' },
  ]) assert.deepEqual(engine.calculate(request), calculateZiweiChart(request));
});

test('all branch option values map back to their displayed branch', () => {
  for (const option of TIME_BRANCH_OPTIONS) {
    assert.equal(timeToIndexFromTime(option.time), option.index, option.label);
  }
});

test('report retains an explicitly configured engine age basis', () => {
  try {
    astro.config({ ageDivide: 'birthday' });
    const chart = at('2026-09-05');
    assert.equal(chart.horoscope.ageDivide, 'birthday');
    assert.match(buildFullText(chart, 0), /엔진 음력 생일 분계/);
    assert.match(buildFullText(chart, 0), new RegExp(`현재 대한: ${chart.horoscope.age.nominalAge}세`));
  } finally { astro.config({ ageDivide: 'normal' }); }
});

test('childhood is separate from decadal and preserves engine moving stars', () => {
  const chart = at('1991-01-12');
  const raw = astro.astrolabeBySolarDate(birth.date, 1, 'male', true, 'ko-KR').horoscope('1991-01-12');
  const rawStars = raw.decadal.stars.map(palaceStars => palaceStars.map(({ name, type, scope }) => ({ name, type, scope })));

  assert.equal(chart.horoscope.decadal, null);
  assert.equal(chart.horoscope.childhood.kind, 'childhood');
  assert.deepEqual(chart.horoscope.childhood.stars, rawStars);
  assert.equal(chart.horoscope.yearly.kind, 'yearly');
  assert.equal(chart.horoscope.yearly.stars.length, chart.palaces.length);
  assert.equal(scopeText('대한', chart.horoscope.decadal), '대한: -');
  assert.doesNotThrow(() => buildFullText(chart, 0));

  const decadalChart = at('2000-01-01');
  assert.equal(decadalChart.horoscope.childhood, null);
  assert.equal(decadalChart.horoscope.decadal.kind, 'decadal');
  assert.equal(decadalChart.horoscope.decadal.stars.length, decadalChart.palaces.length);
});

test('saju uses lunar-javascript hidden stems and reserves 일원 for the day pillar', () => {
  const request = { calendar: 'solar', date: '1991-01-12', gender: 'male', timeIndex: 8, flowDate: '2026-09-05' };
  const chart = calculateZiweiChart(request);
  const ec = Solar.fromYmdHms(1991, 1, 12, 15, 0, 0).getLunar().getEightChar();
  ec.setSect(1);
  assert.deepEqual(
    [chart.saju.year.hideGan, chart.saju.month.hideGan, chart.saju.day.hideGan, chart.saju.hour.hideGan],
    [ec.getYearHideGan(), ec.getMonthHideGan(), ec.getDayHideGan(), ec.getTimeHideGan()].map(stems => stems.join('')),
  );
  assert.equal(chart.saju.day.hideGan, '丁己');
  assert.equal(chart.saju.hour.hideGan, '庚壬戊');

  const sameStem = calculateZiweiChart({ calendar: 'solar', date: '1991-01-10', gender: 'male', timeIndex: 1, flowDate: '2026-09-05' });
  assert.equal(sameStem.saju.day.stem, sameStem.saju.year.stem);
  assert.equal(sameStem.saju.day.shiShenGan, '일원');
  assert.equal(sameStem.saju.year.shiShenGan, '비견');
});
