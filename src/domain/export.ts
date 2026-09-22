/** 내보내기 파일 내용 만들기(순수 함수). */

export type ExportSetRow = {
  startedAt: number;
  workoutName: string;
  exercise: string;
  setNumber: number;
  kind: string;
  weight: number | null;
  unit: string;
  reps: number | null;
  durationSec: number | null;
  rpe: number | null;
};

export const CSV_HEADER = [
  'date',
  'workout',
  'exercise',
  'set',
  'kind',
  'weight',
  'unit',
  'reps',
  'duration_sec',
  'rpe',
] as const;

/** CSV 칸: 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다. 수식으로 해석될 수 있는 첫 글자는 막는다. */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 기기 시간대 기준 'YYYY-MM-DD HH:mm' */
export function formatLocal(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 운동 기록 CSV. 엑셀에서 한글이 깨지지 않게 BOM을 붙인다. */
export function buildWorkoutCsv(rows: readonly ExportSetRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    lines.push(
      [
        formatLocal(r.startedAt),
        r.workoutName,
        r.exercise,
        r.setNumber,
        r.kind,
        r.weight,
        r.unit,
        r.reps,
        r.durationSec,
        r.rpe,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** 파일 이름에 쓰는 날짜 'YYYYMMDD' */
export function fileDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
