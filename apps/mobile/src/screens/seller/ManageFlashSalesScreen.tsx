import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import flashSaleService from '../../services/flashSaleService';
import shopService from '../../services/shopService';
import { getPrimarySellerShop } from '../../services/sellerShopContext';

const DS = {
  primary: '#0D9488', primaryDark: '#0F766E', success: '#10B981', error: '#EF4444', warning: '#F59E0B',
  gray900: '#1F2937', gray700: '#4B5563', gray600: '#6B7280', gray500: '#9CA3AF', gray400: '#D1D5DB',
  gray300: '#E5E7EB', gray100: '#F3F4F6', background: '#F8FAFC', card: '#FFFFFF', text: '#1F2937', border: '#E5E7EB'
};

export const ManageFlashSalesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [shopId, setShopId] = useState<string | null>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  
  // New Sale Form
  const [selectedProduct, setSelectedProduct] = useState('');
  const [discount, setDiscount] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const shop = await getPrimarySellerShop();
    if (shop?.id) {
      setShopId(shop.id);
      loadSales(shop.id);
      loadProducts(shop.id);
    } else {
      setLoading(false);
    }
  };

  const loadSales = async (sId: string) => {
    try {
      setLoading(true);
      const res = await flashSaleService.getShopFlashSales(sId);
      setSales(res.data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load flash sales');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (sId: string) => {
    try {
      const res = await shopService.getProducts(sId, { limit: 100 });
      setProducts(res.data?.products || res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    if (!shopId) return;
    if (!selectedProduct || !discount || !startDateStr || !endDateStr) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    try {
      setCreating(true);
      await flashSaleService.createFlashSale({
        shopId,
        productId: selectedProduct,
        discount: Number(discount),
        startTime: new Date(startDateStr).toISOString(),
        endTime: new Date(endDateStr).toISOString()
      });
      setModalVisible(false);
      loadSales(shopId);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to create flash sale');
    } finally {
      setCreating(false);
    }
  };

  const handleEndEarly = async (saleId: string) => {
    if (!shopId) return;
    try {
      await flashSaleService.endFlashSale(saleId, shopId);
      loadSales(shopId);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to end flash sale');
    }
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
        <Text style={styles.title}>Flash Sales</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sales}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.productName}>{item.product?.name}</Text>
              <View style={[styles.badge, { backgroundColor: item.isLive ? DS.success : DS.gray400 }]}>
                <Text style={styles.badgeText}>{item.isLive ? 'LIVE' : (item.isUpcoming ? 'UPCOMING' : 'ENDED')}</Text>
              </View>
            </View>
            <Text style={styles.discountText}>{item.discount}% OFF</Text>
            <Text style={styles.dateText}>Ends: {new Date(item.endTime).toLocaleString()}</Text>
            {item.isLive && (
              <TouchableOpacity onPress={() => handleEndEarly(item.id)} style={styles.endBtn}>
                <Text style={styles.endBtnText}>End Early</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: DS.gray500 }}>No flash sales found.</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Flash Sale</Text>
            <ScrollView>
              <Text style={styles.label}>Select Product</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {products.map(p => (
                  <TouchableOpacity 
                    key={p.id} 
                    onPress={() => setSelectedProduct(p.id)}
                    style={[styles.productPill, selectedProduct === p.id && styles.productPillActive]}
                  >
                    <Text style={selectedProduct === p.id ? {color: '#FFF'} : {}}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Discount %</Text>
              <TextInput style={styles.input} value={discount} onChangeText={setDiscount} keyboardType="numeric" placeholder="e.g. 20" />

              <Text style={styles.label}>Start Date (YYYY-MM-DD HH:MM)</Text>
              <TextInput style={styles.input} value={startDateStr} onChangeText={setStartDateStr} placeholder="2026-09-09 10:00" />

              <Text style={styles.label}>End Date (YYYY-MM-DD HH:MM)</Text>
              <TextInput style={styles.input} value={endDateStr} onChangeText={setEndDateStr} placeholder="2026-09-10 10:00" />
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: DS.card },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.gray100, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: DS.text },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.primary, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: DS.card, padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  productName: { fontSize: 16, fontWeight: 'bold', color: DS.text, flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  discountText: { fontSize: 20, fontWeight: '800', color: DS.primary, marginBottom: 4 },
  dateText: { fontSize: 12, color: DS.gray500, marginBottom: 12 },
  endBtn: { backgroundColor: DS.error, padding: 8, borderRadius: 8, alignItems: 'center' },
  endBtnText: { color: '#FFF', fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: DS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: DS.text },
  input: { backgroundColor: DS.gray100, padding: 12, borderRadius: 8, marginBottom: 16 },
  productPill: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: DS.gray100, borderRadius: 20, marginRight: 8 },
  productPillActive: { backgroundColor: DS.primary },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center' },
  cancelBtnText: { color: DS.gray600, fontWeight: 'bold' },
  saveBtn: { flex: 1, backgroundColor: DS.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
});

export default ManageFlashSalesScreen;
