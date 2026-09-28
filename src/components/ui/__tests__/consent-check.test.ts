import { splitLinks } from '../consent-check';

const noop = () => undefined;

describe('splitLinks', () => {
  it('문장 속 링크 문구를 순서대로 떼어 낸다', () => {
    const segs = splitLinks('이용약관과 개인정보 처리방침에 동의해요', [
      { text: '개인정보 처리방침', onPress: noop },
      { text: '이용약관', onPress: noop },
    ]);
    expect(segs.map((s) => [s.text, !!s.onPress])).toEqual([
      ['이용약관', true],
      ['과 ', false],
      ['개인정보 처리방침', true],
      ['에 동의해요', false],
    ]);
  });

  it('문장에 없는 링크는 무시한다', () => {
    expect(splitLinks('동의해요', [{ text: '약관', onPress: noop }])).toEqual([
      { text: '동의해요' },
    ]);
  });
});
