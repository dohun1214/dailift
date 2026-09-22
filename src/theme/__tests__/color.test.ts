import { withAlpha } from '../color';

describe('withAlpha', () => {
  it('hex를 rgba로', () => {
    expect(withAlpha('#15171A', 0.6)).toBe('rgba(21, 23, 26, 0.6)');
    expect(withAlpha('red', 0.5)).toBe('red');
  });
});
