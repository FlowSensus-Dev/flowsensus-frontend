import { useCallback, useEffect, useRef, useState } from 'react';
import { DelayReason, DelayStage, delayReasonError, loadDelayReasons, loadDelayStages } from '../../../lib/forecastPenalties';

export default function useDelayReasons() {
  const [reasons, setReasons] = useState<DelayReason[]>([]);
  const [stages, setStages] = useState<DelayStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    const [categories, activeStages] = await Promise.allSettled([loadDelayReasons(), loadDelayStages()]);
    if (id !== request.current) return false;
    // Do not leave old options available after a failed permission or network check.
    setReasons(categories.status === 'fulfilled' ? categories.value : []);
    setStages(activeStages.status === 'fulfilled' ? activeStages.value : []);
    const errors = [categories, activeStages].flatMap((result) => result.status === 'rejected' ? [delayReasonError(result.reason)] : []);
    setError([...new Set(errors)].join(' ') || null);
    setLoading(false);
    return errors.length === 0;
  }, []);
  useEffect(() => {
    void refresh();
    return () => { ++request.current; };
  }, [refresh]);
  return { reasons, stages, loading, error, refresh };
}
