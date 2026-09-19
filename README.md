# 자미블로썸

![자미블로썸 포스터](public/main.png)

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

The package exposes native ESM entry points and is tested on Node.js 24. Calling
`loadJamiBlossomWasm()` without a module path loads the bundled WASM in both
Node.js and browsers.

Run the complete build and test suite before publishing. `pnpm test` performs a
fresh build first, so the tests never use stale `dist` output:

```bash
pnpm test
pnpm typecheck
```

## 로컬 개발 UI

기본 샘플(`1990-1-1 12:00`, 남성)을 즉시 계산하고, 자미두수 12궁과 사주 원국·대운을 탭으로 확인할 수 있습니다. 음력 날짜는 브라우저의 양력 날짜 입력 제한을 피하기 위해 년·월·일을 따로 입력합니다. `src/wasm-pkg`이 이미 있으면 WASM을 다시 만들 필요가 없습니다.

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://127.0.0.1:5180`을 엽니다. 5180 포트가 사용 중이면 다른 포트로 조용히 바뀌지 않고 오류가 표시됩니다.

웹 UI만 검증하려면 다음을 실행합니다. 웹 빌드는 라이브러리 산출물인 `dist/`를 보존하고 `web-dist/`에 생성됩니다.

```bash
pnpm typecheck:web
pnpm build:web
pnpm preview
```

`src/wasm-pkg`이 없는 체크아웃에서만 먼저 `pnpm build:wasm`을 실행해야 하며, 이 명령에는 `wasm-pack`과 Rust WASM 타깃이 필요합니다.
