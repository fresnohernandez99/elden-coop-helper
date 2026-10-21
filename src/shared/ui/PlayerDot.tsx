import type { PlayerId } from '@/types/domain';
import styles from './PlayerDot.module.css';

/** Dot in the player's color (defined as the CSS variable --p1 / --p2). */
export function PlayerDot({ player, className }: { player: PlayerId; className?: string }) {
  return (
    <i
      className={[styles.dot, className].filter(Boolean).join(' ')}
      style={{ background: `var(--${player})` }}
      aria-hidden
    />
  );
}
