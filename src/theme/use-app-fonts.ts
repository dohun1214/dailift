import { IBMPlexSansKR_400Regular } from '@expo-google-fonts/ibm-plex-sans-kr/400Regular';
import { IBMPlexSansKR_500Medium } from '@expo-google-fonts/ibm-plex-sans-kr/500Medium';
import { IBMPlexSansKR_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-kr/600SemiBold';
import { IBMPlexSansKR_700Bold } from '@expo-google-fonts/ibm-plex-sans-kr/700Bold';
import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Onest_700Bold } from '@expo-google-fonts/onest/700Bold';
import { useFonts } from 'expo-font';

import { fonts } from './tokens';

/** 쓰는 굵기만 불러온다 (서체 파일 크기를 줄이려고 굵기별로 import). */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    [fonts.regular]: IBMPlexSansKR_400Regular,
    [fonts.medium]: IBMPlexSansKR_500Medium,
    [fonts.semibold]: IBMPlexSansKR_600SemiBold,
    [fonts.bold]: IBMPlexSansKR_700Bold,
    [fonts.numRegular]: Onest_400Regular,
    [fonts.numMedium]: Onest_500Medium,
    [fonts.numSemibold]: Onest_600SemiBold,
    [fonts.numBold]: Onest_700Bold,
  });
  // 서체를 못 불러와도 앱은 시스템 서체로 계속 쓸 수 있게 한다.
  return loaded || error !== null;
}
