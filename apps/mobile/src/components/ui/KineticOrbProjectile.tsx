import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    runOnJS,
} from 'react-native-reanimated';

interface KineticOrbProjectileProps {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    imageUri: string;
    onComplete: () => void;
}

export function KineticOrbProjectile({
    startX,
    startY,
    endX,
    endY,
    imageUri,
    onComplete,
}: KineticOrbProjectileProps) {
    const t = useSharedValue(0);

    useEffect(() => {
        // 650ms flight duration as specified in the web prototype
        t.value = withTiming(
            1,
            { duration: 650, easing: Easing.bezier(0.16, 1, 0.3, 1) },
            (finished) => {
                if (finished) {
                    runOnJS(onComplete)();
                }
            }
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const currentT = t.value;

        // Quadratic Bezier calculation
        const controlX = (startX + endX) / 2;
        const controlY = Math.min(startY, endY) - 220; // 220px upward apex

        const x =
            Math.pow(1 - currentT, 2) * startX +
            2 * (1 - currentT) * currentT * controlX +
            Math.pow(currentT, 2) * endX;

        const y =
            Math.pow(1 - currentT, 2) * startY +
            2 * (1 - currentT) * currentT * controlY +
            Math.pow(currentT, 2) * endY;

        // Scale shrinks to 30% near impact
        const scale = 1 - currentT * 0.7;
        // Rotate for physical weight (1.5 spins = 540 degrees)
        const rotate = `${currentT * 540}deg`;
        // Slight fade out right at the end
        const opacity = 1 - currentT * 0.15;

        return {
            transform: [
                { translateX: x - 23 }, // Offset by half width (46/2)
                { translateY: y - 23 },
                { scale },
                { rotate },
            ],
            opacity,
        };
    });

    return (
        <Animated.Image
            source={{ uri: imageUri }}
            style={[styles.orb, animatedStyle]}
        />
    );
}

const styles = StyleSheet.create({
    orb: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.85)',
        zIndex: 10000,
        // Add glow shadow using elevation/shadow properties for React Native
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.65,
        shadowRadius: 24,
        elevation: 10,
    },
});
