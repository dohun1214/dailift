import type { AppLanguage } from '@/i18n/resolve-language';

type Named = {
  isCustom: number;
  name: string | null;
  nameKo: string | null;
  nameEn: string | null;
};

/** 종목 표시 이름. 커스텀 종목은 사용자가 입력한 이름, 기본 종목은 언어별 이름. */
export function exerciseName(e: Named, lang: AppLanguage): string {
  if (e.isCustom) return e.name ?? '';
  return (lang === 'ko' ? e.nameKo : e.nameEn) ?? e.nameEn ?? e.nameKo ?? '';
}
