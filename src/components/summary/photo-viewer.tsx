import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  /** 보여 줄 사진들의 주소 */
  uris: readonly string[];
  /** 처음 보여 줄 사진의 순서. null이면 닫힌 상태 */
  index: number | null;
  closeLabel: string;
  onClose: () => void;
};

/** 이만큼 끌어내리고 놓으면 닫힌다 */
const CLOSE_PULL = 80;
/** 빠르게 쓸어내리면 조금만 끌어도 닫힌다 */
const FLICK_PULL = 24;
const FLICK_SPEED = 0.8;
/** 이만큼 끌어내렸을 때 바탕이 가장 옅어진다 */
const FADE_PULL = 240;

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/**
 * 사진 크게 보기: 검은 바탕에 한 장씩, 옆으로 밀어 넘긴다. 아래로 쓸어내리면 닫힌다.
 * iOS에서는 두 손가락으로 확대할 수 있다(확대한 동안에는 쓸어내려도 닫히지 않는다).
 */
export function PhotoViewer({ uris, index, closeLabel, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(index ?? 0);
  /** 아래로 끌어내린 거리 */
  const pull = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (index === null) return;
    setCurrent(index);
    pull.setValue(0);
  }, [index, pull]);
  const dim = pull.interpolate({
    inputRange: [0, FADE_PULL],
    outputRange: [1, 0.35],
    extrapolate: 'clamp',
  });

  // iOS: 사진이 손가락을 따라 내려오는 것은 스크롤의 당김(bounce)이 해 준다.
  const pulled = (e: ScrollEvent) =>
    (e.nativeEvent.zoomScale ?? 1) > 1.01 ? 0 : Math.max(0, -e.nativeEvent.contentOffset.y);
  const onPull = (e: ScrollEvent) => pull.setValue(pulled(e));
  const onRelease = (e: ScrollEvent) => {
    const y = pulled(e);
    const speed = -(e.nativeEvent.velocity?.y ?? 0);
    if (y > CLOSE_PULL || (y > FLICK_PULL && speed > FLICK_SPEED)) onClose();
  };

  return (
    <Modal
      visible={index !== null}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: dim }]} />
        {index !== null ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: index * width, y: 0 }}
            onMomentumScrollEnd={(e) =>
              setCurrent(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
            }
          >
            {uris.map((uri) =>
              Platform.OS === 'ios' ? (
                <ScrollView
                  key={uri}
                  style={{ width, height }}
                  contentContainerStyle={styles.page}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  centerContent
                  alwaysBounceVertical
                  alwaysBounceHorizontal={false}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={onPull}
                  onScrollEndDrag={onRelease}
                >
                  <Photo uri={uri} width={width} height={height} onClose={onClose} />
                </ScrollView>
              ) : (
                <PullPage key={uri} pull={pull} width={width} height={height} onClose={onClose}>
                  <Photo uri={uri} width={width} height={height} onClose={onClose} />
                </PullPage>
              ),
            )}
          </ScrollView>
        ) : null}
        <Animated.View
          style={[styles.top, { paddingTop: insets.top + 8, opacity: dim }]}
          pointerEvents="box-none"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
          {uris.length > 1 ? (
            <Text
              style={styles.count}
            >{`${Math.min(current, uris.length - 1) + 1} / ${uris.length}`}</Text>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

type PhotoProps = { uri: string; width: number; height: number; onClose: () => void };

/** 사진 한 장. 누르면 닫힌다. */
function Photo({ uri, width, height, onClose }: PhotoProps) {
  return (
    <Pressable onPress={onClose} accessible={false}>
      <Image source={{ uri }} style={{ width, height }} contentFit="contain" />
    </Pressable>
  );
}

type PullPageProps = {
  children: ReactNode;
  pull: Animated.Value;
  width: number;
  height: number;
  onClose: () => void;
};

/** Android: 스크롤의 당김이 없어서 손가락을 직접 따라가게 한다. */
function PullPage({ children, pull, width, height, onClose }: PullPageProps) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const responder = useMemo(() => {
    const back = () => Animated.spring(pull, { toValue: 0, useNativeDriver: false }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => pull.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > CLOSE_PULL || (g.dy > FLICK_PULL && g.vy > FLICK_SPEED)) closeRef.current();
        else back();
      },
      onPanResponderTerminate: back,
    });
  }, [pull]);
  return (
    <Animated.View
      style={[styles.page, { width, height, transform: [{ translateY: pull }] }]}
      {...responder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pressed: { opacity: 0.7 },
  count: {
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: '#FFFFFF',
  },
}));
