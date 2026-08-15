import React, { useRef } from 'react';
import { Pressable, PressableProps, Animated, StyleProp, ViewStyle, View } from 'react-native';

interface TouchSpringProps extends PressableProps {
  children: React.ReactNode;
  activeScale?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  tension?: number;
  friction?: number;
}

export function TouchSpring({
  children,
  activeScale = 0.92,
  style,
  contentContainerStyle,
  tension = 160,
  friction = 14,
  onPressIn,
  onPressOut,
  ...rest
}: TouchSpringProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    Animated.spring(scaleAnim, {
      toValue: activeScale,
      useNativeDriver: true,
      tension,
      friction,
    }).start();
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: tension * 1.2, // slightly faster recovery
      friction: friction * 0.8,
    }).start();
    if (onPressOut) onPressOut(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      {...rest}
    >
      <Animated.View style={[contentContainerStyle, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
