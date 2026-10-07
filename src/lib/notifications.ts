import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REST_CHANNEL = 'rest-timer';

let configured = false;

/** 앱 시작 시 한 번. 앱을 보고 있을 때도 알림(휴식 끝 포함)을 배너와 소리로 보여 준다. */
export function configureNotifications() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** 안드로이드 알림 채널을 만든다(이미 있으면 이름만 맞춘다). iOS는 채널이 없다. */
export async function ensureChannel(id: string, name: string) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 150, 300],
  });
}

/** 알림 권한이 있는지 (묻지 않고 확인만) */
export async function notificationsAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** 권한이 없으면 처음 쓸 때 맥락 안에서 요청한다. 거절하면 false */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** 사용자가 알림을 거절해 둔 상태인지(아직 묻지 않은 상태는 아니다) */
export async function notificationsDenied(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    return !current.granted && current.status !== Notifications.PermissionStatus.UNDETERMINED;
  } catch {
    return false;
  }
}

/** 휴식 종료 알림 예약. 실패하면 null (앱을 보고 있을 때의 진동만 동작) */
export async function scheduleRestEnd(
  seconds: number,
  text: { channel: string; title: string; body: string },
): Promise<string | null> {
  try {
    if (seconds < 1 || !(await ensurePermission())) return null;
    await ensureChannel(REST_CHANNEL, text.channel);
    return await Notifications.scheduleNotificationAsync({
      content: { title: text.title, body: text.body, data: { kind: 'rest' }, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(seconds),
        channelId: REST_CHANNEL,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelScheduled(id: string | null) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // 이미 울렸거나 없는 알림
  }
}

/**
 * 휴식 종료 알림을 지금 바로 띄운다(안드로이드, 앱을 보고 있을 때).
 * 안드로이드는 예약 알림이 십여 초 늦게 울릴 수 있어서, 앱이 켜져 있으면 예약분을 지우고 직접 띄운다.
 */
export async function presentRestEnd(
  scheduledId: string | null,
  text: { channel: string; title: string; body: string },
) {
  try {
    await cancelScheduled(scheduledId);
    if (!(await notificationsAllowed())) return;
    await ensureChannel(REST_CHANNEL, text.channel);
    await Notifications.scheduleNotificationAsync({
      content: { title: text.title, body: text.body, data: { kind: 'rest' }, sound: true },
      trigger: { channelId: REST_CHANNEL },
    });
  } catch {
    // 알림을 못 띄워도 화면의 '휴식 끝'과 진동은 동작한다.
  }
}

/** 알림 센터에 남아 있는 휴식 종료 알림을 치운다 (확인했거나 다음 휴식이 시작됐을 때). */
export async function dismissRestNotifications() {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => n.request.content.data?.kind === 'rest')
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    // 못 치워도 동작에는 지장이 없다.
  }
}

export const CARDIO_CHANNEL = 'cardio-timer';

/** 유산소 타이머가 끝나는 시각에 울릴 알림 예약. 실패하면 null (앱을 보고 있을 때의 진동만 동작) */
export async function scheduleCardioEnd(
  seconds: number,
  text: { channel: string; title: string; body: string },
): Promise<string | null> {
  try {
    if (seconds < 1 || !(await ensurePermission())) return null;
    await ensureChannel(CARDIO_CHANNEL, text.channel);
    return await Notifications.scheduleNotificationAsync({
      content: { title: text.title, body: text.body, data: { kind: 'cardio' }, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(seconds),
        channelId: CARDIO_CHANNEL,
      },
    });
  } catch {
    return null;
  }
}

/** 알림 센터에 남아 있는 유산소 타이머 알림을 치운다 (운동을 끝내거나 다시 잴 때). */
export async function dismissCardioNotifications() {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => n.request.content.data?.kind === 'cardio')
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    // 못 치워도 동작에는 지장이 없다.
  }
}
