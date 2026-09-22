import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WeightUnit } from '@/db/schema';
import { kvStorage } from '@/lib/kv-storage';
import type { Accent, ThemePreference } from '@/theme/tokens';

export type LanguagePreference = 'system' | 'ko' | 'en';

/** 미국식 단위를 쓰는 기기면 lb, 그 외는 kg */
export function defaultWeightUnit(): WeightUnit {
  return getLocales()[0]?.measurementSystem === 'us' ? 'lb' : 'kg';
}

type SettingsState = {
  themePreference: ThemePreference;
  accent: Accent;
  language: LanguagePreference;
  weightUnit: WeightUnit;
  setThemePreference: (value: ThemePreference) => void;
  setAccent: (value: Accent) => void;
  setLanguage: (value: LanguagePreference) => void;
  setWeightUnit: (value: WeightUnit) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      accent: 'mono',
      language: 'system',
      weightUnit: defaultWeightUnit(),
      setThemePreference: (themePreference) => set({ themePreference }),
      setAccent: (accent) => set({ accent }),
      setLanguage: (language) => set({ language }),
      setWeightUnit: (weightUnit) => set({ weightUnit }),
    }),
    {
      name: 'settings',
      version: 2,
      storage: createJSONStorage(() => kvStorage),
      migrate: (persisted) =>
        ({
          weightUnit: defaultWeightUnit(),
          ...(persisted as object),
        }) as SettingsState,
    },
  ),
);
