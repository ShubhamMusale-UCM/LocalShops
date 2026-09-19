import React, { useState, useCallback, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, SlideInRight, Layout } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import productService from '../../services/productService';
import shopService from '../../services/shopService';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import { networkDiagnostics } from '../../utils/networkCheck';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_PHOTOS = 5;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const AddProductScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const isEditing = Boolean(route?.params?.isEditing && route?.params?.productId);
  const editingProductId = route?.params?.productId as string | undefined;
  const user = useAuthStore((state) => state.user);
  const currentCity = useLocationStore((state) => state.city);
  const currentAddress = useLocationStore((state) => state.address);
  const currentLatitude = useLocationStore((state) => state.latitude);
  const currentLongitude = useLocationStore((state) => state.longitude);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  
  // Animation states
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const categories = [
    'Fashion & Apparel', 'Furniture & Living', 'Electronics & Audio', 'Hardware & Tools',
    'Second-Hand & Refurbished', 'Rental Items & Gear', 'Local Services', 'Restaurants & Dining',
    'Hotels & Stays', 'Events & Live Shows', 'Local Experiences', 'Vehicles & Mobility',
    'Spaces & Studios', 'Groceries', 'Clothing', 'Home & Garden',
    'Sports', 'Books', 'Health & Beauty', 'Toys & Games',
    'Food & Beverages', 'Pet Supplies', 'Stationery', 'Other',
  ];

  const units = [
    'pcs', 'kg', 'g', 'L', 'ml', 'dozen', 'pack', 'box',
    'bottle', 'bunch', 'pair', 'set',
  ];

  useEffect(() => {
    const loadProductForEdit = async () => {
      if (!isEditing || !editingProductId) return;

      try {
        setIsPrefilling(true);
        const response = await productService.getById(editingProductId);
        const product = response?.data;

        setName(product?.name || '');
        setDescription(product?.description || '');
        setPrice(product?.price ? String(product.price) : '');
        setMrp(product?.mrp ? String(product.mrp) : '');
        setStock(product?.quantity !== undefined && product?.quantity !== null ? String(product.quantity) : '');
        setCategory(product?.category || '');
        setUnit(product?.unit || 'pcs');
        setPhotos(Array.isArray(product?.images) ? product.images : []);
      } catch (error: any) {
        const message = error?.response?.data?.error || 'Failed to load product for edit';
        Alert.alert('Error', message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } finally {
        setIsPrefilling(false);
      }
    };

    loadProductForEdit();
  }, [isEditing, editingProductId, navigation]);

  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant gallery access to add photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && photos.length < MAX_PHOTOS) {
      setPhotos([...photos, result.assets[0].uri]);
    } else if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_PHOTOS} photos allowed`);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && photos.length < MAX_PHOTOS) {
      setPhotos([...photos, result.assets[0].uri]);
    } else if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_PHOTOS} photos allowed`);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Missing Field', 'Please enter product name');
      return false;
    }
    if (!price || parseFloat(price) <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than 0');
      return false;
    }
    if (!category) {
      Alert.alert('Missing Field', 'Please select a category');
      return false;
    }
    if (!description.trim() || description.length < 10) {
      Alert.alert('Invalid Description', 'Description must be at least 10 characters');
      return false;
    }
    if (photos.length === 0) {
      Alert.alert('Photos Required', 'Please add at least one product photo');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Run quick connectivity check
      console.log('[AddProduct] Running connectivity check before upload');
      const connCheck = await networkDiagnostics.testServerConnectivity();
      if (!connCheck.isReachable) {
        throw new Error(`Cannot reach server (${connCheck.error}). Latency: ${connCheck.latency}ms. Check internet and ngrok tunnel.`);
      }
      console.log('[AddProduct] Connectivity check passed. Latency:', connCheck.latency, 'ms');

      const parsedPrice = parseFloat(price);
      const parsedMrp = mrp ? parseFloat(mrp) : parsedPrice;
      const parsedStock = stock ? parseInt(stock, 10) : undefined;

      const remotePhotos = photos.filter((uri) => uri.startsWith('http://') || uri.startsWith('https://'));
      const localPhotos = photos.filter((uri) => !uri.startsWith('http://') && !uri.startsWith('https://'));

      let uploadedPhotos: string[] = [...remotePhotos];
      if (localPhotos.length) {
        console.log('[AddProduct] Uploading', localPhotos.length, 'local photos');
        try {
          const uploadResponse = await productService.uploadImages(localPhotos);
          console.log('[AddProduct] Upload response:', uploadResponse?.data);
          const uploaded = uploadResponse?.data?.images;
          if (!Array.isArray(uploaded) || uploaded.length !== localPhotos.length) {
            throw new Error(`Image upload failed. Expected ${localPhotos.length} images, got ${uploaded?.length || 0}`);
          }
          uploadedPhotos = [...uploadedPhotos, ...uploaded];
        } catch (uploadError: any) {
          console.error('[AddProduct] Upload failure details:');
          console.error('  - Status:', uploadError.response?.status);
          console.error('  - Message:', uploadError.message);
          console.error('  - Response data:', uploadError.response?.data);
          console.error('  - Error code:', uploadError.code);
          throw new Error(`Image upload failed: ${uploadError.response?.data?.error || uploadError.message}`);
        }
      }

      if (isEditing && editingProductId) {
        await productService.update(editingProductId, {
          name: name.trim(),
          description: description.trim(),
          price: parsedPrice,
          mrp: parsedMrp,
          images: uploadedPhotos,
          category,
          quantity: parsedStock,
          unit: unit || 'pcs',
        });

        Alert.alert('Success!', `${name} has been updated.`, [
          { text: 'Go to Products', onPress: () => navigation.navigate('SellerTabs', { screen: 'Products' }) },
        ]);
      } else {
        console.log('[AddProduct] Fetching seller shops');
        const myShopsResponse = await shopService.getMyShops();
        console.log('[AddProduct] Shops response:', myShopsResponse?.data);
        let myShops = Array.isArray(myShopsResponse.data)
          ? myShopsResponse.data
          : myShopsResponse.data?.shops || [];

        if (!myShops.length) {
          console.log('[AddProduct] No shops found, auto-creating shop');
          const normalizedPhone = (user?.phone || '').replace(/\D/g, '').slice(-10);
          if (!user?.name || normalizedPhone.length !== 10) {
            Alert.alert(
              'No Shop Found',
              'Please complete your seller profile with a valid phone number to create a shop.'
            );
            setIsSubmitting(false);
            return;
          }

          const autoCreateResponse = await shopService.create({
            name: `${user.name}'s Shop`,
            description: 'Local seller shop. Update details from shop customization.',
            phone: normalizedPhone,
            address: currentAddress || 'Address pending update',
            city: currentCity || user.city || 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
            latitude: currentLatitude || 12.9716,
            longitude: currentLongitude || 77.5946,
            category: category || 'General Store',
            subCategories: [],
            operatingHours: {
              monday: { open: '09:00', close: '21:00', isClosed: false },
              tuesday: { open: '09:00', close: '21:00', isClosed: false },
              wednesday: { open: '09:00', close: '21:00', isClosed: false },
              thursday: { open: '09:00', close: '21:00', isClosed: false },
              friday: { open: '09:00', close: '21:00', isClosed: false },
              saturday: { open: '09:00', close: '21:00', isClosed: false },
              sunday: { open: '09:00', close: '21:00', isClosed: false },
            },
          });

          console.log('[AddProduct] Auto-create shop response:', autoCreateResponse?.data);
          const createdShop = autoCreateResponse.data;
          myShops = createdShop ? [createdShop] : [];

          if (!myShops.length) {
            throw new Error('Shop auto-creation failed. Please create a shop manually.');
          }
        }

        const primaryShopId = myShops[0].id;
        console.log('[AddProduct] Creating product with shopId:', primaryShopId);
        await productService.create(primaryShopId, {
          name: name.trim(),
          description: description.trim(),
          price: parsedPrice,
          mrp: parsedMrp,
          images: uploadedPhotos,
          category,
          quantity: parsedStock,
          unit: unit || 'pcs',
        });
        console.log('[AddProduct] Product created successfully');

        Alert.alert(
          'Success!',
          `${name} has been added to your store.`,
          [
            {
              text: 'Add Another',
              onPress: () => {
                setName('');
                setDescription('');
                setPrice('');
                setMrp('');
                setStock('');
                setCategory('');
                setUnit('');
                setPhotos([]);
              }
            },
            { text: 'Go to Products', onPress: () => navigation.navigate('SellerTabs', { screen: 'Products' }) },
          ]
        );
      }
    } catch (error: any) {
      const errorResponse = error?.response?.data?.error || error?.message || 'Unknown error';
      const fullError = `${error?.response?.data?.error ? error.response.data.error : error?.message || 'Failed to add product'}`;
      
      console.error('[AddProduct] Full error object:', {
        message: error?.message,
        responseStatus: error?.response?.status,
        responseData: error?.response?.data,
        code: error?.code,
      });
      
      Alert.alert('Product Creation Failed', fullError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPhotoSection = () => (
    <Animated.View entering={FadeInDown.delay(300)} style={styles.photoSection}>
      <Text style={styles.label}>Product Photos</Text>
      <Text style={styles.labelHint}>Add up to {MAX_PHOTOS} photos</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photosContainer}
      >
        {photos.map((photo, idx) => (
          <View key={idx} style={styles.photoItem}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={() => removePhoto(idx)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.removePhotoGradient}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ))}

        {photos.length < MAX_PHOTOS && (
          <>
            <TouchableOpacity
              style={styles.photoPicker}
              onPress={handleAddPhoto}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F8FAFC', '#F1F5F9']}
                style={styles.photoPickerGradient}
              >
                <Ionicons name="images-outline" size={32} color={Colors.primary} />
                <Text style={styles.photoPickerText}>Gallery</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoPicker}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F8FAFC', '#F1F5F9']}
                style={styles.photoPickerGradient}
              >
                <Ionicons name="camera-outline" size={32} color={Colors.primary} />
                <Text style={styles.photoPickerText}>Camera</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      
      <Text style={styles.photoHint}>
        {photos.length}/{MAX_PHOTOS} photos added
      </Text>
    </Animated.View>
  );

  const renderCategoryModal = () => (
    <Modal visible={showCategoryModal} transparent animationType="slide">
      <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
        <Animated.View entering={FadeInDown} style={styles.modalContent}>
          <LinearGradient
            colors={['#ACEED3', '#35C095', '#0E8D6D']}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalBody}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryOption}
                onPress={() => {
                  setCategory(cat);
                  setShowCategoryModal(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryOptionText,
                    category === cat && styles.categoryOptionSelected,
                  ]}
                >
                  {cat}
                </Text>
                {category === cat && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </BlurView>
    </Modal>
  );

  const renderUnitModal = () => (
    <Modal visible={showUnitModal} transparent animationType="slide">
      <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
        <Animated.View entering={FadeInDown} style={styles.modalContent}>
          <LinearGradient
            colors={['#ACEED3', '#35C095', '#0E8D6D']}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>Select Unit</Text>
            <TouchableOpacity onPress={() => setShowUnitModal(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalBody}>
            <View style={styles.unitsGrid}>
              {units.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.unitOption,
                    unit === u && styles.unitOptionActive,
                  ]}
                  onPress={() => {
                    setUnit(u);
                    setShowUnitModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.unitOptionText,
                      unit === u && styles.unitOptionTextActive,
                    ]}
                  >
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </BlurView>
    </Modal>
  );

  const renderFormField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType?: 'default' | 'numeric' | 'decimal-pad',
    required?: boolean,
    icon?: string
  ) => (
    <Animated.View entering={FadeInDown} style={styles.formField}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.requiredStar}>*</Text>}
        </Text>
      </View>
      <View style={[
        styles.inputWrapper,
        focusedField === label && styles.inputWrapperFocused,
      ]}>
        {icon && (
          <Ionicons name={icon as any} size={20} color={Colors.gray[500]} style={styles.inputIcon} />
        )}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray[400]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          onFocus={() => setFocusedField(label)}
          onBlur={() => setFocusedField(null)}
        />
      </View>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <LinearGradient
        colors={['#ACEED3', '#35C095', '#0E8D6D']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Product' : 'Add New Product'}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {isPrefilling && (
        <View style={styles.prefillLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.prefillText}>Loading product details...</Text>
        </View>
      )}

      <AnimatedScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Basic Information Section */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          {renderFormField('Product Name', name, setName, 'e.g., Fresh Milk 1L', 'default', true, 'cube-outline')}
          
          <View style={styles.row}>
            <View style={styles.halfField}>
              {renderFormField('Price (₹)', price, setPrice, '0.00', 'decimal-pad', true, 'cash-outline')}
            </View>
            <View style={styles.halfField}>
              {renderFormField('MRP (₹)', mrp, setMrp, '0.00', 'decimal-pad', false, 'pricetag-outline')}
            </View>
          </View>
          
          <View style={styles.row}>
            <View style={styles.halfField}>
              {renderFormField('Stock', stock, setStock, '0', 'numeric', false, 'layers-outline')}
            </View>
            <View style={styles.halfField}>
              <Animated.View entering={FadeInDown} style={styles.formField}>
                <Text style={styles.label}>Unit <Text style={styles.optionalText}>(Optional)</Text></Text>
                <TouchableOpacity
                  style={styles.selectorButton}
                  onPress={() => setShowUnitModal(true)}
                >
                  <Text style={unit ? styles.selectorText : styles.selectorPlaceholder}>
                    {unit || 'Select unit'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={Colors.gray[500]} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        {/* Category Section */}
        <Animated.View entering={FadeInDown.delay(150)} style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <TouchableOpacity
            style={styles.categorySelector}
            onPress={() => setShowCategoryModal(true)}
          >
            <View style={styles.categorySelectorLeft}>
              <Ionicons name="grid-outline" size={20} color={Colors.primary} />
              <Text style={category ? styles.categorySelectorText : styles.categorySelectorPlaceholder}>
                {category || 'Select a category'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray[500]} />
          </TouchableOpacity>
        </Animated.View>

        {/* Description Section */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Description <Text style={styles.requiredStar}>*</Text></Text>
          <View style={[
            styles.textAreaWrapper,
            focusedField === 'description' && styles.inputWrapperFocused,
          ]}>
            <TextInput
              style={styles.textArea}
              placeholder="Describe your product (ingredients, features, benefits...)"
              placeholderTextColor={Colors.gray[400]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          <Text style={styles.charCount}>
            {description.length}/500 characters
          </Text>
        </Animated.View>

        {/* Photos Section */}
        {renderPhotoSection()}

        {/* Tips Section */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.tipsSection}>
          <LinearGradient
            colors={['#FEF3C7', '#FFFBEB']}
            style={styles.tipsCard}
          >
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb-outline" size={22} color="#F59E0B" />
              <Text style={styles.tipsTitle}>Pro Tips</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color="#F59E0B" />
              <Text style={styles.tipText}>Add clear, well-lit photos from different angles</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color="#F59E0B" />
              <Text style={styles.tipText}>Set a competitive price compared to similar products</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color="#F59E0B" />
              <Text style={styles.tipText}>Write detailed description highlighting key features</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={{ height: 100 }} />
      </AnimatedScrollView>

      {/* Bottom Button */}
      <Animated.View entering={SlideInRight} style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || isPrefilling}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={!name || !price || !category || photos.length === 0 ? ['#9CA3AF', '#6B7280'] : ['#0D9488', '#0F766E']}
            style={styles.submitButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name={isEditing ? 'create-outline' : 'add-circle-outline'} size={22} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>{isEditing ? 'Save Changes' : 'Add Product to Store'}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {renderCategoryModal()}
      {renderUnitModal()}
    </KeyboardAvoidingView>
  );
};

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
  content: {
    padding: Spacing.lg,
  },
  prefillLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#ECFDF5',
  },
  prefillText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: Spacing.md,
  },
  formField: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  requiredStar: {
    color: '#EF4444',
  },
  optionalText: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.gray[500],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Spacing.radius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Spacing.md,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.gray[900],
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfField: {
    flex: 1,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Spacing.radius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  selectorText: {
    fontSize: 14,
    color: Colors.gray[900],
  },
  selectorPlaceholder: {
    fontSize: 14,
    color: Colors.gray[400],
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Spacing.radius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  categorySelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categorySelectorText: {
    fontSize: 14,
    color: Colors.gray[900],
  },
  categorySelectorPlaceholder: {
    fontSize: 14,
    color: Colors.gray[400],
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Spacing.radius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Spacing.md,
  },
  textArea: {
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.gray[900],
    minHeight: 100,
  },
  charCount: {
    fontSize: 11,
    color: Colors.gray[500],
    textAlign: 'right',
    marginTop: 4,
  },
  photoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  labelHint: {
    fontSize: 11,
    color: Colors.gray[500],
    marginBottom: Spacing.md,
  },
  photosContainer: {
    gap: 12,
    paddingVertical: 4,
  },
  photoItem: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: Spacing.radius.md,
    backgroundColor: Colors.gray[100],
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  removePhotoGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  photoPicker: {
    width: 100,
    height: 100,
    borderRadius: Spacing.radius.md,
    overflow: 'hidden',
  },
  photoPickerGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Spacing.radius.md,
    gap: 6,
  },
  photoPickerText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  photoHint: {
    fontSize: 12,
    color: Colors.gray[500],
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  tipsSection: {
    marginBottom: Spacing.md,
  },
  tipsCard: {
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    ...Shadows.lg,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Spacing.radius.md,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
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
    padding: Spacing.md,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryOptionText: {
    fontSize: 15,
    color: Colors.gray[700],
  },
  categoryOptionSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  unitOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Spacing.radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  unitOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unitOptionText: {
    fontSize: 14,
    color: Colors.gray[700],
  },
  unitOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default AddProductScreen;