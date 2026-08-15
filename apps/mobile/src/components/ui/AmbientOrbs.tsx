import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence, 
  Easing 
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Custom hook to create a native-like bezier easing for floating animations
const createFloatEasing = () => Easing.inOut(Easing.sin);

export default function AmbientOrbs() {
  const orb1Scale = useSharedValue(1);
  const orb1Tx = useSharedValue(0);
  const orb1Ty = useSharedValue(0);

  const orb2Scale = useSharedValue(1);
  const orb2Tx = useSharedValue(0);
  const orb2Ty = useSharedValue(0);

  const orb3Scale = useSharedValue(1);
  const orb3Tx = useSharedValue(0);
  const orb3Ty = useSharedValue(0);

  useEffect(() => {
    // Orb 1 Animation (Primary Blue #2563EB)
    orb1Scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 7000, easing: createFloatEasing() }),
        withTiming(0.95, { duration: 7000, easing: createFloatEasing() })
      ),
      -1,
      true
    );
    orb1Tx.value = withRepeat(
      withSequence(
        withTiming(40, { duration: 9000, easing: createFloatEasing() }),
        withTiming(-30, { duration: 8000, easing: createFloatEasing() }),
        withTiming(0, { duration: 7000, easing: createFloatEasing() })
      ),
      -1,
      true
    );
    orb1Ty.value = withRepeat(
      withSequence(
        withTiming(-50, { duration: 10000, easing: createFloatEasing() }),
        withTiming(30, { duration: 9000, easing: createFloatEasing() }),
        withTiming(0, { duration: 8000, easing: createFloatEasing() })
      ),
      -1,
      true
    );

    // Orb 2 Animation (Accent Cyan #06B6D4)
    orb2Scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 8000, easing: createFloatEasing() }),
        withTiming(0.9, { duration: 6000, easing: createFloatEasing() })
      ),
      -1,
      true
    );
    orb2Tx.value = withRepeat(
      withSequence(
        withTiming(-60, { duration: 11000, easing: createFloatEasing() }),
        withTiming(20, { duration: 9000, easing: createFloatEasing() }),
        withTiming(0, { duration: 8000, easing: createFloatEasing() })
      ),
      -1,
      true
    );
    orb2Ty.value = withRepeat(
      withSequence(
        withTiming(60, { duration: 9500, easing: createFloatEasing() }),
        withTiming(-20, { duration: 10500, easing: createFloatEasing() }),
        withTiming(0, { duration: 8500, easing: createFloatEasing() })
      ),
      -1,
      true
    );

    // Orb 3 Animation (Purple #8B5CF6)
    orb3Scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 9000, easing: createFloatEasing() }),
        withTiming(0.85, { duration: 8000, easing: createFloatEasing() })
      ),
      -1,
      true
    );
    orb3Tx.value = withRepeat(
      withSequence(
        withTiming(50, { duration: 10000, easing: createFloatEasing() }),
        withTiming(-40, { duration: 9000, easing: createFloatEasing() }),
        withTiming(0, { duration: 8000, easing: createFloatEasing() })
      ),
      -1,
      true
    );
    orb3Ty.value = withRepeat(
      withSequence(
        withTiming(-40, { duration: 8500, easing: createFloatEasing() }),
        withTiming(40, { duration: 11500, easing: createFloatEasing() }),
        withTiming(0, { duration: 9000, easing: createFloatEasing() })
      ),
      -1,
      true
    );
  }, []);

  const orb1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: orb1Scale.value },
      { translateX: orb1Tx.value },
      { translateY: orb1Ty.value },
    ],
  }));

  const orb2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: orb2Scale.value },
      { translateX: orb2Tx.value },
      { translateY: orb2Ty.value },
    ],
  }));

  const orb3AnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: orb3Scale.value },
      { translateX: orb3Tx.value },
      { translateY: orb3Ty.value },
    ],
  }));

  // Generating a highly feathered SVG radial gradient mimics CSS blur(90px) exactly
  const renderBlurredOrb = (id: string, color: string, baseOpacity: number) => (
    <Svg height="100%" width="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={baseOpacity} />
          <Stop offset="40%" stopColor={color} stopOpacity={baseOpacity * 0.7} />
          <Stop offset="70%" stopColor={color} stopOpacity={baseOpacity * 0.3} />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Orb 1: Primary Royal Blue (#2563EB) */}
      <Animated.View style={[styles.orb, styles.orb1, orb1AnimatedStyle]}>
        {renderBlurredOrb("orb1-grad", "#2563EB", 0.35)}
      </Animated.View>

      {/* Orb 2: Electric Cyan (#06B6D4) */}
      <Animated.View style={[styles.orb, styles.orb2, orb2AnimatedStyle]}>
        {renderBlurredOrb("orb2-grad", "#06B6D4", 0.35)}
      </Animated.View>

      {/* Orb 3: Vivid Purple (#8B5CF6) */}
      <Animated.View style={[styles.orb, styles.orb3, orb3AnimatedStyle]}>
        {renderBlurredOrb("orb3-grad", "#8B5CF6", 0.35)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
  },
  orb1: {
    width: 600,
    height: 600,
    top: -200,
    left: -150,
  },
  orb2: {
    width: 550,
    height: 550,
    top: height * 0.25,
    right: -250,
  },
  orb3: {
    width: 600,
    height: 600,
    bottom: -200,
    left: -100,
  },
});
