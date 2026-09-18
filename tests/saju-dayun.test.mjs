import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateZiweiChart } from '../dist/calculate.js';

const birth = { calendar: 'solar', date: '1990-01-15', gender: 'male', timeIndex: 6 };

test('DaYun selection uses inclusive exact start and exclusive next boundary', () => {
  const seed = calculateZiweiChart({ ...birth, flowDate: '2026-09-12', flowTime: '12:00' });
  assert.equal(seed.saju.daYunStartSolarDateTime, '1993-03-25T11:00:00');
  assert.equal(seed.saju.daYun[0].startSolarDateTime, null);
  const before = calculateZiweiChart({ ...birth, flowDate: '1993-03-25', flowTime: '11:29' });
  const at = calculateZiweiChart({ ...birth, flowDate: '1993-03-25', flowTime: '11:30' });
  assert.equal(before.saju.currentDaYunIndex, null);
  assert.equal(at.saju.currentDaYunIndex, 1);
  assert.equal(seed.saju.daYun[1].endSolarDateTimeExclusive, seed.saju.daYun[2].startSolarDateTime);
});

test('same stem outside day pillar is 비견 rather than 일원', () => {
  let found;
  for (let year = 1980; year <= 2000 && !found; year++) {
    const chart = calculateZiweiChart({ calendar: 'solar', date: `${year}-1-1`, gender: 'male', timeIndex: 6, flowDate: '2026-09-19' });
    const dayStem = chart.saju.day.stem;
    const peers = [chart.saju.year, chart.saju.month, chart.saju.hour].filter((pillar) => pillar.stem === dayStem);
    if (peers.length) found = peers;
  }
  assert.ok(found?.length, 'fixture search should find a repeated day stem');
  found.forEach((pillar) => assert.equal(pillar.shiShenGan, '비견'));
});
