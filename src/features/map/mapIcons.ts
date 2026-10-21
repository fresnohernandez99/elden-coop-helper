import { divIcon, type DivIcon } from 'leaflet';
import { assetUrl } from '@/shared/utils/assetUrl';
import type { PlayerId } from '@/types/domain';
import styles from './mapIcons.module.css';

const PIN_SIZE = 28;
const pinIconCache = new Map<string, DivIcon>();

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Pin icon with one dot per player who found it.
 * Cached per combination so thousands of identical icons are not created.
 */
export function pinIcon(icon: string, foundBy: readonly PlayerId[], foundByMe: boolean): DivIcon {
  const key = `${icon}|${foundBy.join(',')}|${foundByMe}`;
  let cached = pinIconCache.get(key);
  if (!cached) {
    const badges = foundBy.map((p) => `<i class="${styles.badge}" style="background:var(--${p})"></i>`).join('');
    cached = divIcon({
      className: '',
      html: `<div class="${styles.pin} ${foundByMe ? styles.foundByMe : ''}">
        <img src="${escapeHtml(assetUrl(icon))}" alt="">
        ${badges ? `<span class="${styles.badges}">${badges}</span>` : ''}
      </div>`,
      iconSize: [PIN_SIZE, PIN_SIZE],
      iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
      popupAnchor: [0, -PIN_SIZE / 2 + 2],
    });
    pinIconCache.set(key, cached);
  }
  return cached;
}

/** Flag with the player's name for their next destination. */
export function flagIcon(player: PlayerId, name: string): DivIcon {
  return divIcon({
    className: '',
    html: `<div class="${styles.flag}"><span style="background:var(--${player})">${escapeHtml(name)}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -34],
  });
}
