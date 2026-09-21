import { ACCENTS, MODES, resolveThemeName, themes } from '../tokens';

function luminance(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('themes', () => {
  it('포인트 색 3종 × 라이트/다크 = 6개 테마가 있다', () => {
    expect(Object.keys(themes).sort()).toEqual(
      ACCENTS.flatMap((a) => MODES.map((m) => `${a}-${m}`)).sort(),
    );
  });

  it('라이트 모드 배경은 순백이다', () => {
    for (const accent of ACCENTS) {
      expect(themes[`${accent}-light`].colors.bg).toBe('#FFFFFF');
    }
  });

  it.each(Object.entries(themes))('%s: 글자색 대비가 4.5:1 이상이다', (_name, theme) => {
    const c = theme.colors;
    expect(contrast(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text2, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onPr, c.pr)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('resolveThemeName', () => {
  it('system이면 시스템 모드를 따른다', () => {
    expect(resolveThemeName('system', 'mono', 'dark')).toBe('mono-dark');
    expect(resolveThemeName('system', 'blue', 'light')).toBe('blue-light');
  });

  it('시스템 모드를 모르면 라이트를 쓴다', () => {
    expect(resolveThemeName('system', 'lime', null)).toBe('lime-light');
  });

  it('직접 고른 모드가 시스템보다 우선한다', () => {
    expect(resolveThemeName('dark', 'lime', 'light')).toBe('lime-dark');
  });
});
