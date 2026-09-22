import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Screen, TopBar } from '@/components/ui';

/** 세션 요약 자리. 이슈 #8에서 구현한다. */
export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  return (
    <Screen
      header={
        <TopBar
          title={t('workout.summaryTitle')}
          leading="close"
          onLeadingPress={() => router.replace('/')}
        />
      }
    >
      <AppText tone="secondary">{t('common.comingSoon')}</AppText>
    </Screen>
  );
}
