/** 날짜 글자 `YYYY-MM-DD` (기기 현지 날짜). 영양제 · 식단 기록의 날짜 칸에 쓴다. */

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 그날 0시(현지). 모양이 틀리면 null */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dateKey(d) === key ? d : null;
}

/** 며칠 앞뒤의 날짜 글자 */
export function shiftDateKey(key: string, days: number): string {
  const d = parseDateKey(key);
  if (!d) return key;
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

export type MonthCell = { key: string; day: number } | null;

/**
 * 달력 한 달: 월요일부터 시작하는 7칸 줄들. 그 달이 아닌 칸은 null.
 * `month`는 0(1월) – 11
 */
export function monthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: MonthCell[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) {
    cells.push({ key: dateKey(new Date(year, month, day)), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
