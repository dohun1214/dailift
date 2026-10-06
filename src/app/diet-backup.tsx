import { Redirect, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Card, ConfirmDialog, NoticeDialog, Screen, TopBar } from '@/components/ui';
import { openLegal } from '@/lib/links';
import { useAuth } from '@/stores/auth';
import { useHealthConsent } from '@/stores/health-consent';
import { setDietBackup } from '@/sync/manager';

const INFO = ['what', 'why', 'until', 'where'] as const;

/**
 * 식단 기록 백업(건강 데이터 동의): 무엇을 왜 언제까지 어디에 보관하는지 알리고 동의를 받는다.
 * 동의한 뒤에는 같은 화면에서 그만할 수 있다. 동의하지 않아도 식단 기능은 그대로 쓴다(기록은 기기에만).
 */
export default function DietBackupScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useUnistyles();
  const signedIn = useAuth((a) => a.session !== null);
  const acceptedAt = useHealthConsent((s) => s.dietAcceptedAt);
  const [busy, setBusy] = useState(false);
  const [stopAsk, setStopAsk] = useState(false);
  const [failed, setFailed] = useState(false);
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }),
    [i18n.language],
  );

  // 계정이 없으면 서버에 올라가는 것이 없어 물을 것도 없다.
  if (!signedIn) return <Redirect href="/" />;

  const on = acceptedAt !== null;

  const change = async (accepted: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await setDietBackup(accepted);
    } catch (e) {
      console.warn('[consent] failed', e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const keepOnDevice = () => {
    useHealthConsent.getState().dismissDietAsk();
    router.back();
  };

  return (
    <Screen
      header={<TopBar title={t('dietBackup.title')} />}
      footer={
        on ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => setStopAsk(true)}
            style={({ pressed }) => [styles.stop, (pressed || busy) && styles.dim]}
          >
            <Text style={styles.stopText}>{t('dietBackup.stop')}</Text>
          </Pressable>
        ) : (
          <>
            <Button
              label={t('dietBackup.accept')}
              disabled={busy}
              onPress={() => void change(true)}
            />
            <Button
              label={t('dietBackup.keepOnDevice')}
              variant="ghost"
              size="sm"
              disabled={busy}
              onPress={keepOnDevice}
            />
          </>
        )
      }
    >
      {on ? (
        <Card style={styles.status}>
          <View style={styles.statusIcon}>
            <Check size={18} strokeWidth={2.6} color={theme.colors.onAccent} />
          </View>
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>{t('dietBackup.onTitle')}</Text>
            <Text style={styles.statusSub}>
              {t('dietBackup.onSince', { date: dateFmt.format(new Date(acceptedAt)) })}
            </Text>
          </View>
        </Card>
      ) : (
        <View style={styles.lead}>
          <Text style={styles.heading} accessibilityRole="header">
            {t('dietBackup.heading')}
          </Text>
          <Text style={styles.sub}>{t('dietBackup.sub')}</Text>
        </View>
      )}

      <Card padding="none" style={styles.info}>
        {INFO.map((key, i) => (
          <View key={key} style={[styles.infoRow, i < INFO.length - 1 && styles.line]}>
            <Text style={styles.infoLabel}>{t(`dietBackup.info.${key}Label`)}</Text>
            <Text style={styles.infoValue}>{t(`dietBackup.info.${key}`)}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.note}>{t(on ? 'dietBackup.noteOn' : 'dietBackup.noteOff')}</Text>
      <Text
        accessibilityRole="link"
        onPress={() => void openLegal('privacy')}
        style={styles.link}
        suppressHighlighting
      >
        {t('dietBackup.privacy')}
      </Text>

      <ConfirmDialog
        visible={stopAsk}
        title={t('dietBackup.stopTitle')}
        body={t('dietBackup.stopBody')}
        cancelLabel={t('diet.cancel')}
        confirmLabel={t('dietBackup.stopConfirm')}
        destructive
        onCancel={() => setStopAsk(false)}
        onConfirm={() => {
          setStopAsk(false);
          void change(false);
        }}
      />
      <NoticeDialog
        visible={failed}
        title={t('dietBackup.failedTitle')}
        body={t('dietBackup.failedBody')}
        okLabel={t('common.ok')}
        onClose={() => setFailed(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  dim: { opacity: 0.6 },
  lead: { gap: 8, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
  heading: {
    fontSize: 24,
    lineHeight: 31,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  sub: {
    fontSize: 14,
    lineHeight: 21.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  statusText: { flex: 1, minWidth: 0, gap: 2 },
  statusTitle: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  statusSub: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  info: { paddingVertical: 4, paddingHorizontal: 18 },
  infoRow: { gap: 3, paddingVertical: 13 },
  line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  infoLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  infoValue: {
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  note: {
    paddingHorizontal: 6,
    fontSize: 13,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  link: {
    alignSelf: 'flex-start',
    padding: 6,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    textDecorationLine: 'underline',
    color: theme.colors.text,
  },
  stop: {
    height: 56,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  stopText: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.danger,
  },
}));
