import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Dimensions, 
  Modal, 
  Pressable, 
  Platform 
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing, 
  interpolate,
  Extrapolation,
  runOnJS
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

const { width, height } = Dimensions.get('window');

// We use 150% of the max screen dimension to guarantee full coverage
const MAX_RADIUS = Math.max(width, height) * 1.5;

interface CircularSearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (text: string) => void;
  placeholder?: string;
}

export default function CircularSearchOverlay({ 
  visible, 
  onClose, 
  onSearch,
  placeholder = "Search..."
}: CircularSearchOverlayProps) {
  const { colors, isDarkMode } = useTheme();
  const [shouldRender, setShouldRender] = useState(false);
  const progress = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      
      // fluid ease-in-out curve for an organic feeling
      progress.value = withTiming(1, { 
        duration: 700, 
        easing: Easing.bezier(0.85, 0, 0.15, 1) 
      }, () => {
        // Auto-focus after expansion is nearly complete
        runOnJS(focusInput)();
      });

      // Web: Disable background scroll
      if (Platform.OS === 'web') {
        document.body.style.overflow = 'hidden';
      }
    } else if (shouldRender) {
      inputRef.current?.blur();
      
      // Shrinks back down smoothly
      progress.value = withTiming(0, { 
        duration: 700, 
        easing: Easing.bezier(0.85, 0, 0.15, 1) 
      }, () => {
        runOnJS(setShouldRender)(false);
        runOnJS(setQuery)('');
      });

      // Web: Re-enable background scroll
      if (Platform.OS === 'web') {
        document.body.style.overflow = 'auto';
      }
    }
    
    return () => {
       if (Platform.OS === 'web') document.body.style.overflow = 'auto';
    };
  }, [visible]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const circleStyle = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], [0, MAX_RADIUS * 2], Extrapolation.CLAMP);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      // Centered at 50% X and 10% Y
      top: height * 0.1 - size / 2,
      left: width / 2 - size / 2,
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      // Fade in the content as the circle expands
      opacity: interpolate(progress.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(progress.value, [0.4, 1], [15, 0], Extrapolation.CLAMP) }
      ]
    };
  });

  if (!shouldRender) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 999 }]}>
      {/* Expanding Background Circle to mimic clip-path reveal */}
      <Animated.View style={[
        styles.circle, 
        circleStyle, 
        { backgroundColor: colors.background }
      ]} />

      {/* Invisible backdrop to catch taps outside search bar */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      
      {/* Search UI */}
      <Animated.View style={[styles.contentContainer, contentStyle]}>
         <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
           <Pressable onPress={onClose} style={styles.backBtn} hitSlop={10}>
             <Ionicons name="arrow-back" size={24} color={colors.text} />
           </Pressable>
           
           <TextInput
             ref={inputRef}
             style={[styles.input, { color: colors.text }]}
             placeholder={placeholder}
             placeholderTextColor={colors.textSecondary}
             returnKeyType="search"
             value={query}
             onChangeText={setQuery}
             onSubmitEditing={handleSubmit}
             autoCapitalize="none"
             autoCorrect={false}
           />
           
           {query.length > 0 && (
             <Pressable onPress={() => setQuery('')} hitSlop={10}>
               <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
             </Pressable>
           )}
         </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
  },
  contentContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 54,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  backBtn: {
    padding: 5,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 10,
  }
});
