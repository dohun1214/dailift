import { getLocales } from 'expo-localization';
import { useEffect, useMemo, useState } from 'react';

import { foodSourcesForRegion } from '@/domain/food-search';

import type { FoodDb } from './catalog';
import { openFoodDb } from './food-db';

/** 음식 DB. 여는 동안에는 null, 열지 못했으면 `failed` */
export function useFoodDb(): { db: FoodDb | null; failed: boolean } {
  const [db, setDb] = useState<FoodDb | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    openFoodDb().then(
      (opened) => alive && setDb(opened),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);
  return { db, failed };
}

/** 이 기기에서 보일 음식 출처 (기기 지역으로 정한다. 고르는 설정은 없다) */
export function useFoodSources() {
  return useMemo(() => foodSourcesForRegion(getLocales()[0]?.regionCode), []);
}
