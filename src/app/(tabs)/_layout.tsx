import { Redirect, router, usePathname } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { ChartNoAxesColumn, House, ListChecks, User, Utensils } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { ConfirmDialog } from '@/components/ui';
import { TabButton } from '@/components/ui/tab-button';
import { StaleWorkoutSheet, WorkoutMiniBar } from '@/components/workout';
import { db } from '@/db/client';
import { useActiveWorkout } from '@/db/use-workout';
import { discardWorkout, finishWorkout, getActiveWorkout, workoutActivity } from '@/db/workout';
import { daysAgo } from '@/domain/home';
import { formatClock } from '@/domain/rest-timer';
import { isStaleWorkout } from '@/domain/workout-session';
import { useAppLanguage } from '@/i18n/use-app-language';
import { settlePendingAdd } from '@/lib/pending-add';
import { useProfile } from '@/stores/profile';
import { useRestTimer } from '@/stores/rest-timer';

/** 앱을 켤 때 한 번만 진행 중인 운동을 알려준다. */
let recoveryAsked = false;
/** '이어서 하기'로 넘긴 오래된 운동(id:마지막 기록). 같은 상태로는 다시 묻지 않는다. */
let staleSkipped: string | null = null;

type Prompt =
  | { kind: 'recover'; id: string; name: string; startedAt: number; completedSets: number }
  | {
      kind: 'stale';
      id: string;
      name: string;
      startedAt: number;
      /** 마지막 기록 시각 (기록이 없으면 시작 시각) */
      lastAt: number;
      completedSets: number;
    };

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // TabList는 서드파티 컴포넌트라 Unistyles가 직접 갱신하지 못하므로 훅으로 리렌더한다.
  const { theme } = useUnistyles();
  const consented = useProfile((s) => s.consentAcceptedAt !== null);
  const onboarded = useProfile((s) => s.onboardingCompleted);
  const { workout: active } = useActiveWorkout();
  const pathname = usePathname();

  const lang = useAppLanguage();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  // 닫히는 동안에도 내용이 남아 있도록 마지막으로 띄운 것을 기억한다.
  const [shown, setShown] = useState<Prompt | null>(null);
  // '기록 지우기'를 누르면 한 번 더 묻는다. 같은 확인 창의 내용만 바꾼다(창 두 개를 겹쳐 띄우지 않는다).
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseShown, setEraseShown] = useState(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const ready = consented && onboarded;

  /**
   * 진행 중인 운동 확인. 마지막 기록에서 오래 지났으면 어떻게 할지 묻고(앱으로 돌아올 때마다),
   * 아니면 앱을 켠 직후에만 이어할지 묻는다.
   */
  const checkActive = useCallback((firstOpen: boolean) => {
    const w = getActiveWorkout(db);
    if (!w) return;
    const activity = workoutActivity(db, w.id);
    const lastAt = activity.lastAt ?? w.startedAt;
    const base = { id: w.id, name: w.name, startedAt: w.startedAt };
    let next: Prompt | null = null;
    if (isStaleWorkout(lastAt, Date.now())) {
      if (staleSkipped !== `${w.id}:${lastAt}`)
        next = { kind: 'stale', ...base, lastAt, completedSets: activity.completedSets };
    } else if (firstOpen && pathRef.current !== '/workout') {
      // 이미 운동 화면이 떠 있으면(앱 복원) 묻지 않는다.
      next = { kind: 'recover', ...base, completedSets: activity.completedSets };
    }
    if (next) {
      setShown(next);
      setPrompt(next);
      setEraseShown(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!recoveryAsked) {
      recoveryAsked = true;
      // 지난 날 기록을 추가하던 중에 앱이 꺼졌으면 남은 것을 정리한다.
      settlePendingAdd(db);
      checkActive(true);
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkActive(false);
    });
    return () => sub.remove();
  }, [ready, checkActive]);

  const close = () => setPrompt(null);
  /** 기록 지우기: 바로 지우지 않고 한 번 더 묻는다 */
  const askErase = () => {
    if (!prompt) return;
    if (prompt.kind === 'stale') {
      // 아래쪽 창이 다 내려간 뒤에 확인 창을 띄운다.
      close();
      setTimeout(() => {
        setEraseShown(true);
        setEraseOpen(true);
      }, 300);
      return;
    }
    setEraseShown(true);
    setEraseOpen(true);
  };
  const cancelErase = () => {
    setEraseOpen(false);
    if (shown?.kind === 'stale') {
      // 오래된 운동 창에서 왔으면 그 창으로 돌아간다.
      const back = shown;
      setTimeout(() => setPrompt(back), 250);
      return;
    }
    setEraseShown(false);
  };
  const eraseNow = () => {
    if (!shown) return;
    useRestTimer.getState().stop();
    discardWorkout(db, shown.id);
    setEraseOpen(false);
    close();
  };
  const resumePrompted = () => {
    if (prompt?.kind === 'stale') staleSkipped = `${prompt.id}:${prompt.lastAt}`;
    close();
    if (pathRef.current !== '/workout') router.push('/workout');
  };
  const skipStale = () => {
    if (prompt?.kind === 'stale') staleSkipped = `${prompt.id}:${prompt.lastAt}`;
    close();
  };
  const finishAtLast = () => {
    if (prompt?.kind !== 'stale') return;
    const { id, lastAt } = prompt;
    const onWorkout = pathRef.current === '/workout';
    useRestTimer.getState().stop();
    finishWorkout(db, id, Date.now(), lastAt);
    close();
    // 운동 화면이 떠 있었다면 그 화면이 홈으로 돌아간 뒤에 요약을 연다.
    setTimeout(
      () => router.push({ pathname: '/workout-summary/[id]', params: { id } }),
      onWorkout ? 400 : 0,
    );
  };

  const stale = shown?.kind === 'stale' ? shown : null;
  const recover = shown?.kind === 'recover' ? shown : null;
  const nowDate = new Date();
  const startedAgo = stale ? daysAgo(stale.startedAt, nowDate) : 0;
  const agoText =
    startedAgo === 0
      ? t('relative.today')
      : startedAgo === 1
        ? t('relative.yesterday')
        : startedAgo === 2
          ? t('relative.twoDays')
          : t('relative.daysAgo', { count: startedAgo });
  const whenText = stale
    ? new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(stale.lastAt))
    : '';

  // 처음 켜면 시작 화면(약관·연령 동의) → 온보딩을 거쳐야 탭으로 들어온다.
  if (!consented) return <Redirect href="/welcome" />;
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs>
      <TabSlot />
      {active ? (
        <View>
          <WorkoutMiniBar name={active.name} startedAt={active.startedAt} />
        </View>
      ) : null}
      {/* TabList는 Tabs의 직계 자식이어야 트리거를 인식한다. */}
      <TabList
        style={{
          flexDirection: 'row',
          marginHorizontal: theme.space.lg,
          marginTop: theme.space.sm,
          marginBottom: Math.max(insets.bottom, 12),
          padding: 6,
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.surface,
        }}
      >
        <TabTrigger name="home" href="/" asChild>
          <TabButton icon={House} label={t('tabs.home')} />
        </TabTrigger>
        <TabTrigger name="routines" href="/routines" asChild>
          <TabButton icon={ListChecks} label={t('tabs.routines')} />
        </TabTrigger>
        <TabTrigger name="log" href="/log" asChild>
          <TabButton icon={ChartNoAxesColumn} label={t('tabs.log')} />
        </TabTrigger>
        <TabTrigger name="nutrition" href="/nutrition" asChild>
          <TabButton icon={Utensils} label={t('tabs.nutrition')} />
        </TabTrigger>
        <TabTrigger name="me" href="/me" asChild>
          <TabButton icon={User} label={t('tabs.me')} />
        </TabTrigger>
      </TabList>
      <StaleWorkoutSheet
        visible={prompt?.kind === 'stale'}
        name={stale?.name ?? ''}
        ago={agoText}
        completedSets={stale?.completedSets ?? 0}
        when={whenText}
        minutes={stale ? Math.max(1, Math.round((stale.lastAt - stale.startedAt) / 60000)) : 0}
        onFinish={finishAtLast}
        onResume={resumePrompted}
        onDiscard={askErase}
        onClose={skipStale}
      />
      {eraseShown ? (
        <ConfirmDialog
          visible={eraseOpen}
          title={t('workout.eraseTitle')}
          body={
            shown && shown.completedSets > 0
              ? t('workout.eraseBody', { name: shown.name, count: shown.completedSets })
              : t('workout.eraseBodyEmpty', { name: shown?.name ?? '' })
          }
          cancelLabel={t('workout.eraseCancel')}
          confirmLabel={t('workout.recoverDiscard')}
          destructive
          onCancel={cancelErase}
          onConfirm={eraseNow}
        />
      ) : (
        <ConfirmDialog
          visible={prompt?.kind === 'recover'}
          title={t('workout.recoverTitle')}
          body={
            recover
              ? t('workout.recoverBody', {
                  name: recover.name,
                  elapsed: formatClock((Date.now() - recover.startedAt) / 1000),
                })
              : undefined
          }
          cancelLabel={t('workout.recoverDiscard')}
          cancelDestructive
          confirmLabel={t('workout.resume')}
          onCancel={askErase}
          onConfirm={resumePrompted}
          onDismiss={close}
        />
      )}
    </Tabs>
  );
}
