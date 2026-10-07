import { Redirect, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Card, ConfirmDialog, NoticeDialog, Screen, TopBar } from '@/components/ui';
import { openLegal } from '@/lib/links';
import { useAuth } from '@/stores/auth';

const INFO = ['what', 'why', 'until', 'where'] as const;

type Props = {
  /** 문구 묶음. 두 묶음은 같은 키를 갖는다 */
  ns: 'dietBackup' | 'bodyBackup';
  /** 동의한 시각. null이면 아직 동의하지 않았다 */
  acceptedAt: number | null;
  /** 서버에 동의를 적거나 거둔다. 실패하면 던진다 */
  onChange: (accepted: boolean) => Promise<void>;
  /** '기기에만 둘게요' — 안내 카드를 접는다 */
  onDismiss: () => void;
};

/**
 * 건강 데이터 백업 동의 화면(식단 · 체성분이 같이 쓴다): 무엇을 왜 언제까지 어디에 보관하는지 알리고 동의를 받는다.
 * 동의한 뒤에는 같은 화면에서 그만할 수 있다. 동의하지 않아도 기능은 그대로 쓴다(기록은 기기에만).
 */
export function BackupConsentScreen({ ns, acceptedAt, onChange, onDismiss }: Props) {
  const { t, i18n } = useTranslation();
  const { theme } = useUnistyles();
  const signedIn = useAuth((a) => a.session !== null);
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
      await onChange(accepted);
    } catch (e) {
      console.warn('[consent] failed', e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const keepOnDevice = () => {
    onDismiss();
    router.back();
  };

  return (
    <Screen
      header={<TopBar title={t(`${ns}.title`)} />}
      footer={
        on ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => setStopAsk(true)}
            style={({ pressed }) => [styles.stop, (pressed || busy) && styles.dim]}
          >
            <Text style={styles.stopText}>{t(`${ns}.stop`)}</Text>
          </Pressable>
        ) : (
          <>
            <Button label={t(`${ns}.accept`)} disabled={busy} onPress={() => void change(true)} />
            <Button
              label={t(`${ns}.keepOnDevice`)}
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
            <Text style={styles.statusTitle}>{t(`${ns}.onTitle`)}</Text>
            <Text style={styles.statusSub}>
              {t(`${ns}.onSince`, { date: dateFmt.format(new Date(acceptedAt)) })}
            </Text>
          </View>
        </Card>
      ) : (
        <View style={styles.lead}>
          <Text style={styles.heading} accessibilityRole="header">
            {t(`${ns}.heading`)}
          </Text>
          <Text style={styles.sub}>{t(`${ns}.sub`)}</Text>
        </View>
      )}

      <Card padding="none" style={styles.info}>
        {INFO.map((key, i) => (
          <View key={key} style={[styles.infoRow, i < INFO.length - 1 && styles.line]}>
            <Text style={styles.infoLabel}>{t(`${ns}.info.${key}Label`)}</Text>
            <Text style={styles.infoValue}>{t(`${ns}.info.${key}`)}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.note}>{t(on ? `${ns}.noteOn` : `${ns}.noteOff`)}</Text>
      <Text
        accessibilityRole="link"
        onPress={() => void openLegal('privacy')}
        style={styles.link}
        suppressHighlighting
      >
        {t(`${ns}.privacy`)}
      </Text>

      <ConfirmDialog
        visible={stopAsk}
        title={t(`${ns}.stopTitle`)}
        body={t(`${ns}.stopBody`)}
        cancelLabel={t('diet.cancel')}
        confirmLabel={t(`${ns}.stopConfirm`)}
        destructive
        onCancel={() => setStopAsk(false)}
        onConfirm={() => {
          setStopAsk(false);
          void change(false);
        }}
      />
      <NoticeDialog
        visible={failed}
        title={t(`${ns}.failedTitle`)}
        body={t(`${ns}.failedBody`)}
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
