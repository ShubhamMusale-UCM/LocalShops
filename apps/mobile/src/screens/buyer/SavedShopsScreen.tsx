import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { SkeletonListItem } from '../../components/ui/Skeleton';
import { formatRating, isShopOpen } from '../../utils/formatters';
import shopService from '../../services/shopService';

const SavedShopsScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [savedShops, setSavedShops] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSaved = async () => {
        try {
            const res = await shopService.getSaved();
            setSavedShops(res.data || []);
        } catch { /* ignore */ }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { fetchSaved(); }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Saved Shops</Text>
                <Text style={styles.subtitle}>{savedShops.length} shops saved</Text>
            </View>

            {loading ? (
                <View style={styles.content}>
                    {[1, 2, 3, 4].map(i => <SkeletonListItem key={i} />)}
                </View>
            ) : savedShops.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={{ fontSize: 48 }}>❤️</Text>
                    <Text style={styles.emptyTitle}>No saved shops yet</Text>
                    <Text style={styles.emptyText}>Save your favorite local shops for quick access</Text>
                </View>
            ) : (
                <FlatList
                    data={savedShops}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSaved(); }} colors={[Colors.primary]} />}
                    renderItem={({ item }) => {
                        const shop = item.shop;
                        const openStatus = isShopOpen(shop?.operatingHours);
                        return (
                            <Card
                                onPress={() => navigation.navigate('ShopProfile', { shopId: shop?.id })}
                                style={styles.shopCard}
                                shadow="sm"
                            >
                                <View style={styles.shopRow}>
                                    <View style={styles.avatar}>
                                        <Text style={{ fontSize: 24 }}>🏪</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.shopName}>{shop?.name}</Text>
                                        <Text style={styles.shopMeta}>
                                            ⭐ {formatRating(shop?.averageRating || 0)} • {shop?.category}
                                        </Text>
                                        <Badge
                                            text={openStatus.message}
                                            variant={openStatus.isOpen ? 'success' : 'error'}
                                            size="sm"
                                        />
                                    </View>
                                </View>
                            </Card>
                        );
                    }}
                    ListFooterComponent={<View style={{ height: 100 }} />}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    header: { paddingHorizontal: Spacing.screenHorizontal, paddingTop: 50, paddingBottom: Spacing.lg },
    title: { ...Typography.h2, color: Colors.gray[900] },
    subtitle: { ...Typography.body, color: Colors.gray[500], marginTop: Spacing.xs },
    content: { paddingHorizontal: Spacing.screenHorizontal },
    shopCard: { marginBottom: Spacing.md, padding: Spacing.md },
    shopRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primaryFaded, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    shopName: { ...Typography.bodyBold, color: Colors.gray[900] },
    shopMeta: { ...Typography.bodySmall, color: Colors.gray[500], marginVertical: 3 },
    empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 120 },
    emptyTitle: { ...Typography.h4, color: Colors.gray[700], marginTop: Spacing.md },
    emptyText: { ...Typography.body, color: Colors.gray[500], marginTop: Spacing.xs },
});

export default SavedShopsScreen;
