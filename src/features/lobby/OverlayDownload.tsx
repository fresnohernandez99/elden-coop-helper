import { useEffect, useState } from 'react';
import { OVERLAY_REPO } from '@/config/constants';
import styles from './Lobby.module.css';

const RELEASES_PAGE = `https://github.com/${OVERLAY_REPO}/releases`;

interface Release {
  tag_name: string;
  draft: boolean;
  assets: { name: string; browser_download_url: string }[];
}

/**
 * The newest overlay installer on GitHub. Overlay builds are published as
 * pre-releases, which GitHub's "latest release" link skips, so the list is searched.
 */
async function latestInstaller(): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${OVERLAY_REPO}/releases?per_page=20`);
  if (!res.ok) return null;
  for (const release of (await res.json()) as Release[]) {
    if (release.draft || !release.tag_name.startsWith('overlay-v')) continue;
    const installer = release.assets.find((a) => a.name.endsWith('-setup.exe'));
    if (installer) return installer.browser_download_url;
  }
  return null;
}

/**
 * Offers the Windows overlay app (the map over the game) to people who opened
 * the web on Windows. Hidden elsewhere and inside the overlay itself, whose page
 * has Tauri's bridge. Links straight to the installer on GitHub, or to the
 * releases page if it cannot be found.
 */
export function OverlayDownload() {
  const [href, setHref] = useState<string | null>(null);

  // After mounting: the user agent is not known while rendering on the server.
  useEffect(() => {
    if (!/Windows/i.test(navigator.userAgent) || '__TAURI_INTERNALS__' in window) return;
    setHref(RELEASES_PAGE);
    latestInstaller()
      .then((url) => url && setHref(url))
      .catch(() => {});
  }, []);
  if (!href) return null;

  return (
    <p className={styles.overlayDownload}>
      Playing on this PC? The <strong>overlay app</strong> shows this map over Elden Ring with a shortcut key.{' '}
      <a href={href}>Download for Windows</a>
    </p>
  );
}
