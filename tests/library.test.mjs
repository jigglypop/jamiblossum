import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TIME_BRANCH_OPTIONS,
  calculateZiweiChart,
  isValidDate,
  isValidTime,
  loadJamiBlossomWasm,
  PALACE_GRID_AREAS,
  shiftTime,
  timeToIndexFromTime,
} from '../dist/index.js';

test('the public ESM entry point loads its relative modules', () => {
  assert.equal(typeof calculateZiweiChart, 'function');
  assert.equal(typeof isValidDate, 'function');
});

test('all twelve localized earthly branches map to unique physical chart positions', () => {
  const chart = calculateZiweiChart({ calendar: 'solar', date: '1990-1-1', gender: 'male', timeIndex: 6, flowDate: '2026-9-19' });
  const areas = chart.palaces.map((palace) => PALACE_GRID_AREAS[palace.earthlyBranch]);
  assert.equal(areas.every(Boolean), true);
  assert.equal(new Set(areas).size, 12);
});

test('the bundled WASM engine loads without an explicit URL in Node', async () => {
  const engine = await loadJamiBlossomWasm();
  assert.equal(engine.version(), '0.1.0');

  const cases = [
    {
      request: { calendar: 'lunar', date: '2024-2-30', gender: 'male', time: '12:00' },
      date: '2024-2-30',
      isLeapMonth: false,
    },
    {
      request: { calendar: 'lunar', date: '2024-2-30', gender: 'male', time: '00:00' },
      date: '2024-2-29',
      isLeapMonth: false,
    },
    {
      request: {
        calendar: 'lunar',
        date: '2023-2-1',
        gender: 'male',
        time: '00:00',
        isLeapMonth: true,
      },
      date: '2023-2-30',
      isLeapMonth: false,
    },
    {
      request: { calendar: 'lunar', date: '2023-3-1', gender: 'male', time: '00:00' },
      date: '2023-2-29',
      isLeapMonth: true,
    },
  ];

  for (const item of cases) {
    const request = { flowDate: '2026-09-19', flowTime: '12:00', ...item.request };
    const normalized = engine.normalizeRequest(request);
    assert.equal(normalized.date, item.date);
    assert.equal(normalized.isLeapMonth, item.isLeapMonth);

    const jsChart = calculateZiweiChart(request);
    const wasmChart = engine.calculate(request);
    assert.deepEqual(wasmChart.saju, jsChart.saju);
    assert.equal(wasmChart.solarDate, jsChart.solarDate);
    assert.equal(wasmChart.lunarDate, jsChart.lunarDate);
  }

  const defaultReference = calculateZiweiChart({ calendar: 'solar', date: '1990-1-1', gender: 'male', timeIndex: 6 });
  assert.match(defaultReference.saju.daYunReferenceDateTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/);

  const flowRequest = {
    calendar: 'lunar',
    date: '2024-1-1',
    gender: 'male',
    timeIndex: 6,
    flowTime: '00:00',
  };
  assert.equal(engine.normalizeRequest(flowRequest).flowDate, '2024-2-9');
  assert.deepEqual(engine.calculate(flowRequest), calculateZiweiChart(flowRequest));

  const indexedFlowRequest = { ...flowRequest, flowTimeIndex: 6 };
  assert.equal(engine.normalizeRequest(indexedFlowRequest).flowDate, '');
  assert.deepEqual(engine.calculate(indexedFlowRequest), calculateZiweiChart(indexedFlowRequest));

  const blankFlowDateRequest = { ...flowRequest, flowDate: '   ' };
  assert.equal(engine.normalizeRequest(blankFlowDateRequest).flowDate, '2024-2-9');
  assert.deepEqual(engine.calculate(blankFlowDateRequest), calculateZiweiChart(blankFlowDateRequest));
});

test('each branch option representative time maps back to its own index', () => {
  for (const option of TIME_BRANCH_OPTIONS) {
    assert.equal(timeToIndexFromTime(option.time), option.index, option.label);
  }
});

test('date validation rejects impossible calendar dates', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('2023-02-29'), false);
  assert.equal(isValidDate('2024-02-30'), false);
  assert.equal(isValidDate('2024-04-31'), false);
});

test('time validation checks clock ranges and shifting wraps for any delta', () => {
  assert.equal(isValidTime('23:59'), true);
  assert.equal(isValidTime('24:00'), false);
  assert.equal(isValidTime('12:60'), false);
  assert.deepEqual(shiftTime('00:00', -1500), { hour: 23, minute: 0 });
});

test('chart normalization rejects impossible birth dates before calculation', () => {
  assert.throws(
    () => calculateZiweiChart({ calendar: 'solar', date: '2024-02-30', gender: 'male' }),
    /valid YYYY-M-D date/,
  );
  assert.doesNotThrow(() =>
    calculateZiweiChart({ calendar: 'lunar', date: '2024-2-30', gender: 'male' }),
  );
  assert.throws(
    () => calculateZiweiChart({ calendar: 'lunar', date: '2024-4-30', gender: 'male' }),
    /valid lunar YYYY-M-D date/,
  );
  assert.throws(
    () =>
      calculateZiweiChart({
        calendar: 'solar',
        date: '2024-01-01',
        gender: 'male',
        timeIndex: Number.NaN,
      }),
    /integer from 0\.\.12/,
  );
});
