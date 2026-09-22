import type { TemplateKey } from '@/domain/profile';
import type { Weekday } from '@/lib/weekdays';

export type TemplateExercise = {
  /** 기본 종목 key (`base:<key>`) */
  key: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
};

export type TemplateRoutine = {
  ko: string;
  en: string;
  weekdays: readonly Weekday[];
  exercises: readonly TemplateExercise[];
};

export type RoutineTemplate = {
  key: TemplateKey;
  /** 목록에 보이는 한 글자 코드 */
  code: 'A' | 'B' | 'C';
  ko: string;
  en: string;
  routines: readonly TemplateRoutine[];
};

const ex = (key: string, sets: number, repMin: number, repMax: number, restSec: number) => ({
  key,
  sets,
  repMin,
  repMax,
  restSec,
});

/**
 * 추천 루틴 3개. 사용자가 "내 루틴으로 복사"하면 묶음째 복사되고 원본은 그대로 남는다.
 * 복합 종목은 휴식 120초(데드리프트 180초), 고립 종목은 60–90초.
 */
export const ROUTINE_TEMPLATES: readonly RoutineTemplate[] = [
  {
    key: 'full_body',
    code: 'A',
    ko: '전신',
    en: 'Full Body',
    routines: [
      {
        ko: '전신 A',
        en: 'Full Body A',
        weekdays: ['mon', 'fri'],
        exercises: [
          ex('squat', 3, 6, 10, 120),
          ex('bench_press', 3, 6, 10, 120),
          ex('barbell_row', 3, 8, 12, 90),
          ex('dumbbell_shoulder_press', 2, 8, 12, 90),
          ex('dumbbell_curl', 2, 10, 12, 60),
        ],
      },
      {
        ko: '전신 B',
        en: 'Full Body B',
        weekdays: ['wed'],
        exercises: [
          ex('romanian_deadlift', 3, 8, 12, 120),
          ex('incline_dumbbell_press', 3, 8, 12, 90),
          ex('lat_pulldown', 3, 10, 12, 90),
          ex('leg_press', 2, 10, 12, 90),
          ex('face_pull', 2, 12, 15, 60),
        ],
      },
    ],
  },
  {
    key: 'upper_lower',
    code: 'B',
    ko: '상하체 2분할',
    en: 'Upper / Lower',
    routines: [
      {
        ko: '상체 A',
        en: 'Upper A',
        weekdays: ['mon'],
        exercises: [
          ex('bench_press', 4, 6, 10, 120),
          ex('barbell_row', 4, 6, 10, 120),
          ex('overhead_press', 3, 8, 12, 90),
          ex('lat_pulldown', 3, 10, 12, 90),
        ],
      },
      {
        ko: '하체 A',
        en: 'Lower A',
        weekdays: ['tue'],
        exercises: [
          ex('squat', 4, 6, 10, 120),
          ex('romanian_deadlift', 3, 8, 12, 120),
          ex('leg_press', 3, 10, 12, 90),
        ],
      },
      {
        ko: '상체 B',
        en: 'Upper B',
        weekdays: ['thu'],
        exercises: [
          ex('incline_dumbbell_press', 3, 8, 12, 90),
          ex('seated_cable_row', 3, 8, 12, 90),
          ex('dumbbell_shoulder_press', 3, 8, 12, 90),
          ex('pull_up', 3, 6, 10, 120),
          ex('hammer_curl', 2, 10, 12, 60),
          ex('overhead_triceps_extension', 2, 10, 12, 60),
        ],
      },
      {
        ko: '하체 B',
        en: 'Lower B',
        weekdays: ['fri'],
        exercises: [
          ex('deadlift', 3, 4, 6, 180),
          ex('bulgarian_split_squat', 3, 8, 12, 90),
          ex('leg_curl', 3, 10, 12, 60),
          ex('calf_raise', 3, 10, 15, 60),
        ],
      },
    ],
  },
  {
    key: 'push_pull_legs',
    code: 'C',
    ko: '푸시풀레그',
    en: 'Push Pull Legs',
    routines: [
      {
        ko: 'Push A',
        en: 'Push A',
        weekdays: ['mon', 'thu'],
        exercises: [
          ex('bench_press', 4, 6, 10, 120),
          ex('overhead_press', 3, 8, 12, 90),
          ex('incline_dumbbell_press', 3, 8, 12, 90),
          ex('lateral_raise', 3, 12, 15, 60),
          ex('triceps_pushdown', 3, 10, 12, 60),
        ],
      },
      {
        ko: 'Pull A',
        en: 'Pull A',
        weekdays: ['tue', 'fri'],
        exercises: [
          ex('barbell_row', 4, 6, 10, 120),
          ex('pull_up', 3, 6, 10, 120),
          ex('seated_cable_row', 3, 8, 12, 90),
          ex('face_pull', 3, 12, 15, 60),
          ex('barbell_curl', 3, 8, 12, 60),
        ],
      },
      {
        ko: 'Legs',
        en: 'Legs',
        weekdays: ['wed', 'sat'],
        exercises: [
          ex('squat', 4, 6, 10, 120),
          ex('romanian_deadlift', 3, 8, 12, 120),
          ex('leg_press', 3, 10, 12, 90),
          ex('leg_curl', 3, 10, 12, 60),
          ex('leg_extension', 3, 10, 15, 60),
          ex('calf_raise', 3, 10, 15, 60),
        ],
      },
    ],
  },
];

export function findTemplate(key: string): RoutineTemplate | undefined {
  return ROUTINE_TEMPLATES.find((t) => t.key === key);
}

/** 템플릿이 주에 몇 번 운동하는지 (요일 합) */
export function templateDaysPerWeek(t: RoutineTemplate): number {
  return new Set(t.routines.flatMap((r) => r.weekdays)).size;
}
