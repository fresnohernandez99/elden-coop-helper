import { useMemo } from 'react';
import { SEARCH_MAX_RESULTS } from '@/config/constants';
import { useCoopStore } from '@/features/coop/coopStore';
import { parseFoundByKey, useFoundByKey, useMe } from '@/features/coop/selectors';
import { showToast } from '@/features/notifications/toastStore';
import { isSearchActive, matchesSearch } from '@/features/pins/filters';
import { usePins } from '@/features/pins/PinsContext';
import { useUiStore } from '@/features/ui/uiStore';
import { PlayerDot } from '@/shared/ui/PlayerDot';
import { Section } from '@/shared/ui/Section';
import type { Pin } from '@/types/domain';
import styles from './SearchPanel.module.css';

export function SearchPanel() {
  const search = useUiStore((s) => s.search);
  const setSearch = useUiStore((s) => s.setSearch);
  const hideFound = useUiStore((s) => s.hideFound);
  const setHideFound = useUiStore((s) => s.setHideFound);
  const spectating = useMe() === null;

  return (
    <Section>
      <input
        type="search"
        value={search}
        placeholder="Search (name, region, category)…"
        onChange={(e) => setSearch(e.target.value)}
      />
      {!spectating && (
        <label className={styles.check}>
          <input type="checkbox" checked={hideFound} onChange={(e) => setHideFound(e.target.checked)} />
          Hide what I already found
        </label>
      )}
      {isSearchActive(search) && <SearchResults query={search} />}
    </Section>
  );
}

function SearchResults({ query }: { query: string }) {
  const { pins } = usePins();
  const results = useMemo(() => pins.filter((pin) => matchesSearch(pin, query)), [pins, query]);
  const hidden = results.length - SEARCH_MAX_RESULTS;

  return (
    <ul className={styles.results}>
      {results.slice(0, SEARCH_MAX_RESULTS).map((pin) => (
        <SearchResult key={pin.id} pin={pin} />
      ))}
      {hidden > 0 && <li className={styles.muted}>…and {hidden} more</li>}
      {results.length === 0 && <li className={styles.muted}>No results</li>}
    </ul>
  );
}

function SearchResult({ pin }: { pin: Pin }) {
  const me = useMe();
  const foundBy = parseFoundByKey(useFoundByKey(pin.id));
  const toggleFound = useCoopStore((s) => s.toggleFound);
  const focusPin = useUiStore((s) => s.focusPin);
  const foundByMe = me !== null && foundBy.includes(me);

  const goToPin = () => {
    if (pin.latlng) focusPin(pin);
    else showToast('This item has no location on the map');
  };

  return (
    <li className={styles.item}>
      {me && (
        <button
          type="button"
          className={`${styles.checkButton} ${foundByMe ? styles.checked : ''}`}
          title={foundByMe ? 'Unmark' : 'Mark as found'}
          aria-pressed={foundByMe}
          onClick={() => toggleFound(pin.id)}
        >
          ✓
        </button>
      )}
      <button type="button" className={styles.result} onClick={goToPin}>
        <span>
          {pin.title}{' '}
          {foundBy.map((p) => (
            <PlayerDot key={p} player={p} />
          ))}
        </span>
        <small className={styles.muted}>
          {pin.category} · {pin.area || 'no location on the map'}
        </small>
      </button>
    </li>
  );
}
