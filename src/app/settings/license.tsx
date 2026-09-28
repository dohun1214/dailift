import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Card, ListRow, ListSection, Screen, TopBar } from '@/components/ui';
import { findLicense } from '@/data/licenses';
import { openUrl } from '@/lib/links';

/** 오픈소스 한 개의 라이선스 전문 */
export default function LicenseScreen() {
  const { t } = useTranslation();
  const { name } = useLocalSearchParams<{ name: string }>();
  const entry = findLicense(name ?? '');

  return (
    <Screen header={<TopBar title={entry?.name ?? ''} />}>
      {entry ? (
        <>
          <ListSection>
            <ListRow label={entry.license} value={entry.version} />
            <ListRow label={t('licenses.homepage')} onPress={() => void openUrl(entry.url)} />
          </ListSection>
          <Card>
            <Text style={styles.text} selectable>
              {entry.text}
            </Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  text: {
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
