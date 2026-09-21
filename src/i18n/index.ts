import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/ko.js';

import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { useSettings } from '@/stores/settings';

import en from './locales/en.json';
import ko from './locales/ko.json';
import { resolveLanguage } from './resolve-language';

export const resources = { ko: { translation: ko }, en: { translation: en } } as const;

function currentLanguage() {
  return resolveLanguage(
    useSettings.getState().language,
    getLocales().map((l) => l.languageCode),
  );
}

void i18n.use(initReactI18next).init({
  resources,
  lng: currentLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// 설정에서 언어를 바꾸면 바로 반영한다.
useSettings.subscribe((state, prev) => {
  if (state.language !== prev.language) void i18n.changeLanguage(currentLanguage());
});

export default i18n;
