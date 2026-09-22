import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import i18n from '@/i18n';
import { useProfile } from '@/stores/profile';

import Onboarding from '../app/onboarding';
import Welcome from '../app/welcome';

beforeAll(async () => {
  await i18n.changeLanguage('ko');
});

beforeEach(() => {
  jest.clearAllMocks();
  useProfile.setState({
    consentAcceptedAt: null,
    onboardingCompleted: false,
    experience: null,
    daysPerWeek: null,
    goal: null,
    heightCm: null,
    weight: null,
    bodyType: 'male',
  });
});

describe('시작 화면', () => {
  it('약관 동의와 만 14세 확인을 모두 해야 시작할 수 있다', async () => {
    await render(<Welcome />);
    const guest = screen.getByRole('button', { name: '로그인 없이 시작' });
    expect(guest).toBeDisabled();

    await fireEvent.press(
      screen.getByRole('checkbox', { name: '이용약관과 개인정보 처리방침에 동의해요' }),
    );
    expect(screen.getByRole('button', { name: '로그인 없이 시작' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('checkbox', { name: '만 14세 이상이에요' }));
    await fireEvent.press(screen.getByRole('button', { name: '로그인 없이 시작' }));

    expect(useProfile.getState().consentAcceptedAt).not.toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
  });
});

describe('온보딩', () => {
  it('선택해야 다음으로 넘어가고, 4단계 끝에 답변을 저장한다', async () => {
    await render(<Onboarding />);
    expect(screen.getByText('1 / 4')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: /6개월 미만/ }));
    await fireEvent.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('2 / 4')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: /주 4회/ }));
    await fireEvent.press(screen.getByRole('button', { name: '다음' }));
    await fireEvent.press(screen.getByRole('radio', { name: /근육 키우기/ }));
    await fireEvent.press(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('4 / 4')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('체중'), '68,5');
    await fireEvent.press(screen.getByRole('radio', { name: '여성형' }));
    await fireEvent.press(screen.getByRole('button', { name: '완료' }));

    const p = useProfile.getState();
    expect(p.onboardingCompleted).toBe(true);
    expect(p).toMatchObject({
      experience: 'under6m',
      daysPerWeek: 4,
      goal: 'muscle',
      weight: 68.5,
      heightCm: null,
      bodyType: 'female',
    });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('범위를 벗어난 키는 저장하지 않고 오류를 보여준다', async () => {
    await render(<Onboarding />);
    for (const name of [/처음이에요/, /주 3회/, /꾸준히 하기/]) {
      await fireEvent.press(screen.getByRole('radio', { name }));
      await fireEvent.press(screen.getByRole('button', { name: '다음' }));
    }
    await fireEvent.changeText(screen.getByLabelText('키'), '17');
    await fireEvent.press(screen.getByRole('button', { name: '완료' }));
    expect(screen.getByText('100~250 사이로 입력해 주세요')).toBeOnTheScreen();
    expect(useProfile.getState().onboardingCompleted).toBe(false);
  });

  it('건너뛰기를 누르면 그때까지의 답만 저장하고 끝낸다', async () => {
    await render(<Onboarding />);
    await fireEvent.press(screen.getByRole('radio', { name: /1년 이상/ }));
    await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
    const p = useProfile.getState();
    expect(p.onboardingCompleted).toBe(true);
    expect(p.experience).toBe('over1y');
    expect(p.daysPerWeek).toBeNull();
  });
});
