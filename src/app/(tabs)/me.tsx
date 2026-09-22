import Constants from 'expo-constants';
import { router } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  ActionSheet,
  Button,
  Card,
  ListRow,
  ListSection,
  Screen,
  type SheetAction,
  Toggle,
} from '@/components/ui';
import type { WeightUnit } from '@/db/schema';
import { BAR_OPTIONS } from '@/domain/plates';
import { signOut } from '@/lib/auth';
import { wipeDevice } from '@/lib/wipe-device';
import { accountInfo, useAuth } from '@/stores/auth';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';
import { ACCENTS, type Accent, themes } from '@/theme/tokens';

const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240];
const fmt = (n: number) => String(Math.round(n * 100) / 100);

type Sheet = { title: string; actions: SheetAction[] };

/** 내 정보 탭 = 설정 */
export default function MeScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const s = useSettings();
  const bodyType = useProfile((p) => p.bodyType);
  const setBodyType = useProfile((p) => p.setBodyType);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const account = accountInfo(useAuth((a) => a.session));
  const providerName =
    account?.provider === 'apple' ? 'Apple' : account?.provider === 'google' ? 'Google' : '';
  const unit = s.weightUnit;
  const bar = s.barWeights[unit];

  const weight = (value: number) => t('settings.weightValue', { value: fmt(value), unit });
  const choose = <T,>(
    title: string,
    options: readonly T[],
    current: T,
    label: (v: T) => string,
    apply: (v: T) => void,
  ) =>
    setSheet({
      title,
      actions: options.map((v) => ({
        label: label(v),
        selected: v === current,
        onPress: () => apply(v),
      })),
    });

  const themeLabel = {
    system: t('settings.themeSystem'),
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
  } as const;
  const langLabel = {
    system: t('settings.langSystem'),
    ko: t('settings.langKo'),
    en: t('settings.langEn'),
  } as const;
  const accentLabel: Record<Accent, string> = {
    mono: t('settings.accentMono'),
    blue: t('settings.accentBlue'),
    lime: t('settings.accentLime'),
  };
  const dumbbellLabel = {
    single: t('settings.dumbbellSingle'),
    pair: t('settings.dumbbellPair'),
  } as const;
  const bodyLabel = { male: t('settings.bodyMale'), female: t('settings.bodyFemale') } as const;
  const barOptions = BAR_OPTIONS[unit].includes(bar)
    ? BAR_OPTIONS[unit]
    : [bar, ...BAR_OPTIONS[unit]];

  const confirmSignOut = () =>
    Alert.alert(t('auth.account.signOutTitle'), t('auth.account.signOutBody'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('auth.account.signOut'),
        onPress: () => {
          signOut().catch((e) => console.warn('[auth] sign-out failed', e));
        },
      },
    ]);

  const confirmWipe = () =>
    Alert.alert(t('settings.wipeTitle'), t('settings.wipeBody'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.wipeConfirm'),
        style: 'destructive',
        onPress: () => {
          wipeDevice();
          if (account) signOut().catch((e) => console.warn('[auth] sign-out failed', e));
          router.replace('/welcome');
        },
      },
    ]);

  return (
    <Screen inTabs>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.title')}
        </Text>

        <Card style={styles.account}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <UserRound size={24} color={theme.colors.text2} strokeWidth={1.8} />
            </View>
            <View style={styles.accountText}>
              <Text style={styles.accountName} numberOfLines={1}>
                {account ? (account.name ?? account.email ?? providerName) : t('settings.guest')}
              </Text>
              <Text style={styles.accountSub} numberOfLines={1}>
                {account
                  ? account.name && account.email
                    ? `${account.email} · ${providerName}`
                    : t('auth.account.linked', { provider: providerName })
                  : t('settings.guestSub')}
              </Text>
            </View>
          </View>
          {account ? null : (
            <Button
              size="sm"
              label={t('settings.linkAccount')}
              onPress={() => router.push('/account-link')}
            />
          )}
        </Card>

        <ListSection title={t('settings.groupWorkout')}>
          <ListRow
            label={t('settings.unit')}
            trailing={
              <UnitSwitch value={unit} onChange={s.setWeightUnit} label={t('settings.unit')} />
            }
          />
          <ListRow
            label={t('settings.barWeight')}
            value={weight(bar)}
            onPress={() =>
              choose(t('settings.barWeight'), barOptions, bar, weight, (v) =>
                s.setBarWeight(unit, v),
              )
            }
          />
          <ListRow label={t('settings.plates')} onPress={() => router.push('/settings/plates')} />
          <ListRow
            label={t('settings.dumbbell')}
            value={dumbbellLabel[s.dumbbellMode]}
            onPress={() =>
              choose(
                t('settings.dumbbell'),
                ['single', 'pair'] as const,
                s.dumbbellMode,
                (v) => dumbbellLabel[v],
                s.setDumbbellMode,
              )
            }
          />
          <ListRow
            label={t('settings.defaultRest')}
            value={t('settings.seconds', { count: s.defaultRestSec })}
            onPress={() =>
              choose(
                t('settings.defaultRest'),
                REST_OPTIONS,
                s.defaultRestSec,
                (v) => t('settings.seconds', { count: v }),
                s.setDefaultRestSec,
              )
            }
          />
          <ListRow
            label={t('settings.advanced')}
            trailing={
              <Toggle
                value={s.advancedLogging}
                onValueChange={s.setAdvancedLogging}
                accessibilityLabel={t('settings.advanced')}
              />
            }
          />
          <ListRow
            label={t('settings.keepAwake')}
            trailing={
              <Toggle
                value={s.keepAwake}
                onValueChange={s.setKeepAwake}
                accessibilityLabel={t('settings.keepAwake')}
              />
            }
          />
        </ListSection>

        <ListSection title={t('settings.groupDisplay')}>
          <ListRow
            label={t('settings.theme')}
            value={themeLabel[s.themePreference]}
            onPress={() =>
              choose(
                t('settings.theme'),
                ['system', 'light', 'dark'] as const,
                s.themePreference,
                (v) => themeLabel[v],
                s.setThemePreference,
              )
            }
          />
          <ListRow
            label={t('settings.accent')}
            trailing={
              <View style={styles.swatches}>
                {ACCENTS.map((a) => (
                  <Pressable
                    key={a}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: s.accent === a }}
                    accessibilityLabel={t('settings.accentA11y', { name: accentLabel[a] })}
                    onPress={() => s.setAccent(a)}
                    style={[styles.swatch, s.accent === a && styles.swatchOn]}
                  >
                    <View
                      style={[
                        styles.swatchFill,
                        { backgroundColor: themes[`${a}-${theme.mode}`].colors.accent },
                      ]}
                    />
                  </Pressable>
                ))}
              </View>
            }
          />
          <ListRow
            label={t('settings.language')}
            value={langLabel[s.language]}
            onPress={() =>
              choose(
                t('settings.language'),
                ['system', 'ko', 'en'] as const,
                s.language,
                (v) => langLabel[v],
                s.setLanguage,
              )
            }
          />
        </ListSection>

        <ListSection title={t('settings.groupPersonal')}>
          <ListRow
            label={t('settings.redoProfile')}
            onPress={() => router.push({ pathname: '/onboarding', params: { redo: '1' } })}
          />
          <ListRow
            label={t('settings.bodyType')}
            value={bodyLabel[bodyType]}
            onPress={() =>
              choose(
                t('settings.bodyType'),
                ['male', 'female'] as const,
                bodyType,
                (v) => bodyLabel[v],
                setBodyType,
              )
            }
          />
        </ListSection>

        {account ? (
          <ListSection title={t('auth.account.group')}>
            <ListRow label={t('auth.account.signOut')} onPress={confirmSignOut} />
            <ListRow
              label={t('auth.account.delete')}
              destructive
              onPress={() => router.push('/account-delete')}
            />
          </ListSection>
        ) : null}

        <ListSection title={t('settings.groupInfo')}>
          <ListRow label={t('settings.version')} value={Constants.expoConfig?.version ?? ''} />
        </ListSection>

        <Pressable
          accessibilityRole="button"
          onPress={confirmWipe}
          style={({ pressed }) => [styles.wipe, pressed && styles.pressed]}
        >
          <Text style={styles.wipeText}>{t('settings.wipe')}</Text>
        </Pressable>
      </View>

      <ActionSheet
        visible={sheet !== null}
        title={sheet?.title}
        actions={sheet?.actions ?? []}
        cancelLabel={t('settings.cancel')}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function UnitSwitch({
  value,
  onChange,
  label,
}: {
  value: WeightUnit;
  onChange: (v: WeightUnit) => void;
  label: string;
}) {
  return (
    <View style={styles.unitTrack} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {(['kg', 'lb'] as const).map((u) => {
        const on = u === value;
        return (
          <Pressable
            key={u}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(u)}
            hitSlop={{ top: 6, bottom: 6 }}
            style={[styles.unitSeg, on && styles.unitSegOn]}
          >
            <Text style={[styles.unitText, on && styles.unitTextOn]}>{u}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: 20 },
  title: {
    paddingHorizontal: 4,
    fontSize: 26,
    lineHeight: 34,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  account: { gap: 14 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  accountText: { flex: 1, gap: 2 },
  accountName: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  accountSub: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  unitTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    backgroundColor: theme.colors.surface2,
  },
  unitSeg: {
    minWidth: 44,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitSegOn: { backgroundColor: theme.colors.accent },
  unitText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  unitTextOn: { fontFamily: theme.fonts.bold, color: theme.colors.onAccent },
  swatches: { flexDirection: 'row', gap: 2 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 3,
  },
  swatchOn: { borderColor: theme.colors.text },
  swatchFill: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  wipe: { height: 48, alignItems: 'center', justifyContent: 'center' },
  wipeText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.danger,
  },
  pressed: { opacity: 0.6 },
}));
