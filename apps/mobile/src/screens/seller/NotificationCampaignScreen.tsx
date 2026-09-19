import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// DateTimePicker removed - using simple date input instead
import Animated, { FadeInDown, SlideInRight, Layout } from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import apiClient from '../../services/api';
import { getPrimarySellerShop } from '../../services/sellerShopContext';
import * as ImagePicker from 'expo-image-picker';
import productService from '../../services/productService';

interface NotificationCampaign {
  id: string;
  title: string;
  message: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'CANCELLED' | 'FAILED';
  recipientCount: number;
  sentCount?: number;
  scheduledAt?: string;
  sentAt?: string;
  type: 'PROMOTIONAL' | 'TRANSACTIONAL' | 'REMINDER';
}

const SEGMENTS = [
  { id: 'BUYERS', name: 'All Buyers', icon: 'people', color: '#3B82F6', count: 0 },
  { id: 'SELLERS', name: 'All Sellers', icon: 'storefront', color: '#10B981', count: 0 },
  { id: 'DELIVERY_PARTNERS', name: 'Delivery Partners', icon: 'bicycle', color: '#F59E0B', count: 0 },
  { id: 'NEW_USERS', name: 'New Users (30 days)', icon: 'person-add', color: '#8B5CF6', count: 0 },
  { id: 'INACTIVE', name: 'Inactive Users', icon: 'time', color: '#EF4444', count: 0 },
  { id: 'HIGH_VALUE', name: 'High Value Buyers', icon: 'diamond', color: '#EC4899', count: 0 },
];

const CAMPAIGN_TYPES = [
  { id: 'PROMOTIONAL', name: 'Promotional', icon: 'megaphone', color: '#F59E0B' },
  { id: 'TRANSACTIONAL', name: 'Transactional', icon: 'receipt', color: '#3B82F6' },
  { id: 'REMINDER', name: 'Reminder', icon: 'alarm', color: '#10B981' },
];

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

function NotificationCampaignScreen() {
  const navigation = useNavigation<any>();
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState('BUYERS');
  const [selectedType, setSelectedType] = useState('PROMOTIONAL');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date(Date.now() + 3600000));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to select an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUrl(result.assets[0].uri);
    }
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/notifications/campaigns');
      const list = response.data?.data || response.data || [];
      setCampaigns(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCampaigns();
  };

  const createCampaign = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a campaign title');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Validation', 'Please enter a campaign message');
      return;
    }
    if (message.length < 10) {
      Alert.alert('Validation', 'Message must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const shop = await getPrimarySellerShop();
      if (!shop?.id) {
        Alert.alert('Error', 'Shop not found. Please try again later.');
        setIsSubmitting(false);
        return;
      }

      let finalImageUrl = imageUrl.trim() || undefined;

      // Upload local image if it starts with file://
      if (finalImageUrl && finalImageUrl.startsWith('file://')) {
        try {
          const uploadResponse = await productService.uploadImages([finalImageUrl]);
          const uploaded = uploadResponse?.data?.images;
          if (uploaded && uploaded.length > 0) {
            finalImageUrl = uploaded[0];
          }
        } catch (uploadError) {
          Alert.alert('Upload Error', 'Failed to upload the image.');
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        title: title.trim(),
        body: message.trim(),
        type: selectedType === 'TRANSACTIONAL' ? 'SYSTEM' : 'PROMOTION',
        imageUrl: finalImageUrl,
      };

      await apiClient.post(`/shops/${shop.id}/broadcast`, payload);

      setModalVisible(false);
      resetForm();
      await loadCampaigns();
      
      Alert.alert(
        'Success',
        scheduleType === 'now' 
          ? 'Campaign sent successfully!' 
          : `Campaign scheduled for ${scheduledDate.toLocaleString()}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create campaign. Please try again.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelCampaign = async (campaignId: string) => {
    Alert.alert(
      'Cancel Campaign',
      'Are you sure you want to cancel this campaign?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.post(`/notifications/campaign/${campaignId}/cancel`);
              await loadCampaigns();
              Alert.alert('Success', 'Campaign cancelled successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel campaign');
            }
          },
        },
      ]
    );
  };

  const deleteCampaign = async (campaignId: string) => {
    Alert.alert(
      'Delete Campaign',
      'This action cannot be undone. Delete this campaign?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/notifications/campaign/${campaignId}`);
              await loadCampaigns();
              Alert.alert('Success', 'Campaign deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete campaign');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setImageUrl('');
    setSelectedSegment('BUYERS');
    setSelectedType('PROMOTIONAL');
    setScheduleType('now');
    setScheduledDate(new Date(Date.now() + 3600000));
  };

  const getStatusConfig = (status: NotificationCampaign['status']) => {
    switch (status) {
      case 'SENT':
        return { label: 'Sent', color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle' };
      case 'SCHEDULED':
        return { label: 'Scheduled', color: '#3B82F6', bg: '#DBEAFE', icon: 'time' };
      case 'CANCELLED':
        return { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6', icon: 'close-circle' };
      case 'FAILED':
        return { label: 'Failed', color: '#EF4444', bg: '#FEE2E2', icon: 'alert-circle' };
      default:
        return { label: 'Draft', color: '#F59E0B', bg: '#FEF3C7', icon: 'document' };
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDeliveryRate = (campaign: NotificationCampaign) => {
    if (!campaign.sentCount || campaign.recipientCount === 0) return 0;
    return Math.round((campaign.sentCount / campaign.recipientCount) * 100);
  };

  const renderCampaignCard = (campaign: NotificationCampaign, index: number) => {
    const statusConfig = getStatusConfig(campaign.status);
    const deliveryRate = getDeliveryRate(campaign);

    return (
      <Animated.View
        key={campaign.id}
        entering={FadeInDown.delay(index * 100)}
        layout={Layout}
      >
        <Card style={styles.campaignCard}>
          <View style={styles.campaignHeader}>
            <View style={styles.campaignTitleRow}>
              <Text style={styles.campaignTitle} numberOfLines={1}>
                {campaign.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => deleteCampaign(campaign.id)}
              style={styles.deleteIcon}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.campaignMessage} numberOfLines={2}>
            {campaign.message}
          </Text>

          <View style={styles.campaignStats}>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={14} color={Colors.gray[500]} />
              <Text style={styles.statText}>
                {campaign.recipientCount.toLocaleString()} recipients
              </Text>
            </View>
            {campaign.sentCount !== undefined && (
              <View style={styles.statItem}>
                <Ionicons name="checkmark-done-outline" size={14} color={Colors.gray[500]} />
                <Text style={styles.statText}>
                  {deliveryRate}% delivered
                </Text>
              </View>
            )}
          </View>

          <View style={styles.campaignFooter}>
            <View style={styles.dateInfo}>
              <Ionicons name="calendar-outline" size={12} color={Colors.gray[400]} />
              <Text style={styles.dateText}>
                {campaign.status === 'SCHEDULED' 
                  ? `Scheduled: ${formatDate(campaign.scheduledAt)}`
                  : campaign.status === 'SENT'
                  ? `Sent: ${formatDate(campaign.sentAt)}`
                  : `Created: ${formatDate(campaign.sentAt || campaign.scheduledAt)}`}
              </Text>
            </View>

            {campaign.status === 'SCHEDULED' && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => cancelCampaign(campaign.id)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <Animated.View entering={FadeInDown} style={styles.emptyContainer}>
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9']}
        style={styles.emptyIconContainer}
      >
        <Ionicons name="notifications-off-outline" size={64} color={Colors.gray[400]} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>No Campaigns Yet</Text>
      <Text style={styles.emptySubtitle}>
        Create your first notification campaign to engage with users
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setModalVisible(true)}
      >
        <LinearGradient
          colors={['#ACEED3', '#35C095', '#0E8D6D']}
          style={styles.createButtonGradient}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Campaign</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderCreateModal = () => (
    <Modal visible={modalVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <Animated.View entering={FadeInDown} style={styles.modalContent}>
          <LinearGradient
            colors={['#ACEED3', '#35C095', '#0E8D6D']}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>Create Campaign</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Campaign Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Campaign Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Weekend Sale Alert"
                placeholderTextColor={Colors.gray[400]}
                value={title}
                onChangeText={setTitle}
                maxLength={50}
              />
              <Text style={styles.charCount}>{title.length}/50</Text>
            </View>

            {/* Campaign Message */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Message</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Write your campaign message here..."
                placeholderTextColor={Colors.gray[400]}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{message.length}/500</Text>
            </View>

            {/* Product Image */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Product Image (Optional)</Text>
              {imageUrl ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setImageUrl('')}
                  >
                    <Ionicons name="close-circle" size={24} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                  <Ionicons name="image-outline" size={24} color={Colors.primary} />
                  <Text style={styles.imagePickerText}>Select an Image</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Campaign Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Campaign Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeContainer}>
                {CAMPAIGN_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeChip,
                      selectedType === type.id && styles.typeChipActive,
                    ]}
                    onPress={() => setSelectedType(type.id)}
                  >
                    <Ionicons 
                      name={type.icon as any} 
                      size={16} 
                      color={selectedType === type.id ? '#FFFFFF' : type.color} 
                    />
                    <Text style={[
                      styles.typeChipText,
                      selectedType === type.id && styles.typeChipTextActive,
                    ]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Target Segment */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Target Audience</Text>
              <View style={styles.segmentsGrid}>
                {SEGMENTS.map((segment) => (
                  <TouchableOpacity
                    key={segment.id}
                    style={[
                      styles.segmentCard,
                      selectedSegment === segment.id && styles.segmentCardActive,
                    ]}
                    onPress={() => setSelectedSegment(segment.id)}
                  >
                    <LinearGradient
                      colors={selectedSegment === segment.id 
                        ? [segment.color, segment.color + 'CC']
                        : ['#F8FAFC', '#F1F5F9']}
                      style={styles.segmentGradient}
                    >
                      <Ionicons 
                        name={segment.icon as any} 
                        size={24} 
                        color={selectedSegment === segment.id ? '#FFFFFF' : segment.color} 
                      />
                      <Text style={[
                        styles.segmentName,
                        selectedSegment === segment.id && styles.segmentNameActive,
                      ]}>
                        {segment.name}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Schedule */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Send Time</Text>
              <View style={styles.scheduleRow}>
                <TouchableOpacity
                  style={[
                    styles.scheduleOption,
                    scheduleType === 'now' && styles.scheduleOptionActive,
                  ]}
                  onPress={() => setScheduleType('now')}
                >
                  <Ionicons 
                    name="send-outline" 
                    size={18} 
                    color={scheduleType === 'now' ? '#FFFFFF' : Colors.gray[600]} 
                  />
                  <Text style={[
                    styles.scheduleOptionText,
                    scheduleType === 'now' && styles.scheduleOptionTextActive,
                  ]}>
                    Send Now
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scheduleOption,
                    scheduleType === 'later' && styles.scheduleOptionActive,
                  ]}
                  onPress={() => setScheduleType('later')}
                >
                  <Ionicons 
                    name="calendar-outline" 
                    size={18} 
                    color={scheduleType === 'later' ? '#FFFFFF' : Colors.gray[600]} 
                  />
                  <Text style={[
                    styles.scheduleOptionText,
                    scheduleType === 'later' && styles.scheduleOptionTextActive,
                  ]}>
                    Schedule Later
                  </Text>
                </TouchableOpacity>
              </View>

              {scheduleType === 'later' && (
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color={Colors.primary} />
                  <Text style={styles.datePickerText}>
                    {scheduledDate.toLocaleString()}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={Colors.gray[500]} />
                </TouchableOpacity>
              )}
            </View>

            {/* Summary */}
            <LinearGradient
              colors={['#F0FDF4', '#D1FAE5']}
              style={styles.summaryCard}
            >
              <Text style={styles.summaryTitle}>Campaign Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Recipients:</Text>
                <Text style={styles.summaryValue}>
                  {SEGMENTS.find(s => s.id === selectedSegment)?.name || selectedSegment}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type:</Text>
                <Text style={styles.summaryValue}>
                  {CAMPAIGN_TYPES.find(t => t.id === selectedType)?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Schedule:</Text>
                <Text style={styles.summaryValue}>
                  {scheduleType === 'now' ? 'Immediate' : scheduledDate.toLocaleString()}
                </Text>
              </View>
            </LinearGradient>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelModalButton]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelModalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.createModalButton]}
              onPress={createCampaign}
              disabled={isSubmitting || !title || !message}
            >
              <LinearGradient
                colors={!title || !message ? ['#9CA3AF', '#6B7280'] : ['#0D9488', '#0F766E']}
                style={styles.createModalGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                    <Text style={styles.createModalButtonText}>
                      {scheduleType === 'now' ? 'Send Now' : 'Schedule'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      <View style={{ padding: 16, backgroundColor: Colors.light.surface, borderRadius: 12 }}>
        <Text style={{ fontSize: 12, color: Colors.gray[600], marginBottom: 8 }}>Scheduled Date & Time</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.gray[900] }}>
          {scheduledDate.toLocaleString()}
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 12, padding: 10, backgroundColor: Colors.primary, borderRadius: 8, alignItems: 'center' }}
          onPress={() => setScheduledDate(new Date(Date.now() + 3600000))}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Set Scheduled Time</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#ACEED3', '#35C095', '#0E8D6D']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campaigns</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.newButton}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{campaigns.length}</Text>
          <Text style={styles.statLabel}>Total Campaigns</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {campaigns.filter(c => c.status === 'SENT').length}
          </Text>
          <Text style={styles.statLabel}>Sent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {campaigns.filter(c => c.status === 'SCHEDULED').length}
          </Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </View>
      </View>

      {/* Campaign List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <AnimatedScrollView
          contentContainerStyle={styles.campaignList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {campaigns.length === 0 ? renderEmptyState() : campaigns.map(renderCampaignCard)}
          <View style={{ height: 40 }} />
        </AnimatedScrollView>
      )}

      {/* FAB for creating campaigns */}
      {campaigns.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ACEED3', '#35C095', '#0E8D6D']}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {renderCreateModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 48 : Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray[500],
    marginTop: 4,
  },
  campaignList: {
    padding: Spacing.md,
  },
  campaignCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  campaignTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  campaignTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteIcon: {
    padding: 4,
  },
  campaignMessage: {
    fontSize: 14,
    color: Colors.gray[600],
    lineHeight: 20,
    marginBottom: 12,
  },
  campaignStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: Colors.gray[500],
  },
  campaignFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: Colors.gray[400],
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.gray[500],
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: 40,
  },
  createButton: {
    borderRadius: Spacing.radius.md,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    ...Shadows.lg,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Spacing.radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.gray[900],
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Spacing.radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.gray[900],
    backgroundColor: '#F8FAFC',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: Colors.gray[500],
    textAlign: 'right',
    marginTop: 4,
  },
  imagePickerBtn: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: Spacing.radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    color: Colors.gray[600],
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: Spacing.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray[700],
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  segmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  segmentCard: {
    width: '48%',
    borderRadius: Spacing.radius.md,
    overflow: 'hidden',
  },
  segmentCardActive: {
    ...Shadows.sm,
  },
  segmentGradient: {
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  segmentName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.gray[700],
  },
  segmentNameActive: {
    color: '#FFFFFF',
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scheduleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Spacing.radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scheduleOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  scheduleOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray[700],
  },
  scheduleOptionTextActive: {
    color: '#FFFFFF',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: Spacing.radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: Spacing.sm,
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    color: Colors.gray[900],
  },
  summaryCard: {
    padding: Spacing.md,
    borderRadius: Spacing.radius.md,
    marginTop: Spacing.sm,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.gray[600],
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.gray[900],
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalButton: {
    flex: 1,
    borderRadius: Spacing.radius.md,
    overflow: 'hidden',
  },
  cancelModalButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  createModalButton: {
    overflow: 'hidden',
  },
  createModalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  createModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default NotificationCampaignScreen;