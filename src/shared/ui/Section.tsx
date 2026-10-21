import type { ReactNode } from 'react';
import styles from './Section.module.css';

interface SectionProps {
  title?: string;
  /** Content to the right of the title (links, buttons). */
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ title, actions, children }: SectionProps) {
  return (
    <section className={styles.section}>
      {(title || actions) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
