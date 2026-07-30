import { useRef, useCallback } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';

// YouTube/Blinkit/Amazon behavior:
// - Scrolling DOWN (finger swipes up, contentOffset increases) → hide navbar
// - Scrolling UP (finger swipes down, contentOffset decreases) → show navbar
// - At very top of page → always show navbar

const SCROLL_THRESHOLD = 12;
const TOP_THRESHOLD = 8;

export const useHideTabBarOnScroll = () => {
  const { show, hide } = useTabBarVisibility();
  const lastScrollY = useRef(0);
  const isTabBarVisible = useRef(true);

  // Always show tab bar when screen gains focus
  useFocusEffect(
    useCallback(() => {
      show();
      isTabBarVisible.current = true;
      lastScrollY.current = 0;

      return () => {
        show();
        isTabBarVisible.current = true;
      };
    }, [show])
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const diff = currentY - lastScrollY.current;

      // Always show at the very top
      if (currentY <= TOP_THRESHOLD) {
        if (!isTabBarVisible.current) {
          show();
          isTabBarVisible.current = true;
        }
        lastScrollY.current = currentY;
        return;
      }

      // Scrolling DOWN (finger moves up → contentOffset increases → diff > 0) → HIDE navbar
      if (diff > SCROLL_THRESHOLD && isTabBarVisible.current) {
        hide();
        isTabBarVisible.current = false;
      }
      // Scrolling UP (finger moves down → contentOffset decreases → diff < 0) → SHOW navbar
      else if (diff < -SCROLL_THRESHOLD && !isTabBarVisible.current) {
        show();
        isTabBarVisible.current = true;
      }

      lastScrollY.current = currentY;
    },
    [show, hide]
  );

  const handleScrollEndDrag = useCallback(() => {}, []);

  const handleMomentumScrollEnd = useCallback(() => {}, []);

  return {
    onScroll: handleScroll,
    onScrollEndDrag: handleScrollEndDrag,
    onMomentumScrollEnd: handleMomentumScrollEnd,
    scrollEventThrottle: 16,
  };
};
