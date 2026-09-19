import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import shopService from '../../services/shopService';
import { getPrimarySellerShop } from '../../services/sellerShopContext';

const DS = {
  primary: '#0D9488', primaryDark: '#0F766E', success: '#10B981', error: '#EF4444', warning: '#F59E0B',
  gray900: '#1F2937', gray700: '#4B5563', gray600: '#6B7280', gray500: '#9CA3AF', gray400: '#D1D5DB',
  gray300: '#E5E7EB', gray100: '#F3F4F6', background: '#F8FAFC', card: '#FFFFFF', text: '#1F2937', border: '#E5E7EB'
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const StoreSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [operatingHours, setOperatingHours] = useState<any>({});

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const shop = await getPrimarySellerShop();
    if (shop?.id) {
      setShopId(shop.id);
      loadShop(shop.id);
    } else {
      setLoading(false);
    }
  };

  const loadShop = async (sId: string) => {
    try {
      setLoading(true);
      const res = await shopService.getById(sId);
      if (res.data) {
        setIsOpen(res.data.isOpen);
        const backendHours = res.data.operatingHours || {};
        const formatted: any = {};
        DAYS.forEach(day => {
          const bd = backendHours[day];
          formatted[day] = {
            open: bd ? !bd.isClosed : true,
            openTime: bd?.open || '09:00',
            closeTime: bd?.close || '18:00'
          };
        });
        setOperatingHours(formatted);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load shop settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!shopId) return;
    try {
      setSaving(true);
      const payloadHours: any = {};
      DAYS.forEach(day => {
        const fd = operatingHours[day];
        if (fd) {
          payloadHours[day] = {
            open: fd.openTime || '09:00',
            close: fd.closeTime || '18:00',
            isClosed: !fd.open
          };
        }
      });

      await shopService.update(shopId, {
        isOpen,
        operatingHours: payloadHours,
      });
      Alert.alert('Success', 'Store settings updated');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to update store settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setOperatingHours((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        open: !prev[day]?.open,
      }
    }));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={DS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={DS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Store Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.row}>
            <View>
              <Text style={styles.sectionTitle}>Store Online Status</Text>
              <Text style={styles.sectionSub}>Turn off to temporarily close your store</Text>
            </View>
            <Switch
              value={isOpen}
              onValueChange={setIsOpen}
              trackColor={{ false: DS.gray300, true: DS.primary }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Operating Hours</Text>
          {DAYS.map(day => {
            const dayData = operatingHours[day] || { open: false, openTime: '09:00', closeTime: '18:00' };
            return (
              <View key={day} style={styles.dayRow}>
                <View style={styles.dayLeft}>
                  <Switch
                    value={dayData.open}
                    onValueChange={() => toggleDay(day)}
                    trackColor={{ false: DS.gray300, true: DS.primary }}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                  <Text style={styles.dayText}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                </View>
                {dayData.open ? (
                  <View style={styles.timeWrapper}>
                    <Text style={styles.timeText}>{dayData.openTime} - {dayData.closeTime}</Text>
                  </View>
                ) : (
                  <Text style={styles.closedText}>Closed</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: DS.card },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.gray100, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: DS.text },
  content: { flex: 1, padding: 20 },
  section: { backgroundColor: DS.card, padding: 20, borderRadius: 16, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: DS.text, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: DS.gray500 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dayLeft: { flexDirection: 'row', alignItems: 'center' },
  dayText: { fontSize: 15, color: DS.text, marginLeft: 8 },
  timeWrapper: { backgroundColor: DS.gray100, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  timeText: { fontSize: 14, color: DS.text, fontWeight: '500' },
  closedText: { fontSize: 14, color: DS.gray400, fontStyle: 'italic' },
  footer: { padding: 20, backgroundColor: DS.card, borderTopWidth: 1, borderTopColor: DS.border },
  saveBtn: { backgroundColor: DS.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default StoreSettingsScreen;
