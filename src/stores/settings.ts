import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WeightUnit } from '@/db/schema';
import { DEFAULT_PLATES } from '@/domain/plates';
import { defaultBarWeight } from '@/domain/strength';
import { kvStorage } from '@/lib/kv-storage';
import type { Accent, ThemePreference } from '@/theme/tokens';

export type LanguagePreference = 'system' | 'ko' | 'en';
/** 덤벨 무게를 한 손 기준으로 적는지, 두 개 합으로 적는지 */
export type DumbbellMode = 'single' | 'pair';

/** 미국식 단위를 쓰는 기기면 lb, 그 외는 kg */
export function defaultWeightUnit(): WeightUnit {
  return getLocales()[0]?.measurementSystem === 'us' ? 'lb' : 'kg';
}

export const DEFAULT_REST_SEC = 90;

type Data = {
  themePreference: ThemePreference;
  accent: Accent;
  language: LanguagePreference;
  weightUnit: WeightUnit;
  /** 운동 중 화면 꺼짐 방지 */
  keepAwake: boolean;
  /** 단위별 바 무게 */
  barWeights: Record<WeightUnit, number>;
  /** 단위별 보유 원판 (한 종류당 짝으로 충분히 있다고 본다) */
  plates: Record<WeightUnit, number[]>;
  dumbbellMode: DumbbellMode;
  /** 새로 추가하는 종목의 휴식 시간 */
  defaultRestSec: number;
  /** 고급 기록: RPE · 세트 종류 */
  advancedLogging: boolean;
};

type SettingsState = Data & {
  setThemePreference: (value: ThemePreference) => void;
  setAccent: (value: Accent) => void;
  setLanguage: (value: LanguagePreference) => void;
  setWeightUnit: (value: WeightUnit) => void;
  setKeepAwake: (value: boolean) => void;
  setBarWeight: (unit: WeightUnit, value: number) => void;
  setPlates: (unit: WeightUnit, value: number[]) => void;
  setDumbbellMode: (value: DumbbellMode) => void;
  setDefaultRestSec: (value: number) => void;
  setAdvancedLogging: (value: boolean) => void;
  /** 모든 데이터 삭제 때 처음 상태로 */
  reset: () => void;
};

function defaults(): Data {
  return {
    themePreference: 'system',
    accent: 'mono',
    language: 'system',
    weightUnit: defaultWeightUnit(),
    keepAwake: true,
    barWeights: { kg: defaultBarWeight('kg'), lb: defaultBarWeight('lb') },
    plates: { kg: [...DEFAULT_PLATES.kg], lb: [...DEFAULT_PLATES.lb] },
    dumbbellMode: 'single',
    defaultRestSec: DEFAULT_REST_SEC,
    advancedLogging: false,
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults(),
      setThemePreference: (themePreference) => set({ themePreference }),
      setAccent: (accent) => set({ accent }),
      setLanguage: (language) => set({ language }),
      setWeightUnit: (weightUnit) => set({ weightUnit }),
      setKeepAwake: (keepAwake) => set({ keepAwake }),
      setBarWeight: (unit, value) =>
        set((s) => ({ barWeights: { ...s.barWeights, [unit]: value } })),
      setPlates: (unit, value) =>
        set((s) => ({ plates: { ...s.plates, [unit]: [...value].sort((a, b) => b - a) } })),
      setDumbbellMode: (dumbbellMode) => set({ dumbbellMode }),
      setDefaultRestSec: (defaultRestSec) => set({ defaultRestSec }),
      setAdvancedLogging: (advancedLogging) => set({ advancedLogging }),
      reset: () => set(defaults()),
    }),
    {
      name: 'settings',
      version: 4,
      storage: createJSONStorage(() => kvStorage),
      migrate: (persisted) => ({ ...defaults(), ...(persisted as object) }) as SettingsState,
    },
  ),
);

/** 운동을 시작하거나 종목을 추가할 때 쓰는 설정값 (지금 단위 기준) */
export function workoutDefaults(): { barWeight: number; restSec: number } {
  const s = useSettings.getState();
  return { barWeight: s.barWeights[s.weightUnit], restSec: s.defaultRestSec };
}
