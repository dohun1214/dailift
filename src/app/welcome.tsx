/** 시작 화면 — 시안 01 로그인 */
import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AppleLogo, GoogleLogo } from '@/components/auth/brand-logos';
import { Button, ConsentCheck } from '@/components/ui';
import { useProfile } from '@/stores/profile';

export default function Welcome() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const acceptConsent = useProfile((s) => s.acceptConsent);
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const agreed = terms && age;

  const startAsGuest = () => {
    acceptConsent();
    router.replace('/onboarding');
  };
  // 계정 로그인은 이슈 #14에서 연결한다.
  const authSoon = () => Alert.alert(t('welcome.authSoonTitle'), t('welcome.authSoonBody'));

  return (
    <View style={[styles.root, { paddingBottom: 28 + insets.bottom }]}>
      <View style={styles.hero}>
        <Text style={styles.wordmark} accessibilityRole="header">
          Dailift
        </Text>
        <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
      </View>
      <View style={styles.actions}>
        {Platform.OS === 'ios' ? (
          <Button
            label={t('welcome.apple')}
            leading={<AppleLogo color={theme.colors.onAccent} />}
            disabled={!agreed}
            onPress={authSoon}
          />
        ) : null}
        <Button
          label={t('welcome.google')}
          variant="secondary"
          leading={<GoogleLogo />}
          disabled={!agreed}
          onPress={authSoon}
        />
        <Button
          label={t('welcome.email')}
          variant="secondary"
          icon={Mail}
          disabled={!agreed}
          onPress={authSoon}
        />
        <Button
          label={t('welcome.guest')}
          variant="ghost"
          size="sm"
          disabled={!agreed}
          onPress={startAsGuest}
        />
        <Text style={styles.note}>{t('welcome.guestNote')}</Text>
        <View>
          <ConsentCheck label={t('welcome.agreeTerms')} checked={terms} onChange={setTerms} />
          <ConsentCheck label={t('welcome.agreeAge')} checked={age} onChange={setAge} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    paddingTop: 96,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.bg,
  },
  hero: { flex: 1, gap: 12 },
  wordmark: {
    fontSize: 40,
    lineHeight: 52,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    letterSpacing: -1.2,
    color: theme.colors.text,
  },
  tagline: {
    fontSize: 17,
    includeFontPadding: false,
    lineHeight: 25.5,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  actions: { gap: 10 },
  note: {
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 18,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
