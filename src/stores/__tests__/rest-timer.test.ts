import { hideRestLive, showRestLive } from '@/lib/rest-live';

import { useRestTimer } from '../rest-timer';
import { useSettings } from '../settings';

jest.mock('@/lib/rest-live', () => ({ showRestLive: jest.fn(), hideRestLive: jest.fn() }));
jest.mock('@/lib/notifications', () => ({
  cancelScheduled: jest.fn(async () => undefined),
  dismissRestNotifications: jest.fn(async () => undefined),
  notificationsAllowed: jest.fn(async () => true),
  scheduleRestEnd: jest.fn(async () => 'n1'),
}));

const show = showRestLive as jest.Mock;
const hide = hideRestLive as jest.Mock;

beforeEach(() => {
  show.mockClear();
  hide.mockClear();
  useSettings.getState().setRestOnLockScreen(true);
  useRestTimer.setState({ endsAt: null, totalSec: 0, message: null, label: null });
});

describe('휴식 타이머를 잠금 화면·알림창에 표시', () => {
  it('휴식을 시작하면 시작·종료 시각과 다음 세트 문장을 넘긴다', () => {
    useRestTimer
      .getState()
      .start(90, '벤치프레스 3세트를 시작해요', '다음 · 벤치프레스 3세트', 1_000);
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0][0]).toMatchObject({
      startsAt: 1_000,
      endsAt: 91_000,
      next: '다음 · 벤치프레스 3세트',
    });
  });

  it('시간을 늘리면 같은 표시를 새 종료 시각으로 갱신한다', () => {
    useRestTimer.getState().start(90, null, null, 1_000);
    useRestTimer.getState().adjust(15, 1_000);
    expect(show).toHaveBeenCalledTimes(2);
    const last = show.mock.calls[1][0];
    expect(last.endsAt).toBe(106_000);
    expect(last.startsAt).toBe(1_000);
    expect(last.next).toBe('');
  });

  it('설정을 끄면 띄우지 않고, 멈추면 치운다', () => {
    useSettings.getState().setRestOnLockScreen(false);
    useRestTimer.getState().start(90, null, null, 1_000);
    expect(show).not.toHaveBeenCalled();
    useRestTimer.getState().stop();
    expect(hide).toHaveBeenCalled();
  });
});
