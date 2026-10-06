import {
  againMinutes,
  dateKey,
  joinTime,
  planNotifications,
  type Supplement,
  sortSupplements,
  splitTime,
  thisWeek,
  todayList,
  weekStart,
  wrapMinutes,
} from '../supplements';

const base: Supplement = {
  id: 'a',
  name: '오메가3',
  dose: '1,000 mg',
  timing: 'time',
  timeMin: 540,
  afterMin: 30,
  notify: true,
  renotify: true,
  active: true,
  createdAt: 0,
};
const supp = (over: Partial<Supplement>): Supplement => ({ ...base, ...over });
/** 2026-10-06은 화요일 → weekday 3 (1 = 일) */
const at = (h: number, m = 0) => new Date(2026, 9, 6, h, m);

describe('시각', () => {
  it('날짜 글자는 기기 현지 날짜다', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('오전/오후 · 시 · 분으로 나누고 다시 합친다', () => {
    expect(splitTime(0)).toEqual({ pm: false, hour12: 12, minute: 0 });
    expect(splitTime(540)).toEqual({ pm: false, hour12: 9, minute: 0 });
    expect(splitTime(12 * 60 + 5)).toEqual({ pm: true, hour12: 12, minute: 5 });
    expect(splitTime(22 * 60 + 30)).toEqual({ pm: true, hour12: 10, minute: 30 });
    for (const m of [0, 5, 540, 725, 1350, 1435]) {
      const t = splitTime(m);
      expect(joinTime(t.pm, t.hour12, t.minute)).toBe(m);
    }
  });
  it('5분 단위로 맞추고 하루를 돈다', () => {
    expect(wrapMinutes(-5)).toBe(1435);
    expect(wrapMinutes(1440)).toBe(0);
    expect(wrapMinutes(543)).toBe(545);
  });
  it('다시 알림은 한 시간 뒤, 자정을 넘기지 않는다', () => {
    expect(againMinutes(540)).toBe(600);
    expect(againMinutes(23 * 60 + 30)).toBe(1439);
  });
});

describe('오늘 목록', () => {
  const list = [
    supp({ id: 'c', name: '크레아틴', timing: 'after_workout' }),
    supp({ id: 'b', name: '마그네슘', timeMin: 1320, active: false }),
    supp({ id: 'd', name: '비타민 D', createdAt: 5 }),
    supp({ id: 'a' }),
  ];
  it('정해진 시각이 먼저, 운동 후가 뒤', () => {
    expect(sortSupplements(list).map((s) => s.id)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('사용 중인 것만 세고 사용 안 하는 것은 따로 둔다', () => {
    const t = todayList(list, new Set(['a', 'b']));
    expect(t.active.map((s) => [s.id, s.taken])).toEqual([
      ['a', true],
      ['d', false],
      ['c', false],
    ]);
    expect(t.inactive.map((s) => s.id)).toEqual(['b']);
    expect([t.done, t.total]).toEqual([1, 3]);
  });
});

describe('이번 주', () => {
  it('월요일부터 일요일까지, 영양제 단위로 세고 그날 없던 영양제는 빼고 본다', () => {
    const list = [
      supp({ id: 'a' }),
      supp({ id: 'b', createdAt: new Date(2026, 9, 6, 12).getTime() }),
      supp({ id: 'x', active: false }),
    ];
    const logs = [
      { supplementId: 'a', date: '2026-10-04' }, // 지난주 일요일 — 안 센다
      { supplementId: 'a', date: '2026-10-05' },
      { supplementId: 'a', date: '2026-10-05' },
      { supplementId: 'x', date: '2026-10-05' },
      { supplementId: 'a', date: '2026-10-06' },
      { supplementId: 'a', date: '2026-10-07' },
      { supplementId: 'b', date: '2026-10-07' },
      { supplementId: 'a', date: '2026-10-09' }, // 오지 않은 날 — 안 센다
    ];
    const days = thisWeek(list, logs, new Date(2026, 9, 7, 8));
    expect(days.map((d) => dateKey(d.date))).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(days.map((d) => [d.count, d.total, d.complete])).toEqual([
      [1, 1, true],
      [1, 2, false],
      [2, 2, true],
      [0, 0, false],
      [0, 0, false],
      [0, 0, false],
      [0, 0, false],
    ]);
    expect(days.map((d) => d.today)).toEqual([false, false, true, false, false, false, false]);
    expect(days.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
  });
  it('일요일은 그 주의 마지막 날이다', () => {
    const days = thisWeek([supp({ id: 'a' })], [], new Date(2026, 9, 11, 23));
    expect(dateKey(days[0]?.date as Date)).toBe('2026-10-05');
    expect(days[6]?.today).toBe(true);
    expect(days.some((d) => d.future)).toBe(false);
    expect(dateKey(weekStart(new Date(2026, 9, 12, 0, 1)))).toBe('2026-10-12');
  });
  it('영양제가 없으면 다 먹은 날도 없다', () => {
    expect(thisWeek([], [], at(8)).every((d) => !d.complete)).toBe(true);
  });
});

describe('알림 계획', () => {
  const plan = (
    supplements: Supplement[],
    taken: string[] = [],
    now = at(8),
    workoutEndedAt: number | null = null,
    budget?: number,
  ) => planNotifications({ supplements, takenToday: new Set(taken), now, workoutEndedAt, budget });

  it('같은 시각은 하나로 묶어 요일마다 건다', () => {
    const out = plan([supp({ id: 'a' }), supp({ id: 'd', name: '비타민 D', renotify: false })]);
    const due = out.filter((n) => n.kind === 'due');
    const again = out.filter((n) => n.kind === 'again');
    expect(due).toHaveLength(7);
    expect(again).toHaveLength(7);
    expect(due[0]?.names).toEqual(['오메가3', '비타민 D']);
    expect(again[0]?.names).toEqual(['오메가3']);
    expect(due.map((n) => n.trigger)).toContainEqual({
      type: 'weekly',
      weekday: 3,
      hour: 9,
      minute: 0,
    });
    expect(again[0]?.trigger).toMatchObject({ hour: 10, minute: 0 });
    expect(new Set(out.map((n) => n.id)).size).toBe(out.length);
  });

  it('알림을 끈 것 · 사용 안 하는 것은 걸지 않는다', () => {
    expect(plan([supp({ notify: false }), supp({ id: 'b', active: false })])).toEqual([]);
  });

  it('다 먹었으면 오늘 몫만 빠진다', () => {
    const out = plan([supp({ id: 'a' })], ['a']);
    expect(out).toHaveLength(12);
    expect(out.some((n) => n.trigger.type === 'weekly' && n.trigger.weekday === 3)).toBe(false);
    expect(out.some((n) => n.trigger.type === 'date')).toBe(false);
  });

  it('일부만 먹었으면 남은 것만 오늘 한 번짜리로 건다', () => {
    const out = plan([supp({ id: 'a' }), supp({ id: 'd', name: '비타민 D' })], ['a']);
    const today = out.filter((n) => n.trigger.type === 'date');
    expect(today.map((n) => [n.kind, n.names])).toEqual([
      ['due', ['비타민 D']],
      ['again', ['비타민 D']],
    ]);
    expect(today[0]?.trigger).toEqual({ type: 'date', at: at(9).getTime() });
    expect(today[1]?.trigger).toEqual({ type: 'date', at: at(10).getTime() });
    expect(out.filter((n) => n.trigger.type === 'weekly')).toHaveLength(12);
  });

  it('시각이 지난 뒤에는 요일 알림이 돌아온다(다음 주 몫)', () => {
    const out = plan([supp({ id: 'a' })], ['a'], at(9, 30));
    expect(out.filter((n) => n.kind === 'due')).toHaveLength(7);
    // 다시 알림(10:00)은 아직 안 왔으니 오늘 몫이 빠져 있다
    expect(out.filter((n) => n.kind === 'again')).toHaveLength(6);
    expect(plan([supp({ id: 'a' })], ['a'], at(10, 1))).toHaveLength(14);
  });

  it('이름이 바뀌면 id도 바뀐다(다시 걸린다)', () => {
    const a = plan([supp({ id: 'a' })]).map((n) => n.id);
    const b = plan([supp({ id: 'a', name: '오메가-3' })]).map((n) => n.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it('한도를 넘으면 늦은 시각 묶음부터 매일 반복으로 줄인다', () => {
    const list = [540, 720, 1080].map((timeMin, i) => supp({ id: `s${i}`, timeMin }));
    const out = plan(list, [], at(8), null, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.filter((n) => n.trigger.type === 'daily').map((n) => n.trigger)).toEqual([
      { type: 'daily', hour: 18, minute: 0 },
      { type: 'daily', hour: 19, minute: 0 },
    ]);
    expect(out.filter((n) => n.trigger.type === 'weekly')).toHaveLength(28);
  });

  describe('운동 후', () => {
    const creatine = supp({ id: 'c', name: '크레아틴', timing: 'after_workout', afterMin: 30 });
    const end = at(19, 12).getTime();

    it('운동을 마치지 않았으면 걸지 않는다', () => {
      expect(plan([creatine])).toEqual([]);
    });
    it('끝난 시각 + N분에 한 번, 한 시간 뒤 한 번 더', () => {
      const out = plan([creatine], [], at(19, 12), end);
      expect(out.map((n) => [n.kind, n.trigger])).toEqual([
        ['after', { type: 'date', at: at(19, 42).getTime() }],
        ['afterAgain', { type: 'date', at: at(20, 42).getTime() }],
      ]);
    });
    it('이미 지난 시각이면 걸지 않는다', () => {
      expect(plan([creatine], [], at(21), end)).toEqual([]);
      expect(plan([creatine], [], at(20), end).map((n) => n.kind)).toEqual(['afterAgain']);
    });
    it('먹었으면 걸지 않는다', () => {
      expect(plan([creatine], ['c'], at(19, 12), end)).toEqual([]);
    });
    it("'바로'는 방금 끝났을 때만 건다", () => {
      const now = new Date(end + 2000);
      const out = plan([{ ...creatine, afterMin: 0, renotify: false }], [], now, end);
      expect(out.map((n) => n.trigger)).toEqual([{ type: 'date', at: now.getTime() + 1000 }]);
    });
    it('어제 마친 운동은 보지 않는다', () => {
      expect(plan([creatine], [], at(0, 5), new Date(2026, 9, 5, 23, 50).getTime())).toEqual([]);
    });
  });
});
