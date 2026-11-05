'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SimInput, SimResult } from '@/lib/calculations/montecarlo';
import type { WorkerOut } from '@/lib/workers/montecarlo.worker';

export type SimStatus = 'idle' | 'running' | 'done' | 'cancelled' | 'error';

export const NO_WORKER_MESSAGE = "This browser can't run the simulator.";

/** Random 32-bit seed (shown to the user so a run can be repeated). */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] as number;
}

export interface UseSimulation {
  run: (input: SimInput) => void;
  cancel: () => void;
  status: SimStatus;
  /** 0..1 */
  progress: number;
  result: SimResult | null;
  /** The input the current/last result was computed from. */
  input: SimInput | null;
  error: string | null;
}

/**
 * Runs the Monte Carlo engine in a Web Worker so 10^7 rounds never block the UI.
 * Cancel = terminate(): the worker is stateless, so killing it is the fastest safe stop.
 */
export function useSimulation(): UseSimulation {
  const workerRef = useRef<Worker | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef(0);
  const [status, setStatus] = useState<SimStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimResult | null>(null);
  const [input, setInput] = useState<SimInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teardown = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Terminate on unmount so a navigation away never leaves a worker burning CPU.
  useEffect(() => teardown, [teardown]);

  const fail = useCallback((message: string) => {
    teardown();
    setError(message);
    setStatus('error');
  }, [teardown]);

  const run = useCallback((next: SimInput) => {
    teardown();
    setResult(null);
    setError(null);
    setProgress(0);
    setInput(next);
    if (typeof Worker === 'undefined') {
      fail(NO_WORKER_MESSAGE);
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL('../lib/workers/montecarlo.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      fail(NO_WORKER_MESSAGE);
      return;
    }
    workerRef.current = worker;
    setStatus('running');
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        // Progress can arrive faster than frames; keep only the latest per animation frame.
        pendingRef.current = msg.total > 0 ? msg.done / msg.total : 0;
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            setProgress(pendingRef.current);
          });
        }
      } else if (msg.type === 'result') {
        teardown();
        setProgress(1);
        setResult(msg.result);
        setStatus('done');
      } else {
        fail(msg.message);
      }
    };
    worker.onerror = () => fail('The simulation stopped unexpectedly. Try again.');
    worker.postMessage({ type: 'run', input: next });
  }, [teardown, fail]);

  const cancel = useCallback(() => {
    teardown();
    setStatus(s => (s === 'running' ? 'cancelled' : s));
  }, [teardown]);

  return { run, cancel, status, progress, result, input, error };
}
