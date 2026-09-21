import { useTranslation } from 'react-i18next';

import { Screen } from './screen';
import { AppText } from './text';

/** 화면이 구현되기 전까지 탭 자리를 채우는 임시 화면. */
export function PlaceholderScreen({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <Screen inTabs>
      <AppText variant="h1" accessibilityRole="header">
        {title}
      </AppText>
      <AppText tone="secondary">{t('common.comingSoon')}</AppText>
    </Screen>
  );
}
