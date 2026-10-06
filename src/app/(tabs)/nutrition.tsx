import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DietView } from '@/components/diet/diet-view';
import { SupplementsView } from '@/components/supplements/supplements-view';
import { Screen, Segmented } from '@/components/ui';

type View_ = 'diet' | 'supplements';

/** 영양 탭: 식단 | 영양제 */
export default function NutritionScreen() {
  const { t } = useTranslation();
  const [view, setView] = useState<View_>('diet');
  // 알림이나 홈 카드로 들어오면 그 구간을 연다. 한 번 쓰고 지워서 다음에도 다시 열 수 있게 한다.
  const params = useLocalSearchParams<{ view?: string }>();
  useEffect(() => {
    if (params.view !== 'supplements' && params.view !== 'diet') return;
    setView(params.view);
    router.setParams({ view: undefined });
  }, [params.view]);

  return (
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
      {view === 'supplements' ? <SupplementsView /> : <DietView />}
    </Screen>
  );
}
