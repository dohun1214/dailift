import { getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

/** 여러 행이 한꺼번에 바뀔 때(동기화 받기 등) 한 번만 다시 읽도록 모으는 시간 */
const COALESCE_MS = 60;

/**
 * 주어진 테이블이 바뀔 때마다 올라가는 숫자. useLiveQuery의 두 번째 인자(deps)에 넣어 쓴다.
 *
 * useLiveQuery는 from에 쓴 테이블 하나만 지켜본다. 조인한 테이블만 바뀌는 경우
 * (운동을 마치면 workouts.status만 바뀌고 sets는 그대로다)에는 다시 읽지 않으므로,
 * 조인한 테이블을 여기에 넘겨서 다시 읽게 한다.
 */
export function useTableRev(...tables: SQLiteTable[]): number {
  const [rev, setRev] = useState(0);
  const names = tables.map(getTableName).join(',');
  useEffect(() => {
    const watched = new Set(names.split(','));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = addDatabaseChangeListener(({ tableName }) => {
      if (!watched.has(tableName) || timer) return;
      timer = setTimeout(() => {
        timer = null;
        setRev((r) => r + 1);
      }, COALESCE_MS);
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [names]);
  return rev;
}
