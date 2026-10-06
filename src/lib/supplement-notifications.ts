import * as Notifications from 'expo-notifications';

import { db } from '@/db/client';
import { lastWorkoutEndOn, listSupplements, takenOn } from '@/db/supplements';
import {
  dateKey,
  type NotificationKind,
  type PlannedNotification,
  planNotifications,
} from '@/domain/supplements';
import i18n from '@/i18n';

import { ensureChannel, notificationsAllowed } from './notifications';

export const SUPPLEMENT_CHANNEL = 'supplements';
/** 알림의 data.kind. 영양제 알림만 골라 지우고, 눌렀을 때 영양제 화면을 여는 데 쓴다. */
export const SUPPLEMENT_KIND = 'supplement';

const TITLE: Record<NotificationKind, 'due' | 'again' | 'after'> = {
  due: 'due',
  again: 'again',
  after: 'after',
  afterAgain: 'again',
};

function trigger(p: PlannedNotification): Notifications.NotificationTriggerInput {
  const t = p.trigger;
  if (t.type === 'weekly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: t.weekday,
      hour: t.hour,
      minute: t.minute,
      channelId: SUPPLEMENT_CHANNEL,
    };
  }
  if (t.type === 'daily') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: t.hour,
      minute: t.minute,
      channelId: SUPPLEMENT_CHANNEL,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: t.at,
    channelId: SUPPLEMENT_CHANNEL,
  };
}

async function scheduledSupplementIds(): Promise<string[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.filter((n) => n.content.data?.kind === SUPPLEMENT_KIND).map((n) => n.identifier);
}

async function run() {
  try {
    const have = await scheduledSupplementIds();
    const now = new Date();
    const planned = (await notificationsAllowed())
      ? planNotifications({
          supplements: listSupplements(db),
          takenToday: takenOn(db, dateKey(now)),
          now,
          workoutEndedAt: lastWorkoutEndOn(db, now),
        })
      : [];
    // 글자가 언어에 따라 달라지므로 언어가 바뀌면 다시 건다.
    const lang = i18n.language;
    const want = new Map(planned.map((p) => [`${p.id}-${lang}`, p]));
    for (const id of have) {
      if (!want.has(id)) await Notifications.cancelScheduledNotificationAsync(id);
    }
    const kept = new Set(have);
    const missing = [...want].filter(([id]) => !kept.has(id));
    if (missing.length === 0) return;
    await ensureChannel(SUPPLEMENT_CHANNEL, i18n.t('supplements.notify.channel'));
    for (const [identifier, p] of missing) {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: i18n.t(`supplements.notify.${TITLE[p.kind]}`),
          body: p.names.join(', '),
          data: { kind: SUPPLEMENT_KIND },
          sound: true,
        },
        trigger: trigger(p),
      });
    }
  } catch {
    // 알림을 못 걸어도 기록과 체크는 그대로 동작한다. 다음에 다시 맞춘다.
  }
}

let chain: Promise<void> = Promise.resolve();

/**
 * 예약된 영양제 알림을 지금 상태(영양제 · 오늘 체크 · 오늘 마친 운동)에 맞춘다.
 * 이미 맞게 걸려 있는 것은 건드리지 않고, 달라진 것만 지우고 건다. 휴식 타이머 알림은 건드리지 않는다.
 * 권한을 묻지 않는다(권한이 없으면 걸려 있던 것을 지운다).
 */
export function syncSupplementNotifications(): Promise<void> {
  chain = chain.then(run);
  return chain;
}

/** 예약된 영양제 알림을 모두 지운다(모든 데이터 삭제 · 계정 삭제 · 지우고 계속). */
export function cancelSupplementNotifications(): Promise<void> {
  chain = chain.then(async () => {
    try {
      for (const id of await scheduledSupplementIds()) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    } catch {
      // 다음에 알림을 맞출 때 다시 지운다.
    }
  });
  return chain;
}
