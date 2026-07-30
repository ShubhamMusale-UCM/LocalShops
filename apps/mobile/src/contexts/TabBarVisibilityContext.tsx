import React, { createContext, useContext, useCallback } from 'react';
import {
  useSharedValue,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';

// ─── Design System Spring Config ────────────────────────
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 140,
  mass: 0.8,
};

const TAB_BAR_TRANSLATE_HIDE = 120;

// ─── Context Types ──────────────────────────────────────
interface TabBarVisibilityContextType {
  translateY: SharedValue<number>;
  show: () => void;
  hide: () => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType>({
  translateY: { value: 0 } as SharedValue<number>,
  show: () => {},
  hide: () => {},
});

// ─── Provider ───────────────────────────────────────────
export const TabBarVisibilityProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const translateY = useSharedValue(0);

  const show = useCallback(() => {
    'worklet';
    translateY.value = withSpring(0, SPRING_CONFIG);
  }, [translateY]);

  const hide = useCallback(() => {
    'worklet';
    translateY.value = withSpring(TAB_BAR_TRANSLATE_HIDE, SPRING_CONFIG);
  }, [translateY]);

  return (
    <TabBarVisibilityContext.Provider value={{ translateY, show, hide }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
};

// ─── Hook ───────────────────────────────────────────────
export const useTabBarVisibility = () => {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error(
      'useTabBarVisibility must be used within TabBarVisibilityProvider'
    );
  }
  return context;
};
