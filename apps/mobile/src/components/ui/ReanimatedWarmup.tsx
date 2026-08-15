import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  withSequence,
  interpolate,
  Extrapolate,
  Easing,
  runOnJS,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  Layout,
  FadeOut,
  FadeIn,
  FadeInRight
} from 'react-native-reanimated';

interface Props {
  onWarmupComplete: () => void;
}

export const ReanimatedWarmup: React.FC<Props> = ({ onWarmupComplete }) => {
  const warmupVal = useSharedValue(0);
  const [isRendered, setIsRendered] = useState(true);

  const style = useAnimatedStyle(() => {
    // Force compilation of interpolate and Extrapolate on the UI thread
    const dummyScale = interpolate(warmupVal.value, [0, 1], [0.5, 1], Extrapolate.CLAMP);
    return {
      opacity: warmupVal.value,
      transform: [{ scale: dummyScale }]
    };
  });

  useEffect(() => {
    // Force compilation of withSequence, withSpring, withTiming, and Easing on the UI thread
    warmupVal.value = withSequence(
      withSpring(0.5, { damping: 10, stiffness: 100 }),
      withTiming(1, { duration: 10, easing: Easing.bezier(0.16, 1, 0.3, 1) }, (finished) => {
        if (finished) {
          runOnJS(onWarmupComplete)();
        }
      })
    );
    
    // Unmount layout animations to force FadeOut compilation
    const timer = setTimeout(() => setIsRendered(false), 5);
    return () => clearTimeout(timer);
  }, [warmupVal, onWarmupComplete]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {/* 
        Force compilation of Layout animations by rendering them invisibly.
        When these mount, Reanimated compiles the layout animations.
      */}
      {isRendered && (
        <Animated.View 
          entering={FadeInDown} 
          exiting={FadeOut}
          layout={Layout}
          style={{ width: 1, height: 1, backgroundColor: 'transparent' }} 
        />
      )}
      {isRendered && (
        <Animated.View 
          entering={FadeInUp} 
          style={{ width: 1, height: 1, backgroundColor: 'transparent' }} 
        />
      )}
      {isRendered && (
        <Animated.View 
          entering={SlideInRight} 
          style={{ width: 1, height: 1, backgroundColor: 'transparent' }} 
        />
      )}
      {isRendered && (
        <Animated.View 
          entering={FadeIn} 
          style={{ width: 1, height: 1, backgroundColor: 'transparent' }} 
        />
      )}
      {isRendered && (
        <Animated.View 
          entering={FadeInRight} 
          style={{ width: 1, height: 1, backgroundColor: 'transparent' }} 
        />
      )}
    </Animated.View>
  );
};
