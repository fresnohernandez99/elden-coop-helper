/** localStorage that never throws: without storage (private mode, quota exceeded) the app keeps going in memory. */

export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Keep going in memory.
  }
}

export function removeItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
