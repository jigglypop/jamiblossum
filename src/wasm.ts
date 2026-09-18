import type { ChartRequest, Chart } from './types.js';
import { calculateZiweiChartWithCore, type NormalizedPayload } from './calculate.js';
import { Lunar } from 'lunar-javascript';
import initBundledWasm, * as bundledWasm from './wasm-pkg/jamiblossom_core.js';

export type NormalizedWasmRequest = {
  calendar: 'solar' | 'lunar';
  date: string;
  gender: 'male' | 'female';
  timeIndex: number;
  hour: number;
  minute: number;
  language: string;
  isLeapMonth: boolean;
  fixLeap: boolean;
  flowDate: string;
  flowTimeIndex: number;
  flowHour: number;
  flowMinute: number;
  ziTimeMode: 'split' | 'fixed';
};

export type WasmSurrounded = {
  selfIndex: number;
  trine: [number, number];
  opposite: number;
};

export type JamiBlossomWasmModule = {
  default?: (input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module) => Promise<unknown>;
  initSync?: (module: BufferSource | WebAssembly.Module) => unknown;
  version(): string;
  normalizeRequestJson(payload: string): string;
  surroundedJson(palaceCount: number): string;
};

export type JamiBlossomEngine = {
  version(): string;
  normalizeRequest(request: ChartRequest): NormalizedWasmRequest;
  surrounded(palaceCount: number): WasmSurrounded[];
  calculate(request: ChartRequest): Chart;
};

function isNodeRuntime(): boolean {
  const processValue = (globalThis as { process?: { versions?: { node?: string } } }).process;
  return typeof processValue?.versions?.node === 'string';
}

async function readBundledWasmForNode(): Promise<Uint8Array> {
  // Keep the Node built-in invisible to browser bundlers while still supporting
  // the package's no-argument loader in Node, where fetch(file:) is unsupported.
  const nodeFsSpecifier = ['node:fs', 'promises'].join('/');
  const { readFile } = (await import(/* @vite-ignore */ nodeFsSpecifier)) as {
    readFile(path: URL): Promise<Uint8Array>;
  };
  return readFile(new URL('./wasm-pkg/jamiblossom_core_bg.wasm', import.meta.url));
}

function normalizedInputDate(value: string): string {
  const trimmed = value.trim();
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (mdy) return `${Number(mdy[3])}-${Number(mdy[1])}-${Number(mdy[2])}`;
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  return ymd ? `${Number(ymd[1])}-${Number(ymd[2])}-${Number(ymd[3])}` : trimmed;
}

function reconcileLunarDate(
  request: ChartRequest,
  normalized: NormalizedWasmRequest,
): NormalizedWasmRequest {
  if (normalized.calendar !== 'lunar') return normalized;

  const inputDate = normalizedInputDate(request.date);
  const [year, month, day] = inputDate.split('-').map(Number);
  if (
    !/^\d{4}-\d{1,2}-\d{1,2}$/.test(inputDate) ||
    year < 100 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 30
  ) {
    throw new Error('date must be a valid lunar YYYY-M-D date');
  }
  let lunar;
  try {
    lunar = Lunar.fromYmd(year, request.isLeapMonth ? -month : month, day);
  } catch {
    throw new Error('date must be a valid lunar YYYY-M-D date');
  }
  const inputLunar = lunar;

  // The Rust core performs the 30-minute correction with Gregorian month
  // lengths. If it crossed midnight, move one solar day and convert back to
  // lunar so lunar month boundaries (including leap months) remain correct.
  if (
    request.timeIndex == null &&
    request.time &&
    normalized.hour === 23 &&
    normalized.minute >= 30
  ) {
    lunar = lunar.getSolar().next(-1).getLunar();
  }
  const lunarMonth = lunar.getMonth();
  let flowDate = normalized.flowDate;
  if (request.flowTimeIndex == null && !request.flowDate?.trim() && request.flowTime) {
    let flowSolar = inputLunar.getSolar();
    if (normalized.flowHour === 23 && normalized.flowMinute >= 30) {
      flowSolar = flowSolar.next(-1);
    }
    flowDate = `${flowSolar.getYear()}-${flowSolar.getMonth()}-${flowSolar.getDay()}`;
  }
  return {
    ...normalized,
    date: `${lunar.getYear()}-${Math.abs(lunarMonth)}-${lunar.getDay()}`,
    isLeapMonth: lunarMonth < 0,
    flowDate,
  };
}

function normalizeWithWasm(
  wasm: JamiBlossomWasmModule,
  request: ChartRequest,
): NormalizedWasmRequest {
  if (request.timeIndex != null && !Number.isInteger(request.timeIndex)) {
    throw new Error('timeIndex must be an integer from 0..12');
  }
  if (request.flowTimeIndex != null && !Number.isInteger(request.flowTimeIndex)) {
    throw new Error('flowTimeIndex must be an integer from 0..12');
  }
  const normalized = JSON.parse(
    wasm.normalizeRequestJson(JSON.stringify(request)),
  ) as NormalizedWasmRequest;
  return reconcileLunarDate(request, normalized);
}

export async function loadJamiBlossomWasm(
  modulePath?: string,
): Promise<JamiBlossomEngine> {
  let module: JamiBlossomWasmModule;
  if (modulePath) {
    module = (await import(/* @vite-ignore */ modulePath)) as JamiBlossomWasmModule;
    if (module.default) await module.default();
  } else {
    module = { ...bundledWasm, default: initBundledWasm } as JamiBlossomWasmModule;
    if (isNodeRuntime()) {
      await initBundledWasm({ module_or_path: await readBundledWasmForNode() });
    } else {
      await initBundledWasm();
    }
  }
  return createJamiBlossomEngine(module);
}

export function createJamiBlossomEngine(wasm: JamiBlossomWasmModule): JamiBlossomEngine {
  return {
    version: () => wasm.version(),
    normalizeRequest: (request) => normalizeWithWasm(wasm, request),
    surrounded: (palaceCount) => JSON.parse(wasm.surroundedJson(palaceCount)),
    calculate: (request) =>
      calculateZiweiChartWithCore(request, {
        normalize: (payload) => normalizeWithWasm(wasm, payload) as NormalizedPayload,
        surrounded: (palaceCount) => JSON.parse(wasm.surroundedJson(palaceCount)),
      }),
  };
}
