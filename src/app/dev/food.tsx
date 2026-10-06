/**
 * 개발 빌드 전용: 음식 DB 검색을 직접 해 보는 화면. `dailift://dev/food`로 연다.
 * 사용자에게 보이지 않는 화면이라 문자열을 번역 파일에 넣지 않는다. 식단 화면이 생기면 지운다.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { AppText, Card, ListRow, Screen, SearchField, Segmented, TopBar } from '@/components/ui';
import { type FoodSource, foodSourcesForRegion } from '@/domain/food-search';
import { foodCounts, foodPortions, searchFoods } from '@/food/catalog';
import { useFoodDb } from '@/food/use-food-db';

export default function FoodPreview() {
  const { db, failed } = useFoodDb();
  // 에뮬레이터에는 한글을 입력할 수 없어서 주소로 검색어를 넘길 수 있게 했다: dailift://dev/food?q=김치
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [region, setRegion] = useState<'KR' | 'US'>('KR');
  const sources: FoodSource[] = useMemo(() => foodSourcesForRegion(region), [region]);
  const result = useMemo(() => {
    if (!db) return null;
    const started = Date.now();
    const rows = searchFoods(db, query, sources, 30);
    return { rows, ms: Date.now() - started };
  }, [db, query, sources]);

  if (!__DEV__) return <Redirect href="/" />;
  const counts = db ? foodCounts(db) : null;

  return (
    <Screen header={<TopBar title="Food DB" />} dismissKeyboardOnDrag>
      <Segmented
        options={[
          { value: 'KR', label: 'KR' },
          { value: 'US', label: 'US' },
        ]}
        value={region}
        onChange={setRegion}
      />
      <SearchField label="search" value={query} onChangeText={setQuery} placeholder="search" />
      <AppText tone="secondary">
        {failed
          ? 'failed to open'
          : counts
            ? `usda ${counts.usda} · mfds ${counts.mfds} · ${result?.rows.length ?? 0} rows · ${result?.ms ?? 0} ms`
            : 'opening…'}
      </AppText>
      <Card padding="list">
        {(result?.rows ?? []).map((f, i, all) => {
          const [portion] = db ? foodPortions(db, f.id) : [];
          return (
            <ListRow
              key={`${f.src}:${f.sid}`}
              last={i === all.length - 1}
              label={f.name}
              description={`${f.src} · ${f.kcal} kcal · P ${f.protein} · C ${f.carb} · F ${f.fat} /100${f.basis} · ${f.serving ?? '-'}${f.basis} ${f.servingName ?? portion?.name ?? ''}`}
            />
          );
        })}
      </Card>
    </Screen>
  );
}
