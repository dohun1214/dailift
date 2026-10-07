import { asc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import type { BodyEntry } from '@/domain/body';

import { toBodyEntry } from './body';
import { db } from './client';
import * as schema from './schema';

/** 체성분 기록 전부(오래된 순). 표가 바뀌면 다시 읽는다. */
export function useBodyEntries(): BodyEntry[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(schema.bodyMetrics)
      .where(isNull(schema.bodyMetrics.deletedAt))
      .orderBy(asc(schema.bodyMetrics.measuredAt)),
  );
  return useMemo(() => data.map(toBodyEntry), [data]);
}
