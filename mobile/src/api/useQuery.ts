// Minimal data-loading hook so screens can call the DataSource without a
// query library.
//
//   const { data, loading, error, refetch } = useQuery(() => api.getToday(), []);
//
// `deps` works like useEffect deps: when they change, the query runs again.
// Results from an older run are ignored if a newer one has started.
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  /** Runs the query again. Keeps the current data visible while loading. */
  refetch: () => Promise<void>;
}

export function useQuery<T>(fn: () => Promise<T>, deps: DependencyList = []): QueryState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const runId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    const id = ++runId.current;
    setLoading(true);
    setError(undefined);
    try {
      const result = await fnRef.current();
      if (id === runId.current) setData(result);
    } catch (err) {
      if (id === runId.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    return () => {
      // Invalidate in-flight results on unmount or deps change.
      runId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch: run };
}
