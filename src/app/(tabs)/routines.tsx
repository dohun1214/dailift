import { router } from 'expo-router';
import { Plus, Repeat } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { RoutineCard, SectionLabel, TemplateRow } from '@/components/routines';
import { IconButton, Screen } from '@/components/ui';
import { ROUTINE_TEMPLATES } from '@/data/templates';
import { db } from '@/db/client';
import { duplicateRoutine } from '@/db/routines';
import { useRoutineSections } from '@/db/use-routine-sections';
import { recommendTemplate } from '@/domain/profile';
import type { RoutineSummary } from '@/domain/routine';
import { useAppLanguage } from '@/i18n/use-app-language';
import { isScheduledOn } from '@/lib/weekdays';
import { useProfile } from '@/stores/profile';

export default function RoutinesScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const sections = useRoutineSections();
  const experience = useProfile((s) => s.experience);
  const daysPerWeek = useProfile((s) => s.daysPerWeek);
  const recommended = recommendTemplate({ experience, daysPerWeek });
  const today = new Date();

  const meta = (r: RoutineSummary) =>
    r.exerciseCount === 0
      ? t('routines.metaEmpty')
      : t('routines.meta', { count: r.exerciseCount, minutes: r.minutes });

  const openActions = (r: RoutineSummary) => {
    Alert.alert(t('routines.actionsTitle', { name: r.name }), undefined, [
      {
        text: t('routines.duplicate'),
        onPress: () => {
          duplicateRoutine(db, r.id, t('routines.copyName', { name: r.name }));
        },
      },
      { text: t('routines.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <Screen inTabs>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t('routines.title')}
        </Text>
        <IconButton
          icon={Plus}
          label={t('routines.create')}
          onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })}
        />
      </View>

      {sections.length === 0 ? <Text style={styles.empty}>{t('routines.empty')}</Text> : null}

      {sections.map((section) => (
        <View key={section.group?.id ?? 'standalone'} style={styles.section}>
          {section.group ? (
            <SectionLabel
              label={section.group.name}
              trailing={
                <View style={styles.mode}>
                  <Repeat size={14} color={theme.colors.text2} strokeWidth={1.8} />
                  <Text style={styles.modeText}>
                    {section.group.rotationMode ? t('routines.rotation') : t('routines.fixedDays')}
                  </Text>
                </View>
              }
            />
          ) : (
            <SectionLabel label={t('routines.standalone')} top={sections.length > 1 ? 8 : 0} />
          )}
          {section.routines.map((r) => (
            <RoutineCard
              key={r.id}
              name={r.name}
              weekdays={r.weekdays}
              meta={meta(r)}
              today={isScheduledOn(r.weekdays, today)}
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
              onLongPress={() => openActions(r)}
            />
          ))}
        </View>
      ))}

      <View style={styles.section}>
        <SectionLabel label={t('routines.recommended')} top={12} />
        {ROUTINE_TEMPLATES.map((tpl) => (
          <TemplateRow
            key={tpl.key}
            code={tpl.code}
            name={lang === 'ko' ? tpl.ko : tpl.en}
            subtitle={`${t(`routines.template.${tpl.key}.freq`)} · ${t(`routines.template.${tpl.key}.level`)}`}
            badge={tpl.key === recommended ? t('routines.recommendedBadge') : undefined}
            onPress={() =>
              router.push({ pathname: '/routine-template/[key]', params: { key: tpl.key } })
            }
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 4 },
  title: {
    flex: 1,
    fontSize: 26,
    lineHeight: 34,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  section: { gap: 12 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  empty: {
    paddingHorizontal: 6,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
