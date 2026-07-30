// components/reviews/PhotoReview.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    Modal,
    StyleSheet,
    useWindowDimensions,
    ScrollView,
    Animated,
    Pressable,
    Platform,
    StatusBar,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Design System ────────────────────────────────────────────────────────────
const DS = {
    primary: '#0D9488',
    primaryDark: '#0F766E',
    primaryFaded: 'rgba(13,148,136,0.08)',
    primaryLight: '#CCFBF1',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    gray900: '#1F2937',
    gray700: '#4B5563',
    gray600: '#6B7280',
    gray500: '#9CA3AF',
    gray400: '#D1D5DB',
    gray300: '#E5E7EB',
    gray200: '#EEF2F6',
    gray100: '#F3F4F6',
    gray50: '#F9FAFB',
    white: '#FFFFFF',
    card: '#FFFFFF',
    border: '#F1F5F9',
    background: '#F8FAFC',
    radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface PhotoReviewItem {
    id: string;
    photo: string;
    author: {
        name: string;
        avatar?: string;
    };
    rating: number;
    comment: string;
    timestamp: string;
}

interface PhotoReviewProps {
    reviews: PhotoReviewItem[];
    onPhotoPress?: (photo: string) => void;
    onViewAll?: () => void;
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRow: React.FC<{ rating: number; size?: number }> = ({
    rating,
    size = 13,
}) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
                key={s}
                name={s <= rating ? 'star' : 'star-outline'}
                size={size}
                color={s <= rating ? DS.warning : DS.gray300}
            />
        ))}
    </View>
);

// ─── Photo Thumbnail ──────────────────────────────────────────────────────────
const PhotoThumbnail: React.FC<{
    review: PhotoReviewItem;
    size: number;
    index: number;
    isLast?: boolean;
    remainingCount?: number;
    onPress: () => void;
}> = ({ review, size, index, isLast, remainingCount = 0, onPress }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const pressScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const delay = index * 70;
        setTimeout(() => {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    damping: 14,
                    stiffness: 160,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }, delay);
    }, []);

    const handlePressIn = () => {
        Animated.spring(pressScale, {
            toValue: 0.94,
            damping: 14,
            stiffness: 300,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(pressScale, {
            toValue: 1,
            damping: 12,
            stiffness: 200,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Animated.View
            style={{
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
            }}
        >
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[
                    styles.thumbContainer,
                    { width: size, height: size },
                ]}
            >
                <Animated.View
                    style={[
                        { width: '100%', height: '100%' },
                        { transform: [{ scale: pressScale }] },
                    ]}
                >
                    <Image
                        source={{ uri: review.photo }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                    />

                    {/* Gradient overlay */}
                    <View style={styles.thumbGradient} />

                    {/* Rating badge */}
                    <View style={styles.thumbRating}>
                        <Ionicons name="star" size={9} color={DS.warning} />
                        <Text style={styles.thumbRatingText}>{review.rating}</Text>
                    </View>

                    {/* Overflow overlay */}
                    {isLast && remainingCount > 0 && (
                        <View style={styles.overflowOverlay}>
                            <Text style={styles.overflowText}>+{remainingCount}</Text>
                            <Text style={styles.overflowSub}>more</Text>
                        </View>
                    )}
                </Animated.View>
            </Pressable>
        </Animated.View>
    );
};

// ─── Modal Header ─────────────────────────────────────────────────────────────
const ModalHeader: React.FC<{
    current: number;
    total: number;
    onClose: () => void;
}> = ({ current, total, onClose }) => {
    const topOffset = Platform.select({
        ios: 54,
        android: (StatusBar.currentHeight ?? 24) + 12,
        default: 54,
    });

    return (
        <View style={[styles.modalHeader, { paddingTop: topOffset }]}>
            {/* Close button */}
            <Pressable
                onPress={onClose}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close photo viewer"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <View style={styles.modalCloseBtnInner}>
                    <Ionicons name="close" size={20} color={DS.white} />
                </View>
            </Pressable>

            {/* Counter pill */}
            <View style={styles.modalCounter}>
                <Ionicons name="images-outline" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.modalCounterText}>
                    {current} / {total}
                </Text>
            </View>

            {/* Share button placeholder */}
            <Pressable style={styles.modalActionBtn}>
                <View style={styles.modalCloseBtnInner}>
                    <Ionicons name="share-outline" size={18} color={DS.white} />
                </View>
            </Pressable>
        </View>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PhotoReview: React.FC<PhotoReviewProps> = ({
    reviews,
    onPhotoPress,
    onViewAll,
}) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [currentModalIndex, setCurrentModalIndex] = useState(0);
    const { width, height } = useWindowDimensions();

    // Entry animation for entire section
    const sectionOpacity = useRef(new Animated.Value(0)).current;
    const sectionTranslate = useRef(new Animated.Value(20)).current;

    // Modal animations
    const modalScaleAnim = useRef(new Animated.Value(0.92)).current;
    const modalOpacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(sectionOpacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(sectionTranslate, {
                toValue: 0,
                damping: 14,
                stiffness: 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const filteredPhotos = reviews.filter((r) => r.photo);
    const visiblePhotos = filteredPhotos.slice(0, 9);
    const GRID_GAP = 6;
    const GRID_PADDING = 16;
    const photoSize =
        (width - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

    const openModal = useCallback(
        (index: number) => {
            setCurrentModalIndex(index);
            setSelectedIndex(index);
            onPhotoPress?.(filteredPhotos[index]?.photo ?? '');

            Animated.parallel([
                Animated.spring(modalScaleAnim, {
                    toValue: 1,
                    damping: 14,
                    stiffness: 160,
                    useNativeDriver: true,
                }),
                Animated.timing(modalOpacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        },
        [filteredPhotos, onPhotoPress],
    );

    const closeModal = useCallback(() => {
        Animated.parallel([
            Animated.spring(modalScaleAnim, {
                toValue: 0.92,
                damping: 14,
                stiffness: 200,
                useNativeDriver: true,
            }),
            Animated.timing(modalOpacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => setSelectedIndex(null));
    }, []);

    const currentReview = filteredPhotos[currentModalIndex];

    // ── Empty State ──
    if (filteredPhotos.length === 0) {
        return (
            <Animated.View
                style={[
                    styles.container,
                    {
                        opacity: sectionOpacity,
                        transform: [{ translateY: sectionTranslate }],
                    },
                ]}
            >
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>Customer Photos</Text>
                        <Text style={styles.sectionSubtitle}>
                            Real photos from verified buyers
                        </Text>
                    </View>
                </View>
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconCircle}>
                        <Ionicons name="camera-outline" size={32} color={DS.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No photos yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Be the first to share a photo with your review
                    </Text>
                </View>
            </Animated.View>
        );
    }

    return (
        <>
            <Animated.View
                style={[
                    styles.container,
                    {
                        opacity: sectionOpacity,
                        transform: [{ translateY: sectionTranslate }],
                    },
                ]}
            >
                {/* ── Section Header ── */}
                <View style={styles.sectionHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                            <Text style={styles.sectionTitle}>Customer Photos</Text>
                            <View style={styles.photoCountPill}>
                                <Text style={styles.photoCountText}>
                                    {filteredPhotos.length}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.sectionSubtitle}>
                            Real photos from verified buyers
                        </Text>
                    </View>
                    {filteredPhotos.length > 9 && (
                        <TouchableOpacity
                            onPress={onViewAll}
                            style={styles.seeAllBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.seeAllText}>See all</Text>
                            <Ionicons
                                name="chevron-forward"
                                size={14}
                                color={DS.primary}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Photo Grid ── */}
                <View style={styles.photoGrid}>
                    {visiblePhotos.map((review, idx) => {
                        const isLast = idx === 8 && filteredPhotos.length > 9;
                        const remaining = filteredPhotos.length - 9;
                        return (
                            <PhotoThumbnail
                                key={review.id}
                                review={review}
                                size={photoSize}
                                index={idx}
                                isLast={isLast}
                                remainingCount={remaining}
                                onPress={() => openModal(idx)}
                            />
                        );
                    })}
                </View>

                {/* ── Divider + View All ── */}
                {filteredPhotos.length > 9 && (
                    <TouchableOpacity
                        onPress={onViewAll}
                        style={styles.viewAllRow}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="images-outline"
                            size={16}
                            color={DS.primary}
                        />
                        <Text style={styles.viewAllText}>
                            View all {filteredPhotos.length} photos
                        </Text>
                        <Ionicons
                            name="arrow-forward"
                            size={14}
                            color={DS.primary}
                        />
                    </TouchableOpacity>
                )}
            </Animated.View>

            {/* ── Photo Detail Modal ── */}
            <Modal
                visible={selectedIndex !== null}
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={closeModal}
            >
                <Animated.View
                    style={[
                        styles.modalOverlay,
                        {
                            opacity: modalOpacityAnim,
                            transform: [{ scale: modalScaleAnim }],
                        },
                    ]}
                >
                    {/* Header */}
                    <ModalHeader
                        current={currentModalIndex + 1}
                        total={filteredPhotos.length}
                        onClose={closeModal}
                    />

                    {/* Scrollable Photos */}
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={{ flex: 1 }}
                        onMomentumScrollEnd={(e) => {
                            const newIndex = Math.round(
                                e.nativeEvent.contentOffset.x / width,
                            );
                            setCurrentModalIndex(newIndex);
                        }}
                        contentOffset={{ x: currentModalIndex * width, y: 0 }}
                    >
                        {filteredPhotos.map((review) => (
                            <View
                                key={review.id}
                                style={[
                                    styles.modalPhotoPage,
                                    { width, height: height * 0.58 },
                                ]}
                            >
                                <Image
                                    source={{ uri: review.photo }}
                                    style={styles.modalPhoto}
                                    resizeMode="contain"
                                />
                            </View>
                        ))}
                    </ScrollView>

                    {/* Dot indicators */}
                    {filteredPhotos.length > 1 && filteredPhotos.length <= 12 && (
                        <View style={styles.dotsRow}>
                            {filteredPhotos.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        i === currentModalIndex && styles.dotActive,
                                    ]}
                                />
                            ))}
                        </View>
                    )}

                    {/* ── Review Details Panel ── */}
                    {currentReview && (
                        <View style={styles.detailsPanel}>
                            {/* Author row */}
                            <View style={styles.detailsAuthorRow}>
                                <View style={styles.detailsAvatarWrapper}>
                                    <Image
                                        source={{
                                            uri:
                                                currentReview.author.avatar ??
                                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                    currentReview.author.name,
                                                )}&background=0D9488&color=fff&size=80`,
                                        }}
                                        style={styles.detailsAvatar}
                                    />
                                    {/* Verified ring */}
                                    <View style={styles.verifiedRing} />
                                </View>

                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.detailsName} numberOfLines={1}>
                                        {currentReview.author.name}
                                    </Text>
                                    <View style={styles.detailsMeta}>
                                        <StarRow rating={currentReview.rating} />
                                        <Text style={styles.detailsDate}>
                                            {new Date(
                                                currentReview.timestamp,
                                            ).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </Text>
                                    </View>
                                </View>

                                {/* Verified badge */}
                                <View style={styles.verifiedBadge}>
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={11}
                                        color={DS.primary}
                                    />
                                    <Text style={styles.verifiedText}>Verified</Text>
                                </View>
                            </View>

                            {/* Comment */}
                            <Text style={styles.detailsComment} numberOfLines={3}>
                                {currentReview.comment}
                            </Text>
                        </View>
                    )}
                </Animated.View>
            </Modal>
        </>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        backgroundColor: DS.card,
        borderRadius: DS.radius.lg,
        padding: 16,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: DS.border,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 3,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: DS.gray900,
        letterSpacing: -0.2,
    },
    photoCountPill: {
        backgroundColor: DS.primaryFaded,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: DS.radius.full,
    },
    photoCountText: {
        fontSize: 11,
        fontWeight: '700',
        color: DS.primary,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: DS.gray500,
        fontWeight: '400',
    },
    seeAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingVertical: 4,
        paddingLeft: 8,
    },
    seeAllText: {
        fontSize: 13,
        fontWeight: '600',
        color: DS.primary,
    },
    // Grid
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 0,
    },
    thumbContainer: {
        borderRadius: DS.radius.md,
        overflow: 'hidden',
        backgroundColor: DS.gray100,
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    thumbGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '45%',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    thumbRating: {
        position: 'absolute',
        bottom: 5,
        left: 5,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: DS.radius.full,
        gap: 2,
    },
    thumbRatingText: {
        color: DS.white,
        fontSize: 10,
        fontWeight: '700',
    },
    overflowOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15,23,42,0.72)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overflowText: {
        fontSize: 22,
        fontWeight: '800',
        color: DS.white,
        letterSpacing: -0.5,
    },
    overflowSub: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
        marginTop: 1,
    },
    // View All
    viewAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingTop: 14,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: DS.border,
    },
    viewAllText: {
        fontSize: 13,
        fontWeight: '600',
        color: DS.primary,
    },
    // Empty
    emptyState: {
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 20,
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: DS.radius.full,
        backgroundColor: DS.primaryFaded,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: DS.gray700,
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 13,
        color: DS.gray500,
        textAlign: 'center',
        lineHeight: 19,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: '#0A0F1E',
    },
    modalHeader: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalCloseBtn: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseBtnInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    modalActionBtn: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.10)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: DS.radius.full,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    modalCounterText: {
        color: DS.white,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    modalPhotoPage: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    modalPhoto: {
        width: '100%',
        height: '100%',
        borderRadius: DS.radius.md,
    },
    // Dots
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 10,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: DS.radius.full,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    dotActive: {
        width: 18,
        backgroundColor: DS.primary,
    },
    // Details panel
    detailsPanel: {
        backgroundColor: DS.card,
        borderTopLeftRadius: DS.radius.xl,
        borderTopRightRadius: DS.radius.xl,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        borderTopWidth: 1,
        borderTopColor: DS.border,
    },
    detailsAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    detailsAvatarWrapper: {
        position: 'relative',
    },
    detailsAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: DS.primaryLight,
    },
    verifiedRing: {
        position: 'absolute',
        top: -2,
        bottom: -2,
        left: -2,
        right: -2,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: DS.primary,
    },
    detailsName: {
        fontSize: 14,
        fontWeight: '700',
        color: DS.gray900,
        marginBottom: 4,
    },
    detailsMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailsDate: {
        fontSize: 11,
        color: DS.gray500,
        fontWeight: '500',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: DS.primaryFaded,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: DS.radius.full,
        borderWidth: 1,
        borderColor: 'rgba(13,148,136,0.15)',
        marginLeft: 8,
    },
    verifiedText: {
        fontSize: 10,
        fontWeight: '700',
        color: DS.primary,
        letterSpacing: 0.2,
    },
    detailsComment: {
        fontSize: 13,
        color: DS.gray600,
        lineHeight: 20,
        fontWeight: '400',
    },
});

export default PhotoReview;