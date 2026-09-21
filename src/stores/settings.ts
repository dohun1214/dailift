import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Accent, ThemePreference } from '@/theme/tokens';

export type LanguagePreference = 'system' | 'ko' | 'en';

type SettingsState = {
  themePreference: ThemePreference;
  accent: Accent;
  language: LanguagePreference;
  setThemePreference: (value: ThemePreference) => void;
  setAccent: (value: Accent) => void;
  setLanguage: (value: LanguagePreference) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      accent: 'mono',
      language: 'system',
      setThemePreference: (themePreference) => set({ themePreference }),
      setAccent: (accent) => set({ accent }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => Storage),
    },
  ),
);
