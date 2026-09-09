import type { ChartRequest, Chart } from './types';
import { calculateZiweiChartWithCore, type NormalizedPayload } from './calculate.js';
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

export async function loadJamiBlossomWasm(
  modulePath?: string,
): Promise<JamiBlossomEngine> {
  const module = modulePath
    ? ((await import(/* @vite-ignore */ modulePath)) as JamiBlossomWasmModule)
    : ({ ...bundledWasm, default: initBundledWasm } as JamiBlossomWasmModule);
  if (module.default) {
    await module.default();
  }
  return createJamiBlossomEngine(module);
}

export function createJamiBlossomEngine(wasm: JamiBlossomWasmModule): JamiBlossomEngine {
  return {
    version: () => wasm.version(),
    normalizeRequest: (request) => JSON.parse(wasm.normalizeRequestJson(JSON.stringify(request))),
    surrounded: (palaceCount) => JSON.parse(wasm.surroundedJson(palaceCount)),
    calculate: (request) =>
      calculateZiweiChartWithCore(request, {
        normalize: (payload) =>
          JSON.parse(wasm.normalizeRequestJson(JSON.stringify(payload))) as NormalizedPayload,
        surrounded: (palaceCount) => JSON.parse(wasm.surroundedJson(palaceCount)),
      }),
  };
}
