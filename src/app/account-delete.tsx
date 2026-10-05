/** 계정 삭제 — 시안 27 */
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useExportSheet } from '@/components/export-sheet';
import { Button, Card, ConfirmDialog, Screen, TopBar } from '@/components/ui';
import { deleteAccount } from '@/lib/auth';
import { wipeDevice } from '@/lib/wipe-device';
import { pauseSync, resumeSync } from '@/sync/manager';

export default function AccountDeleteScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const exportSheet = useExportSheet();

  const remove = async () => {
    setAsking(false);
    setBusy(true);
    try {
      // 지우는 동안에는 동기화를 멈춘다(지운 뒤에 기록을 다시 올리거나 채우지 않게).
      await pauseSync();
      await deleteAccount();
      wipeDevice();
      router.dismissAll();
      router.replace('/welcome');
    } catch (e) {
      console.warn('[auth] delete failed', e);
      Alert.alert(t('auth.delete.failedTitle'), t('auth.delete.failed'));
      setBusy(false);
    } finally {
      resumeSync();
    }
  };

  return (
    <Screen
      header={<TopBar title={t('auth.delete.title')} />}
      footer={
        <View style={styles.footer}>
          <Button
            label={t(busy ? 'auth.delete.deleting' : 'auth.delete.confirm')}
            variant="danger"
            disabled={busy}
            onPress={() => setAsking(true)}
          />
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.intro}>
          <Text style={styles.heading} accessibilityRole="header">
            {t('auth.delete.heading')}
          </Text>
          <Text style={styles.sub}>{t('auth.delete.sub')}</Text>
        </View>
        <Card>
          <View style={styles.list}>
            {(['b1', 'b2', 'b3'] as const).map((k) => (
              <View key={k} style={styles.item}>
                <View style={styles.icon}>
                  <X size={16} color={theme.colors.danger} strokeWidth={2.4} />
                </View>
                <Text style={styles.itemText}>{t(`auth.delete.${k}`)}</Text>
              </View>
            ))}
          </View>
        </Card>
        <Button
          size="md"
          variant="secondary"
          label={t('auth.delete.exportFirst')}
          disabled={busy}
          onPress={exportSheet.open}
        />
      </View>
      {exportSheet.sheet}
      <ConfirmDialog
        visible={asking}
        title={t('auth.delete.confirmTitle')}
        body={t('auth.delete.confirmBody')}
        cancelLabel={t('settings.cancel')}
        confirmLabel={t('auth.delete.confirmAction')}
        destructive
        onCancel={() => setAsking(false)}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: 16, paddingTop: 16 },
  intro: { gap: 8, paddingHorizontal: 4 },
  heading: {
    fontSize: 24,
    lineHeight: 31,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  sub: {
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  list: { gap: 10 },
  item: { flexDirection: 'row', gap: 10 },
  icon: { paddingTop: 2 },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  footer: { paddingBottom: 12 },
}));
