import { initialOf, matchesSearch } from '../hangul';

describe('hangul search', () => {
  it('음절의 초성을 구한다', () => {
    expect(initialOf('벤')).toBe('ㅂ');
    expect(initialOf('치')).toBe('ㅊ');
    expect(initialOf('a')).toBeUndefined();
  });

  it('초성만으로 찾는다', () => {
    expect(matchesSearch('ㅂㅊ', ['벤치프레스'])).toBe(true);
    expect(matchesSearch('ㅍㄹㅅ', ['벤치프레스'])).toBe(true);
    expect(matchesSearch('ㅅㅋ', ['벤치프레스'])).toBe(false);
  });

  it('초성과 완성 글자를 섞어 찾는다', () => {
    expect(matchesSearch('벤ㅊ', ['벤치프레스'])).toBe(true);
    expect(matchesSearch('인클ㄹ', ['인클라인 덤벨 프레스'])).toBe(true);
  });

  it('공백·대소문자를 무시하고 영어 이름도 본다', () => {
    expect(matchesSearch('덤벨프레스', ['인클라인 덤벨 프레스'])).toBe(true);
    expect(matchesSearch('bench', ['벤치프레스', 'Bench Press'])).toBe(true);
    expect(matchesSearch('LAT pull', [null, 'Lat Pulldown'])).toBe(true);
  });

  it('빈 검색어는 모두 맞는다', () => {
    expect(matchesSearch('  ', ['아무거나'])).toBe(true);
  });
});
