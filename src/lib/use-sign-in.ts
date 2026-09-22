import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { googleConfigured, signInWithApple, signInWithGoogle } from './auth';

export type Provider = 'google' | 'apple';

/** 로그인 버튼 공용: 진행 중 표시, 취소는 조용히, 실패는 안내. 성공하면 true. */
export function useSignIn() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<Provider | null>(null);

  const signIn = async (provider: Provider): Promise<boolean> => {
    if (busy) return false;
    if (provider === 'google' && !googleConfigured()) {
      Alert.alert(t('auth.googleSoonTitle'), t('auth.googleSoon'));
      return false;
    }
    setBusy(provider);
    try {
      const result = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
      return result === 'ok';
    } catch (e) {
      console.warn('[auth] sign-in failed', e);
      Alert.alert(t('auth.failedTitle'), t('auth.failed'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { signIn, busy };
}
