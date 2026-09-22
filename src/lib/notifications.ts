import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REST_CHANNEL = 'rest-timer';

let configured = false;

/** 앱 시작 시 한 번. 앱이 켜져 있을 때는 휴식 알림 배너를 띄우지 않는다(화면에서 진동으로 알림). */
export function configureNotifications() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const isRest = n.request.content.data?.kind === 'rest';
      return {
        shouldShowBanner: !isRest,
        shouldShowList: !isRest,
        shouldPlaySound: !isRest,
        shouldSetBadge: false,
      };
    },
  });
}

async function ensureChannel(name: string) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REST_CHANNEL, {
    name,
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 150, 300],
  });
}

/** 권한이 없으면 처음 쓸 때 맥락 안에서 요청한다. 거절하면 false */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** 휴식 종료 알림 예약. 실패하면 null (화면 진동만 동작) */
export async function scheduleRestEnd(
  seconds: number,
  text: { channel: string; title: string; body: string },
): Promise<string | null> {
  try {
    if (seconds < 1 || !(await ensurePermission())) return null;
    await ensureChannel(text.channel);
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
