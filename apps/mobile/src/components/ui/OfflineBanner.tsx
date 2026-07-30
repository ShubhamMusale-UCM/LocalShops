import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useNetworkState } from '../../hooks/useNetworkState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const OfflineBanner = () => {
  const { isConnected } = useNetworkState();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);

  useEffect(() => {
    if (!isConnected) {
      // Slide down
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else {
      // Slide up
      translateY.value = withTiming(-100, {
        duration: 300,
        easing: Easing.in(Easing.ease),
      });
    }
  }, [isConnected, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        { paddingTop: Math.max(insets.top, 20) },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#DC2626', // Colors.error
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999, // Render above everything
    elevation: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
  },
});
