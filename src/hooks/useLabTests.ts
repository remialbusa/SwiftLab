'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface LabTest {
  id: string;
  name: string;
  code: string;
  cash_price: number;
  duration_minutes: number;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; tests: LabTest[] };

/** Loads active lab tests from the public endpoint. */
export function useLabTests(): FetchState & { reload: () => void } {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch('/api/v1/lab-tests');
        if (!res.ok) throw new Error('Failed to load tests');
        const json = (await res.json()) as { tests: LabTest[] };
        if (!cancelled) setState({ status: 'ready', tests: json.tests });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { ...state, reload };
}