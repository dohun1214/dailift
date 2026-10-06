import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { SupplementsView } from '@/components/supplements/supplements-view';
import { Screen, Segmented } from '@/components/ui';

type View_ = 'diet' | 'supplements';

/** 영양 탭: 식단 | 영양제 */
export default function NutritionScreen() {
  const { t } = useTranslation();
  // 식단을 만들기 전까지는 영양제를 먼저 보여 준다.
  const [view, setView] = useState<View_>('supplements');
  // 알림이나 홈 카드로 들어오면 영양제를 연다. 한 번 쓰고 지워서 다음에도 다시 열 수 있게 한다.
  const params = useLocalSearchParams<{ view?: string }>();
  useEffect(() => {
    if (params.view !== 'supplements') return;
    setView('supplements');
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
      {view === 'supplements' ? (
        <SupplementsView />
      ) : (
        <Text style={styles.soon}>{t('common.comingSoon')}</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  soon: {
    paddingHorizontal: 6,
    paddingTop: 8,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
