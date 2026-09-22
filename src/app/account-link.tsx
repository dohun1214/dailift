/** 계정 연결 — 시안 25 (이메일 연결은 도메인 확보 후 추가) */
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AppleLogo, GoogleLogo } from '@/components/auth/brand-logos';
import { Button, Card, Screen, TopBar } from '@/components/ui';
import { type Provider, useSignIn } from '@/lib/use-sign-in';

export default function AccountLinkScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { signIn, busy } = useSignIn();

  const link = async (provider: Provider) => {
    if (await signIn(provider)) router.back();
  };

  return (
    <Screen
      header={<TopBar title={t('auth.link.title')} />}
      footer={
        <View style={styles.buttons}>
          {Platform.OS === 'ios' ? (
            <Button
              label={t('auth.link.apple')}
              leading={<AppleLogo color={theme.colors.onAccent} />}
              disabled={busy !== null}
              onPress={() => link('apple')}
            />
          ) : null}
          <Button
            label={t('auth.link.google')}
            variant={Platform.OS === 'ios' ? 'secondary' : 'primary'}
            leading={<GoogleLogo />}
            disabled={busy !== null}
            onPress={() => link('google')}
          />
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.intro}>
          <Text style={styles.heading} accessibilityRole="header">
            {t('auth.link.heading')}
          </Text>
          <Text style={styles.sub}>{t('auth.link.sub')}</Text>
        </View>
        <Card>
          <View style={styles.list}>
            {(['b1', 'b2', 'b3'] as const).map((k) => (
              <View key={k} style={styles.item}>
                <View style={styles.icon}>
                  <Check size={16} color={theme.colors.text2} strokeWidth={2.4} />
                </View>
                <Text style={styles.itemText}>{t(`auth.link.${k}`)}</Text>
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
  buttons: { gap: 10, paddingBottom: 12 },
}));
