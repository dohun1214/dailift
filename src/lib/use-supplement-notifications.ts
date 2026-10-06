import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import i18n from '@/i18n';

import { SUPPLEMENT_KIND, syncSupplementNotifications } from './supplement-notifications';

/** 영양제 알림에 영향을 주는 표: 영양제, 오늘 체크, 운동(마친 시각) */
const WATCHED = new Set(['supplements', 'supplement_logs', 'workouts']);
/** 여러 줄이 한꺼번에 바뀔 때(동기화 받기 · 모두 지우기) 한 번만 맞추도록 모으는 시간 */
const SETTLE_MS = 400;

/**
 * 영양제 알림을 늘 지금 상태에 맞춰 둔다. 루트(DB가 준비된 뒤)에서 한 번 쓴다.
 * - 앱을 켤 때, 앞으로 올 때, 영양제 · 체크 · 운동이 바뀔 때(다른 기기에서 받은 것 포함), 언어를 바꿀 때 다시 맞춘다.
 * - 영양제 알림을 누르면 영양 탭의 영양제 화면을 연다.
 */
export function useSupplementNotifications() {
  useEffect(() => {
    void syncSupplementNotifications();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const dbSub = addDatabaseChangeListener(({ tableName }) => {
      if (!WATCHED.has(tableName)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void syncSupplementNotifications();
      }, SETTLE_MS);
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncSupplementNotifications();
    });
    const onLanguage = () => void syncSupplementNotifications();
    i18n.on('languageChanged', onLanguage);
    return () => {
      dbSub.remove();
      appSub.remove();
      i18n.off('languageChanged', onLanguage);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response) return;
    if (response.notification.request.content.data?.kind !== SUPPLEMENT_KIND) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    // 같은 알림으로 다음에 앱을 켰을 때 또 열리지 않게 지운다.
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    router.navigate({ pathname: '/nutrition', params: { view: 'supplements' } });
  }, [response]);
}
