import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';

/**
 * ServiceShowcaseCard - Display restaurant/hotel/cafe services, menu items, or room types
 * Works for Food & Restaurants, Hotels, and Cafes categories
 */

export interface ServiceItem {
    id: string;
    name: string;
    description?: string;
    price?: number;
    image?: string;
    rating?: number;
    category?: string;
    tags?: string[];
    isAvailable?: boolean;
    prepTime?: number; // in minutes, for food items
}

export interface ServiceShowcaseProps {
    services: ServiceItem[];
    shopId: string;
    shopType: 'restaurant' | 'hotel' | 'cafe' | 'other';
    title?: string;
    onServicePress?: (service: ServiceItem) => void;
    onAddToCart?: (service: ServiceItem) => void;
}

const ServiceShowcaseCard: React.FC<ServiceShowcaseProps> = ({
    services,
    shopId,
    shopType,
    title = 'Featured Services',
    onServicePress,
    onAddToCart,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = Array.from(new Set(services.map(s => s.category).filter(Boolean))) as string[];
    const filteredServices = selectedCategory
        ? services.filter(s => s.category === selectedCategory)
        : services;

    const getShopSpecificIcon = () => {
        switch (shopType) {
            case 'restaurant':
                return '🍽️';
            case 'hotel':
                return '🛏️';
            case 'cafe':
                return '☕';
            default:
                return '✨';
        }
    };

    const getShopSpecificLabel = () => {
        switch (shopType) {
            case 'restaurant':
                return 'Menu Items';
            case 'hotel':
                return 'Rooms & Amenities';
            case 'cafe':
                return 'Beverages & Snacks';
            default:
                return 'Featured';
        }
    };

    const renderServiceItem = ({ item }: { item: ServiceItem; index: number }) => (
        <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => onServicePress?.(item)}
            activeOpacity={0.7}
        >
            {/* Service Image */}
            {item.image && (
                <Image
                    source={{ uri: item.image }}
                    style={styles.serviceImage}
                />
            )}

            {!item.image && (
                <View style={[styles.serviceImage, styles.imageEmpty]}>
                    <Text style={{ fontSize: 32 }}>{getShopSpecificIcon()}</Text>
                </View>
            )}

            {/* Availability badge */}
            {!item.isAvailable && (
                <View style={styles.unavailableBadge}>
                    <Text style={styles.unavailableText}>Unavailable</Text>
                </View>
            )}

            {/* Service Details */}
            <View style={styles.serviceDetails}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName} numberOfLines={2}>
                        {item.name}
                    </Text>
                    {item.description && (
                        <Text style={styles.serviceDescription} numberOfLines={2}>
                            {item.description}
                        </Text>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                        <View style={styles.tagsContainer}>
                            {item.tags.slice(0, 2).map((tag, idx) => (
                                <View key={idx} style={styles.tag}>
                                    <Text style={styles.tagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Metadata */}
                    <View style={styles.metadataRow}>
                        {item.price !== undefined && (
                            <Text style={styles.price}>₹{item.price}</Text>
                        )}

                        {item.prepTime && (
                            <View style={styles.prepTimeContainer}>
                                <Ionicons name="time-outline" size={12} color={Colors.gray[500]} />
                                <Text style={styles.prepTime}>{item.prepTime} min</Text>
                            </View>
                        )}

                        {item.rating && (
                            <View style={styles.ratingContainer}>
                                <Ionicons name="star" size={12} color={Colors.warning} />
                                <Text style={styles.rating}>{item.rating}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Add Button */}
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onAddToCart?.(item);
                    }}
                >
                    <Ionicons name="add-circle" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerIcon}>{getShopSpecificIcon()}</Text>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <Text style={styles.headerSubtitle}>{getShopSpecificLabel()}</Text>
                </View>
            </View>

            {/* Category Filter - only show if multiple categories */}
            {categories && categories.length > 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoryScroll}
                    contentContainerStyle={styles.categoryScrollContent}
                >
                    <TouchableOpacity
                        style={[styles.categoryButton, selectedCategory === null && styles.categoryButtonActive]}
                        onPress={() => setSelectedCategory(null)}
                    >
                        <Text style={[styles.categoryButtonText, selectedCategory === null && styles.categoryButtonTextActive]}>
                            All
                        </Text>
                    </TouchableOpacity>

                    {categories.map((category) => (
                        <TouchableOpacity
                            key={category}
                            style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
                            onPress={() => setSelectedCategory(category)}
                        >
                            <Text style={[styles.categoryButtonText, selectedCategory === category && styles.categoryButtonTextActive]}>
                                {category}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Services Grid */}
            <FlatList
                data={filteredServices}
                renderItem={renderServiceItem}
                keyExtractor={(item, idx) => `${item.id}-${idx}`}
                numColumns={1}
                scrollEnabled={false}
                contentContainerStyle={styles.grid}
            />

            {filteredServices.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>📭</Text>
                    <Text style={styles.emptyStateText}>No services available in this category</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.light?.background || '#F8FAFC',
        paddingVertical: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.screenHorizontal,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    headerIcon: {
        fontSize: 28,
        marginRight: Spacing.md,
    },
    headerTitle: {
        ...Typography.h5,
        color: Colors.gray[900],
        fontWeight: '600',
    },
    headerSubtitle: {
        ...Typography.caption,
        color: Colors.gray[500],
        marginTop: 2,
    },
    categoryScroll: {
        marginVertical: Spacing.md,
        paddingHorizontal: Spacing.screenHorizontal,
    },
    categoryScrollContent: {
        gap: Spacing.sm,
    },
    categoryButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Spacing.radius.full,
        backgroundColor: Colors.gray[100],
        borderWidth: 1,
        borderColor: Colors.gray[200],
    },
    categoryButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    categoryButtonText: {
        ...Typography.caption,
        color: Colors.gray[700],
        fontWeight: '500',
    },
    categoryButtonTextActive: {
        color: Colors.white,
    },
    grid: {
        paddingHorizontal: Spacing.screenHorizontal,
        gap: Spacing.md,
        paddingBottom: Spacing.lg,
    },
    serviceCard: {
        backgroundColor: Colors.white,
        borderRadius: Spacing.radius.lg,
        overflow: 'hidden',
        ...Shadows.md,
    },
    serviceImage: {
        width: '100%',
        height: 160,
        backgroundColor: Colors.gray[100],
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageEmpty: {
        backgroundColor: Colors.primaryFaded,
    },
    unavailableBadge: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        backgroundColor: Colors.error,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Spacing.radius.full,
    },
    unavailableText: {
        ...Typography.caption,
        color: Colors.white,
        fontWeight: '600',
    },
    serviceDetails: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: Spacing.md,
    },
    serviceName: {
        ...Typography.bodyMedium,
        color: Colors.gray[900],
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    serviceDescription: {
        ...Typography.caption,
        color: Colors.gray[600],
        marginBottom: Spacing.xs,
    },
    tagsContainer: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginBottom: Spacing.xs,
    },
    tag: {
        backgroundColor: Colors.primaryFaded,
        paddingHorizontal: Spacing.xs,
        paddingVertical: 2,
        borderRadius: Spacing.radius.full,
    },
    tagText: {
        ...Typography.caption,
        color: Colors.primary,
        fontSize: 10,
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginTop: Spacing.xs,
    },
    price: {
        ...Typography.labelSmall,
        color: Colors.primary,
        fontWeight: '700',
    },
    prepTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    prepTime: {
        ...Typography.caption,
        color: Colors.gray[600],
        fontSize: 10,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: Colors.warningFaded,
        paddingHorizontal: Spacing.xs,
        paddingVertical: 2,
        borderRadius: Spacing.radius.sm,
    },
    rating: {
        ...Typography.caption,
        color: Colors.warning,
        fontSize: 10,
        fontWeight: '600',
    },
    addButton: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
    },
    emptyStateIcon: {
        fontSize: 48,
        marginBottom: Spacing.md,
    },
    emptyStateText: {
        ...Typography.body,
        color: Colors.gray[500],
    },
});

export default ServiceShowcaseCard;
