import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { ListRow, ListSection, Screen, TopBar } from '@/components/ui';
import { LICENSES } from '@/data/licenses';

const open = (name: string) => router.push({ pathname: '/settings/license', params: { name } });

/** 데이터 출처 · 오픈소스 */
export default function LicensesScreen() {
  const { t } = useTranslation();
  return (
    <Screen header={<TopBar title={t('licenses.title')} />}>
      <ListSection title={t('licenses.groupData')}>
        <ListRow label={t('licenses.exercises')} value={t('licenses.exercisesValue')} />
        <ListRow
          label={t('licenses.muscleMap')}
          value="react-native-body-highlighter (MIT)"
          onPress={() => open('react-native-body-highlighter')}
        />
        <ListRow
          label={t('licenses.fonts')}
          value={t('licenses.fontsValue')}
          onPress={() => open('@expo-google-fonts/ibm-plex-sans-kr')}
        />
      </ListSection>

      <Text style={styles.hint}>{t('licenses.hint')}</Text>
      <ListSection title={t('licenses.groupOss')}>
        {LICENSES.map((l) => (
          <ListRow key={l.name} label={l.name} value={l.license} onPress={() => open(l.name)} />
        ))}
      </ListSection>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  hint: {
    paddingHorizontal: 6,
    fontSize: 13,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
