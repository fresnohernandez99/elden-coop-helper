/** Resolves relative public/ paths (icons, local tiles) to absolute ones. */
export function assetUrl(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `/${path}`;
}
