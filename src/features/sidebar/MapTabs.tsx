import { usePins } from '@/features/pins/PinsContext';
import { useUiStore } from '@/features/ui/uiStore';
import { Section } from '@/shared/ui/Section';
import styles from './MapTabs.module.css';

export function MapTabs() {
  const { maps } = usePins();
  const currentMap = useUiStore((s) => s.currentMap);
  const setCurrentMap = useUiStore((s) => s.setCurrentMap);

  return (
    <Section title="Map">
      <div className={styles.tabs} role="tablist">
        {maps.map((m) => (
          <button
            key={m.dir}
            type="button"
            role="tab"
            aria-selected={m.title === currentMap}
            className={styles.tab}
            onClick={() => setCurrentMap(m.title)}
          >
            {m.title}
          </button>
        ))}
      </div>
    </Section>
  );
}
