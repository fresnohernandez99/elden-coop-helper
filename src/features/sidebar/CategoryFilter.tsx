import { useMemo } from 'react';
import { useCoopStore } from '@/features/coop/coopStore';
import { isFoundBy, useVisiblePlayers } from '@/features/coop/selectors';
import { usePins } from '@/features/pins/PinsContext';
import { useEnabledCategories } from '@/features/pins/useEnabledCategories';
import { useUiStore } from '@/features/ui/uiStore';
import { Section } from '@/shared/ui/Section';
import { assetUrl } from '@/shared/utils/assetUrl';
import type { PlayerId } from '@/types/domain';
import styles from './CategoryFilter.module.css';

interface CategoryStats {
  name: string;
  icon: string;
  total: number;
  found: Partial<Record<PlayerId, number>>;
}

/** Categories of the current map with how many pins each visible player found. */
function useCategoryStats(visiblePlayers: PlayerId[]): CategoryStats[] {
  const { pins } = usePins();
  const currentMap = useUiStore((s) => s.currentMap);
  const players = useCoopStore((s) => s.players);

  return useMemo(() => {
    const stats = new Map<string, CategoryStats>();
    for (const pin of pins) {
      if (pin.area !== currentMap || !pin.latlng) continue;
      let entry = stats.get(pin.category);
      if (!entry) {
        entry = { name: pin.category, icon: pin.icon, total: 0, found: {} };
        stats.set(pin.category, entry);
      }
      entry.total++;
      for (const p of visiblePlayers) if (isFoundBy(players, p, pin.id)) entry.found[p] = (entry.found[p] ?? 0) + 1;
    }
    return [...stats.values()].sort((a, b) => b.total - a.total);
  }, [pins, currentMap, players, visiblePlayers]);
}

export function CategoryFilter() {
  const { allCategories } = usePins();
  const visiblePlayers = useVisiblePlayers();
  const stats = useCategoryStats(visiblePlayers);
  const enabled = useEnabledCategories();
  const setCategoryEnabled = useUiStore((s) => s.setCategoryEnabled);
  const setEnabledCategories = useUiStore((s) => s.setEnabledCategories);

  const actions = (
    <span className={styles.links}>
      <button type="button" onClick={() => setEnabledCategories(null)}>
        all
      </button>
      {' · '}
      <button type="button" onClick={() => setEnabledCategories([])}>
        none
      </button>
    </span>
  );

  return (
    <Section title="Categories" actions={actions}>
      <ul className={styles.list}>
        {stats.map((c) => (
          <li key={c.name}>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={enabled.has(c.name)}
                onChange={(e) => setCategoryEnabled(c.name, e.target.checked, allCategories)}
              />
              <img src={assetUrl(c.icon)} alt="" />
              <span className={styles.name}>{c.name}</span>
              <span className={styles.counts}>
                {visiblePlayers.map((p) => (
                  <span key={p} style={{ color: `var(--${p})` }}>
                    {c.found[p] ?? 0}
                  </span>
                ))}
                <span className={styles.muted}>/ {c.total}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Section>
  );
}
