import { and, gte, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { dateKey, thisWeek, todayList, weekStart } from '@/domain/supplements';

import { db } from './client';
import * as schema from './schema';
import { toSupplement } from './supplements';

/** 영양제 화면 · 홈 카드에 쓰는 것: 오늘 목록과 이번 주(월–일). DB가 바뀌면 다시 계산된다. */
export function useSupplements(today: Date) {
  const todayKey = dateKey(today);
  const from = dateKey(weekStart(today));
  const { data: rows } = useLiveQuery(
    db.select().from(schema.supplements).where(isNull(schema.supplements.deletedAt)),
  );
  const { data: logs } = useLiveQuery(
    db
      .select({
        supplementId: schema.supplementLogs.supplementId,
        date: schema.supplementLogs.date,
      })
      .from(schema.supplementLogs)
      .where(and(gte(schema.supplementLogs.date, from), isNull(schema.supplementLogs.deletedAt))),
    [from],
  );
  return useMemo(() => {
    const supplements = rows.map(toSupplement);
    const taken = new Set(logs.filter((l) => l.date === todayKey).map((l) => l.supplementId));
    // todayKey로 만든 날짜는 today와 같은 날이다(의존성을 글자로 두어 같은 날에는 다시 계산하지 않는다).
    const [y, m, d] = todayKey.split('-').map(Number) as [number, number, number];
    return {
      todayKey,
      ...todayList(supplements, taken),
      week: thisWeek(supplements, logs, new Date(y, m - 1, d)),
    };
  }, [rows, logs, todayKey]);
}
