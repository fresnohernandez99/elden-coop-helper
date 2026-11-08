import { useRef } from 'react';
import { downloadBackup, readBackup } from '@/features/coop/backup';
import { ownProgress, useCoopStore } from '@/features/coop/coopStore';
import { localTeam } from '@/features/coop/localTeam';
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
    downloadBackup(ownProgress(useCoopStore.getState()), localTeam.creatorKeys(), names[me]);
  };

  const importProgress = async (file: File) => {
    try {
      const { progress, teams } = await readBackup(file);
      useCoopStore.getState().mergeOwn(progress);
      for (const [id, team] of Object.entries(teams)) localTeam.save(id, team);
      showToast(`Backup imported: ${Object.keys(progress.found).length} pins`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not import');
    }
  };

  return (
    <Section title="Backup">
      <p className={styles.hint}>Your progress (and the keys of the teams you created) is saved in this browser.</p>
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
