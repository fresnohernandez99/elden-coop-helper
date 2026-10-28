import { useRef } from 'react';
import { downloadBackup, readBackup } from '@/features/coop/backup';
import { ownProgress, useCoopStore } from '@/features/coop/coopStore';
import { usePlayerNames } from '@/features/coop/playerNames';
import { showToast } from '@/features/notifications/toastStore';
import { Button } from '@/shared/ui/Button';
import { Section } from '@/shared/ui/Section';
import type { PlayerId } from '@/types/domain';
import styles from './BackupPanel.module.css';

/** Your progress lives in this browser: exporting it lets you back it up or move it to another device. */
export function BackupPanel({ me }: { me: PlayerId }) {
  const names = usePlayerNames();
  const fileInput = useRef<HTMLInputElement>(null);

  const exportProgress = () => {
    downloadBackup(ownProgress(useCoopStore.getState()), names[me]);
  };

  const importProgress = async (file: File) => {
    try {
      const progress = await readBackup(file);
      useCoopStore.getState().mergeOwn(progress);
      showToast(`Backup imported: ${Object.keys(progress.found).length} pins`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not import');
    }
  };

  return (
    <Section title="Backup">
      <p className={styles.hint}>Your progress is saved in this browser.</p>
      <div className={styles.actions}>
        <Button onClick={exportProgress}>Export</Button>
        <Button onClick={() => fileInput.current?.click()}>Import</Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void importProgress(file);
        }}
      />
    </Section>
  );
}
