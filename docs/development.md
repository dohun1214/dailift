# 개발 가이드

## 스택
- Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript strict (`noUncheckedIndexedAccess`)
- 라우팅: expo-router (`src/app`), 하단 탭은 `expo-router/ui`의 headless Tabs로 직접 그림
- 스타일: react-native-unistyles 3 — 테마 6개(`mono|blue|lime` × `light|dark`), 토큰은 `src/theme/tokens.ts`
- 상태: zustand (+ `expo-sqlite/kv-store` persist) — 설정은 `src/stores/settings.ts`
- 다국어: i18next + react-i18next, 리소스는 `src/i18n/locales/{ko,en}.json` (키 구조가 같아야 테스트 통과)
- 아이콘: lucide-react-native
- 품질: Biome(린트·포맷), Jest(jest-expo), GitHub Actions CI

## 명령
```bash
npm run android      # Android 에뮬레이터 (dev build 필요)
npm run lint         # biome check .
npm run lint:fix
npm run typecheck    # tsc --noEmit
npm test
```

## 규칙
- 색·간격은 토큰만 쓴다. 화면 코드에 hex 값을 직접 쓰지 않는다.
- 새 문자열은 반드시 ko/en 두 파일에 같이 넣는다.
- 순수 로직(계산·파서·동기화)은 `__tests__`에 단위 테스트를 둔다.
- 브랜치 `feat/<이슈번호>-<slug>` → PR → squash merge. 커밋은 한국어 conventional commits (`feat:`, `fix:`, `chore:` …).

## 에뮬레이터 실행
1. AVD 실행 후 부팅 완료까지 기다린다.
2. 네이티브 의존성이 바뀌었을 때만 `npx expo run:android --no-bundler` (ANDROID_HOME 지정 필요).
3. `npx expo start --dev-client` → `adb reverse tcp:8081 tcp:8081` → 앱에서 `localhost:8081`로 연결.
4. 다크 모드 확인: `adb shell cmd uimode night yes|no`.

## 알아둘 것
- expo-router headless Tabs: `TabList`는 `Tabs`의 직계 자식이어야 한다. `TabTrigger asChild`는 자식에 `flexDirection: row`를 함수 스타일로 넘기므로 자식 스타일을 뒤에 합친다.
- 서드파티 컴포넌트(TabList 등)는 Unistyles가 네이티브로 갱신하지 못한다 → `useUnistyles()`로 리렌더.

## 로컬 DB
- expo-sqlite + drizzle-orm. 스키마 `src/db/schema.ts`, 클라이언트 `src/db/client.ts`, 앱 시작 시 `DatabaseProvider`가 마이그레이션 → 참조 데이터 시드 후 화면을 그린다.
- 스키마를 바꾸면 `npx drizzle-kit generate --name <이름>`으로 `drizzle/` 마이그레이션을 만든다(생성 파일은 직접 수정하지 않는다).
- 사용자 데이터 행은 모두 동기화 컬럼을 가진다: `id`(UUIDv7, `newId()`), `created_at`/`updated_at`(ms), `deleted_at`(툼스톤), `dirty`(1 = 서버로 보낼 변경). 삭제는 `deleted_at`을 채우고, 조회는 `isNull(t.deletedAt)`으로 거른다.
- 외래 키 제약은 걸지 않는다(동기화 중 자식이 먼저 도착할 수 있음). 참조 무결성은 앱 로직과 인덱스로 관리한다.
- 근육(15개)과 기본 종목(34개, id `base:<key>`)은 `src/data/`가 정본이고 동기화하지 않는다. 시드는 매 실행마다 upsert라 데이터 파일만 고치면 반영된다.
- 요일은 비트마스크(월=bit0 … 일=bit6), `src/lib/weekdays.ts`.
- 무게는 입력한 단위 그대로(`weight` + `weight_unit`) 저장한다.
- DB 테스트는 better-sqlite3 인메모리 DB에 같은 마이그레이션을 적용해서 돌린다(`src/db/__tests__`).

## 폰트·텍스트
- 모든 글자는 IBM Plex Sans KR, 숫자(`AppText numeric`)와 워드마크는 Onest. `src/theme/use-app-fonts.ts`가 스플래시 동안 로드한다(실패해도 앱은 뜬다).
- 굵기는 `fontWeight` 대신 `fontFamily: theme.fonts.{regular|medium|semibold|bold|numRegular…}`로 지정한다(Android는 fontWeight로 굵기 파일을 못 고른다).
- 모든 텍스트 스타일에 `lineHeight`(시안에 없으면 글자 크기 × 1.3 반올림)와 `includeFontPadding: false`를 준다. 안 주면 Plex KR 메트릭 때문에 카드 높이가 시안보다 30% 가까이 커진다.
- Button 크기: lg 56 · md 52 · sm 48 · xs 44, 반경 20, 라벨 16 bold. 로고는 `leading` prop.

## 온보딩·프로필
- 첫 실행: `(tabs)/_layout`이 약관 미동의 → `/welcome`, 온보딩 미완료 → `/onboarding`으로 Redirect.
- 프로필은 `src/stores/profile.ts`(zustand persist, 동기 kv-store `src/lib/kv-storage.ts` — 첫 렌더에 기본값이 번쩍이지 않는다). 추천 로직은 `src/domain/profile.ts`(순수 함수, 단위 테스트).
- 무게 단위 기본값은 기기 측정 체계(`us` → lb, 그 외 kg). 소수점 입력은 `parseDecimal`(쉼표 허용).
- 바디 그림은 `BodyFigure`(react-native-body-highlighter). 라이브러리 에셋에 기본색이 박혀 있어서 모든 slug에 `styles.fill`을 명시해야 테마 트랙색으로 칠해진다.
