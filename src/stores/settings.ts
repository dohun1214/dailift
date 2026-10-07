import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WeightUnit } from '@/db/schema';
import { DEFAULT_PLATES } from '@/domain/plates';
import { clampSetTarget, type SetTargets, type TargetGroup } from '@/domain/set-targets';
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
  /** 휴식 타이머를 잠금 화면(아이폰 실시간 현황) · 알림창(안드로이드)에 보여 줄지 */
  restOnLockScreen: boolean;
  /** 운동 중 '종목을 꾹 누르면…' 안내를 닫았거나 편집 모드에 들어가 봤는지 */
  editHintSeen: boolean;
  /** '세트 번호를 누르면 종류 · RPE를 적을 수 있다'는 안내를 닫았다 */
  setHintSeen: boolean;
  /** 기록 상세의 '한 운동' 카드를 펼쳐 둘지 (마지막으로 누른 상태를 기억) */
  summaryExercisesOpen: boolean;
  /** 직접 정한 부위별 주간 목표 세트. 없는 부위는 운동 경력에 맞춘 추천값을 쓴다 */
  setTargets: Partial<SetTargets>;
  /** 부위별 주간 세트를 셀 때 협응근만 쓰는 부위에도 0.5세트를 더할지. 끄면 주동근 부위만 센다 */
  countSecondarySets: boolean;
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
  setRestOnLockScreen: (value: boolean) => void;
  markEditHintSeen: () => void;
  markSetHintSeen: () => void;
  setSummaryExercisesOpen: (value: boolean) => void;
  setSetTarget: (group: TargetGroup, value: number) => void;
  setCountSecondarySets: (value: boolean) => void;
  /** 모든 부위를 추천값으로 */
  resetSetTargets: () => void;
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
    restOnLockScreen: true,
    editHintSeen: false,
    setHintSeen: false,
    summaryExercisesOpen: false,
    setTargets: {},
    countSecondarySets: false,
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
      setRestOnLockScreen: (restOnLockScreen) => set({ restOnLockScreen }),
      markEditHintSeen: () => set({ editHintSeen: true }),
      markSetHintSeen: () => set({ setHintSeen: true }),
      setSummaryExercisesOpen: (summaryExercisesOpen) => set({ summaryExercisesOpen }),
      setSetTarget: (group, value) =>
        set((s) => ({ setTargets: { ...s.setTargets, [group]: clampSetTarget(value) } })),
      resetSetTargets: () => set({ setTargets: {} }),
      setCountSecondarySets: (countSecondarySets) => set({ countSecondarySets }),
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
