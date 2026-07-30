import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (
    lat: number,
    lng: number,
    address: string,
    city: string,
    pincode: string
  ) => void;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
}

export default function MapPickerModal({
  visible,
  onClose,
  onSelectLocation,
  initialLatitude,
  initialLongitude,
}: MapPickerModalProps) {
  const DEFAULT_LAT = 12.9770;
  const DEFAULT_LNG = 77.6030;

  const [region, setRegion] = useState<Region>({
    latitude: initialLatitude || DEFAULT_LAT,
    longitude: initialLongitude || DEFAULT_LNG,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });

  const [pinCoords, setPinCoords] = useState({ lat: initialLatitude || DEFAULT_LAT, lng: initialLongitude || DEFAULT_LNG });
  const [resolvedAddress, setResolvedAddress] = useState<string>('Move map to select location...');
  const [resolvedCity, setResolvedCity] = useState<string>('Bengaluru');
  const [resolvedPincode, setResolvedPincode] = useState<string>('560001');
  const [loadingAddress, setLoadingAddress] = useState<boolean>(false);
  const [loadingMyLocation, setLoadingMyLocation] = useState<boolean>(false);
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (visible) {
      const lat = initialLatitude || DEFAULT_LAT;
      const lng = initialLongitude || DEFAULT_LNG;
      const r: Region = { latitude: lat, longitude: lng, latitudeDelta: 0.008, longitudeDelta: 0.008 };
      setRegion(r);
      setPinCoords({ lat, lng });
      fetchAddress(lat, lng);
    }
    // Cleanup timeout when modal closes
    return () => {
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
    };
  }, [visible, initialLatitude, initialLongitude]);

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      setLoadingAddress(true);
      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const city = place.city || place.subregion || place.district || 'Bengaluru';
        const pincode = place.postalCode || '560001';
        const parts = [place.name, place.street, place.district, city]
          .filter(Boolean)
          .map(s => (s || '').trim());
        const address = parts.join(', ') || 'Selected Location';
        setResolvedAddress(address);
        setResolvedCity(city);
        setResolvedPincode(pincode);
      } else {
        setResolvedAddress('Selected Location');
      }
    } catch {
      setResolvedAddress('Selected Location');
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
    const lat = newRegion.latitude;
    const lng = newRegion.longitude;
    setPinCoords({ lat, lng });

    // Debounce geocoding
    if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
    geocodeTimeoutRef.current = setTimeout(() => {
      fetchAddress(lat, lng);
    }, 700);
  };

  const handleMyLocation = async () => {
    try {
      setLoadingMyLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Enable location access in settings to use this feature.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const newRegion: Region = { latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 };
      setRegion(newRegion);
      setPinCoords({ lat, lng });
      mapRef.current?.animateToRegion(newRegion, 500);
      fetchAddress(lat, lng);
    } catch {
      Alert.alert('Error', 'Could not get current location. Please move the map manually.');
    } finally {
      setLoadingMyLocation(false);
    }
  };

  const handleConfirm = () => {
    onSelectLocation(pinCoords.lat, pinCoords.lng, resolvedAddress, resolvedCity, resolvedPincode);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* MapView — full screen */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={region}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          mapType="standard"
        />

        {/* Fixed center-pin overlay (does NOT move with map — the map moves beneath it) */}
        <View style={styles.pinOverlay} pointerEvents="none">
          <View style={styles.pin}>
            <Ionicons name="location" size={44} color="#0D9488" />
          </View>
          <View style={styles.pinDot} />
        </View>

        {/* Floating header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.circleBtn}>
            <Ionicons name="arrow-back" size={22} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose Location</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* My Location button */}
        <TouchableOpacity
          style={styles.myLocationBtn}
          onPress={handleMyLocation}
          disabled={loadingMyLocation}
          activeOpacity={0.85}
        >
          {loadingMyLocation ? (
            <ActivityIndicator size="small" color="#0D9488" />
          ) : (
            <Ionicons name="locate" size={22} color="#0D9488" />
          )}
        </TouchableOpacity>

        {/* Bottom card */}
        <View style={styles.bottomCard}>
          <View style={styles.handle} />
          <Text style={styles.cardLabel}>PINNED LOCATION</Text>
          <View style={styles.addressRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="map-outline" size={20} color="#0D9488" />
            </View>
            <View style={{ flex: 1 }}>
              {loadingAddress ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#0D9488" />
                  <Text style={styles.addressText}>Fetching address...</Text>
                </View>
              ) : (
                <Text style={styles.addressText} numberOfLines={2}>{resolvedAddress}</Text>
              )}
              <Text style={styles.coordText}>
                {pinCoords.lat.toFixed(5)}, {pinCoords.lng.toFixed(5)}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.confirmBtnText}>Confirm This Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8EFF5',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    left: 16,
    right: 16,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  pinOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Shift up by half bottom card height so pin is centered in visible map area
    marginBottom: 200,
  },
  pin: {
    // Drop shadow makes the pin "float"
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  pinDot: {
    width: 10,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: 2,
  },
  myLocationBtn: {
    position: 'absolute',
    right: 16,
    bottom: 240,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(13,148,136,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
    marginBottom: 3,
  },
  coordText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  confirmBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
