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
- 루틴 목록(#55): 카드를 꾹 누르면 앱 디자인 시트(운동 시작 / 복제 / 삭제), 왼쪽으로 밀면 삭제 버튼. 삭제는 둘 다 확인 창을 거친다(`deleteRoutine`, 지난 기록은 남는다).
- 추천 루틴 데이터는 `src/data/templates.ts`(코드가 원본, 복사하면 묶음째 DB로). 복사·복제는 `src/db/routines.ts`, 편집 저장·삭제·커스텀 종목은 `src/db/routine-editor.ts`.
- 화면은 DB를 `useLiveQuery`(drizzle expo-sqlite)로 읽는다: `use-routine-sections.ts`, `use-exercise-catalog.ts`. 쓰기 후 따로 새로고침할 필요 없다.
- 편집 화면은 초안(`src/domain/routine-draft.ts`)을 로컬 상태로 들고 있다가 저장할 때 한 트랜잭션으로 반영한다(빠진 종목은 툼스톤, position 재부여). 이탈 확인은 `usePreventRemove`(`expo-router/react-navigation`).
- 화면 사이 결과 전달(편집 → 종목 검색 → 종목 만들기)은 `src/stores/exercise-picker.ts`의 일회용 콜백.
- 종목 검색은 `matchesSearch`(`src/lib/hangul.ts`) — 초성과 완성 글자를 섞어도 된다.
- 드래그 순서 변경은 gesture-handler Pan + reanimated(`exercise-edit-list.tsx`), 밀어서 삭제는 `ReanimatedSwipeable`. 루트에 `GestureHandlerRootView`가 있다.
- 번역 복수형: 영어는 `_one`/`_other`, 한국어는 `_other`만. 키 비교 테스트는 복수형 접미사를 떼고 비교한다.

- 세트별로 정하기(#53): 종목마다 세트 수 · 횟수 범위 대신 세트 줄(무게 · 횟수, 워밍업 포함)을 적어 둘 수 있다. `routine_exercises.set_plan`(JSON `{unit, sets:[{kind, weight, reps, durationSec}]}`, null이면 범위로 정한 종목, 읽고 쓰는 곳은 `domain/set-plan.ts`). 서버 테이블에도 같은 칸이 있어 그대로 동기화된다(예전 빌드는 모르는 칸을 무시한다).
  - 편집 화면은 `components/routines/plan-editor.tsx`. 종목 줄 전체가 밀어서 삭제(Swipeable)라 세트 줄은 밀기 대신 줄 오른쪽 ✕ 버튼으로 지운다. '세트별로 정하기'를 켜면 무게는 빈칸으로 시작한다(#55).
  - 증량 단위는 화면에서 뺐다(새 종목은 kg 2.5 / lb 5, 저장돼 있던 값은 그대로 쓴다).
  - 이 루틴으로 시작하면 `planSets`가 계획을 그대로 채운다(지난 기록 · 증량 제안 · 자동 워밍업을 건너뜀). 지난번에 계획한 본 세트를 모두 채웠으면 종목 카드에 '무게를 올려 볼까요?' 안내만 띄운다(`planAchieved`).
  - 운동을 끝낼 때 `pendingRoutineUpdate`(`db/routine-update.ts`)로 루틴과 다른 점을 구한다: 세트별로 정한 종목의 세트 변경, 추가한 종목, 뺀 종목. 세트별로 정한 종목은 **세트 줄 전체(안 한 줄 포함)** 를 계획과 견준다(#55) — 세트를 일부만 하고 끝낸 것은 다른 게 아니고, 줄을 지우거나 더했을 때 · 값을 고쳤을 때만 다르다. 끝내면 안 한 세트 · 종목이 지워지므로 **끝내기 직전에** 계산해 `stores/routine-update.ts`(저장 안 함)에 둔다. 기록 화면 맨 아래 카드(`components/summary/routine-update-card.tsx`)에서 '루틴 바꾸기'를 누르면 `applyRoutineUpdate`. 목록에 남겨 두고 하나도 안 한 종목은 뺀 것으로 보지 않는다.

## 운동 중
- 메뉴(#55): 위쪽 ⋯는 종목 추가 / 종목 순서 변경 / 기록 없이 끝내기(예전 '운동 버리기'). 종목 하나에 대한 동작은 카드마다 있는 ⋯(펼친 카드는 원판 계산기 옆, 접힌 카드는 화살표 앞) → 다른 종목으로 변경 / 이 종목 빼기. 펼친 카드는 `Pressable`이라 입력칸 · 버튼이 아닌 빈 곳을 꾹 눌러도 종목 편집으로 간다.
- 아래쪽 창(`components/ui/bottom-sheet.tsx`)은 손잡이 · 제목 부분을 잡고 쓸어내려 닫을 수 있다(`PanResponder`, 80 넘게 끌거나 빠르게 튕기면 닫힘). 닿는 순간부터 잡아야 해서 `onStartShouldSetPanResponder`를 켰다(이동만으로는 Modal 안에서 잡히지 않았다).
- 화면 `src/app/workout.tsx`(진행 중 운동은 항상 하나). 접으면 탭 위 `WorkoutMiniBar`, 앱을 다시 켜면 `(tabs)/_layout`이 이어하기/버리기를 묻는다.
- 시작·세트·교체·완료·버리기는 `src/db/workout.ts`. 시작할 때 지난 기록 + 증량 제안으로 세트를 프리필하고(완료 체크 전까지는 기록 아님), 부위별 첫 바벨 종목에 워밍업을 붙인다.
- 계산은 `src/domain/strength.ts`(Epley e1RM 1–12회, 더블 프로그레션, 워밍업, PR = 최고 중량 또는 e1RM 돌파·첫 기록 제외, kg 환산 비교).
- 휴식 타이머는 끝나는 시각 기준(`src/stores/rest-timer.ts`, kv-store에 저장). 앱이 켜져 있으면 `useRestTimerAlarm`(루트)이 진동, 백그라운드면 예약한 로컬 알림(`src/lib/notifications.ts`, 채널 `rest-timer`)이 울린다. 알림 권한은 첫 휴식 때 요청.
- 화면 꺼짐 방지는 설정 `keepAwake`(기본 켬). 네이티브 모듈: expo-notifications, expo-keep-awake, expo-haptics.
- 안드로이드에서 둥근 모서리 뷰는 자식을 잘라낸다 → 칸 밖으로 나가는 배지는 감싸는 뷰에 둔다.
- 휴식이 끝나면(#41): 타이머를 바로 지우지 않고 '휴식 끝' 막대를 `REST_DONE_LINGER_MS`(1분) 동안 남긴다. 앱을 보고 있으면 진동 + 배너·소리(알림 핸들러가 포그라운드에서도 표시). 안드로이드는 예약 알림이 늦게 울릴 수 있어 앱이 켜져 있으면 `presentRestEnd`로 직접 띄운다. 확인하거나 다음 휴식이 시작되면 알림 센터의 휴식 알림을 치운다(`dismissRestNotifications`).
- 종목별 휴식 시간(#41): 카드의 휴식 칩 → `RestSheet`. `setWorkoutExerciseRest`가 이번 운동에 저장하고, '루틴에도 저장'(기본 켬)이면 같은 루틴의 그 종목에도 저장한다. 빈 운동에는 토글이 없다.
- 종목 편집(#41): ⋯ 메뉴(`WorkoutMenuSheet`) 또는 종목 카드를 꾹 누르면 편집 모드(`WorkoutEditList`). 손잡이는 바로, 행은 꾹 눌러서 끈다. 삭제는 기록한 세트가 있으면 `ConfirmDialog`로 확인. DB는 `moveWorkoutExercise`·`deleteWorkoutExercise`(소프트 삭제).
- 제스처 빌더를 함수로 감싸서 콜백을 붙이면 자동으로 워클릿이 되지 않는다 → 콜백 첫 줄에 `'worklet'`을 직접 쓴다.
- 휴식 타이머를 앱 밖에 표시(#49): 설정 `restOnLockScreen`(기본 켬). 휴식을 시작·조정할 때 `rest-timer` 스토어가 `lib/rest-live.ts`의 `showRestLive`를 부르고, 멈추거나 끝나면 `hideRestLive`.
  - 아이폰: `widgets/rest-activity.tsx`(expo-widgets Live Activity). `'widget'` 함수는 위젯 확장에서 따로 실행돼 훅·모듈 범위 값을 못 쓴다 → 문구도 props로 넘긴다. 남은 시간은 `Text timerInterval`·`ProgressView timerInterval`이 스스로 줄인다. `staleDate`를 종료 시각으로 줘서 앱이 꺼져 있어도 `environment.isStale`로 '휴식 끝'으로 바뀐다. unistyles 바벨 플러그인이 `src`만 처리하므로 위젯 파일은 `src` 밖에 둔다.
  - 안드로이드: `modules/rest-notification`(로컬 Expo 모듈, Kotlin). 크로노미터 카운트다운 + `setTimeoutAfter`로 끝나는 시각에 스스로 사라지는 조용한 진행 중 알림(채널 `rest-live`). 이 모듈이 없는 빌드에서는 `requireOptionalNativeModule`이 null이라 아무 일도 안 한다.
  - 빌드: 위젯 확장 타깃 `ExpoWidgetsTarget`(번들 `com.dohun1214.dailift.widgets`)과 App Group `group.com.dohun1214.dailift`이 필요하다. App Group은 Apple 개발자 사이트에서만 만들 수 있다(App Store Connect API로는 안 됨).
- 오래 열려 있던 운동(#43): 마지막 완료 세트(없으면 시작)에서 `STALE_WORKOUT_MS`(3시간) 넘게 지나면 `(tabs)/_layout`이 앱을 켤 때·앱으로 돌아올 때 `StaleWorkoutSheet`를 띄운다. '마지막 기록 시각에 마치기'는 `finishWorkout(db, id, now, endedAt)`에 마지막 세트 시각을 넘긴다. '이어서 하기'를 고르면 같은 상태로는 다시 묻지 않는다(모듈 변수 — 개발 중 Fast Refresh로 초기화되면 다시 뜬다). 운동 화면에서 완료할 때도 마지막 세트가 3시간 넘게 전이면 그 시각을 종료 시각으로 쓴다.
- 남은 세트에도 적용(#51, #43의 '따라 채우기'를 대체): 값을 고치면 그 세트만 바뀐다(`updateSet`). 입력 중인 칸의 값이 아래쪽 미완료 본 세트와 다르면 키보드 줄에 버튼이 뜨고(`domain/workout-session.ts` `applyTargetIds`), 누르면 그 칸(무게·횟수·시간 중 하나)만 넣는다(`applyToRemainingSets`). 완료한 세트·워밍업·위쪽 세트는 건드리지 않는다.
- 확인 창(#43): 운동 완료·버리기·이어하기는 시스템 Alert 대신 `ConfirmDialog`. 확인 버튼은 기본이 채움(주요), `destructive`면 빨간 글자. 왼쪽이 위험한 동작이면 `cancelDestructive` + `onDismiss`(바깥 터치가 그 동작을 실행하지 않게).
- 종목 삭제 되돌리기(#43): `deleteWorkoutExercise`가 지운 시각을 돌려주고, `restoreWorkoutExercise`가 그 시각에 지워진 세트만 살린다. 편집 화면 하단 `Snackbar`가 5초간 뜬다.
- 꾹 누르기 안내(#43): 종목이 둘 이상이고 `settings.editHintSeen`이 false면 목록 아래에 한 줄 안내. 닫거나 편집 모드에 들어가면 다시 안 보인다.
- 숫자 입력(#41): `field-nav.tsx`가 화면의 입력 칸을 순서대로 등록한다. 키보드가 올라오면 하단 버튼 대신 `KeyboardBar`(다음/완료)를 보여 주고, 스크롤하면 키보드가 내려간다. `KeyboardAvoidingView`는 두 플랫폼 모두 `padding`.

## 세션 요약
- 화면 `src/app/workout-summary/[id].tsx`(운동 완료 직후·히스토리 공용, "완료"는 뒤로 갈 곳이 있으면 back). 데이터는 `src/db/summary.ts`의 `loadSummary`(완료 세트·근육·이 운동 전까지의 최고 기록).
- 계산은 `src/domain/session-summary.ts`: 볼륨은 본세트 무게×횟수(표시 단위로 환산), 근육 점수는 주동 1 · 협응 0.5, 단계는 최대 대비 ⅔ 이상 집중 · ⅓ 이상 주요 · 나머지 보조(근육맵 투명도 1 / 0.6 / 0.3).
- '한 운동' 카드(#47): `loadSummary().exercises`(종목별 완료 세트) → `groupSetsByWeight`로 같은 무게를 이어 묶어 한 줄(`62.5kg × 10 · 9 · 9`, 맨몸은 `12 · 10회`, 시간 종목은 시간). 워밍업은 빼고 본 세트가 있는 종목만. 접는 카드이고 기본은 접힘, 마지막 상태를 `settings.summaryExercisesOpen`에 기억한다.
- 메모는 입력을 멈추고 0.5초 뒤·화면을 떠날 때 저장. 사진은 expo-image-picker로 고르거나 찍어 앱 폴더(documentDirectory/photos)에 복사하고 `workout_photos`에 상대 경로를 저장한다(로그인하면 줄인 사본을 서버 저장소에 올린다 — `src/sync/photos.ts`). 길게 눌러 삭제.

## 히스토리
- 기록 탭 `src/app/(tabs)/log.tsx`: 히스토리 | 통계 | 종목 세그먼트. 목록은 `useHistory`(완료 운동 + 완료 세트 live) → `buildHistory`(오래된 순으로 최고 기록을 쌓아 세션별 PR 개수 계산, 요약 화면과 같은 기준) → `groupByMonth`.
- 각 줄에 한 종목 이름을 보여 준다(#47): `HistoryItem.exerciseIds`(본 세트를 기록한 종목, 한 순서대로) → 두 개까지 이름 + '외 N'.
- 행을 누르면 요약(`/workout-summary/[id]`), 길게 누르면 수정·삭제 시트. 수정(`/workout-edit/[id]`)은 바꾸는 즉시 저장, 새 세트는 바로 완료 상태, 나갈 때 `cleanupRecordedWorkout`로 완료 해제 세트·빈 종목 정리. 삭제는 툼스톤 + 사진 파일 삭제.

## 통계
- 기록 탭 '통계' = `src/components/stats/stats-view.tsx`, 데이터는 `useStatsData`(완료 본세트 전체 + 종목→부위). 계산은 `src/domain/stats.ts`.
- 기간은 **이번 주(월요일 0시부터 지금까지)** 기준이고 비교 대상은 지난주(월–일)다(#51, 그전에는 지난 7일). 주 초반에는 밸런스가 권장보다 적게 보인다.
- 진행도: 이번 주 vs 지난주 총 볼륨·세트(증감 색·화살표 없음). 밸런스: 세트가 부위의 주동근을 쓰면 1, 협응근만 쓰면 0.5(세트당 부위별 한 번), 권장 범위는 `weeklySetRange(경험)`, 벗어나면 주황.
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
- 통계 카드: 이번 주 운동 횟수 / 주 목표(`workoutsThisWeek`), 연속 기록(목표를 채운 연속 주). 그 아래 '오늘 영양제' 카드(`supplement-card.tsx`)는 사용 중인 영양제가 있을 때만 보인다.
- 오늘 마친 운동이 있으면(`todaysWorkout`) '운동 시작' 대신 완료 카드(기록 보기 / 운동 더 하기)를 보여 준다. '운동 시작'·'운동 더 하기'는 `RoutinePickSheet`(루틴 선택 또는 빈 운동)를 연다(#41).
- 홈의 '지금'은 `useToday()`로 잡는다(화면 포커스·앱 복귀 때 갱신). 마운트 때 한 번만 잡으면 방금 마친 운동이 이번 주 횟수에서 빠지고, 앱을 켜 둔 채 날짜가 바뀌면 어제 화면이 남는다.
- 운동 중 카드(#51, `components/home/live-workout-card.tsx`): 지금 종목 · 몇 세트째 · 무게×횟수, 전체 진행 막대, 다음 종목, 쉬는 동안 남은 휴식 시간. 지금 종목은 마지막으로 세트를 완료한 종목(세트가 남아 있을 때), 아니면 세트가 남은 첫 종목(`workoutProgress`). 1초마다 다시 그리는 부분을 이 컴포넌트 안에 가둔다.
- 이번 주 부위별 세트 카드(#51, `muscle-sets-card.tsx`): 통계의 `groupBalance`를 그대로 쓰고 가장 많은 부위를 꽉 찬 막대로 삼는다. 누르면 기록 탭을 `view=stats`로 연다(기록 탭이 한 번 쓰고 지운다).
- 최근 PR 행 → 해당 세션 요약. 상대 날짜는 i18n `relative.*`(Hermes에 `Intl.RelativeTimeFormat` 없음).

## 설정 · 원판 계산기
- 내 정보 탭 `src/app/(tabs)/me.tsx`. 값은 `stores/settings.ts`(단위·바 무게·보유 원판(단위별)·덤벨 표기·기본 휴식·고급 기록·화면 켜두기·테마·포인트 색·언어)와 `stores/profile.ts`(근육맵 바디).
- 바 무게는 워밍업 첫 단계(빈 바)에, 기본 휴식은 루틴 편집·운동 중에 새로 추가하는 종목에 쓰인다(`workoutDefaults()`). 덤벨 표기는 운동 중 무게 컬럼 제목만 바꾼다.
- 고급 기록을 켜면 운동 중 세트 번호를 눌러 세트 종류(본·워밍업·드롭·실패)와 RPE(6–10)를 고른다. 드롭 D, 실패 F로 표시.
- 원판 계산기 `src/app/plate-calculator.tsx`(`?weight=&unit=`), 운동 중 바벨 종목 카드의 원판 버튼에서 연다. 계산은 `src/domain/plates.ts`: 1/100 단위 정수 DP로 원판 개수가 가장 적은 조합, 못 맞추면 가장 가까운 무게(같으면 가벼운 쪽).
- 보유 원판 `src/app/settings/plates.tsx`. 모든 데이터 삭제는 `db/wipe.ts`(참조 데이터는 남김) + 사진 파일 + 스토어 초기화 → 시작 화면.
- 시안의 기록(체성분·눈바디)·알림·데이터(동기화·건강 데이터·내보내기)·약관 등 행은 해당 이슈(M2, #14–#17)에서 추가.

## 인증 · 계정
- Supabase 프로젝트 `dailift`(ref `kszdqhhvozdumfjhrovl`, 서울). 공개 설정값은 `src/config.ts`(URL, publishable key, Google 클라이언트 ID). 비밀 값은 앱에 넣지 않는다.
- `src/lib/supabase.ts`: 세션은 expo-sqlite kv-store에 저장, 앱이 앞에 있을 때만 토큰 자동 갱신. `src/lib/auth.ts`: `startAuth()`(루트에서 한 번) → `stores/auth.ts`(session). Google은 `@react-native-google-signin/google-signin`, Apple은 `expo-apple-authentication`(iOS만) → `signInWithIdToken`.
- 게스트가 기본. 로그인해도 기록은 기기에 먼저 쌓이고 서버 동기화는 #15. 로그아웃해도 기기 기록은 남는다.
- 시작 화면·계정 연결(`/account-link`)은 Apple(iOS)·Google만. 이메일 로그인은 도메인 확보 후 추가(Supabase 기본 메일은 팀원에게만 발송).
- 계정 삭제(`/account-delete`) → Edge Function `delete-account`(`supabase/functions/delete-account`, JWT 검증, 서비스 롤로 본인 계정 삭제) → 기기 데이터 삭제(`lib/wipe-device.ts`) → 시작 화면.
- Supabase 대시보드 Google 제공자: Client IDs 칸에 `웹ID,iOS ID`(쉼표), Skip nonce check 켬. Apple: Client IDs `com.dohun1214.dailift`.
- Google 로그인이 동작하려면 Google Cloud OAuth 클라이언트(웹·Android·iOS)와 Supabase Google 제공자 설정이 필요하다. 웹·iOS 클라이언트 ID를 `src/config.ts`에, iOS URL 스킴(`com.googleusercontent.apps.…`)을 app.json 플러그인 옵션 `iosUrlScheme`에 넣는다. Android 개발용 SHA-1은 Expo 기본 debug.keystore(5E:8F:16:…:F6:25), 스토어용은 #17에서 추가.

## 영양제 (#95)
- 영양 탭 `src/app/(tabs)/nutrition.tsx`: 식단 | 영양제 세그먼트(처음에는 식단이 보인다. `?view=supplements|diet`로 들어오면 그 구간을 연다). 목록은 `src/components/supplements/supplements-view.tsx`, 추가 · 편집은 `src/app/supplement/[id].tsx`(`new`면 추가).
- 표: `supplements`(이름, 용량 글자, `timing` = `time` | `after_workout`, `time_min` = 자정부터 몇 분, `after_min`, `notify` · `renotify` · `active`), `supplement_logs`(영양제 id, 날짜 `YYYY-MM-DD`(기기 현지), 먹은 시각). 체크를 풀면 그날 그 영양제의 줄을 모두 지운 것으로 표시하고, 다시 체크하면 그 줄을 되살린다. 유니크 인덱스가 없으므로 먹은 수는 영양제 단위로 센다.
- 계산은 `src/domain/supplements.ts`(순수 함수): 오늘 목록(`todayList`), 이번 주(`thisWeek` — 월–일, 홈 · 통계와 같은 주 기준. 지금 사용 중인 영양제만, 그날까지 등록돼 있던 것을 분모로. 오지 않은 날은 비워 둔다), 알림 계획(`planNotifications`).
- 알림(`src/lib/supplement-notifications.ts`): 전부 기기 알림. **`syncSupplementNotifications()` 하나가 예약된 영양제 알림을 지금 상태에 맞춘다** — 계획과 예약된 것을 id로 비교해 달라진 것만 지우고 건다. 영양제 알림은 `data.kind = 'supplement'`로 구분하고 휴식 타이머 알림은 건드리지 않는다(`cancelAllScheduledNotificationsAsync`를 쓰지 않는다).
  - 정해진 시각: 같은 시각의 영양제를 묶어 **요일마다 반복 알림 7개**(+ 한 시간 뒤 '다시 알림' 7개). 앱을 열지 않아도 계속 울린다. 오늘 그 묶음에서 하나라도 체크하면 오늘 요일 몫만 빼고, 남은 영양제가 있으면 그 이름만 담은 한 번짜리를 건다. 뺀 요일 알림은 그 시각이 지난 뒤 다시 맞출 때 돌아온다.
  - iOS는 예약 알림이 앱당 64개까지라 60개를 넘으면 늦은 시각의 묶음부터 '매일 반복' 하나로 줄인다(이 묶음은 체크해도 그날 알림이 온다).
  - 운동 후: 오늘 마친 운동의 끝난 시각 + N분에 한 번(+ 한 시간 뒤 한 번 더). 운동을 마치면 `workouts`가 바뀌어 저절로 다시 맞춰진다(운동 화면에서 따로 부르지 않는다).
  - 언제 맞추나(`useSupplementNotifications`, 루트): 앱을 켤 때, 앞으로 올 때, `supplements` · `supplement_logs` · `workouts`가 바뀔 때(동기화로 받은 것 · 모두 지우기 포함), 언어를 바꿀 때. 영양제 알림을 누르면 영양 탭의 영양제를 연다.
  - 권한은 알림을 켠 영양제를 저장할 때 처음 묻는다. 거절해 둔 기기에서는 편집 화면에 안내와 '설정 열기'를 보여 준다. 권한이 없으면 걸려 있던 영양제 알림을 지운다.
- 복용 시각은 앱 안의 창(`time-sheet.tsx`, 5분 단위)에서 고른다. 시스템 시계 창은 네이티브 패키지가 필요해 쓰지 않았다.
- 효능 문구는 쓰지 않는다. 목록 아래에 면책 문구를 둔다.

## 음식 DB (#97)
- 앱에 넣는 읽기 전용 SQLite 파일 `assets/food/foods.db`. 사용자 기록(`dailift.db`)과 다른 파일이다. `scripts/build-food-db.mjs`로 만든다(원본은 저장소에 넣지 않는다 — 받는 곳과 쓰는 법은 스크립트 머리말. 식약처 것은 `scripts/fetch-mfds-foods.mjs`로 공공데이터포털 API에서 받는다 — 인증키는 환경 변수로만 넘기고 저장소에 넣지 않는다). 새로 만들면 `src/food/food-db.ts`의 `FOOD_DB_VERSION`을 올린다(기기에는 `foods-v<판>.db`로 복사하므로 올리지 않으면 예전 파일을 계속 쓴다).
- 들어 있는 것(2026-10 기준 20,074개, 3.6MB): USDA 13,224(FNDDS 5,431 + SR Legacy 7,793), 식약처 6,850(음식 1,970 + 원재료 2,913 + 업체 음식 1,967). 식약처 데이터를 다듬는 규칙은 스크립트에 있다 — 밑줄로 이어진 이름은 쉼표로, 같은 이름이 여러 조사에 있으면 하나만(가정식 → 외식 → 급식 순), 수산물의 지역 · 월별 표본은 하나만(대표 평균 우선), 탄수화물 · 지방이 비어 있는 업체 음식(약 13,000개)은 뺌, 업체 음식은 이름 뒤에 ` · 업체`, 마실 것만 ml.
- 구조: `foods`(src `usda|mfds`, sid = 출처의 id, pri = 출처 안 순서, name, cho = 초성, 100g(ml)당 kcal · protein · carb · fat, basis `g|ml`, serving · serving_name), `portions`(가정 단위 — USDA만), `meta`(출처별 개수). 검색 색인(FTS)은 두지 않았다 — 이름을 LIKE로 훑어도 몇 ms라서 파일을 키우지 않는 쪽을 골랐다.
- 여는 곳 `src/food/food-db.ts`(`openFoodDb` — 처음 한 번 `importDatabaseFromAssetAsync`로 복사), 훅 `use-food-db.ts`(`useFoodDb`, `useFoodSources`), 찾기 `catalog.ts`(`searchFoods` · `findFood` · `foodPortions` · `foodCounts` — 열린 DB만 받으므로 테스트는 better-sqlite3로 실제 파일을 연다).
- 출처 규칙 `src/domain/food-search.ts`: 기기 지역이 KR이면 식약처 먼저 + USDA, 그 밖에는 USDA만(고르는 설정 없음). 검색어의 낱말은 모두 들어 있어야 하고, 순서는 출처 → 같은 이름 → 검색어로 시작하고 끊김 → 검색어로 시작 → 낱말의 처음 → 그 밖 → pri → 짧은 이름. 한글은 띄어쓰기 · 밑줄을 빼고 견주고, 초성이 섞이면 초성 칸에서 넓게 찾은 뒤 `matchesSearch`로 거른다.
- 기록에는 음식 DB의 줄 번호(`id`)가 아니라 `src` + `sid`와 영양값 사본을 남긴다(DB를 새로 만들면 줄 번호가 바뀐다).
- 데이터 출처 화면(`settings/licenses.tsx`)은 이 기기에서 보이는 출처만 적고 음식 수를 DB에서 읽어 보여 준다.

## 식단 (#101)
- 영양 탭의 식단 구간 `src/components/diet/diet-view.tsx`: 날짜 줄(‹ › 로 하루씩, 날짜를 누르면 달력 `date-sheet.tsx`, 오늘보다 뒤는 못 고른다), 합계 카드(`macro.tsx` — 칼로리 · 단백질은 크게, 탄수화물 · 지방은 작게), 끼니 카드 4개. 끼니 옆 +는 음식 찾기(`src/app/food-search.tsx`), 음식 줄을 누르면 양 창(`amount-sheet.tsx`)에서 양을 고치거나 지운다. 음식 줄을 **왼쪽으로 쭉 밀면 바로 지워진다**(`ui/swipe-delete.tsx` — 줄 너비의 40% 넘게 밀거나 빠르게 튕기면 삭제, 버튼 없음. 스크린리더는 줄의 '삭제' 동작으로).
- 표(모두 동기화 표): `foods`(직접 만든 음식 — 100 g당 영양값, 1회 제공량 g과 이름), `food_logs`(날짜 `YYYY-MM-DD`(기기 현지), 끼니, 끼니 안 순서, 음식 출처 `usda|mfds|custom` + 출처 id, **이름 · 100 g당 영양값 사본**, 먹은 양 g, 1회 양 단위로 넣었으면 그 단위의 무게와 이름), `food_favorites`(출처 + id). 음식 DB를 새로 만들거나 내 음식을 고쳐도 이미 적은 기록은 그때 값 그대로다.
- **건강 데이터 동의가 있어야 서버와 주고받는다.** `schema.CONSENT_TABLES`(위 세 표)는 `stores/health-consent.ts`의 동의가 없으면 `sync/manager.ts`가 `syncOnce` · `pendingCount`에서 건너뛴다(보내지도 받지도 않고 dirty 표시는 남는다 → 동의하면 그때 올라간다). 기본값은 동의 없음이고, 동의 화면은 아직 없다(다음 이슈). 그때까지 식단은 기기에만 있다. "모든 데이터 삭제"는 동의와 상관없이 서버의 식단 행도 지운 것으로 표시한다.
- 계산 `src/domain/diet.ts`(순수 함수): 먹은 양의 영양값 · 하루 합계(`dayView`), 목표(`dietTargets`), 진행(`progress` — 보이는 숫자끼리 맞도록 반올림한 값으로 남은 양을 낸다), 양 넣기(`parseAmount` · `pressKey`), 최근 먹은 음식(`recentFoods`), 직접 만든 음식의 100 g당 환산(`toPer100`). 날짜 글자와 달력은 `src/domain/date-key.ts`.
- 양 창: 기기 키보드 대신 **창 안의 숫자판**을 쓴다(아래에서 올라오는 창 안에 입력칸을 두면 iOS에서 키보드와 창이 엇갈린다). 단위는 g(음료는 ml) 또는 그 음식의 1회 양 단위(식약처: 이름 없는 1회 양 = "1인분", USDA: "1 cup" 같은 가정 단위, 내 음식: 넣은 이름). 처음 누른 숫자는 보이던 값을 갈아 치운다.
- 음식 찾기: 검색어가 없으면 `최근 · 즐겨찾기 · 내 음식` 칩, 있으면 내 음식 + 음식 DB를 같이 찾아 즐겨찾기 → 최근 먹은 것 → 나머지 순으로 보여 준다. 줄을 누르면 양 창(그때 가정 단위를 모두 읽는다), +는 보이는 양(최근 = 지난번 양, 그 밖 = 1회 양 또는 100 g)으로 바로 추가. 추가해도 화면에 남고 아래에 '추가했어요 · 취소'가 4초 뜬다.
- 음식 만들기 · 고치기 `src/app/food/[id].tsx`(`new`면 만들기, `?name=`으로 이름을 채운다): 영양성분표의 기준(1회 제공량당 / 100 g당)을 고르고 숫자를 그대로 넣으면 100 g당으로 바꿔 저장한다. 만들고 돌아오면 찾기 화면이 그 음식의 양 창을 연다(`lib/created-food.ts`).
- 목표 `src/app/diet-goal.tsx`(식단 화면의 "목표 ›" · 내 정보의 "식단 목표"): 단백질은 몸무게 1 kg당 1.2 / 1.6 / 2.0 / 2.2 g 가운데 고르거나 하루 g을 직접 넣는다. 고르지 않은 사람은 운동 목표에 맞춘 값(`defaultProteinPerKg`)을 쓰고 운동 목표를 바꾸면 따라 바뀐다. 칼로리 · 탄수화물 · 지방은 직접 넣는 숫자만(앱이 계산하지 않는다, 비우면 합계만 보인다). 몸무게도 여기서 넣고 고친다(설정의 kg · lb 단위). 목표는 `stores/diet-goals.ts`, 몸무게는 `stores/profile.ts` — 둘 다 이 기기에만 둔다.
- **세트(#103)**: 자주 같이 먹는 음식을 양까지 묶어 둔 것. 표 `food_sets`(이름) · `food_set_items`(칸의 뜻은 `food_logs`와 같다) — 둘 다 `CONSENT_TABLES`. 끼니에 넣으면 **안의 음식이 `food_logs`에 하나씩 들어가고 세트와의 연결은 남기지 않는다**(`addItemsToMeal`) — 그래서 넣은 뒤에는 음식마다 따로 고치거나 지우고, 세트를 고치거나 지워도 이미 적은 기록은 그대로다.
  - 음식 찾기의 '세트' 칩: +는 바로 넣기, 줄을 누르면 미리 보기(`set-preview-sheet.tsx`) — 음식 줄을 누르면 양 창이 떠서 **이번에 넣을 양만** 고치거나 뺀다(세트는 그대로). 창 위에 창을 겹치지 않으려고 양 창을 띄우는 동안 미리 보기를 내려 두었다가(`SHEET_NEXT_MS`) 다시 올린다.
  - 만들기 · 고치기 `src/app/food-set/[id].tsx`: 담은 음식은 `stores/set-draft.ts`(저장 전 임시 값)에 두고, '음식 담기'로 여는 음식 찾기(`/food-search?mode=set`)와 같이 쓴다. 그 모드에서는 고른 음식이 끼니가 아니라 세트에 담긴다. 고치면 음식 줄을 통째로 바꾼다(`updateSet`).
  - 음식 찾기의 '만들기'는 음식 / 세트를 고르는 창을 띄운다(세트에 담는 중에는 음식만).
  - 한도: 세트 50개, 세트 하나에 음식 20개(`LIMITS`).
- 방금 넣은 것을 알리는 한 줄(`ui/snackbar.tsx`)은 아래에서 올라오며 나타나고, `onDismiss`를 넘기면 아래로 쓸어내리거나 `autoHideMs`가 지나면 내려가며 사라진다.
- 홈의 '오늘 식단' 카드 `src/components/home/diet-card.tsx`: 식단을 한 번이라도 적은 사람에게만 보인다. 운동 카드 바로 아래, '오늘 영양제' 위에 둔다(이번 주 · 연속 기록보다 위).
- 효능 · 감량 조언 문구는 쓰지 않는다. 식단 화면 아래에 데이터 출처, 목표 화면 아래에 면책 문구를 둔다.

## 서버 동기화
- 서버 테이블은 기기 SYNCED_TABLES와 같은 컬럼 + `user_id`(기본값 auth.uid(), auth.users on delete cascade) + `rev`. RLS로 본인 행만 select/insert/update(삭제는 툼스톤, 계정 삭제 시 cascade). SQL은 `supabase/migrations/`.
- 서버 트리거 `sync_before_write`: 쓰기마다 전역 시퀀스로 `rev`를 매기고, `updated_at`이 기존보다 오래된 수정은 무시(LWW).
- 기기: 모든 수정은 drizzle `$onUpdateFn`으로 `dirty = 1`. 엔진 `src/sync/engine.ts`: 부모→자식 순서로 dirty 행 upsert → 보낸 그대로면 `dirty = 0`(raw SQL로 updated_at 유지) → 테이블별 `rev > 커서` 행을 받아 반영(아직 안 보낸 기기 변경이 같거나 새로우면 기기 것 유지). 커서는 `sync_state.cursor_updated_at`에 rev를 담는다. 기본 종목·그 근육 매핑은 보내지 않는다.
- 언제: 로그인 직후, 앱이 앞으로 올 때, 동기화 테이블이 바뀌고 8초 뒤, 설정 '데이터 › 동기화'를 누를 때(`src/sync/manager.ts`). 한 번에 하나만 돈다.
- 다른 계정으로 로그인하면(kv `sync-account`가 다름) 기기의 모든 행을 dirty로 만들고 커서를 지워 새 계정에 전부 올리고 처음부터 받는다(게스트 기록이 계정으로 들어가는 것과 같은 규칙). 로그아웃 전에는 한 번 동기화하고, 기기 기록은 남긴다.
- 운동 사진: `workout_photos` 행은 일반 동기화, 파일은 `src/sync/photos.ts`가 Storage 비공개 버킷 `workout-photos`(`<user>/<photoId>.jpg`, RLS로 본인 폴더만, 2MB·jpeg 제한)와 맞춘다. 올릴 때 긴 쪽 1280px·JPEG 80%로 줄인 사본(expo-image-manipulator), 기기 원본은 그대로. 기기에 파일이 없으면 내려받고, 서버에 아직 없으면 다음 동기화에 다시 시도. 지운 사진은 기기·서버 파일 삭제 후 `uploaded_at = -1`. `uploaded_at`은 기기 전용 컬럼(엔진 LOCAL_ONLY). 계정이 바뀌면 다시 올린다. 계정 삭제 Edge Function이 사진 폴더도 지운다.
- 눈바디(체성분) 사진은 M2에서 건강 데이터 동의와 함께.
- 한계: 동시에 커밋되는 트랜잭션이 rev 순서와 다르게 보일 수 있어(여러 기기가 같은 순간에 쓸 때) 드물게 한 번 놓칠 수 있다. 필요하면 커서를 조금 겹쳐 받는 방식으로 보완.

## 데이터 내보내기
- 내 정보 '데이터 › 데이터 내보내기' 또는 계정 삭제 화면 '먼저 내 데이터 내보내기' → 시트(`components/export-sheet.tsx`)에서 형식 선택 → 캐시 폴더에 파일을 만들고 공유 시트(expo-sharing).
- CSV(`dailift-workouts-YYYYMMDD.csv`): 완료한 운동의 완료한 세트 한 줄씩(date, workout, exercise, set, kind, weight, unit, reps, duration_sec, rpe). 엑셀 한글용 BOM, CRLF, 수식 주입 방지. 내용은 `domain/export.ts`, 조회는 `db/export.ts`.
- JSON(`dailift-backup-YYYYMMDD.json`): 설정·프로필 + 지우지 않은 사용자 행 전부(기본 종목·버린 운동·기기 전용 컬럼 제외). 사진 파일은 포함하지 않는다(경로만).

## 스토어 준비
- 앱 아이콘·스플래시: `assets/images/` (icon 1024px 배경 #0F1012, 안드로이드 적응형 전경·모노크롬·배경, 스플래시 라이트/다크). 바꾼 뒤에는 `npx expo prebuild`로 네이티브 리소스를 다시 만든다.
- 법적 페이지: GitHub Pages(`gh-pages` 브랜치) — https://dohun1214.github.io/dailift/ 의 `privacy.html`, `terms.html`, `delete-account.html`. 한국어 본문 뒤에 영어(`#en`)가 이어진다. 앱에서는 `src/lib/links.ts`(`openLegal`, `openSupportMail`)로 연다. 주소·문의 메일은 `src/config.ts`.
- 시작 화면 동의 문장의 '이용약관'·'개인정보 처리방침'은 누르면 해당 페이지가 열린다(`ConsentCheck`의 `links`).
- 내 정보 › 정보: 이용약관, 개인정보 처리방침, 데이터 출처 · 오픈소스(`settings/licenses`, `settings/license`), 문의하기(메일 작성), 버전.
- 오픈소스 목록은 `node scripts/gen-licenses.mjs`가 `src/data/licenses.json`으로 만든다(직접 의존성, 라이선스 전문 포함). 의존성을 추가·삭제하면 다시 실행한다.
- EAS: `eas.json`의 `preview`(내부 배포 APK), `production`(스토어용, 빌드 번호 자동 증가, 버전 원본은 EAS 서버). Play 제출용 서비스 계정 키는 `secrets/play-service-account.json`(커밋 금지, .gitignore 처리).

## iOS 출시 (#37)
- EAS 프로젝트 `@dohun1214/dailift`(projectId는 app.json `extra.eas`). App Store Connect 앱 ID `6816855441`, Team `65J6R92P2U` → eas.json `submit.production.ios`.
- 빌드·제출은 비대화형으로 한다. 키는 `secrets/`(git 제외): `ids.txt`(1 ASC Key ID, 2 Issuer ID, 3 SIWA Key ID, 4 Team ID, 5 Expo 토큰), `AuthKey_<id>.p8` 두 개(ASC API 키, Sign in with Apple 키).
  환경 변수 `EXPO_TOKEN`, `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`를 채우고 `eas build -p ios --profile production --non-interactive`, `eas submit -p ios --latest --non-interactive`.
- iOS 설정: 수출 규정 암호화 없음(`ios.config.usesNonExemptEncryption: false`), 아이폰 전용, 권한 문구·표시 이름은 `locales/ko.json`·`locales/en.json`.
- Apple 로그인 연결 끊기(App Store 5.1.1(v)): 로그인 직후 앱이 authorizationCode를 Edge Function `apple-token`에 보내면 refresh token으로 바꿔 `apple_tokens`(서비스 롤 전용)에 보관 → `delete-account`가 계정 삭제 전에 Apple `/auth/revoke`를 호출한다. Sign in with Apple 키는 Supabase Vault `apple_siwa`(JSON)에 있고 `public.apple_siwa_config()`(service_role만 실행)로 읽는다. 공통 코드는 `supabase/functions/_shared/apple.ts`.

## 심사 없는 업데이트 — EAS Update (#45)
- `expo-updates`. app.json `updates.url`(프로젝트 ID) · `runtimeVersion: { policy: "appVersion" }`, eas.json 빌드 프로필에 `channel`(production / preview). 앱은 켤 때 새 수정본을 받아 두고 **다음에 켤 때** 적용한다.
- 내보내기: `eas update --channel production --platform ios --environment production --message "<what changed>"` (`EXPO_TOKEN` 필요). `--platform ios`를 빼면 web까지 묶다가 expo-sqlite의 wasm을 찾지 못해 실패한다. 메시지는 영문으로(Windows에서 한글이 깨진다). 먼저 `--channel preview`로 내보내 preview 빌드에서 확인한 뒤 production으로 내보낸다. 되돌리기는 `eas update:rollback`.
- 규칙
  - 이 방법으로는 **버그 수정과 작은 개선만** 내보낸다. 새 기능이나 앱 성격이 바뀌는 변경은 스토어 심사로 낸다(스토어 정책).
  - 수정본은 app.json `version`이 같은 빌드에만 내려간다. **네이티브가 바뀌면**(패키지 추가·삭제, Expo SDK 업그레이드, app.json의 플러그인·권한·아이콘 변경) 반드시 `version`을 올리고 새 빌드를 심사에 낸다. 안 올리면 예전 빌드가 맞지 않는 수정본을 받아 죽을 수 있다.
  - DB 마이그레이션이 들어간 수정본은 되돌리기가 어렵다 → 스토어 빌드로 낸다.
- 개발용 빌드(dev client)에서는 업데이트 확인이 동작하지 않는다. 앱 코드에서 `expo-updates`를 import하지 않으므로 이 패키지가 없는 예전 dev client로도 Metro 개발은 그대로 된다.
- 업데이트 서버(Expo)에는 설치마다 만들어지는 임의 ID와 IP가 전달된다 → 개인정보 처리방침의 수탁자 표와 App Store 개인정보 라벨에 반영한다.

