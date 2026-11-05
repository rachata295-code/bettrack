/// <reference lib="webworker" />
// Thin wrapper: all logic lives in lib/calculations/montecarlo.ts.
// UI cancels by calling worker.terminate(), so no stop message is needed.
import { simulate, type SimInput, type SimResult } from '@/lib/calculations/montecarlo';

/** Messages posted back to the UI. */
export type WorkerOut =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; result: SimResult }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<{ type: 'run'; input: SimInput }>) => {
  if (e.data?.type !== 'run') return;
  try {
    const total = e.data.input.runs;
    const result = simulate(e.data.input, {
      onProgress: (done) => ctx.postMessage({ type: 'progress', done, total } satisfies WorkerOut),
    });
    if (result) ctx.postMessage({ type: 'result', result });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
