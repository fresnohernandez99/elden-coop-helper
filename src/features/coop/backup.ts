import type { ImportedProgress } from './coopStore';
import { parseStoredProgress } from './localProgress';
import type { LocalTeam } from './localTeam';

const BACKUP_FORMAT = 'elden-coop-map/backup';
const BACKUP_VERSION = 2;
/** Version 1 had no teams. */
const SUPPORTED_VERSIONS = [1, 2];

interface BackupFile extends ImportedProgress {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Teams you created, with their creator key, so you can still remove players from another browser. */
  teams?: Record<string, LocalTeam>;
}

export interface Backup {
  progress: ImportedProgress;
  teams: Record<string, LocalTeam>;
}

/** Downloads your own progress (and the creator keys of your teams) as a JSON file. */
export function downloadBackup(progress: ImportedProgress, teams: Record<string, LocalTeam>, characterName: string) {
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    found: progress.found,
    next: progress.next,
    teams,
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
export async function readBackup(file: File): Promise<Backup> {
  let data: Partial<BackupFile>;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('The file is not valid JSON');
  }
  if (data.format !== BACKUP_FORMAT) throw new Error('The file is not an Elden Co-op Map backup');
  if (!SUPPORTED_VERSIONS.includes(data.version ?? 0)) throw new Error(`Unsupported backup version: ${data.version}`);
  const progress = parseStoredProgress(data);
  if (!progress) throw new Error('The backup is empty or damaged');
  return { progress: { found: progress.found, next: progress.next }, teams: parseTeams(data.teams) };
}

const TEAM_ID = /^[0-9a-f]{24}$/;

/** Only well-formed teams with a creator key. */
function parseTeams(value: unknown): Record<string, LocalTeam> {
  if (!value || typeof value !== 'object') return {};
  const teams: Record<string, LocalTeam> = {};
  for (const [id, team] of Object.entries(value as Record<string, Partial<LocalTeam>>)) {
    if (!TEAM_ID.test(id) || typeof team?.name !== 'string' || typeof team.creatorKey !== 'string') continue;
    teams[id] = {
      name: team.name,
      creatorKey: team.creatorKey,
      ...(typeof team.password === 'string' && { password: team.password }),
    };
  }
  return teams;
}
