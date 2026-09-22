import { useTranslation } from 'react-i18next';

import type { AppLanguage } from './resolve-language';

/** 지금 화면에 쓰이는 언어 (ko | en). 언어가 바뀌면 리렌더된다. */
export function useAppLanguage(): AppLanguage {
  const { i18n } = useTranslation();
  return i18n.language === 'ko' ? 'ko' : 'en';
}
