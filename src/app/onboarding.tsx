/** 온보딩 프로파일링 — 시안 02(1/4), 03(4/4). 2·3단계는 1단계와 같은 틀을 쓴다. */
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { BodyFigure, Button, Card, IconButton, OptionCard, TextField } from '@/components/ui';
import {
  type BodyType,
  type DaysPerWeek,
  type Experience,
  type Goal,
  HEIGHT_CM_RANGE,
  WEIGHT_RANGE,
} from '@/domain/profile';
import { parseDecimal } from '@/lib/number';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

const TOTAL = 4;
const STEPS = [1, 2, 3, 4] as const;
const EXPERIENCES: readonly Experience[] = ['new', 'under6m', 'over1y'];
const DAYS: readonly DaysPerWeek[] = [2, 3, 4, 5];
const GOALS: readonly Goal[] = ['muscle', 'strength', 'fat_loss', 'consistency'];

export default function Onboarding() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { redo } = useLocalSearchParams<{ redo?: string }>();
  const profile = useProfile();
  const weightUnit = useSettings((s) => s.weightUnit);

  const [step, setStep] = useState(1);
  const [experience, setExperience] = useState<Experience | null>(profile.experience);
  const [days, setDays] = useState<DaysPerWeek | null>(profile.daysPerWeek);
  const [goal, setGoal] = useState<Goal | null>(profile.goal);
  const [height, setHeight] = useState(profile.heightCm?.toString() ?? '');
  const [weight, setWeight] = useState(profile.weight?.toString() ?? '');
  const [bodyType, setBodyType] = useState<BodyType>(profile.bodyType);
  const [errors, setErrors] = useState<{ height?: string; weight?: string }>({});

  const leave = () => {
    if (redo) router.back();
    else router.replace('/');
  };

  const finish = (validate: boolean) => {
    const h = parseDecimal(height);
    const w = parseDecimal(weight);
    const range = WEIGHT_RANGE[weightUnit];
    const heightBad = h !== null && (h < HEIGHT_CM_RANGE.min || h > HEIGHT_CM_RANGE.max);
    const weightBad = w !== null && (w < range.min || w > range.max);
    if (validate && (heightBad || weightBad || (height && h === null) || (weight && w === null))) {
      setErrors({
        height:
          heightBad || (height && h === null)
            ? t('onboarding.body.heightError', HEIGHT_CM_RANGE)
            : undefined,
        weight:
          weightBad || (weight && w === null) ? t('onboarding.body.weightError', range) : undefined,
      });
      return;
    }
    profile.completeOnboarding({
      experience,
      daysPerWeek: days,
      goal,
      heightCm: heightBad ? null : h,
      weight: weightBad ? null : w,
      weightUnit,
      bodyType,
    });
    leave();
  };

  const back = () => {
    if (step > 1) setStep(step - 1);
    else if (redo) router.back();
    else router.replace('/welcome');
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1) {
        setStep(step - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  const canNext =
    (step === 1 && experience !== null) ||
    (step === 2 && days !== null) ||
    (step === 3 && goal !== null) ||
    step === 4;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <IconButton icon={ChevronLeft} label={t('common.back')} onPress={back} />
          <Text style={styles.progress}>{t('onboarding.progress', { step, total: TOTAL })}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => finish(false)}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipLabel}>{t('onboarding.skip')}</Text>
          </Pressable>
        </View>
        <View
          style={styles.bars}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: TOTAL, now: step }}
        >
          {STEPS.map((n) => (
            <View key={n} style={[styles.bar, n <= step ? styles.barOn : styles.barOff]} />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.main, step === 4 ? styles.mainBody : styles.mainChoice]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <Step
            title={t('onboarding.experience.title')}
            subtitle={t('onboarding.experience.subtitle')}
          >
            {EXPERIENCES.map((e) => (
              <OptionCard
                key={e}
                title={t(`onboarding.experience.${e}`)}
                subtitle={t(`onboarding.experience.${e}Sub`)}
                selected={experience === e}
                onPress={() => setExperience(e)}
              />
            ))}
          </Step>
        ) : null}

        {step === 2 ? (
          <Step title={t('onboarding.days.title')} subtitle={t('onboarding.days.subtitle')}>
            {DAYS.map((d) => (
              <OptionCard
                key={d}
                title={t(d === 5 ? 'onboarding.days.optionPlus' : 'onboarding.days.option', {
                  count: d,
                })}
                subtitle={t(`onboarding.days.d${d}Sub`)}
                selected={days === d}
                onPress={() => setDays(d)}
              />
            ))}
          </Step>
        ) : null}

        {step === 3 ? (
          <Step title={t('onboarding.goal.title')} subtitle={t('onboarding.goal.subtitle')}>
            {GOALS.map((g) => (
              <OptionCard
                key={g}
                title={t(`onboarding.goal.${g}`)}
                subtitle={t(`onboarding.goal.${g}Sub`)}
                selected={goal === g}
                onPress={() => setGoal(g)}
              />
            ))}
          </Step>
        ) : null}

        {step === 4 ? (
          <>
            <Title title={t('onboarding.body.title')} subtitle={t('onboarding.body.subtitle')} />
            <Card>
              <View style={styles.fields}>
                <TextField
                  label={t('onboarding.body.height')}
                  unit="cm"
                  value={height}
                  onChangeText={(v) => {
                    setHeight(v);
                    setErrors((e) => ({ ...e, height: undefined }));
                  }}
                  keyboardType="decimal-pad"
                  error={errors.height}
                />
                <TextField
                  label={t('onboarding.body.weight')}
                  unit={weightUnit}
                  value={weight}
                  onChangeText={(v) => {
                    setWeight(v);
                    setErrors((e) => ({ ...e, weight: undefined }));
                  }}
                  keyboardType="decimal-pad"
                  error={errors.weight}
                />
              </View>
            </Card>
            <View style={styles.bodySection}>
              <Text style={styles.sectionLabel}>{t('onboarding.body.bodyTypeLabel')}</Text>
              <View style={styles.bodyRow} accessibilityRole="radiogroup">
                {(['male', 'female'] as const).map((b) => (
                  <Pressable
                    key={b}
                    accessibilityRole="radio"
                    accessibilityLabel={t(`onboarding.body.${b}`)}
                    accessibilityState={{ checked: bodyType === b }}
                    onPress={() => setBodyType(b)}
                    style={[styles.bodyOption, bodyType === b ? styles.bodyOn : styles.bodyOff]}
                  >
                    <BodyFigure gender={b} width={62} />
                    <Text style={styles.bodyName}>{t(`onboarding.body.${b}`)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 28 + insets.bottom }]}>
        <Button
          label={step === TOTAL ? t('onboarding.done') : t('onboarding.next')}
          disabled={!canNext}
          onPress={() => (step === TOTAL ? finish(true) : setStep(step + 1))}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Title title={title} subtitle={subtitle} />
      <View style={styles.options} accessibilityRole="radiogroup">
        {children}
      </View>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  header: { gap: 8, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progress: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  skip: {
    minWidth: theme.hitSize,
    height: theme.hitSize,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text2,
  },
  pressed: { opacity: 0.6 },
  bars: { flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  barOn: { backgroundColor: theme.colors.accent },
  barOff: { backgroundColor: theme.colors.track },
  main: { paddingHorizontal: 16, paddingBottom: 12 },
  mainChoice: { paddingTop: 32, gap: 24 },
  mainBody: { paddingTop: 28, gap: 20 },
  titleBlock: { gap: 8, paddingHorizontal: 4 },
  title: {
    fontSize: 26,
    lineHeight: 34,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    letterSpacing: -0.26,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 21,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  options: { gap: 10 },
  fields: { flexDirection: 'row', gap: 12 },
  bodySection: { gap: 10 },
  sectionLabel: {
    paddingHorizontal: 6,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  bodyRow: { flexDirection: 'row', gap: 10 },
  bodyOption: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
  },
  bodyOn: { borderColor: theme.colors.accent },
  bodyOff: { borderColor: 'transparent' },
  bodyName: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  footer: { paddingTop: 12, paddingHorizontal: 16 },
}));
