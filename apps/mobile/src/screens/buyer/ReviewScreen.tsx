import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { GlassPanel, GlassCard, GlassButton } from '../../components/ui/Glassmorphism';
import AmbientOrbs from '../../components/ui/AmbientOrbs';
import { TouchSpring } from '../../components/ui/TouchSpring';
import reviewService from '../../services/reviewService';
import shopService from '../../services/shopService';
import { getProductImageUrl } from '../../utils/image';

interface Product {
  id: string;
  name: string;
  image: string;
  price: number;
  shopId: string;
  shopName: string;
}

interface OrderItem {
  orderId: string;
  product: Product;
  quantity: number;
}

export default function ReviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId, items } = route.params || { orderId: '', items: [] };
  const insets = useSafeAreaInsets();
  const { colors, radius, isDarkMode } = useTheme();
  const isDark = isDarkMode;

  const [selectedProduct, setSelectedProduct] = useState<OrderItem | null>(items[0] || null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [checkingReview, setCheckingReview] = useState(true);

  // Check if already reviewed
  useEffect(() => {
    let active = true;
    const checkExisting = async () => {
      if (!selectedProduct) return;
      try {
        setCheckingReview(true);
        // We fetch the product's reviews and see if the user's review is there
        // In a real app, there'd be an endpoint like /reviews/me/product/:id
        // We'll simulate checking by assuming it's clear for now or calling API if available
        // For now, assume it's clear and let the backend enforce the 409 error
      } catch (err) {
        // ignore
      } finally {
        if (active) setCheckingReview(false);
      }
    };
    checkExisting();
    return () => { active = false; };
  }, [selectedProduct]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && photos.length < 5) {
      setPhotos([...photos, result.assets[0].uri]);
    } else if (photos.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 photos allowed');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmitReview = async () => {
    if (!selectedProduct) {
      Alert.alert('Select Product', 'Please select a product to review');
      return;
    }
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please tap a star to leave a rating');
      return;
    }
    if (comment.trim().length < 10) {
      Alert.alert('Comment Too Short', 'Please write at least 10 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload photos first
      const uploadedUrls = [];
      for (const uri of photos) {
        const url = await shopService.uploadImage(uri);
        uploadedUrls.push(url);
      }

      // 2. Submit review
      await reviewService.createReview({
        productId: selectedProduct.product.id,
        shopId: selectedProduct.product.shopId,
        orderId: selectedProduct.orderId,
        rating,
        title,
        comment,
        photos: uploadedUrls,
        isAnonymous,
      });

      setReviewSubmitted(true);
    } catch (error: any) {
      const msg = error?.response?.data?.error || error.message || 'Failed to submit review.';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  if (reviewSubmitted) {
    return (
      <View style={[styles.container, { backgroundColor: '#050814' }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <AmbientOrbs />
        <Animated.View entering={ZoomIn.springify()} style={styles.successContainer}>
          <View style={styles.successIconRing}>
            <Ionicons name="checkmark" size={48} color="#22C55E" />
          </View>
          <Text style={styles.successTitle}>Review Submitted!</Text>
          <Text style={styles.successText}>
            Thank you for your feedback. Your review helps the community and local businesses.
          </Text>
          <TouchSpring 
            style={styles.doneBtn}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.doneBtnGrad}>
              <Text style={styles.doneBtnText}>Back to Booking</Text>
            </LinearGradient>
          </TouchSpring>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#050814' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AmbientOrbs />

      {/* Header */}
      <GlassPanel intensity={30} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchSpring onPress={() => navigation.goBack()} style={styles.backBtn}>
          <View style={styles.backBtnInner}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </View>
        </TouchSpring>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Write a Review</Text>
        </View>
        <View style={{ width: 44 }} />
      </GlassPanel>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      >
        {/* Product Selection */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Select Item</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            {items.map((item: OrderItem) => {
              const isSelected = selectedProduct?.product.id === item.product.id;
              return (
                <TouchSpring
                  key={item.product.id}
                  onPress={() => setSelectedProduct(item)}
                  style={[styles.productPill, isSelected && { borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.1)' }]}
                >
                  <Image source={{ uri: getProductImageUrl([item.product.image]) }} style={styles.productImgSmall} />
                  <Text style={[styles.productPillText, { color: isSelected ? '#38BDF8' : textSecondary }]} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                </TouchSpring>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Rating Stars */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={{ marginTop: 24 }}>
          <GlassCard intensity={20} style={styles.ratingCard}>
            <Text style={[styles.ratingTitle, { color: textPrimary }]}>How was your experience?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchSpring key={star} onPress={() => setRating(star)}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={42}
                    color={star <= rating ? '#F59E0B' : 'rgba(255,255,255,0.2)'}
                  />
                </TouchSpring>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.ratingLabelText}>
                {rating === 1 ? 'Poor' : rating === 2 ? 'Not Great' : rating === 3 ? 'Good' : rating === 4 ? 'Great' : 'Excellent!'}
              </Text>
            )}
          </GlassCard>
        </Animated.View>

        {/* Written Review */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={{ marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Tell us more</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.titleInput, { color: textPrimary }]}
              placeholder="Headline (e.g. Great Service!)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={title}
              onChangeText={setTitle}
            />
          </View>
          <View style={[styles.inputWrap, { marginTop: 12 }]}>
            <TextInput
              style={[styles.commentInput, { color: textPrimary }]}
              placeholder="Share your detailed experience..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={comment}
              onChangeText={setComment}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{comment.length}/1000</Text>
          </View>
        </Animated.View>

        {/* Photos */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={{ marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Add Photos</Text>
          <View style={styles.photosGrid}>
            {photos.map((photo, idx) => (
              <View key={idx} style={styles.photoItem}>
                <Image source={{ uri: photo }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(idx)}>
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchSpring style={styles.addPhotoBtn} onPress={handlePickImage}>
                <Ionicons name="camera-outline" size={28} color="#38BDF8" />
                <Text style={styles.addPhotoTxt}>{photos.length}/5</Text>
              </TouchSpring>
            )}
          </View>
        </Animated.View>

        {/* Post Button */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={{ marginTop: 40 }}>
          <TouchSpring 
            style={[styles.submitBtn, (!selectedProduct || rating === 0 || comment.length < 10) && { opacity: 0.5 }]}
            disabled={!selectedProduct || rating === 0 || comment.length < 10 || isSubmitting}
            onPress={handleSubmitReview}
          >
            <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.submitBtnGrad}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>Post Review</Text>
              )}
            </LinearGradient>
          </TouchSpring>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { width: 44, height: 44 },
  backBtnInner: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  content: { padding: 20 },
  
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginLeft: 4 },
  
  productPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    paddingRight: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 12,
  },
  productImgSmall: { width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  productPillText: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
  
  ratingCard: { padding: 24, alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  ratingTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 12 },
  ratingLabelText: { fontSize: 16, fontWeight: '800', color: '#F59E0B', marginTop: 16 },

  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  titleInput: { padding: 16, fontSize: 15, fontWeight: '600' },
  commentInput: { padding: 16, fontSize: 15, minHeight: 120 },
  charCount: { position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoItem: { position: 'relative', width: 80, height: 80 },
  photo: { width: '100%', height: '100%', borderRadius: 16 },
  removePhotoBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#050814', borderRadius: 12 },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(56,189,248,0.5)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(56,189,248,0.05)',
  },
  addPhotoTxt: { fontSize: 11, color: '#38BDF8', fontWeight: '700', marginTop: 4 },

  submitBtn: { borderRadius: 20, overflow: 'hidden' },
  submitBtnGrad: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIconRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(34,197,94,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 12 },
  successText: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  doneBtn: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  doneBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
