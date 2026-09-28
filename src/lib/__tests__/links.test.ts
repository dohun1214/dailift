import { LICENSES } from '@/data/licenses';
import { legalUrl } from '@/lib/links';

describe('legalUrl', () => {
  it('한국어는 페이지 첫머리, 그 밖의 언어는 영어 부분(#en)으로 연다', () => {
    expect(legalUrl('privacy', 'ko')).toBe('https://dohun1214.github.io/dailift/privacy.html');
    expect(legalUrl('terms', 'en')).toBe('https://dohun1214.github.io/dailift/terms.html#en');
  });
});

describe('LICENSES', () => {
  it('근육맵 라이브러리의 MIT 저작권 고지를 담는다', () => {
    const body = LICENSES.find((l) => l.name === 'react-native-body-highlighter');
    expect(body?.license).toBe('MIT');
    expect(body?.text).toContain('Copyright (c) 2022 ELABBASSI Hicham');
  });

  it('모든 항목에 라이선스 전문이 있다', () => {
    for (const l of LICENSES) expect(l.text.length).toBeGreaterThan(200);
  });
});
