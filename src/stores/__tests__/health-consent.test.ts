import { BODY_CONSENT_TABLES, CONSENT_TABLES } from '@/db/schema';

import {
  consentSkippedTables,
  shouldAskBodyBackup,
  shouldAskDietBackup,
  useHealthConsent,
} from '../health-consent';

const state = () => useHealthConsent.getState();

describe('건강 데이터 동의', () => {
  beforeEach(() => state().reset());

  it('처음에는 동의가 없어 식단 표와 체성분 표를 건너뛴다', () => {
    expect(state().dietAcceptedAt).toBeNull();
    expect(consentSkippedTables()).toEqual([...CONSENT_TABLES, ...BODY_CONSENT_TABLES]);
  });

  it('식단 동의와 체성분 동의는 따로다', () => {
    state().setDiet(1000);
    expect(consentSkippedTables()).toEqual(BODY_CONSENT_TABLES);
    state().setBody(2000);
    expect(consentSkippedTables()).toEqual([]);
    state().setDiet(null);
    expect(consentSkippedTables()).toEqual(CONSENT_TABLES);
  });

  it('체성분 안내 카드도 같은 규칙이고 식단 카드를 접어도 따로 남는다', () => {
    expect(shouldAskBodyBackup(true, state())).toBe(false);
    state().setDiet(null);
    state().setBody(null);
    state().dismissDietAsk();
    expect(shouldAskBodyBackup(true, state())).toBe(true);
    expect(shouldAskBodyBackup(false, state())).toBe(false);
    state().dismissBodyAsk();
    expect(shouldAskBodyBackup(true, state())).toBe(false);
  });

  it('체성분 백업을 그만한 사람에게 다시 묻지 않는다', () => {
    state().setBody(1000);
    state().setBody(null);
    expect(state().bodyAcceptedAt).toBeNull();
    expect(shouldAskBodyBackup(true, state())).toBe(false);
  });

  it('안내 카드는 로그인했고 서버에서 확인했고 동의하지 않았을 때만 보인다', () => {
    // 아직 서버에 물어보기 전
    expect(shouldAskDietBackup(true, state())).toBe(false);
    state().setDiet(null);
    expect(shouldAskDietBackup(true, state())).toBe(true);
    expect(shouldAskDietBackup(false, state())).toBe(false);
    state().setDiet(1000);
    expect(shouldAskDietBackup(true, state())).toBe(false);
  });

  it("'기기에만 둘게요'를 고르면 다시 묻지 않는다", () => {
    state().setDiet(null);
    state().dismissDietAsk();
    expect(shouldAskDietBackup(true, state())).toBe(false);
  });

  it('동의했다가 그만한 사람에게도 다시 묻지 않는다', () => {
    state().setDiet(1000);
    state().setDiet(null);
    expect(state().dietAcceptedAt).toBeNull();
    expect(shouldAskDietBackup(true, state())).toBe(false);
  });

  it('계정이 바뀌면(reset) 처음부터 다시 확인한다', () => {
    state().setDiet(1000);
    state().reset();
    expect(state()).toMatchObject({ dietAcceptedAt: null, known: false, dietAskDismissed: false });
  });
});
