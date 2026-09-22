/** Google · Apple 로그인, 로그아웃, 계정 삭제. 게스트 기록은 기기에 그대로 둔다(동기화는 #15). */
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/config';
import { useAuth } from '@/stores/auth';

import { supabase } from './supabase';

export type SignInResult = 'ok' | 'cancelled';

let started = false;

/** 앱 시작 때 한 번: 저장된 세션을 읽고 이후 변화를 구독한다. */
export function startAuth() {
  if (started) return;
  started = true;
  if (GOOGLE_WEB_CLIENT_ID) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    });
  }
  supabase.auth
    .getSession()
    .then(({ data }) => useAuth.getState().setSession(data.session))
    .catch(() => useAuth.getState().setSession(null));
  supabase.auth.onAuthStateChange((_event, session) => useAuth.getState().setSession(session));
}

export const googleConfigured = () => GOOGLE_WEB_CLIENT_ID !== '';

export async function signInWithGoogle(): Promise<SignInResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return 'cancelled';
    const token = res.data.idToken;
    if (!token) throw new Error('no id token');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw error;
    return 'ok';
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return 'cancelled';
    throw e;
  }
}

export async function signInWithApple(): Promise<SignInResult> {
  const rawNonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
    if (!credential.identityToken) throw new Error('no identity token');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;
    // Apple은 이름을 첫 로그인 때만 준다 → 사용자 정보에 남겨 둔다.
    const { givenName, familyName } = credential.fullName ?? {};
    const fullName = [givenName, familyName].filter(Boolean).join(' ');
    if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } });
    return 'ok';
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    throw e;
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  if (googleConfigured()) await GoogleSignin.signOut().catch(() => null);
}

/** 서버의 계정을 지운다(Edge Function `delete-account`). 로컬 정리는 호출한 쪽에서. */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
  if (googleConfigured()) await GoogleSignin.revokeAccess().catch(() => null);
}
