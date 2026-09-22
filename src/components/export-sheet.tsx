import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { ActionSheet } from '@/components/ui';
import { useAppLanguage } from '@/i18n/use-app-language';
import { type ExportKind, exportData } from '@/lib/export-data';

/** '데이터 내보내기' 선택 시트. open()으로 연다. */
export function useExportSheet() {
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const [visible, setVisible] = useState(false);

  const run = (kind: ExportKind) => {
    // 시트가 닫힌 뒤 공유 시트를 연다
    setTimeout(() => {
      exportData(kind, lang)
        .then((ok) => {
          if (!ok) Alert.alert(t('exportData.failedTitle'), t('exportData.unavailable'));
        })
        .catch((e) => {
          console.warn('[export] failed', e);
          Alert.alert(t('exportData.failedTitle'), t('exportData.failed'));
        });
    }, 250);
  };

  const sheet = (
    <ActionSheet
      visible={visible}
      title={t('exportData.title')}
      cancelLabel={t('settings.cancel')}
      onClose={() => setVisible(false)}
      actions={[
        { label: t('exportData.csv'), onPress: () => run('csv') },
        { label: t('exportData.json'), onPress: () => run('json') },
      ]}
    />
  );
  return { open: () => setVisible(true), sheet };
}
