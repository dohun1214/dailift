import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { DietView } from '@/components/diet/diet-view';
import { SupplementsView } from '@/components/supplements/supplements-view';
import { Screen, Segmented, Snackbar } from '@/components/ui';
import { db } from '@/db/client';
import { restoreFoodLog } from '@/db/diet';
import type { FoodLog } from '@/domain/diet';

type View_ = 'diet' | 'supplements';

/** 지운 음식의 '취소' 줄이 떠 있는 시간 */
const UNDO_MS = 4000;

/** 영양 탭: 식단 | 영양제 */
export default function NutritionScreen() {
  const { t } = useTranslation();
  const [view, setView] = useState<View_>('diet');
  // 방금 지운 음식 기록. 떠 있는 동안 '취소'를 누르면 되살린다(마지막에 지운 하나만).
  const [deleted, setDeleted] = useState<{ key: number; id: string; name: string } | null>(null);
  const deletedKey = useRef(0);
  // 알림이나 홈 카드로 들어오면 그 구간을 연다. 한 번 쓰고 지워서 다음에도 다시 열 수 있게 한다.
  const params = useLocalSearchParams<{ view?: string }>();
  useEffect(() => {
    if (params.view !== 'supplements' && params.view !== 'diet') return;
    setView(params.view);
    router.setParams({ view: undefined });
  }, [params.view]);

  const onDeleted = (log: FoodLog) => {
    deletedKey.current += 1;
    setDeleted({ key: deletedKey.current, id: log.id, name: log.name });
  };

  return (
    <View style={styles.root}>
      <Screen inTabs>
        <Segmented
          accessibilityLabel={t('nutrition.segA11y')}
          options={[
            { value: 'diet', label: t('nutrition.diet') },
            { value: 'supplements', label: t('nutrition.supplements') },
          ]}
          value={view}
          onChange={setView}
        />
        {view === 'supplements' ? <SupplementsView /> : <DietView onDeleted={onDeleted} />}
      </Screen>
      {deleted && view === 'diet' ? (
        // 내용을 밀어내지 않게 탭 바 바로 위에 띄운다.
        <View style={styles.floating} pointerEvents="box-none">
          <Snackbar
            key={deleted.key}
            message={t('diet.deleted', { name: deleted.name })}
            actionLabel={t('diet.search.undo')}
            onAction={() => {
              restoreFoodLog(db, deleted.id);
              setDeleted(null);
            }}
            onDismiss={() => setDeleted((cur) => (cur?.key === deleted.key ? null : cur))}
            autoHideMs={UNDO_MS}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  floating: {
    position: 'absolute',
    left: theme.space.lg,
    right: theme.space.lg,
    bottom: theme.space.md,
  },
}));
