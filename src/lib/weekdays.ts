/**
 * 루틴 요일은 비트마스크 정수로 저장한다. 월=bit0 … 일=bit6.
 * JS Date.getDay()는 일=0이므로 변환 함수를 거친다.
 */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function toMask(days: readonly Weekday[]): number {
  return days.reduce((mask, d) => mask | (1 << WEEKDAYS.indexOf(d)), 0);
}

export function fromMask(mask: number): Weekday[] {
  return WEEKDAYS.filter((_, i) => (mask & (1 << i)) !== 0);
}

export function hasDay(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

export function toggleDay(mask: number, index: number): number {
  return mask ^ (1 << index);
}

export function isScheduledOn(mask: number, date: Date): boolean {
  return hasDay(mask, weekdayIndex(date));
}
