/** 영양제 계산: 오늘 목록, 이번 주, 알림 계획. 모두 순수 함수. */
import type { SupplementTiming } from '@/db/schema';
import { weekdayIndex } from '@/lib/weekdays';

export type Supplement = {
  id: string;
  name: string;
  dose: string | null;
  timing: SupplementTiming;
  /** 자정부터 몇 분째 (정해진 시각) */
  timeMin: number;
  /** 운동을 마치고 몇 분 뒤 (운동 후) */
  afterMin: number;
  notify: boolean;
  renotify: boolean;
  active: boolean;
  createdAt: number;
};

/** 체크가 없으면 이만큼 뒤에 한 번 더 알린다 */
export const RENOTIFY_MIN = 60;
/** '운동을 마친 뒤' 고를 수 있는 값(분) */
export const AFTER_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90, 120] as const;
/** 복용 시각을 바꾸는 단위(분) */
export const TIME_STEP_MIN = 5;
export const LIMITS = { supplements: 30, name: 30, dose: 20 } as const;

const DAY_MIN = 24 * 60;
const MIN_MS = 60_000;

/** 기기 현지 날짜 글자 `YYYY-MM-DD` */
export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 시 · 분을 5분 단위의 '자정부터 몇 분'으로 (범위를 넘으면 하루를 돌아간다) */
export function wrapMinutes(min: number): number {
  const stepped = Math.round(min / TIME_STEP_MIN) * TIME_STEP_MIN;
  return ((stepped % DAY_MIN) + DAY_MIN) % DAY_MIN;
}

/** 복용 시각 창: 오전/오후, 시(1–12), 분으로 나눈다 */
export function splitTime(timeMin: number): { pm: boolean; hour12: number; minute: number } {
  const h = Math.floor(timeMin / 60);
  return { pm: h >= 12, hour12: h % 12 === 0 ? 12 : h % 12, minute: timeMin % 60 };
}

export function joinTime(pm: boolean, hour12: number, minute: number): number {
  const h = (hour12 % 12) + (pm ? 12 : 0);
  return h * 60 + minute;
}

/** 목록 순서: 정해진 시각(이른 순) → 운동 후(짧은 순) → 먼저 만든 순 */
export function sortSupplements<T extends Supplement>(list: readonly T[]): T[] {
  const key = (s: Supplement) => (s.timing === 'time' ? s.timeMin : DAY_MIN + s.afterMin);
  return [...list].sort(
    (a, b) => key(a) - key(b) || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}

export type TodayItem = Supplement & { taken: boolean };

/** 오늘 화면: 사용 중인 영양제(먹었는지 포함)와 사용 안 하는 영양제 */
export function todayList(
  supplements: readonly Supplement[],
  takenToday: ReadonlySet<string>,
): { active: TodayItem[]; inactive: Supplement[]; done: number; total: number } {
  const sorted = sortSupplements(supplements);
  const active = sorted.filter((s) => s.active).map((s) => ({ ...s, taken: takenToday.has(s.id) }));
  return {
    active,
    inactive: sorted.filter((s) => !s.active),
    done: active.filter((s) => s.taken).length,
    total: active.length,
  };
}

export type WeekDay = {
  date: Date;
  /** 그날 먹은 영양제 수(지금 사용 중인 것만) */
  count: number;
  /** 그날 먹어야 했던 수: 그날까지 등록돼 있던, 지금 사용 중인 영양제 */
  total: number;
  complete: boolean;
  today: boolean;
  /** 아직 오지 않은 날 */
  future: boolean;
};

/** 그 주 월요일 (홈 · 통계와 같은 기준) */
export function weekStart(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekdayIndex(today));
}

/** 이번 주 월–일. 먹은 수는 영양제 단위로 센다(같은 날 기록이 둘이어도 하나). 오지 않은 날은 비워 둔다. */
export function thisWeek(
  supplements: readonly Supplement[],
  logs: readonly { supplementId: string; date: string }[],
  today: Date,
): WeekDay[] {
  const active = supplements.filter((s) => s.active);
  const ids = new Set(active.map((s) => s.id));
  const byDate = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!ids.has(l.supplementId)) continue;
    const set = byDate.get(l.date) ?? new Set<string>();
    set.add(l.supplementId);
    byDate.set(l.date, set);
  }
  const start = weekStart(today);
  const todayKey = dateKey(today);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dateKey(date);
    const future = key > todayKey;
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const total = future ? 0 : active.filter((s) => s.createdAt < endOfDay).length;
    const count = future ? 0 : (byDate.get(key)?.size ?? 0);
    return {
      date,
      count,
      total,
      complete: total > 0 && count >= total,
      today: key === todayKey,
      future,
    };
  });
}

// ---------- 알림 계획

export type NotificationKind = 'due' | 'again' | 'after' | 'afterAgain';

export type NotificationTrigger =
  /** 매주 그 요일. weekday: 1(일) – 7(토) */
  | { type: 'weekly'; weekday: number; hour: number; minute: number }
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'date'; at: number };

export type PlannedNotification = {
  /** 같은 내용이면 같은 id (이미 예약돼 있으면 다시 걸지 않는다) */
  id: string;
  kind: NotificationKind;
  names: string[];
  trigger: NotificationTrigger;
};

/** iOS는 예약 알림이 앱당 64개까지. 휴식 타이머 몫을 남긴다. */
export const NOTIFICATION_BUDGET = 60;
/** '바로' 알림은 예약하는 사이 시각이 지나므로 이만큼은 봐준다 */
const JUST_NOW_MS = 60_000;

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** 다시 알림 시각. 자정을 넘기지 않는다(그날 체크와 묶여 있으므로). */
export function againMinutes(timeMin: number): number {
  return Math.min(timeMin + RENOTIFY_MIN, DAY_MIN - 1);
}

const atMinutes = (day: Date, min: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(min / 60), min % 60);

/**
 * 지금 예약돼 있어야 할 영양제 알림 전부.
 *
 * 정해진 시각: 같은 시각의 영양제를 하나로 묶어 요일마다 반복 알림 7개를 건다(앱을 열지 않아도 계속 울린다).
 * 오늘 그 묶음에서 하나라도 먹었으면 오늘 몫만 빼고, 남은 것이 있으면 그 이름만 담아 한 번짜리로 건다.
 * 오늘 몫을 뺀 요일 알림은 그 시각이 지난 뒤 다시 계획하면 돌아온다.
 * 묶음이 많아 한도를 넘으면 늦은 시각의 묶음부터 '매일 반복' 하나로 줄인다(오늘 몫을 뺄 수 없다).
 *
 * 운동 후: 오늘 마친 운동이 있으면 그 시각 + N분에 한 번(아직 안 먹은 것만).
 */
export function planNotifications({
  supplements,
  takenToday,
  now,
  workoutEndedAt,
  budget = NOTIFICATION_BUDGET,
}: {
  supplements: readonly Supplement[];
  takenToday: ReadonlySet<string>;
  now: Date;
  /** 오늘 마지막으로 마친 운동의 끝난 시각 */
  workoutEndedAt: number | null;
  budget?: number;
}): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const on = sortSupplements(supplements.filter((s) => s.active && s.notify));
  const nowMs = now.getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  /** 오늘 요일 (1 = 일) */
  const weekday = today.getDay() + 1;

  // 운동 후 (한 번짜리)
  const after = on.filter((s) => s.timing === 'after_workout' && !takenToday.has(s.id));
  if (workoutEndedAt !== null && dateKey(new Date(workoutEndedAt)) === dateKey(now)) {
    for (const min of [...new Set(after.map((s) => s.afterMin))]) {
      const members = after.filter((s) => s.afterMin === min);
      let at = workoutEndedAt + min * MIN_MS;
      if (at <= nowMs && nowMs - at < JUST_NOW_MS) at = nowMs + 1000;
      if (at > nowMs) out.push(oneOff('after', members, at, `a${min}-${workoutEndedAt}`));
      const again = members.filter((s) => s.renotify);
      const againAt = workoutEndedAt + (min + RENOTIFY_MIN) * MIN_MS;
      if (again.length > 0 && againAt > nowMs)
        out.push(oneOff('afterAgain', again, againAt, `aa${min}-${workoutEndedAt}`));
    }
  }

  // 정해진 시각 (요일 반복 + 오늘 몫)
  const timed = on.filter((s) => s.timing === 'time');
  const groups = [...new Set(timed.map((s) => s.timeMin))].map((timeMin) => {
    const members = timed.filter((s) => s.timeMin === timeMin);
    return { timeMin, members, again: members.filter((s) => s.renotify) };
  });
  const cost = (g: (typeof groups)[number], full: boolean) =>
    (full ? 7 : 1) * (1 + (g.again.length > 0 ? 1 : 0));
  let fullCount = groups.length;
  const total = () => out.length + groups.reduce((n, g, i) => n + cost(g, i < fullCount), 0);
  while (fullCount > 0 && total() > budget) fullCount -= 1;

  groups.forEach((g, index) => {
    const full = index < fullCount;
    const slots: { kind: 'due' | 'again'; min: number; members: Supplement[] }[] = [
      { kind: 'due', min: g.timeMin, members: g.members },
    ];
    if (g.again.length > 0)
      slots.push({ kind: 'again', min: againMinutes(g.timeMin), members: g.again });
    const anyTaken = g.members.some((s) => takenToday.has(s.id));

    for (const slot of slots) {
      const hour = Math.floor(slot.min / 60);
      const minute = slot.min % 60;
      const names = slot.members.map((s) => s.name);
      const sig = hash(`${slot.members.map((s) => s.id).join(',')}|${names.join(',')}`);
      if (!full) {
        out.push({
          id: `supp-${slot.kind}-d-${slot.min}-${sig}`,
          kind: slot.kind,
          names,
          trigger: { type: 'daily', hour, minute },
        });
        continue;
      }
      const todayAt = atMinutes(today, slot.min).getTime();
      // 오늘 몫을 따로 다뤄야 하는가: 하나라도 먹었고, 오늘 그 시각이 아직 안 왔을 때
      const replaceToday = anyTaken && todayAt > nowMs;
      for (let wd = 1; wd <= 7; wd++) {
        if (replaceToday && wd === weekday) continue;
        out.push({
          id: `supp-${slot.kind}-w${wd}-${slot.min}-${sig}`,
          kind: slot.kind,
          names,
          trigger: { type: 'weekly', weekday: wd, hour, minute },
        });
      }
      if (replaceToday) {
        const left = slot.members.filter((s) => !takenToday.has(s.id));
        if (left.length > 0)
          out.push(oneOff(slot.kind, left, todayAt, `t${slot.min}-${dateKey(today)}`));
      }
    }
  });
  return out;
}

function oneOff(
  kind: NotificationKind,
  members: readonly Supplement[],
  at: number,
  key: string,
): PlannedNotification {
  const names = members.map((s) => s.name);
  const sig = hash(`${members.map((s) => s.id).join(',')}|${names.join(',')}`);
  return { id: `supp-${kind}-${key}-${sig}`, kind, names, trigger: { type: 'date', at } };
}
