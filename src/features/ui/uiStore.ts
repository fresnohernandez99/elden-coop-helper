import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LatLng, Pin } from '@/types/domain';

export interface FocusRequest {
  area: string;
  latlng: LatLng;
  /** Pin whose popup opens on arrival. */
  pinId?: string;
  /** Changes on every request so the same target can be repeated. */
  nonce: number;
}

interface UiStore {
  // Preferences remembered in this browser
  currentMap: string | null;
  /** null means "all categories". */
  enabledCategories: string[] | null;
  hideFound: boolean;

  // Current session state
  search: string;
  placing: boolean;
  nextNote: string;
  sidebarOpen: boolean;
  focus: FocusRequest | null;

  setCurrentMap: (map: string) => void;
  setCategoryEnabled: (category: string, enabled: boolean, allCategories: string[]) => void;
  setEnabledCategories: (categories: string[] | null) => void;
  setHideFound: (hide: boolean) => void;
  setSearch: (search: string) => void;
  setPlacing: (placing: boolean) => void;
  setNextNote: (note: string) => void;
  setSidebarOpen: (open: boolean) => void;
  focusOn: (area: string, latlng: LatLng) => void;
  focusPin: (pin: Pin) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      currentMap: null,
      enabledCategories: null,
      hideFound: false,
      search: '',
      placing: false,
      nextNote: '',
      sidebarOpen: false,
      focus: null,

      setCurrentMap: (currentMap) => set({ currentMap }),

      setCategoryEnabled: (category, enabled, allCategories) => {
        const current = new Set(get().enabledCategories ?? allCategories);
        if (enabled) current.add(category);
        else current.delete(category);
        set({ enabledCategories: [...current] });
      },

      setEnabledCategories: (enabledCategories) => set({ enabledCategories }),
      setHideFound: (hideFound) => set({ hideFound }),
      setSearch: (search) => set({ search }),
      // Starting "pick on map" closes the drawer so the map is visible on phones.
      setPlacing: (placing) => set(placing ? { placing, sidebarOpen: false } : { placing }),
      setNextNote: (nextNote) => set({ nextNote }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      focusOn: (area, latlng) =>
        set({ currentMap: area, focus: { area, latlng, nonce: Date.now() }, sidebarOpen: false }),

      focusPin: (pin) => {
        if (!pin.latlng) return;
        const { enabledCategories } = get();
        // Make sure the pin is visible even if its category was disabled.
        if (enabledCategories && !enabledCategories.includes(pin.category)) {
          set({ enabledCategories: [...enabledCategories, pin.category] });
        }
        set({
          currentMap: pin.area,
          focus: { area: pin.area, latlng: pin.latlng, pinId: pin.id, nonce: Date.now() },
          sidebarOpen: false,
        });
      },
    }),
    {
      name: 'elden-coop-map.ui',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ currentMap, enabledCategories, hideFound }) => ({ currentMap, enabledCategories, hideFound }),
    },
  ),
);
