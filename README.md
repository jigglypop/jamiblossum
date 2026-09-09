# jamiblossom

WASM-first Zi Wei Dou Shu and East Asian calendar charting library.

## Install

```bash
pnpm add jamiblossom
```

## Usage

```ts
import { calculateZiweiChart } from 'jamiblossom';

const chart = calculateZiweiChart({
  calendar: 'solar',
  date: '1990-1-1',
  time: '12:00',
  gender: '남',
  language: 'ko-KR',
});
```

For Ziwei decades, use the age and index returned by the horoscope engine:

```ts
const age = chart.horoscope?.age?.nominalAge;
const scope = chart.horoscope?.decadal;
const natalPalace = scope ? chart.palaces[scope.index] : undefined;
```

Before the first decadal range, `chart.horoscope.decadal` is `null` and the
engine-selected childhood scope is available at `chart.horoscope.childhood`.
Each moving scope that has placements exposes `stars`, an array grouped by natal
palace index (including empty arrays). `kind` identifies the scope independently
of its localized display name.

Saju pillar `hideGan` values come directly from lunar-javascript's corresponding
`get*HideGan()` method, preserving that engine's order. Only the day pillar's
`shiShenGan` is `일원`; an identical stem in another pillar is calculated as `비견`.

The default age is **lunar target year − lunar birth year + 1**, increasing at Lunar New Year.
`scope.palaceNames[scope.index]` is the moving chart's life palace, not the natal palace name.
`decadalDateRangeFromSolarDate(stage, chart.solarDate)` returns exact dates for this default convention;
`endExclusive` is the first day of the following decade. The legacy numeric `decadalYearRange`
requires a **lunar birth year** for Ziwei and returns year labels only.

`time` applies a fixed −30 minute correction; `timeIndex` directly selects a branch and does not
apply that correction. City, longitude, and time zone are not request parameters. `timeIndex: 1`
therefore preserves an explicitly supplied 丑 branch; it does not establish an exact birth time.
Saju `daYun.startYear/endYear` are calendar labels from lunar-javascript, not exact transition dates.

Run `pnpm test` for the decade boundaries, text output, time zone, and JS/WASM regression checks.
The [calculation rules](../harness/READING_RULES.md) and [changelog](CHANGELOG.md) document the conventions, fixes, and remaining limitations.
Personal interpretations are organized in the workspace [docs index](../docs/README.md).

## WASM Core

The Rust core lives under `wasm/` and is built with `wasm-pack`.

```bash
pnpm --filter jamiblossom build
```

After building, load the generated WASM module:

```ts
import { loadJamiBlossomWasm } from 'jamiblossom/wasm';

const engine = await loadJamiBlossomWasm();
const normalized = engine.normalizeRequest({
  calendar: 'solar',
  date: '1990-1-1',
  time: '12:00',
  gender: '남',
});
```
