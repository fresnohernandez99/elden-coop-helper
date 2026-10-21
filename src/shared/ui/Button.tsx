import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary';
  size?: 'normal' | 'small';
}

export function Button({ variant = 'default', size = 'normal', className, type = 'button', ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], size === 'small' && styles.small, className].filter(Boolean);
  return <button type={type} className={classes.join(' ')} {...props} />;
}
