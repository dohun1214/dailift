import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * 화면에 쓸 '지금'. 화면에 다시 들어오거나 앱이 앞으로 올 때 새로 잡는다.
 * 앱을 며칠 켜 둔 채로 두어도 날짜와 '오늘 한 운동'이 어제 것으로 남지 않게 한다.
 */
export function useToday(): Date {
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => setNow(new Date()), []);
  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  return now;
}
