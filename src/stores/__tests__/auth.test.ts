import type { Session } from '@supabase/supabase-js';

import { accountInfo } from '../auth';

const session = (meta: Record<string, unknown>, email: string | undefined, provider: string) =>
  ({
    user: { user_metadata: meta, email, app_metadata: { provider } },
  }) as unknown as Session;

describe('accountInfo', () => {
  it('게스트면 null', () => {
    expect(accountInfo(null)).toBeNull();
  });

  it('이름은 full_name → name 순', () => {
    expect(accountInfo(session({ full_name: '박도훈', name: 'x' }, 'a@b.c', 'google'))).toEqual({
      name: '박도훈',
      email: 'a@b.c',
      provider: 'google',
    });
    expect(accountInfo(session({ name: 'Dohun' }, undefined, 'apple'))).toEqual({
      name: 'Dohun',
      email: null,
      provider: 'apple',
    });
    expect(accountInfo(session({}, 'a@b.c', 'apple'))?.name).toBeNull();
  });
});
