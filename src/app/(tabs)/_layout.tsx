import { Redirect, router, usePathname } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { ChartNoAxesColumn, House, ListChecks, User, Utensils } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { TabButton } from '@/components/ui/tab-button';
import { WorkoutMiniBar } from '@/components/workout';
import { db } from '@/db/client';
import { useActiveWorkout } from '@/db/use-workout';
import { discardWorkout, getActiveWorkout } from '@/db/workout';
import { formatClock } from '@/domain/rest-timer';
import { useProfile } from '@/stores/profile';
import { useRestTimer } from '@/stores/rest-timer';

/** 앱을 켤 때 한 번만 진행 중인 운동을 알려준다. */
let recoveryAsked = false;

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // TabList는 서드파티 컴포넌트라 Unistyles가 직접 갱신하지 못하므로 훅으로 리렌더한다.
  const { theme } = useUnistyles();
  const consented = useProfile((s) => s.consentAcceptedAt !== null);
  const onboarded = useProfile((s) => s.onboardingCompleted);
  const { workout: active } = useActiveWorkout();
  const pathname = usePathname();

  // 세션 복구: 앱이 꺼졌다 켜졌는데 진행 중인 운동이 있으면 이어할지 묻는다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 앱을 켤 때 한 번만 확인한다(경로 변화는 무시).
  useEffect(() => {
    if (recoveryAsked || !consented || !onboarded) return;
    recoveryAsked = true;
    // 이미 운동 화면이 떠 있으면(앱 복원) 묻지 않는다.
    if (pathname === '/workout') return;
    const w = getActiveWorkout(db);
    if (!w) return;
    Alert.alert(
      t('workout.recoverTitle'),
      t('workout.recoverBody', {
        name: w.name,
        elapsed: formatClock((Date.now() - w.startedAt) / 1000),
      }),
      [
        {
          text: t('workout.discard'),
          style: 'destructive',
          onPress: () => {
            useRestTimer.getState().stop();
            discardWorkout(db, w.id);
          },
        },
        { text: t('workout.resume'), onPress: () => router.push('/workout') },
      ],
    );
  }, [consented, onboarded, t]);

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
    </Tabs>
  );
}
