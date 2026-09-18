import { loadJamiBlossomWasm } from 'jamiblossom';
import type { ChartRequest } from 'jamiblossom';

type RequestMessage = { id: number; request: ChartRequest };
let enginePromise: ReturnType<typeof loadJamiBlossomWasm> | null = null;
let initializationCount = 0;

self.addEventListener('message', async (event: MessageEvent<RequestMessage>) => {
  const { id, request } = event.data;
  try {
    if (!enginePromise) { initializationCount += 1; enginePromise = loadJamiBlossomWasm(); }
    const engine = await enginePromise;
    self.postMessage({ id, chart: engine.calculate(request), initializationCount });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
