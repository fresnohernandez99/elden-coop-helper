import { useMemo } from 'react';
import { useUiStore } from '@/features/ui/uiStore';
import { usePins } from './PinsContext';

/** Enabled categories as a Set; all of them if the player never chose. */
export function useEnabledCategories(): ReadonlySet<string> {
  const { allCategories } = usePins();
  const enabled = useUiStore((s) => s.enabledCategories);
  return useMemo(() => new Set(enabled ?? allCategories), [enabled, allCategories]);
}
