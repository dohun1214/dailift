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

## 루틴
- 추천 루틴 데이터는 `src/data/templates.ts`(코드가 원본, 복사하면 묶음째 DB로). 복사·복제는 `src/db/routines.ts`, 편집 저장·삭제·커스텀 종목은 `src/db/routine-editor.ts`.
- 화면은 DB를 `useLiveQuery`(drizzle expo-sqlite)로 읽는다: `use-routine-sections.ts`, `use-exercise-catalog.ts`. 쓰기 후 따로 새로고침할 필요 없다.
- 편집 화면은 초안(`src/domain/routine-draft.ts`)을 로컬 상태로 들고 있다가 저장할 때 한 트랜잭션으로 반영한다(빠진 종목은 툼스톤, position 재부여). 이탈 확인은 `usePreventRemove`(`expo-router/react-navigation`).
- 화면 사이 결과 전달(편집 → 종목 검색 → 종목 만들기)은 `src/stores/exercise-picker.ts`의 일회용 콜백.
- 종목 검색은 `matchesSearch`(`src/lib/hangul.ts`) — 초성과 완성 글자를 섞어도 된다.
- 드래그 순서 변경은 gesture-handler Pan + reanimated(`exercise-edit-list.tsx`), 밀어서 삭제는 `ReanimatedSwipeable`. 루트에 `GestureHandlerRootView`가 있다.
- 번역 복수형: 영어는 `_one`/`_other`, 한국어는 `_other`만. 키 비교 테스트는 복수형 접미사를 떼고 비교한다.

## 운동 중
- 화면 `src/app/workout.tsx`(진행 중 운동은 항상 하나). 접으면 탭 위 `WorkoutMiniBar`, 앱을 다시 켜면 `(tabs)/_layout`이 이어하기/버리기를 묻는다.
- 시작·세트·교체·완료·버리기는 `src/db/workout.ts`. 시작할 때 지난 기록 + 증량 제안으로 세트를 프리필하고(완료 체크 전까지는 기록 아님), 부위별 첫 바벨 종목에 워밍업을 붙인다.
- 계산은 `src/domain/strength.ts`(Epley e1RM 1–12회, 더블 프로그레션, 워밍업, PR = 최고 중량 또는 e1RM 돌파·첫 기록 제외, kg 환산 비교).
- 휴식 타이머는 끝나는 시각 기준(`src/stores/rest-timer.ts`, kv-store에 저장). 앱이 켜져 있으면 `useRestTimerAlarm`(루트)이 진동, 백그라운드면 예약한 로컬 알림(`src/lib/notifications.ts`, 채널 `rest-timer`)이 울린다. 알림 권한은 첫 휴식 때 요청.
- 화면 꺼짐 방지는 설정 `keepAwake`(기본 켬). 네이티브 모듈: expo-notifications, expo-keep-awake, expo-haptics.
- 안드로이드에서 둥근 모서리 뷰는 자식을 잘라낸다 → 칸 밖으로 나가는 배지는 감싸는 뷰에 둔다.

## 세션 요약
- 화면 `src/app/workout-summary/[id].tsx`(운동 완료 직후·히스토리 공용, "완료"는 뒤로 갈 곳이 있으면 back). 데이터는 `src/db/summary.ts`의 `loadSummary`(완료 세트·근육·이 운동 전까지의 최고 기록).
- 계산은 `src/domain/session-summary.ts`: 볼륨은 본세트 무게×횟수(표시 단위로 환산), 근육 점수는 주동 1 · 협응 0.5, 단계는 최대 대비 ⅔ 이상 집중 · ⅓ 이상 주요 · 나머지 보조(근육맵 투명도 1 / 0.6 / 0.3).
- 메모는 입력을 멈추고 0.5초 뒤·화면을 떠날 때 저장. 사진은 expo-image-picker로 고르거나 찍어 앱 폴더(documentDirectory/photos)에 복사하고 `workout_photos`에 상대 경로를 저장한다(서버 동기화 안 함). 길게 눌러 삭제.

## 히스토리
- 기록 탭 `src/app/(tabs)/log.tsx`: 히스토리 | 통계 세그먼트. 목록은 `useHistory`(완료 운동 + 완료 세트 live) → `buildHistory`(오래된 순으로 최고 기록을 쌓아 세션별 PR 개수 계산, 요약 화면과 같은 기준) → `groupByMonth`.
- 행을 누르면 요약(`/workout-summary/[id]`), 길게 누르면 수정·삭제 시트. 수정(`/workout-edit/[id]`)은 바꾸는 즉시 저장, 새 세트는 바로 완료 상태, 나갈 때 `cleanupRecordedWorkout`로 완료 해제 세트·빈 종목 정리. 삭제는 툼스톤 + 사진 파일 삭제.

## 통계
- 기록 탭 '통계' = `src/components/stats/stats-view.tsx`, 데이터는 `useStatsData`(완료 본세트 전체 + 종목→부위). 계산은 `src/domain/stats.ts`.
- 진행도: 지난 7일 vs 그 전 7일 총 볼륨·세트(증감 색·화살표 없음). 밸런스: 세트가 부위의 주동근을 쓰면 1, 협응근만 쓰면 0.5(세트당 부위별 한 번), 권장 범위는 `weeklySetRange(경험)`, 벗어나면 주황.
- 추정 1RM: 세션별 최고 Epley → 8주 주별 최고, 기본 종목은 8주간 가장 자주 한 종목. 정체: 최근 4–6회·3주 이상 최소제곱 기울기 ≤ 0.
- 한국어 조사는 `src/lib/josa.ts`(은/는).

## 종목 상세
- `src/app/exercise/[id].tsx`(id 예: `base:bench_press`). 진입: 운동 중 카드의 종목 이름 탭, 종목 검색에서 길게 누르기.
- 동작 5단계 설명은 `src/data/exercise-guides.ts`(기본 34종 한/영, 테스트로 누락 검사). 커스텀 종목은 설명 없음.
- 미니 근육맵은 주동근이 뒤쪽 근육(광배·승모·허리·둔근·햄스트링·종아리·삼두)에 많으면 뒷모습. 내 기록은 전체 최고 추정 1RM + 최고 중량 세트 + 최근 12회 세션 추이.
- 포즈 이미지(시작/끝)는 시안에서도 자리만 있어 아직 없음 — 이미지 소스(라이선스) 확정 후 추가.

## 홈
- `src/app/(tabs)/index.tsx`, 계산은 `src/domain/home.ts`. 주 시작은 월요일.
- 주간 스트립(`week-strip.tsx`): 오늘 = 검정, 완료한 날 = 채움, 루틴 계획일 = 점. 오늘 루틴은 로테이션 다음 순서(`todaysRoutine`), 운동 중이면 '운동 이어하기'.
- 통계 카드: 지난 7일 운동 횟수 / 주 목표, 연속 기록(목표를 채운 연속 주). 시안의 '오늘 영양제' 카드는 M2(영양제)까지 연속 기록으로 대체.
- 최근 PR 행 → 해당 세션 요약. 상대 날짜는 i18n `relative.*`(Hermes에 `Intl.RelativeTimeFormat` 없음).

## 설정 · 원판 계산기
- 내 정보 탭 `src/app/(tabs)/me.tsx`. 값은 `stores/settings.ts`(단위·바 무게·보유 원판(단위별)·덤벨 표기·기본 휴식·고급 기록·화면 켜두기·테마·포인트 색·언어)와 `stores/profile.ts`(근육맵 바디).
- 바 무게는 워밍업 첫 단계(빈 바)에, 기본 휴식은 루틴 편집·운동 중에 새로 추가하는 종목에 쓰인다(`workoutDefaults()`). 덤벨 표기는 운동 중 무게 컬럼 제목만 바꾼다.
- 고급 기록을 켜면 운동 중 세트 번호를 눌러 세트 종류(본·워밍업·드롭·실패)와 RPE(6–10)를 고른다. 드롭 D, 실패 F로 표시.
- 원판 계산기 `src/app/plate-calculator.tsx`(`?weight=&unit=`), 운동 중 바벨 종목 카드의 원판 버튼에서 연다. 계산은 `src/domain/plates.ts`: 1/100 단위 정수 DP로 원판 개수가 가장 적은 조합, 못 맞추면 가장 가까운 무게(같으면 가벼운 쪽).
- 보유 원판 `src/app/settings/plates.tsx`. 모든 데이터 삭제는 `db/wipe.ts`(참조 데이터는 남김) + 사진 파일 + 스토어 초기화 → 시작 화면.
- 시안의 기록(체성분·눈바디)·알림·데이터(동기화·건강 데이터·내보내기)·약관 등 행은 해당 이슈(M2, #14–#17)에서 추가.
