import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { ListRow, ListSection, Screen, TopBar } from '@/components/ui';
import { LICENSES } from '@/data/licenses';
import type { FoodSource } from '@/domain/food-search';
import { foodCounts } from '@/food/catalog';
import { useFoodDb, useFoodSources } from '@/food/use-food-db';
import { useAppLanguage } from '@/i18n/use-app-language';
import { openUrl } from '@/lib/links';

const FOOD_SOURCE_URL: Record<FoodSource, string> = {
  usda: 'https://fdc.nal.usda.gov/',
  mfds: 'https://various.foodsafetykorea.go.kr/nutrient/',
};

const open = (name: string) => router.push({ pathname: '/settings/license', params: { name } });

/** 데이터 출처 · 오픈소스 */
export default function LicensesScreen() {
  const { t } = useTranslation();
  const locale = useAppLanguage() === 'ko' ? 'ko-KR' : 'en-US';
  // 음식 출처는 이 기기에서 보이는 것만 적는다(한국 밖에서는 식약처 데이터를 쓰지 않는다).
  const sources = useFoodSources();
  const { db, failed } = useFoodDb();
  const counts = useMemo(() => (db ? foodCounts(db) : null), [db]);
  return (
    <Screen header={<TopBar title={t('licenses.title')} />}>
      <ListSection title={t('licenses.groupData')}>
        <ListRow label={t('licenses.exercises')} value={t('licenses.exercisesValue')} />
        <ListRow
          label={t('licenses.muscleMap')}
          value="react-native-body-highlighter (MIT)"
          onPress={() => open('react-native-body-highlighter')}
        />
        {sources.map((src) => {
          const count = counts?.[src] ?? 0;
          // 아직 넣지 않은 출처는 보이지 않는다.
          if (counts && count === 0) return null;
          const license = t(
            src === 'usda' ? 'licenses.foodUsdaLicense' : 'licenses.foodMfdsLicense',
          );
          return (
            <ListRow
              key={src}
              label={t(src === 'usda' ? 'licenses.foodUsda' : 'licenses.foodMfds')}
              description={
                failed
                  ? t('licenses.foodFailed')
                  : counts
                    ? t('licenses.foodCount', { count, n: count.toLocaleString(locale), license })
                    : t('licenses.foodLoading', { license })
              }
              onPress={() => void openUrl(FOOD_SOURCE_URL[src])}
            />
          );
        })}
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
