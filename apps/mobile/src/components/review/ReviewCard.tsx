// components/reviews/ReviewCard.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    Animated,
    Pressable,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SentimentBadge from './SentimentBadge';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Design System ────────────────────────────────────────────────────────────
const DS = {
    primary: '#0D9488',
    primaryDark: '#0F766E',
    primaryFaded: 'rgba(13,148,136,0.08)',
    primaryLight: '#CCFBF1',
    success: '#10B981',
    successFaded: 'rgba(16,185,129,0.08)',
    error: '#EF4444',
    errorFaded: 'rgba(239,68,68,0.08)',
    warning: '#F59E0B',
    info: '#3B82F6',
    gray900: '#1F2937',
    gray800: '#1E293B',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatRelativeDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
};

const getRatingLabel = (rating: number): string => {
    if (rating >= 5) return 'Excellent';
    if (rating >= 4) return 'Good';
    if (rating >= 3) return 'Average';
    if (rating >= 2) return 'Poor';
    return 'Terrible';
};

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating: React.FC<{ rating: number; size?: number }> = ({
    rating,
    size = 15,
}) => (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((s) => (
            <Animated.View key={s}>
                <Ionicons
                    name={
                        s <= rating
                            ? 'star'
                            : s - 0.5 <= rating
                                ? 'star-half'
                                : 'star-outline'
                    }
                    size={size}
                    color={s <= rating ? DS.warning : DS.gray300}
                />
            </Animated.View>
        ))}
    </View>
);

// ─── Helpful Button ───────────────────────────────────────────────────────────
const HelpfulButton: React.FC<{
    count: number;
    onPress?: () => void;
}> = ({ count, onPress }) => {
    const [helped, setHelped] = useState(false);
    const [localCount, setLocalCount] = useState(count);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const heartScale = useRef(new Animated.Value(1)).current;

    const handlePress = useCallback(() => {
        if (helped) return;

        // Pop animation
        Animated.sequence([
            Animated.spring(heartScale, {
                toValue: 1.4,
                damping: 8,
                stiffness: 300,
                useNativeDriver: true,
            }),
            Animated.spring(heartScale, {
                toValue: 1,
                damping: 12,
                stiffness: 200,
                useNativeDriver: true,
            }),
        ]).start();

        setHelped(true);
        setLocalCount((c) => c + 1);
        onPress?.();
    }, [helped, onPress]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.92,
            damping: 14,
            stiffness: 300,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            damping: 12,
            stiffness: 200,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[
                    styles.helpfulBtn,
                    helped && styles.helpfulBtnActive,
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Mark as helpful. ${localCount} people found this helpful`}
                accessibilityRole="button"
            >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                    <Ionicons
                        name={helped ? 'thumbs-up' : 'thumbs-up-outline'}
                        size={14}
                        color={helped ? DS.primary : DS.gray600}
                    />
                </Animated.View>
                <Text style={[styles.helpfulText, helped && styles.helpfulTextActive]}>
                    {localCount > 0
                        ? `Helpful (${localCount})`
                        : 'Mark helpful'}
                </Text>
            </Pressable>
        </Animated.View>
    );
};

// ─── Photo Strip ──────────────────────────────────────────────────────────────
const PhotoStrip: React.FC<{
    photos: string[];
    size: number;
    onPhotoPress?: (uri: string, index: number) => void;
}> = ({ photos, size, onPhotoPress }) => {
    const pressScales = useRef(
        photos.map(() => new Animated.Value(1)),
    ).current;

    const handlePressIn = (idx: number) => {
        Animated.spring(pressScales[idx], {
            toValue: 0.93,
            damping: 14,
            stiffness: 300,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = (idx: number) => {
        Animated.spring(pressScales[idx], {
            toValue: 1,
            damping: 12,
            stiffness: 200,
            useNativeDriver: true,
        }).start();
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoStrip}
            contentContainerStyle={{ paddingRight: 4 }}
        >
            {photos.map((photo, idx) => (
                <Animated.View
                    key={idx}
                    style={[
                        { transform: [{ scale: pressScales[idx] }] },
                        { marginRight: 8 },
                    ]}
                >
                    <Pressable
                        onPress={() => onPhotoPress?.(photo, idx)}
                        onPressIn={() => handlePressIn(idx)}
                        onPressOut={() => handlePressOut(idx)}
                    >
                        <Image
                            source={{ uri: photo }}
                            style={[
                                styles.stripPhoto,
                                { width: size, height: size },
                            ]}
                            resizeMode="cover"
                        />
                        {/* Photo number badge */}
                        <View style={styles.photoIndexBadge}>
                            <Text style={styles.photoIndexText}>{idx + 1}</Text>
                        </View>
                    </Pressable>
                </Animated.View>
            ))}
        </ScrollView>
    );
};

// ─── Seller Reply ─────────────────────────────────────────────────────────────
const SellerReply: React.FC<{ reply: string }> = ({ reply }) => {
    const [expanded, setExpanded] = useState(false);
    const isLong = reply.length > 140;

    return (
        <View style={styles.sellerReplyCard}>
            {/* Header */}
            <View style={styles.sellerReplyHeader}>
                <View style={styles.sellerBadge}>
                    <Ionicons name="storefront" size={12} color={DS.primary} />
                    <Text style={styles.sellerBadgeText}>Seller Reply</Text>
                </View>
                <View style={styles.sellerVerified}>
                    <Ionicons name="checkmark-circle" size={12} color={DS.success} />
                    <Text style={styles.sellerVerifiedText}>Official</Text>
                </View>
            </View>

            {/* Reply text */}
            <Text
                style={styles.sellerReplyText}
                numberOfLines={!expanded && isLong ? 3 : undefined}
            >
                {reply}
            </Text>

            {isLong && (
                <TouchableOpacity
                    onPress={() => {
                        LayoutAnimation.configureNext(
                            LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setExpanded((e) => !e);
                    }}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                    <Text style={styles.expandBtn}>
                        {expanded ? 'Show less ↑' : 'Read more ↓'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReviewCardProps {
    id: string;
    author: {
        name: string;
        avatar?: string;
    };
    rating: number;
    title: string;
    comment: string;
    photos?: string[];
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    sentimentScore: number;
    isVerifiedPurchase: boolean;
    helpfulCount: number;
    createdAt: string;
    sellerReply?: string;
    onMarkHelpful?: () => void;
    onReport?: () => void;
    onPhotoPress?: (uri: string, index: number) => void;
    // Enhanced
    animationDelay?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const ReviewCard: React.FC<ReviewCardProps> = ({
    id,
    author,
    rating,
    title,
    comment,
    photos,
    sentiment,
    sentimentScore,
    isVerifiedPurchase,
    helpfulCount,
    createdAt,
    sellerReply,
    onMarkHelpful,
    onReport,
    onPhotoPress,
    animationDelay = 0,
}) => {
    const [showFullComment, setShowFullComment] = useState(false);
    const [reportPressed, setReportPressed] = useState(false);
    const { width } = useWindowDimensions();

    const photoSize = 80;
    const isLongComment = comment.length > 200;

    // ── Entry animation ──
    const entryOpacity = useRef(new Animated.Value(0)).current;
    const entryTranslate = useRef(new Animated.Value(24)).current;
    const cardScale = useRef(new Animated.Value(0.97)).current;

    useEffect(() => {
        const delay = animationDelay;
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(entryOpacity, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.spring(entryTranslate, {
                    toValue: 0,
                    damping: 14,
                    stiffness: 120,
                    useNativeDriver: true,
                }),
                Animated.spring(cardScale, {
                    toValue: 1,
                    damping: 14,
                    stiffness: 120,
                    useNativeDriver: true,
                }),
            ]).start();
        }, delay);
        return () => clearTimeout(timer);
    }, [animationDelay]);

    // ── Report handler ──
    const handleReport = useCallback(() => {
        setReportPressed(true);
        onReport?.();
    }, [onReport]);

    // ── Toggle comment ──
    const toggleComment = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowFullComment((v) => !v);
    }, []);

    // ── Rating color ──
    const ratingColor =
        rating >= 4 ? DS.success : rating >= 3 ? DS.warning : DS.error;
    const ratingBg =
        rating >= 4
            ? DS.successFaded
            : rating >= 3
                ? 'rgba(245,158,11,0.08)'
                : DS.errorFaded;

    return (
        <Animated.View
            style={[
                styles.card,
                {
                    opacity: entryOpacity,
                    transform: [
                        { translateY: entryTranslate },
                        { scale: cardScale },
                    ],
                },
            ]}
        >
            {/* ── Header ── */}
            <View style={styles.cardHeader}>
                {/* Avatar + Author */}
                <View style={styles.authorRow}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={{
                                uri:
                                    author.avatar ??
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        author.name,
                                    )}&background=0D9488&color=fff&size=80`,
                            }}
                            style={styles.avatar}
                        />
                        {/* Verified ring */}
                        {isVerifiedPurchase && (
                            <View style={styles.avatarRing} />
                        )}
                    </View>

                    <View style={styles.authorDetails}>
                        <View style={styles.authorNameRow}>
                            <Text style={styles.authorName} numberOfLines={1}>
                                {author.name}
                            </Text>
                            {isVerifiedPurchase && (
                                <View style={styles.verifiedChip}>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={10}
                                        color={DS.primary}
                                    />
                                    <Text style={styles.verifiedChipText}>Verified</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.authorDate}>
                            {formatRelativeDate(createdAt)}
                        </Text>
                    </View>
                </View>

                {/* Report menu */}
                <TouchableOpacity
                    onPress={handleReport}
                    style={styles.menuBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Report review"
                    accessibilityRole="button"
                >
                    <Ionicons
                        name={reportPressed ? 'flag' : 'ellipsis-vertical'}
                        size={18}
                        color={reportPressed ? DS.error : DS.gray400}
                    />
                </TouchableOpacity>
            </View>

            {/* ── Rating Row ── */}
            <View style={styles.ratingRow}>
                {/* Stars + label pill */}
                <View style={styles.ratingLeft}>
                    <View style={[styles.ratingPill, { backgroundColor: ratingBg }]}>
                        <Text style={[styles.ratingNumber, { color: ratingColor }]}>
                            {rating.toFixed(1)}
                        </Text>
                        <Ionicons name="star" size={11} color={ratingColor} />
                    </View>
                    <StarRating rating={rating} size={14} />
                    <Text style={styles.ratingLabel}>{getRatingLabel(rating)}</Text>
                </View>

                {/* Sentiment badge */}
                <SentimentBadge sentiment={sentiment} score={sentimentScore} />
            </View>

            {/* ── Review Title ── */}
            {title?.length > 0 && (
                <Text style={styles.reviewTitle} numberOfLines={2}>
                    {title}
                </Text>
            )}

            {/* ── Comment ── */}
            <View style={styles.commentBlock}>
                <Text
                    style={styles.comment}
                    numberOfLines={showFullComment ? undefined : 3}
                    ellipsizeMode="tail"
                >
                    {comment}
                </Text>
                {isLongComment && (
                    <TouchableOpacity
                        onPress={toggleComment}
                        style={styles.readMoreBtn}
                        hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                    >
                        <Text style={styles.readMoreText}>
                            {showFullComment ? '↑ Show less' : 'Read more →'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Photos ── */}
            {photos && photos.length > 0 && (
                <View style={styles.photosSection}>
                    <View style={styles.photosSectionHeader}>
                        <Ionicons name="images-outline" size={13} color={DS.gray500} />
                        <Text style={styles.photosLabel}>
                            {photos.length} photo{photos.length > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <PhotoStrip
                        photos={photos}
                        size={photoSize}
                        onPhotoPress={onPhotoPress}
                    />
                </View>
            )}

            {/* ── Seller Reply ── */}
            {sellerReply && <SellerReply reply={sellerReply} />}

            {/* ── Footer ── */}
            <View style={styles.footer}>
                <HelpfulButton count={helpfulCount} onPress={onMarkHelpful} />

                {/* Right: Share */}
                <TouchableOpacity
                    style={styles.footerAction}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Share review"
                >
                    <Ionicons name="share-outline" size={15} color={DS.gray500} />
                    <Text style={styles.footerActionText}>Share</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    card: {
        backgroundColor: DS.card,
        borderRadius: DS.radius.lg,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: DS.border,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
    },

    // ── Header ──
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 10,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 2,
        borderColor: DS.primaryLight,
    },
    avatarRing: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 23,
        borderWidth: 1.5,
        borderColor: DS.primary,
        borderStyle: 'dashed',
    },
    authorDetails: {
        flex: 1,
        gap: 3,
    },
    authorNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    authorName: {
        fontSize: 14,
        fontWeight: '700',
        color: DS.gray900,
        letterSpacing: -0.1,
    },
    verifiedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: DS.primaryFaded,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: DS.radius.full,
        borderWidth: 1,
        borderColor: 'rgba(13,148,136,0.12)',
    },
    verifiedChipText: {
        fontSize: 9,
        fontWeight: '700',
        color: DS.primary,
        letterSpacing: 0.2,
        textTransform: 'uppercase',
    },
    authorDate: {
        fontSize: 11,
        color: DS.gray500,
        fontWeight: '400',
    },
    menuBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: DS.gray50,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: DS.border,
    },

    // ── Rating ──
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: DS.border,
    },
    ratingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    ratingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: DS.radius.full,
    },
    ratingNumber: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    ratingLabel: {
        fontSize: 11,
        color: DS.gray500,
        fontWeight: '500',
    },

    // ── Review content ──
    reviewTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: DS.gray900,
        marginBottom: 8,
        letterSpacing: -0.2,
        lineHeight: 22,
    },
    commentBlock: {
        marginBottom: 4,
    },
    comment: {
        fontSize: 14,
        color: DS.gray700,
        lineHeight: 22,
        fontWeight: '400',
    },
    readMoreBtn: {
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    readMoreText: {
        fontSize: 13,
        color: DS.primary,
        fontWeight: '600',
    },

    // ── Photos ──
    photosSection: {
        marginTop: 12,
        marginBottom: 4,
    },
    photosSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
    },
    photosLabel: {
        fontSize: 11,
        color: DS.gray500,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    photoStrip: {
        marginLeft: -4,
    },
    stripPhoto: {
        borderRadius: DS.radius.md,
        backgroundColor: DS.gray100,
    },
    photoIndexBadge: {
        position: 'absolute',
        top: 4,
        left: 4,
        width: 18,
        height: 18,
        borderRadius: DS.radius.full,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoIndexText: {
        fontSize: 9,
        color: DS.white,
        fontWeight: '700',
    },

    // ── Seller Reply ──
    sellerReplyCard: {
        marginTop: 12,
        backgroundColor: DS.primaryFaded,
        borderRadius: DS.radius.md,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(13,148,136,0.12)',
        borderLeftWidth: 3,
        borderLeftColor: DS.primary,
    },
    sellerReplyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    sellerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    sellerBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: DS.primary,
        letterSpacing: 0.1,
    },
    sellerVerified: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    sellerVerifiedText: {
        fontSize: 11,
        color: DS.success,
        fontWeight: '600',
    },
    sellerReplyText: {
        fontSize: 13,
        color: DS.gray700,
        lineHeight: 20,
        fontWeight: '400',
    },
    expandBtn: {
        fontSize: 12,
        color: DS.primary,
        fontWeight: '600',
        marginTop: 6,
    },

    // ── Footer ──
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: DS.border,
    },
    helpfulBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: DS.radius.full,
        borderWidth: 1,
        borderColor: DS.border,
        backgroundColor: DS.gray50,
        minHeight: 36,
    },
    helpfulBtnActive: {
        backgroundColor: DS.primaryFaded,
        borderColor: 'rgba(13,148,136,0.20)',
    },
    helpfulText: {
        fontSize: 12,
        color: DS.gray600,
        fontWeight: '600',
    },
    helpfulTextActive: {
        color: DS.primary,
        fontWeight: '700',
    },
    footerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 36,
    },
    footerActionText: {
        fontSize: 12,
        color: DS.gray500,
        fontWeight: '500',
    },
});

export default ReviewCard;