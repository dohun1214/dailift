import { router, useLocalSearchParams } from 'expo-router';
import { Copy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Badge, Button, Screen, TopBar } from '@/components/ui';
import { BASE_EXERCISES, baseExerciseId } from '@/data/exercises';
import { findTemplate } from '@/data/templates';
import { db } from '@/db/client';
import { copyTemplate } from '@/db/routines';
import { recommendTemplate } from '@/domain/profile';
import { useAppLanguage } from '@/i18n/use-app-language';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

const exerciseNames = new Map(BASE_EXERCISES.map((e) => [e.key, { ko: e.ko, en: e.en }]));

/** 추천 루틴 읽기 전용 미리보기 → 내 루틴으로 복사 */
export default function TemplatePreviewScreen() {
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const { key } = useLocalSearchParams<{ key: string }>();
  const template = findTemplate(key ?? '');
  const weightUnit = useSettings((s) => s.weightUnit);
  const experience = useProfile((s) => s.experience);
  const daysPerWeek = useProfile((s) => s.daysPerWeek);

  if (!template) {
    return (
      <Screen header={<TopBar />}>
        <Text style={styles.info}>{t('routines.preview.notFound')}</Text>
      </Screen>
    );
  }

  const recommended = recommendTemplate({ experience, daysPerWeek }) === template.key;
  const name = lang === 'ko' ? template.ko : template.en;

  const onCopy = () => {
    copyTemplate(db, template.key, { lang, weightUnit });
    router.back();
  };

  return (
    <Screen
      header={<TopBar title={`${template.code} · ${name}`} />}
      footer={<Button label={t('routines.preview.copy')} icon={Copy} onPress={onCopy} />}
    >
      <View style={styles.infoRow}>
        {recommended ? <Badge label={t('routines.recommendedBadge')} /> : null}
        <Text style={styles.info}>
          {t('routines.preview.readOnly', { freq: t(`routines.template.${template.key}.freq`) })}
        </Text>
      </View>
      {template.routines.map((r) => (
        <View key={r.en} style={styles.day}>
          <Text style={styles.dayTitle} accessibilityRole="header">
            {lang === 'ko' ? r.ko : r.en}
          </Text>
          {r.exercises.map((e, i) => {
            const n = exerciseNames.get(e.key);
            return (
              <View
                key={baseExerciseId(e.key)}
                style={[styles.row, i < r.exercises.length - 1 && styles.rowLine]}
              >
                <Text style={styles.exName} numberOfLines={1}>
                  {n ? n[lang] : e.key}
                </Text>
                <Text style={styles.exMeta}>
                  {t('routines.preview.sets', { count: e.sets, min: e.repMin, max: e.repMax })}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  info: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  day: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 6,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  dayTitle: {
    paddingBottom: 4,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  row: { minHeight: 60, justifyContent: 'center', gap: 2 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  exName: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  exMeta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
