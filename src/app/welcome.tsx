/** 시작 화면 — 시안 01 로그인 (이메일 로그인은 도메인 확보 후 추가) */
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AppleLogo, GoogleLogo } from '@/components/auth/brand-logos';
import { Button, ConsentCheck } from '@/components/ui';
import { type Provider, useSignIn } from '@/lib/use-sign-in';
import { useProfile } from '@/stores/profile';

export default function Welcome() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const acceptConsent = useProfile((s) => s.acceptConsent);
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const agreed = terms && age;

  const proceed = () => {
    acceptConsent();
    router.replace('/onboarding');
  };
  const { signIn, busy } = useSignIn();
  // 로그인해도 기록은 이 기기에 먼저 쌓인다(서버 동기화는 #15). 온보딩은 똑같이 거친다.
  const startWith = async (provider: Provider) => {
    if (await signIn(provider)) proceed();
  };

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
            disabled={!agreed || busy !== null}
            onPress={() => startWith('apple')}
          />
        ) : null}
        <Button
          label={t('welcome.google')}
          variant="secondary"
          leading={<GoogleLogo />}
          disabled={!agreed || busy !== null}
          onPress={() => startWith('google')}
        />
        <Button
          label={t('welcome.guest')}
          variant="ghost"
          size="sm"
          disabled={!agreed || busy !== null}
          onPress={proceed}
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
