import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WeightUnit } from '@/db/schema';
import type { BodyType, DaysPerWeek, Experience, Goal } from '@/domain/profile';
import { kvStorage } from '@/lib/kv-storage';

export type OnboardingResult = {
  experience: Experience | null;
  daysPerWeek: DaysPerWeek | null;
  goal: Goal | null;
  heightCm: number | null;
  weight: number | null;
  weightUnit: WeightUnit;
  bodyType: BodyType;
};

type ProfileState = OnboardingResult & {
  /** 이용약관·개인정보 처리방침 동의 + 만 14세 이상 확인 시각 */
  consentAcceptedAt: number | null;
  onboardingCompleted: boolean;
  acceptConsent: () => void;
  completeOnboarding: (result: OnboardingResult) => void;
};

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      consentAcceptedAt: null,
      onboardingCompleted: false,
      experience: null,
      daysPerWeek: null,
      goal: null,
      heightCm: null,
      weight: null,
      weightUnit: 'kg',
      bodyType: 'male',
      acceptConsent: () => set({ consentAcceptedAt: Date.now() }),
      completeOnboarding: (result) => set({ ...result, onboardingCompleted: true }),
    }),
    { name: 'profile', version: 1, storage: createJSONStorage(() => kvStorage) },
  ),
);
