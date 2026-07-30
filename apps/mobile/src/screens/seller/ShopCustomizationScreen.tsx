import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import shopService from '../../services/shopService';
import { sanitizeImageUrl } from '../../utils/image';
import MapPickerModal from '../../components/ui/MapPickerModal';
import { clearPrimarySellerShopCache } from '../../services/sellerShopContext';

// ─── Design tokens ───────────────────────────────────────
const DS = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryLight: '#CCFBF1',
  primaryFaded: 'rgba(13,148,136,0.08)',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  gray900: '#1F2937',
  gray800: '#374151',
  gray700: '#4B5563',
  gray600: '#6B7280',
  gray500: '#9CA3AF',
  gray400: '#D1D5DB',
  gray300: '#E5E7EB',
  gray200: '#EEF2F6',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#F1F5F9',
  inputBorder: '#E2E8F0',
  radius: { sm: 8, md: 12, lg: 16, xl: 20, full: 999 },
};

const SPRING = { damping: 22, stiffness: 250, useNativeDriver: true as true };

// ─── Labeled input ───────────────────────────────────────
const FieldInput: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  icon?: string;
}> = ({ label, value, onChangeText, placeholder, keyboardType, multiline, icon }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <View style={[fi.row, focused && fi.rowFocused]}>
        {icon && (
          <View style={fi.iconWrap}>
            <Ionicons name={icon as any} size={16} color={focused ? DS.primary : DS.gray400} />
          </View>
        )}
        <TextInput
          style={[fi.input, multiline && { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={DS.gray400}
          keyboardType={keyboardType}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
};

const fi = StyleSheet.create({
  wrap: { marginBottom: 0 },
  label: { fontSize: 12, fontWeight: '600', color: DS.gray600, marginBottom: 6, letterSpacing: 0.3 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DS.card, borderRadius: DS.radius.md,
    borderWidth: 1.5, borderColor: DS.inputBorder,
  },
  rowFocused: { borderColor: DS.primary },
  iconWrap: { paddingLeft: 12 },
  input: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: DS.gray900, fontWeight: '500',
  },
});

// ─── Section card ────────────────────────────────────────
const SectionCard: React.FC<{ title: string; icon: string; children: React.ReactNode; delay?: number }> = ({
  title, icon, children, delay = 0,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, ...SPRING }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.sectionCard, { opacity, transform: [{ translateY }] }]}>
      <View style={s.sectionHeader}>
        <View style={s.sectionIconWrap}>
          <Ionicons name={icon as any} size={18} color={DS.primary} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </Animated.View>
  );
};

export default function ShopCustomizationScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Registration vs Customization state
  const [isNewShop, setIsNewShop] = useState(false);
  
  // Shop details
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopEmail, setShopEmail] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [pincode, setPincode] = useState('560001');
  const [latitude, setLatitude] = useState(12.9770);
  const [longitude, setLongitude] = useState(77.6030);
  const [category, setCategory] = useState('Grocery');
  
  const [openingHours, setOpeningHours] = useState('9:00 AM');
  const [closingHours, setClosingHours] = useState('9:00 PM');
  const [shopImage, setShopImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  
  // Map picker state
  const [showMapPicker, setShowMapPicker] = useState(false);
  
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    loadShop();
  }, []);

  const loadShop = async () => {
    try {
      setLoading(true);
      const response = await shopService.getMyShops();
      const shops = Array.isArray(response.data) ? response.data : response.data?.shops || [];
      
      if (!shops.length) {
        setIsNewShop(true);
        // Pre-fill with user default values or empty states
        setShopName('');
        setShopPhone('');
        setShopEmail('');
        setShopAddress('');
        setDescription('');
        setCity('Bengaluru');
        setStateName('Karnataka');
        setPincode('560001');
        setLatitude(12.9770);
        setLongitude(77.6030);
        setCategory('Grocery');
        return;
      }
      
      setIsNewShop(false);
      const shop = shops[0];
      setShopName(shop.name || '');
      setShopPhone(shop.phone || '');
      setShopEmail(shop.email || '');
      setShopAddress(shop.address || '');
      setDescription(shop.description || '');
      setCity(shop.city || 'Bengaluru');
      setStateName(shop.state || 'Karnataka');
      setPincode(shop.pincode || '560001');
      setLatitude(Number(shop.latitude) || 12.9770);
      setLongitude(Number(shop.longitude) || 77.6030);
      setCategory(shop.category || 'Grocery');
      
      const opening = shop.operatingHours?.monday?.open;
      const closing = shop.operatingHours?.monday?.close;
      if (opening) setOpeningHours(opening);
      if (closing) setClosingHours(closing);
      setShopImage(sanitizeImageUrl(shop.logo || shop.coverImage) || null);
    } catch (error) {
      console.error('Failed to load shop customization', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setShopImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!shopName || shopName.trim().length < 2) {
      Alert.alert('Validation Error', 'Shop name must be at least 2 characters.');
      return;
    }
    if (!description || description.trim().length < 10) {
      Alert.alert('Validation Error', 'Description must be at least 10 characters.');
      return;
    }
    if (!shopAddress || shopAddress.trim().length < 5) {
      Alert.alert('Validation Error', 'Street address must be at least 5 characters.');
      return;
    }
    if (!city || city.trim().length < 2) {
      Alert.alert('Validation Error', 'City is required.');
      return;
    }
    if (!stateName || stateName.trim().length < 2) {
      Alert.alert('Validation Error', 'State is required.');
      return;
    }
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      Alert.alert('Validation Error', 'Please enter a valid 6-digit pincode.');
      return;
    }

    try {
      setSaving(true);
      const normalizedPhone = (shopPhone || '').replace(/\D/g, '').slice(-10);
      if (normalizedPhone.length !== 10) {
        Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
        return;
      }
      
      let uploadedImage = shopImage;
      if (shopImage && (shopImage.startsWith('file://') || shopImage.startsWith('content://'))) {
        uploadedImage = await shopService.uploadImage(shopImage);
      }

      const shopData = {
        name: shopName,
        description,
        phone: normalizedPhone,
        email: shopEmail || undefined,
        address: shopAddress,
        city,
        state: stateName,
        pincode,
        latitude: Number(latitude),
        longitude: Number(longitude),
        category: category || 'Grocery',
        logo: uploadedImage || undefined,
        coverImage: uploadedImage || undefined,
        operatingHours: {
          monday: { open: openingHours, close: closingHours, isClosed: false },
          tuesday: { open: openingHours, close: closingHours, isClosed: false },
          wednesday: { open: openingHours, close: closingHours, isClosed: false },
          thursday: { open: openingHours, close: closingHours, isClosed: false },
          friday: { open: openingHours, close: closingHours, isClosed: false },
          saturday: { open: openingHours, close: closingHours, isClosed: false },
          sunday: { open: openingHours, close: closingHours, isClosed: false },
        },
      };

      if (isNewShop) {
        await shopService.create(shopData);
        clearPrimarySellerShopCache();
        (Alert as any).alert('Registered Successfully!', 'Your shop has been registered. You can now configure products.', [
          { text: 'Dashboard', onPress: () => navigation.navigate('Dashboard' as any) }
        ]);
      } else {
        const response = await shopService.getMyShops();
        const shops = Array.isArray(response.data) ? response.data : response.data?.shops || [];
        const shopId = shops[0]?.id;
        if (!shopId) {
          Alert.alert('Shop Not Found', 'Failed to retrieve active shop ID.');
          return;
        }
        await shopService.update(shopId, shopData);
        clearPrimarySellerShopCache();
        Alert.alert('Saved!', 'Shop details updated successfully.');
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to save shop details.';
      Alert.alert('Error', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMapLocation = (
    lat: number,
    lng: number,
    addressStr: string,
    cityStr: string,
    pincodeStr: string
  ) => {
    setLatitude(lat);
    setLongitude(lng);
    if (addressStr) setShopAddress(addressStr);
    if (cityStr) setCity(cityStr);
    if (pincodeStr) setPincode(pincodeStr);
  };

  if (loading) {
    return (
      <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={DS.primary} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#35C095', '#0E8D6D']} style={s.header}>
        <Animated.View style={[s.headerContent, { opacity: headerFade }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerMid}>
            <Text style={s.headerTitle}>{isNewShop ? 'Shop Registration' : 'Shop Setup'}</Text>
            <Text style={s.headerSub}>{isNewShop ? 'Create your shop' : 'Customize your shop profile'}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            style={[s.backBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="checkmark" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Shop image */}
        <SectionCard title="Shop Image" icon="image-outline" delay={0}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={s.imagePicker}>
            {shopImage ? (
              <Image source={{ uri: shopImage }} style={s.shopImage} />
            ) : (
              <View style={s.imagePlaceholder}>
                <Ionicons name="camera-outline" size={32} color={DS.gray400} />
                <Text style={s.imagePlaceholderText}>Tap to upload shop photo</Text>
                <Text style={s.imagePlaceholderSub}>PNG, JPG up to 5MB</Text>
              </View>
            )}
            <View style={s.imageEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </SectionCard>

        {/* Shop details */}
        <SectionCard title="Basic Information" icon="storefront-outline" delay={50}>
          <View style={{ gap: 14 }}>
            <FieldInput label="Shop Name" value={shopName} onChangeText={setShopName} placeholder="Enter shop name" icon="storefront-outline" />
            <FieldInput label="Description" value={description} onChangeText={setDescription} placeholder="Brief description (min 10 characters)" multiline icon="document-text-outline" />
            <FieldInput label="Phone Number" value={shopPhone} onChangeText={setShopPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" icon="call-outline" />
            <FieldInput label="Email" value={shopEmail} onChangeText={setShopEmail} placeholder="shop@example.com" keyboardType="email-address" icon="mail-outline" />
            
            {/* Category picker row */}
            <View>
              <Text style={s.fieldLabel}>Shop Category</Text>
              <TextInput
                style={s.textInputStyle}
                value={category}
                onChangeText={setCategory}
                placeholder="Type or select a category"
                placeholderTextColor={DS.gray400}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryChipsScroll}>
                {['Grocery', 'Fruits & Vegetables', 'Dairy & Eggs', 'Bakery', 'Pharmacy', 'Electronics', 'Clothing', 'Snacks', 'Beverages'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.categoryChip, category.toLowerCase() === cat.toLowerCase() && s.categoryChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[s.categoryChipText, category.toLowerCase() === cat.toLowerCase() && s.categoryChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <FieldInput label="Street Address" value={shopAddress} onChangeText={setShopAddress} placeholder="Shop address" icon="location-outline" />
            <FieldInput label="City" value={city} onChangeText={setCity} placeholder="City name" icon="business-outline" />
            <FieldInput label="State" value={stateName} onChangeText={setStateName} placeholder="State name" icon="map-outline" />
            <FieldInput label="Pincode" value={pincode} onChangeText={setPincode} placeholder="6-digit pincode" keyboardType="numeric" icon="pin-outline" />
          </View>
        </SectionCard>

        {/* Map selection */}
        <SectionCard title="Map Coordinates" icon="map-outline" delay={75}>
          <View style={{ gap: 12 }}>
            <Text style={s.coordinatesInfoText}>
              Locate your shop on the map so customers nearby can find you within their search range.
            </Text>
            
            <TouchableOpacity
              style={s.mapPickerButton}
              activeOpacity={0.8}
              onPress={() => setShowMapPicker(true)}
            >
              <Ionicons name="location" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={s.mapPickerButtonText}>Choose Location on Map</Text>
            </TouchableOpacity>

            <View style={s.coordsDisplayRow}>
              <View style={s.coordBadge}>
                <Text style={s.coordBadgeLabel}>Latitude</Text>
                <Text style={s.coordBadgeValue}>{latitude ? latitude.toFixed(5) : 'Not Set'}</Text>
              </View>
              <View style={s.coordBadge}>
                <Text style={s.coordBadgeLabel}>Longitude</Text>
                <Text style={s.coordBadgeValue}>{longitude ? longitude.toFixed(5) : 'Not Set'}</Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Business hours */}
        <SectionCard title="Business Hours" icon="time-outline" delay={100}>
          <View style={{ gap: 12 }}>
            {[
              { label: 'Opening Time', value: openingHours, onChange: setOpeningHours, icon: 'sunny-outline' },
              { label: 'Closing Time', value: closingHours, onChange: setClosingHours, icon: 'moon-outline' },
            ].map((field) => (
              <View key={field.label}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <TouchableOpacity
                  style={s.timeRow}
                  activeOpacity={0.85}
                  onPress={() => Alert.alert('Set Time', 'Time picker details. You can type open and close times.')}
                >
                  <Ionicons name={field.icon as any} size={16} color={DS.primary} />
                  <Text style={s.timeText}>{field.value}</Text>
                  <Ionicons name="chevron-forward" size={16} color={DS.gray400} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Open days quick toggle */}
            <View>
              <Text style={s.fieldLabel}>Open Days</Text>
              <View style={s.daysRow}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day, i) => (
                  <TouchableOpacity
                    key={day}
                    style={[s.dayChip, i < 6 && s.dayChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.dayChipText, i < 6 && s.dayChipTextActive]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
          style={s.saveBtn}
        >
          <LinearGradient
            colors={['#35C095', '#0E8D6D']}
            style={s.saveBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={s.saveBtnText}>{isNewShop ? 'Register Shop' : 'Save Changes'}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Map Picker Modal Component */}
      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        initialLatitude={latitude}
        initialLongitude={longitude}
        onSelectLocation={handleSelectMapLocation}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 0) + 12,
    paddingHorizontal: 16, paddingBottom: 20,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerMid: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  body: { padding: 16, paddingBottom: 100, gap: 14 },

  // Section card
  sectionCard: {
    backgroundColor: DS.card, borderRadius: DS.radius.lg,
    borderWidth: 1, borderColor: DS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  sectionIconWrap: {
    width: 32, height: 32, borderRadius: DS.radius.sm,
    backgroundColor: DS.primaryFaded, alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: DS.gray900 },
  sectionBody: { padding: 16 },

  // Image picker
  imagePicker: {
    width: '100%', height: 180, borderRadius: DS.radius.md,
    overflow: 'hidden', backgroundColor: DS.gray50,
    borderWidth: 1.5, borderColor: DS.border, borderStyle: 'dashed',
    position: 'relative',
  },
  shopImage: { width: '100%', height: '100%', borderRadius: DS.radius.md },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderText: { fontSize: 14, fontWeight: '600', color: DS.gray600 },
  imagePlaceholderSub: { fontSize: 11, color: DS.gray400 },
  imageEditBadge: {
    position: 'absolute', bottom: 10, right: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: DS.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },

  // Fields
  fieldLabel: { fontSize: 12, fontWeight: '600', color: DS.gray600, marginBottom: 6, letterSpacing: 0.3 },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: DS.gray50, borderRadius: DS.radius.md,
    borderWidth: 1.5, borderColor: DS.inputBorder,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  timeText: { flex: 1, fontSize: 14, fontWeight: '600', color: DS.gray900 },

  // Days
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayChip: {
    width: 38, height: 38, borderRadius: DS.radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: DS.gray100, borderWidth: 1, borderColor: DS.border,
  },
  dayChipActive: { backgroundColor: DS.primaryFaded, borderColor: DS.primaryLight },
  dayChipText: { fontSize: 11, fontWeight: '700', color: DS.gray500 },
  dayChipTextActive: { color: DS.primary },

  // Save
  saveBtn: {
    borderRadius: DS.radius.md, overflow: 'hidden',
    shadowColor: DS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  saveBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Category and Coordinate custom styles
  textInputStyle: {
    backgroundColor: DS.card, borderRadius: DS.radius.md,
    borderWidth: 1.5, borderColor: DS.inputBorder,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: DS.gray900, fontWeight: '500',
  },
  categoryChipsScroll: { paddingVertical: 8, gap: 8 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.full,
    backgroundColor: DS.gray100, borderWidth: 1, borderColor: DS.border,
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: DS.primaryFaded, borderColor: DS.primary,
  },
  categoryChipText: { fontSize: 12, color: DS.gray600, fontWeight: '600' },
  categoryChipTextActive: { color: DS.primary },
  coordinatesInfoText: { fontSize: 13, color: DS.gray600, lineHeight: 18, marginBottom: 4 },
  mapPickerButton: {
    backgroundColor: DS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: DS.radius.md,
    shadowColor: DS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
    marginBottom: 6,
  },
  mapPickerButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  coordsDisplayRow: { flexDirection: 'row', gap: 12 },
  coordBadge: {
    flex: 1, backgroundColor: DS.gray50, borderWidth: 1, borderColor: DS.border,
    borderRadius: DS.radius.md, padding: 10, alignItems: 'center',
  },
  coordBadgeLabel: { fontSize: 11, fontWeight: '600', color: DS.gray500, textTransform: 'uppercase', marginBottom: 2 },
  coordBadgeValue: { fontSize: 14, fontWeight: '700', color: DS.gray900 },
});
