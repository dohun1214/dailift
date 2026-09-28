import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Platform } from 'react-native';
import { LEGAL_BASE_URL, SUPPORT_EMAIL } from '@/config';
import i18n from '@/i18n';

export type LegalPage = 'terms' | 'privacy' | 'delete-account';

/** 페이지는 한국어 본문 뒤에 영어(#en)가 이어진다. 한국어가 아니면 영어 부분으로 바로 간다. */
export function legalUrl(page: LegalPage, lang = i18n.language): string {
  return `${LEGAL_BASE_URL}/${page}.html${lang?.startsWith('ko') ? '' : '#en'}`;
}

export function openLegal(page: LegalPage) {
  return openUrl(legalUrl(page));
}

export async function openUrl(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url).catch(() => undefined);
  }
}

/** 문의 메일 작성 화면을 연다. 메일 앱이 없으면 주소를 보여준다. */
export async function openSupportMail() {
  const version = Constants.expoConfig?.version ?? '';
  const subject = `[Dailift] ${i18n.t('settings.contactSubject')}`;
  const body = `\n\n---\nDailift ${version} · ${Platform.OS} ${Platform.Version}`;
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(i18n.t('settings.contact'), SUPPORT_EMAIL);
  }
}
