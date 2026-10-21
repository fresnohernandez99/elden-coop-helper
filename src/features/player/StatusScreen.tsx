import type { ReactNode } from 'react';
import styles from './StatusScreen.module.css';

export function StatusScreen({ children }: { children: ReactNode }) {
  return <div className={styles.screen}>{children}</div>;
}
