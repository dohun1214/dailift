import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
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

/** 사진 크게 보기: 검은 바탕에 한 장씩, 옆으로 밀어 넘긴다. iOS에서는 두 손가락으로 확대할 수 있다. */
export function PhotoViewer({ uris, index, closeLabel, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(index ?? 0);
  useEffect(() => {
    if (index !== null) setCurrent(index);
  }, [index]);

  return (
    <Modal
      visible={index !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
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
            {uris.map((uri) => (
              <ScrollView
                key={uri}
                style={{ width, height }}
                contentContainerStyle={styles.page}
                maximumZoomScale={3}
                minimumZoomScale={1}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Pressable onPress={onClose} accessible={false}>
                  <Image source={{ uri }} style={{ width, height }} contentFit="contain" />
                </Pressable>
              </ScrollView>
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: '#000000' },
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
