import type { ImportedProgress } from './coopStore';
import { parseStoredProgress } from './localProgress';

const BACKUP_FORMAT = 'elden-coop-map/backup';
const BACKUP_VERSION = 1;

interface BackupFile extends ImportedProgress {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
}

/** Downloads your own progress as a JSON file. */
export function downloadBackup(progress: ImportedProgress, characterName: string) {
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    found: progress.found,
    next: progress.next,
  };
  const slug = characterName.toLowerCase().replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'player';
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `elden-coop-map-${slug}-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Reads a backup; throws an Error with a user-facing message if it is invalid. */
export async function readBackup(file: File): Promise<ImportedProgress> {
  let data: Partial<BackupFile>;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('The file is not valid JSON');
  }
  if (data.format !== BACKUP_FORMAT) throw new Error('The file is not an Elden Co-op Map backup');
  if (data.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version: ${data.version}`);
  const progress = parseStoredProgress(data);
  if (!progress) throw new Error('The backup is empty or damaged');
  return { found: progress.found, next: progress.next };
}
