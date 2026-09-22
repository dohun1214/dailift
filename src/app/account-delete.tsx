/** 계정 삭제 — 시안 27 ('먼저 내 데이터 내보내기'는 #16에서) */
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Card, Screen, TopBar } from '@/components/ui';
import { deleteAccount } from '@/lib/auth';
import { wipeDevice } from '@/lib/wipe-device';

export default function AccountDeleteScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      wipeDevice();
      router.dismissAll();
      router.replace('/welcome');
    } catch (e) {
      console.warn('[auth] delete failed', e);
      Alert.alert(t('auth.delete.failedTitle'), t('auth.delete.failed'));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<TopBar title={t('auth.delete.title')} />}
      footer={
        <View style={styles.footer}>
          <Button
            label={t('auth.delete.confirm')}
            variant="danger"
            disabled={busy}
            onPress={remove}
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
      </View>
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
