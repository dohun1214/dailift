/**
 * 앱에 들어가는 공개 설정값. 비밀 키(서비스 롤 키, OAuth 클라이언트 보안 비밀)는 절대 넣지 않는다.
 */
export const SUPABASE_URL = 'https://kszdqhhvozdumfjhrovl.supabase.co';
/** Supabase publishable key (공개용, RLS로 보호) */
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JUZHDdEhOYEifRIrmqyfkw_pUFXE9Oi';

/** Google Cloud OAuth 클라이언트 ID. 비어 있으면 Google 로그인 버튼은 안내만 띄운다. */
export const GOOGLE_WEB_CLIENT_ID: string =
  '85791918223-vsrbi4duhqj1u96m339mj7rcn2iu9mq4.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID: string =
  '85791918223-tccvuepnbqg684npigc9m67hu8nteknq.apps.googleusercontent.com';

/** 이용약관·개인정보 처리방침·계정 삭제 안내 페이지 (GitHub Pages, gh-pages 브랜치) */
export const LEGAL_BASE_URL = 'https://dohun1214.github.io/dailift';
/** 문의 메일 */
export const SUPPORT_EMAIL = 'dhp137qkr@gmail.com';
