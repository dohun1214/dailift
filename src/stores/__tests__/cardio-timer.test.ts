import { hideCardioLive, showCardioLive } from '@/lib/cardio-live';
import { cancelScheduled, scheduleCardioEnd } from '@/lib/notifications';

import { useCardioTimer } from '../cardio-timer';
import { useSettings } from '../settings';

jest.mock('@/lib/cardio-live', () => ({ showCardioLive: jest.fn(), hideCardioLive: jest.fn() }));
jest.mock('@/lib/notifications', () => ({
  cancelScheduled: jest.fn(async () => undefined),
  dismissCardioNotifications: jest.fn(async () => undefined),
  scheduleCardioEnd: jest.fn(async () => 'n1'),
}));

const show = showCardioLive as jest.Mock;
const hide = hideCardioLive as jest.Mock;
const schedule = scheduleCardioEnd as jest.Mock;
const cancel = cancelScheduled as jest.Mock;
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  for (const mock of [show, hide, schedule, cancel]) mock.mockClear();
  useSettings.getState().setRestOnLockScreen(true);
  useCardioTimer.setState({ timers: {}, plans: {}, notifications: {}, lastLimitSec: 1200 });
});

describe('유산소 스톱워치', () => {
  it('시작하면 잠금 화면에 올라가는 시간을 띄우고, 알림은 예약하지 않는다', () => {
    useCardioTimer.getState().start('a', { name: '러닝머신', now: 10_000 });
    expect(schedule).not.toHaveBeenCalled();
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({ countdown: false, startsAt: 10_000, endsAt: null, frozen: '' }),
    );
    expect(show.mock.calls[0][0].name).toBe('러닝머신');
  });

  it('일시정지하면 멈춘 시간을 글자로 보여 주고, 이어서 재면 쌓인 시간부터 간다', () => {
    const store = useCardioTimer.getState();
    store.start('a', { name: '러닝머신', now: 0 });
    store.pause('a', 95_000);
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ frozen: '1:35' }));
    store.start('a', { now: 200_000 });
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({ frozen: '', startsAt: 105_000, name: '러닝머신' }),
    );
    expect(useCardioTimer.getState().take('a', 205_000)).toBe(100);
    expect(hide).toHaveBeenCalled();
  });
});

describe('유산소 타이머', () => {
  it('끝나는 시각에 알림을 예약하고 잠금 화면에 남은 시간을 띄운다', async () => {
    useCardioTimer.getState().start('a', { name: '러닝머신', limitSec: 600, now: 1_000 });
    expect(schedule).toHaveBeenCalledWith(
      600,
      expect.objectContaining({ title: expect.any(String) }),
    );
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({ countdown: true, startsAt: 1_000, endsAt: 601_000 }),
    );
    await flush();
    expect(useCardioTimer.getState().notifications).toEqual({ a: 'n1' });
    expect(useCardioTimer.getState().lastLimitSec).toBe(600);
  });

  it('일시정지하면 알림을 지우고, 이어서 재면 남은 시간으로 다시 예약한다', async () => {
    const store = useCardioTimer.getState();
    store.start('a', { limitSec: 600, now: 0 });
    await flush();
    store.pause('a', 240_000);
    expect(cancel).toHaveBeenCalledWith('n1');
    expect(useCardioTimer.getState().notifications).toEqual({});
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({ frozen: '6:00', frozenProgress: 0.6 }),
    );
    schedule.mockClear();
    store.start('a', { now: 1_000_000 });
    expect(schedule).toHaveBeenCalledWith(360, expect.anything());
  });

  it('정한 시간을 넘겨서 꺼내도 정한 시간까지만 돌려주고, 울릴 알림은 지우지 않는다', async () => {
    useCardioTimer.getState().start('a', { limitSec: 600, now: 0 });
    await flush();
    cancel.mockClear();
    expect(useCardioTimer.getState().take('a', 9_000_000)).toBe(600);
    expect(useCardioTimer.getState()).toMatchObject({ timers: {}, notifications: {} });
    expect(cancel).not.toHaveBeenCalledWith('n1');
  });

  it('다 되기 전에 끝내면 예약한 알림을 지운다', async () => {
    useCardioTimer.getState().start('a', { limitSec: 600, now: 0 });
    await flush();
    expect(useCardioTimer.getState().take('a', 100_000)).toBe(100);
    expect(cancel).toHaveBeenCalledWith('n1');
  });

  it('그 사이 멈췄으면 늦게 예약된 알림은 버린다', async () => {
    const store = useCardioTimer.getState();
    store.start('a', { limitSec: 600, now: 0 });
    store.pause('a', 1_000);
    await flush();
    expect(cancel).toHaveBeenCalledWith('n1');
    expect(useCardioTimer.getState().notifications).toEqual({});
  });
});

describe('재는 방식 고르기 · 정리', () => {
  it('고른 방식과 마지막 타이머 시간을 기억한다', () => {
    useCardioTimer.getState().setPlan('a', { mode: 'timer', limitSec: 900 });
    expect(useCardioTimer.getState().plans.a).toEqual({ mode: 'timer', limitSec: 900 });
    expect(useCardioTimer.getState().lastLimitSec).toBe(900);
  });

  it('운동을 끝내면 모두 지우고 잠금 화면 표시도 내린다', async () => {
    const store = useCardioTimer.getState();
    store.setPlan('a', { mode: 'timer', limitSec: 900 });
    store.start('a', { limitSec: 900, now: 0 });
    await flush();
    hide.mockClear();
    store.clear();
    expect(useCardioTimer.getState()).toMatchObject({ timers: {}, plans: {}, notifications: {} });
    expect(cancel).toHaveBeenCalledWith('n1');
    expect(hide).toHaveBeenCalled();
  });

  it("'잠금 화면에 표시'를 꺼 두면 띄우지 않는다", () => {
    useSettings.getState().setRestOnLockScreen(false);
    useCardioTimer.getState().start('a', { now: 0 });
    expect(show).not.toHaveBeenCalled();
  });
});

describe('종목 빼기 되돌리기', () => {
  it('지웠던 스톱워치와 목표 시간을 그대로 되살리고, 돌던 타이머는 알림을 다시 건다', async () => {
    const store = useCardioTimer.getState();
    const now = Date.now();
    store.start('a', { name: '러닝머신', limitSec: 600, now });
    store.start('b', { name: '사이클', now });
    store.pause('b', now + 30_000);
    await flush();
    const { timers, plans } = useCardioTimer.getState();
    useCardioTimer.getState().clear(['a', 'b']);
    expect(useCardioTimer.getState().timers).toEqual({});
    schedule.mockClear();

    useCardioTimer.getState().restore(timers, plans);
    expect(useCardioTimer.getState().timers).toEqual(timers);
    expect(useCardioTimer.getState().plans).toEqual(plans);
    await flush();
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});
