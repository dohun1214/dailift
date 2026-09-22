import { useTranslation } from 'react-i18next';

import { AppText, Screen, TopBar } from '@/components/ui';

/** 루틴 편집 화면 자리. 이슈 #6에서 구현한다. */
export default function RoutineEditScreen() {
  const { t } = useTranslation();
  return (
    <Screen header={<TopBar title={t('routines.edit.title')} />}>
      <AppText tone="secondary">{t('common.comingSoon')}</AppText>
    </Screen>
  );
}
