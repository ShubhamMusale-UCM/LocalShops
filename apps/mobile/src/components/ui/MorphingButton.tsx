import React, { useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Animated, 
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TouchSpring } from './TouchSpring';

interface MorphingButtonProps {
  onPress: () => Promise<void> | void;
  title: string;
  successTitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  successIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeBgColor?: string;
  activeTextColor?: string;
  defaultBgColor?: string;
  defaultTextColor?: string;
}

export function MorphingButton({
  onPress,
  title,
  successTitle = 'Added',
  icon = 'cart-outline',
  successIcon = 'checkmark-outline',
  style,
  textStyle,
  activeBgColor = '#0D9488', // Brand 500 equivalent
  activeTextColor = '#FFFFFF',
  defaultBgColor = '#FFFFFF',
  defaultTextColor = '#000000',
}: MorphingButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  
  // Animation values
  const colorAnim = useRef(new Animated.Value(0)).current;

  const handlePress = async () => {
    if (status !== 'idle') return;

    setStatus('loading');
    try {
      await onPress();
      
      // Morph to success
      setStatus('success');
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false, // color interpolation doesn't support native driver well
      }).start();

      // Reset after delay
      setTimeout(() => {
        Animated.timing(colorAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start(() => {
          setStatus('idle');
        });
      }, 2000);

    } catch (e) {
      setStatus('idle');
    }
  };

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [defaultBgColor, activeBgColor]
  });

  return (
    <TouchSpring onPress={handlePress} style={[styles.container, style]}>
      <Animated.View style={[styles.button, { backgroundColor }]}>
        {status === 'loading' ? (
          <ActivityIndicator color={defaultTextColor} />
        ) : (
          <View style={styles.contentRow}>
            {status === 'success' && successIcon ? (
              <Ionicons name={successIcon} size={20} color={activeTextColor} />
            ) : null}
            <Text style={[styles.text, textStyle, { color: status === 'success' ? activeTextColor : defaultTextColor }]}>
              {status === 'success' ? successTitle : title}
            </Text>
            {status === 'idle' && icon ? (
              <Ionicons name={icon} size={20} color={defaultTextColor} />
            ) : null}
          </View>
        )}
      </Animated.View>
    </TouchSpring>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  button: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  }
});
