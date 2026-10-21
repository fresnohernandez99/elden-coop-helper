import { useEffect, useState } from 'react';
import { loadPins } from '@/features/pins/loadPins';
import type { PinsData } from '@/types/domain';

type PinsResult =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: PinsData };

/** Downloads the pin catalog; `onLoad` runs before it is shown. */
export function usePinsData(onLoad?: (data: PinsData) => void): PinsResult {
  const [result, setResult] = useState<PinsResult>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadPins()
      .then((data) => {
        if (cancelled) return;
        onLoad?.(data);
        setResult({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
    // Downloaded only once: a new onLoad must not trigger another download.
  }, []);

  return result;
}
