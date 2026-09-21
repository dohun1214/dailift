import type { MuscleGroup } from '@/db/schema';

export type MuscleSeed = {
  id: string;
  group: MuscleGroup;
  ko: string;
  en: string;
  /** react-native-body-highlighter의 부위 slug */
  bodySlugs: readonly string[];
};

/** 근육 참조 데이터. 순서가 곧 화면 표시 순서다. */
export const MUSCLES = [
  { id: 'chest', group: 'chest', ko: '가슴', en: 'Chest', bodySlugs: ['chest'] },
  { id: 'lats', group: 'back', ko: '광배', en: 'Lats', bodySlugs: ['upper-back'] },
  { id: 'traps', group: 'back', ko: '승모', en: 'Traps', bodySlugs: ['trapezius'] },
  { id: 'lower_back', group: 'back', ko: '허리', en: 'Lower back', bodySlugs: ['lower-back'] },
  { id: 'shoulders', group: 'shoulders', ko: '어깨', en: 'Shoulders', bodySlugs: ['deltoids'] },
  { id: 'biceps', group: 'arms', ko: '이두', en: 'Biceps', bodySlugs: ['biceps'] },
  { id: 'triceps', group: 'arms', ko: '삼두', en: 'Triceps', bodySlugs: ['triceps'] },
  { id: 'forearms', group: 'arms', ko: '전완', en: 'Forearms', bodySlugs: ['forearm'] },
  { id: 'abs', group: 'core', ko: '복근', en: 'Abs', bodySlugs: ['abs'] },
  { id: 'obliques', group: 'core', ko: '옆구리', en: 'Obliques', bodySlugs: ['obliques'] },
  { id: 'glutes', group: 'legs', ko: '둔근', en: 'Glutes', bodySlugs: ['gluteal'] },
  { id: 'quads', group: 'legs', ko: '대퇴사두', en: 'Quads', bodySlugs: ['quadriceps'] },
  { id: 'hamstrings', group: 'legs', ko: '햄스트링', en: 'Hamstrings', bodySlugs: ['hamstring'] },
  { id: 'adductors', group: 'legs', ko: '내전근', en: 'Adductors', bodySlugs: ['adductors'] },
  { id: 'calves', group: 'legs', ko: '종아리', en: 'Calves', bodySlugs: ['calves'] },
] as const satisfies readonly MuscleSeed[];

export type MuscleId = (typeof MUSCLES)[number]['id'];

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
];
