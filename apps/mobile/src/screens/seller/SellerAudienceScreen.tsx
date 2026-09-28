import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, SlideInRight, Layout } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import apiClient from '../../services/api';
import { getPrimarySellerShop } from '../../services/sellerShopContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SellerAudienceScreen() {
  const navigation = useNavigation();
  const { colors, radius, shadows, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);
  const [followers, setFollowers] = useState<any[]>([]);
  
  // Broadcast Form
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAudience = useCallback(async () => {
    try {
      setLoading(true);
      const shop = await getPrimarySellerShop();
      if (shop) {
        setShopId(shop.id);
        const res = await apiClient.get(`/shops/${shop.id}/followers`);
        if (res.data?.data) {
          setFollowers(res.data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching audience:', error);
      Alert.alert('Error', 'Failed to load audience data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudience();
  }, [fetchAudience]);

  const handleSendBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Validation Error', 'Title and message are required.');
      return;
    }
    if (!shopId) return;

    try {
      setIsSubmitting(true);
      const payload = {
        title: title.trim(),
        body: body.trim(),
        type: 'PROMOTION',
        city: cityFilter.trim() || undefined,
      };
      
      const res = await apiClient.post(`/shops/${shopId}/broadcast`, payload);
      
      Alert.alert('Success', `Broadcast sent successfully! Reached ${res.data?.data?.pushSent || 0} followers.`);
      setShowBroadcastForm(false);
      setTitle('');
      setBody('');
      setCityFilter('');
    } catch (error: any) {
      console.error('Error broadcasting:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStyles = () => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 12,
    },
    backBtn: {
      padding: 8,
      marginLeft: -8,
    },
    content: {
      padding: 16,
    },
    statsCard: {
      backgroundColor: colors.primaryFaded,
      borderRadius: radius.lg,
      padding: 20,
      alignItems: 'center',
      marginBottom: 24,
    },
    statsLabel: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
      marginBottom: 8,
    },
    statsNumber: {
      fontSize: 48,
      fontWeight: 'bold',
      color: colors.primary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      marginTop: 8,
    },
    followerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    followerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryFaded,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    followerAvatarText: {
      color: colors.primary,
      fontWeight: 'bold',
      fontSize: 16,
    },
    followerInfo: {
      flex: 1,
    },
    followerName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    followerLocation: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textTertiary,
      marginTop: 24,
    },
    formContainer: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: radius.lg,
      marginBottom: 24,
      ...shadows.sm,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
      borderRadius: radius.sm,
      padding: 12,
      color: colors.text,
      fontSize: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    helperText: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
    }
  });

  const styles = getStyles();

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audience & Broadcast</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Total Followers</Text>
            <Text style={styles.statsNumber}>{followers.length}</Text>
          </View>
        </Animated.View>

        {!showBroadcastForm ? (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Button
              title="New Broadcast"
              icon="megaphone-outline"
              onPress={() => setShowBroadcastForm(true)}
              style={{ marginBottom: 24 }}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.formContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Compose Message</Text>
                <TouchableOpacity onPress={() => setShowBroadcastForm(false)}>
                  <Ionicons name="close" size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Flash Sale Today!"
                placeholderTextColor={colors.textTertiary}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.inputLabel}>Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Write your broadcast message here..."
                placeholderTextColor={colors.textTertiary}
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Target Location (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mumbai"
                placeholderTextColor={colors.textTertiary}
                value={cityFilter}
                onChangeText={setCityFilter}
              />
              <Text style={styles.helperText}>Leave blank to send to all followers</Text>

              <Button
                title={isSubmitting ? 'Sending...' : 'Send Broadcast'}
                icon="send"
                onPress={handleSendBroadcast}
                loading={isSubmitting}
                style={{ marginTop: 24 }}
              />
            </View>
          </Animated.View>
        )}

        <Text style={styles.sectionTitle}>Recent Followers</Text>
        {followers.length === 0 ? (
          <Text style={styles.emptyText}>You don't have any followers yet.</Text>
        ) : (
          followers.slice(0, 10).map((follower, index) => (
            <Animated.View key={follower.id || index} entering={SlideInRight.delay(100 + index * 50)}>
              <View style={styles.followerCard}>
                <View style={styles.followerAvatar}>
                  <Text style={styles.followerAvatarText}>
                    {follower.name ? follower.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
                <View style={styles.followerInfo}>
                  <Text style={styles.followerName}>{follower.name || 'Anonymous User'}</Text>
                  <Text style={styles.followerLocation}>
                    <Ionicons name="location-outline" size={12} color={colors.textTertiary} /> {follower.city || 'Unknown Location'}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
