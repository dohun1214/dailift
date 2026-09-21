export type AppLanguage = 'ko' | 'en';

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['ko', 'en'];

/** 설정값이 'system'이면 기기 언어 목록에서 지원하는 첫 언어를 고르고, 없으면 영어를 쓴다. */
export function resolveLanguage(
  preference: 'system' | AppLanguage,
  deviceLanguages: readonly (string | null | undefined)[],
): AppLanguage {
  if (preference !== 'system') return preference;
  for (const code of deviceLanguages) {
    const match = SUPPORTED_LANGUAGES.find((l) => l === code);
    if (match) return match;
  }
  return 'en';
}
