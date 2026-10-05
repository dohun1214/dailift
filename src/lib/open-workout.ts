import { router } from 'expo-router';

let lastAt = 0;

/** 운동 화면 열기. 빠르게 두 번 눌러도 화면이 두 장 쌓이지 않게 한다. */
export function openWorkout() {
  const now = Date.now();
  if (now - lastAt < 700) return;
  lastAt = now;
  router.push('/workout');
}
