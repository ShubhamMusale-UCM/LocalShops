import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, shadows } from '../../theme';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import reviewService from '../../services/reviewService';
import { getSingleImageUrl } from '../../utils/image';

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

const ReviewScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute() as any;
  const { orderId, items } = route.params || {
    orderId: '',
    items: [
      {
        orderId: 'ORD-001',
        product: {
          id: '1',
          name: 'Fresh Milk 1L',
          image:
            'https://images.unsplash.com/photo-1550583724-b2692b25a968?w=500',
          price: 60,
          shopId: 'shop-1',
          shopName: 'Daily Fresh Dairy',
        },
        quantity: 2,
      },
    ],
  };

  const [selectedProduct, setSelectedProduct] = useState<OrderItem | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

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
      Alert.alert('Rating Required', 'Please select a rating');
      return;
    }

    if (comment.trim().length < 10) {
      Alert.alert('Comment Too Short', 'Please write at least 10 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      await reviewService.createReview({
        productId: selectedProduct.product.id,
        shopId: selectedProduct.product.shopId,
        orderId: selectedProduct.orderId,
        rating,
        title,
        comment,
        photos,
        isAnonymous,
      });

      setReviewSubmitted(true);
      Alert.alert('Review Submitted', 'Thank you for your review!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review. Please try again.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setRating(0);
    setTitle('');
    setComment('');
    setPhotos([]);
    setIsAnonymous(false);
    setReviewSubmitted(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Write a Review</Text>
        <View style={{ width: 28 }} />
      </View>

      {reviewSubmitted ? (
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.successTitle}>Review Submitted!</Text>
          <Text style={styles.successText}>
            Thank you for your feedback. Your review helps others make better choices.
          </Text>
          <Button
            label="Back to Orders"
            onPress={() => {
              resetForm();
              navigation.goBack();
            }}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
          {/* Select Product */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Product</Text>
            {items.map((item: OrderItem) => (
              <TouchableOpacity
                key={item.product.id}
                style={[
                  styles.productCard,
                  selectedProduct?.product.id === item.product.id && styles.selectedCard,
                ]}
                onPress={() => setSelectedProduct(item)}
              >
                <Image
                  source={{ uri: getSingleImageUrl(item.product.image) }}
                  style={styles.productImage}
                />
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  <Text style={styles.productShop}>{item.product.shopName}</Text>
                  <Text style={styles.productPrice}>₹{item.product.price}</Text>
                </View>
                {selectedProduct?.product.id === item.product.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Rating */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rating</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={48}
                    color={star <= rating ? colors.warning : colors.gray300}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <View style={styles.ratingLabel}>
                <Text style={styles.ratingEmoji}>
                  {rating <= 2
                    ? '😞'
                    : rating === 3
                    ? '😐'
                    : rating === 4
                    ? '🙂'
                    : '😍'}
                </Text>
                <Text style={styles.ratingText}>
                  {rating === 1
                    ? 'Poor'
                    : rating === 2
                    ? 'Not Great'
                    : rating === 3
                    ? 'Good'
                    : rating === 4
                    ? 'Great'
                    : 'Excellent'}
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Review Title (Optional)</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="e.g., Great quality and fresh"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              placeholderTextColor={colors.gray400}
            />
            <Text style={[styles.charCount, { color: colors.gray500 }]}>
              {title.length}/100
            </Text>
          </View>

          {/* Comment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Review</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Share your experience with this product..."
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={1000}
              placeholderTextColor={colors.gray400}
            />
            <Text style={styles.charCount}>{comment.length}/1000</Text>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Photos (Optional)</Text>
            <View style={styles.photosGrid}>
              {photos.map((photo, idx) => (
                <View key={idx} style={styles.photoItem}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(idx)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}

              {photos.length < 5 && (
                <TouchableOpacity
                  style={styles.photoAddButton}
                  onPress={handlePickImage}
                >
                  <Ionicons name="camera" size={32} color={colors.primary} />
                  <Text style={styles.photoAddText}>
                    {photos.length}/5
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Anonymous */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.anonymousButton}
              onPress={() => setIsAnonymous(!isAnonymous)}
            >
              <View style={styles.checkbox}>
                {isAnonymous && (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                )}
              </View>
              <View>
                <Text style={styles.anonymousLabel}>Post anonymously</Text>
                <Text style={styles.anonymousSubtitle}>
                  Your name won't be visible
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Button
              label="Submit Review"
              onPress={handleSubmitReview}
              loading={isSubmitting}
              disabled={!selectedProduct || rating === 0 || comment.length < 10}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: spacing.md,
    backgroundColor: colors.gray100,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  productShop: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: spacing.xs,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  starButton: {
    padding: spacing.sm,
  },
  ratingLabel: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  ratingEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.warning,
  },
  titleInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.gray900,
  },
  commentInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.gray900,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  photoItem: {
    position: 'relative',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  photoAddButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
  },
  photoAddText: {
    fontSize: 12,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  anonymousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  anonymousLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  anonymousSubtitle: {
    fontSize: 12,
    color: colors.gray600,
  },
  submitSection: {
    paddingBottom: spacing.lg,
  },
});

export default ReviewScreen;
