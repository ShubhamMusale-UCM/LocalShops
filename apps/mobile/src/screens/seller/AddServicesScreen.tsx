import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  FlatList,
  Modal,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

/**
 * AddServicesScreen - Screen for restaurant/hotel/cafe owners to add menu items and services
 */

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  prepTime?: number; // For food items
  image?: string;
  isAvailable: boolean;
}

interface ServiceForm {
  name: string;
  description: string;
  price: string;
  category: string;
  tags: string;
  prepTime: string;
  image?: string;
}

type ShopType = 'restaurant' | 'hotel' | 'cafe';

const AddServicesScreen = () => {
  const navigation = useNavigation();
  const [shopType] = useState<ShopType>('restaurant'); // This should come from shop data
  const [services, setServices] = useState<Service[]>([
    {
      id: '1',
      name: 'Margherita Pizza',
      description: 'Classic pizza with tomato sauce and mozzarella',
      price: 250,
      category: 'Pizza',
      tags: ['Vegetarian', 'Classic'],
      prepTime: 15,
      isAvailable: true,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>({
    name: '',
    description: '',
    price: '',
    category: '',
    tags: '',
    prepTime: '15',
  });

  const categories = {
    restaurant: ['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Specials'],
    hotel: ['Deluxe Room', 'Suite', 'Standard Room', 'Premium Room', 'Amenities'],
    cafe: ['Coffee', 'Tea', 'Pastries', 'Sandwiches', 'Beverages'],
  };

  const getShopIcon = () => {
    switch (shopType) {
      case 'restaurant':
        return '🍽️';
      case 'hotel':
        return '🏨';
      case 'cafe':
        return '☕';
      default:
        return '✨';
    }
  };

  const getShopLabel = () => {
    switch (shopType) {
      case 'restaurant':
        return 'Menu Items';
      case 'hotel':
        return 'Room Types & Amenities';
      case 'cafe':
        return 'Beverages & Snacks';
      default:
        return 'Services';
    }
  };

  const handleOpenModal = (service?: Service) => {
    if (service) {
      setEditingId(service.id);
      setForm({
        name: service.name,
        description: service.description,
        price: service.price.toString(),
        category: service.category,
        tags: service.tags.join(', '),
        prepTime: service.prepTime?.toString() || '15',
      });
    } else {
      setEditingId(null);
      setForm({
        name: '',
        description: '',
        price: '',
        category: '',
        tags: '',
        prepTime: shopType === 'restaurant' || shopType === 'cafe' ? '15' : '',
      });
    }
    setShowModal(true);
  };

  const handleSaveService = () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    if (!form.price.trim()) {
      Alert.alert('Error', 'Please enter a price');
      return;
    }
    if (!form.category.trim()) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    const newService: Service = {
      id: editingId || Date.now().toString(),
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      category: form.category,
      tags: form.tags
        ? form.tags.split(',').map(t => t.trim()).filter(t => t)
        : [],
      prepTime: form.prepTime ? parseInt(form.prepTime) : undefined,
      isAvailable: true,
    };

    if (editingId) {
      setServices(services.map(s => (s.id === editingId ? newService : s)));
      Alert.alert('Success', 'Service updated successfully');
    } else {
      setServices([...services, newService]);
      Alert.alert('Success', 'Service added successfully');
    }

    setShowModal(false);
  };

  const handleDeleteService = (id: string) => {
    Alert.alert('Delete Service', 'Are you sure you want to delete this service?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setServices(services.filter(s => s.id !== id));
          Alert.alert('Success', 'Service deleted');
        },
      },
    ]);
  };

  const handleToggleAvailability = (id: string) => {
    setServices(services.map(s => (s.id === id ? { ...s, isAvailable: !s.isAvailable } : s)));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: Spacing.md }}>
          <Text style={styles.headerTitle}>Add {getShopLabel()}</Text>
          <Text style={styles.headerSubtitle}>{getShopIcon()} Manage your offerings</Text>
        </View>
        <TouchableOpacity onPress={() => handleOpenModal()}>
          <Ionicons name="add-circle" size={32} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Services List */}
      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.serviceCard}>
            <View style={styles.serviceRow}>
              {/* Left section with info */}
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.serviceName}>{item.name}</Text>
                  <TouchableOpacity
                    onPress={() => handleToggleAvailability(item.id)}
                    style={[
                      styles.availabilityBadge,
                      !item.isAvailable && { backgroundColor: Colors.error },
                    ]}
                  >
                    <Ionicons
                      name={item.isAvailable ? 'checkmark-circle' : 'close-circle'}
                      size={14}
                      color={Colors.white}
                    />
                    <Text style={styles.availabilityText}>
                      {item.isAvailable ? 'Available' : 'Unavailable'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>

                {/* Category & Tags */}
                <View style={styles.metaRow}>
                  <View style={styles.categoryTag}>
                    <Text style={styles.categoryTagText}>{item.category}</Text>
                  </View>
                  {item.tags && item.tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {item.tags.slice(0, 2).map((tag, idx) => (
                        <Text key={idx} style={styles.tagSmall}>
                          {tag}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>

                {/* Price & Prep Time */}
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{item.price}</Text>
                  {item.prepTime && (
                    <View style={styles.prepTimeTag}>
                      <Ionicons name="time-outline" size={12} color={Colors.gray[600]} />
                      <Text style={styles.prepTimeText}>{item.prepTime} min</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right section with actions */}
              <View style={styles.actionsColumn}>
                <TouchableOpacity
                  onPress={() => handleOpenModal(item)}
                  style={styles.iconButton}
                >
                  <Ionicons name="pencil" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteService(item.id)}
                  style={styles.iconButton}
                >
                  <Ionicons name="trash" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
        scrollEnabled={true}
        contentContainerStyle={styles.listContent}
      />

      {/* Empty State */}
      {services.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>📝</Text>
          <Text style={styles.emptyStateText}>No services added yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Tap the + button above to add your first {getShopLabel().toLowerCase()}
          </Text>
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Service' : 'Add New Service'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={28} color={Colors.gray[600]} />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Input
                label="Name"
                placeholder="e.g., Margherita Pizza"
                value={form.name}
                onChangeText={(text) => setForm({ ...form, name: text })}
              />

              <Input
                label="Description"
                placeholder="Brief description of the service"
                value={form.description}
                onChangeText={(text) => setForm({ ...form, description: text })}
                multiline
                style={{ minHeight: 60 }}
              />

              <Input
                label="Price (₹)"
                placeholder="0.00"
                value={form.price}
                onChangeText={(text) => setForm({ ...form, price: text })}
                keyboardType="decimal-pad"
              />

              {/* Category Dropdown */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryOptions}>
                  {categories[shopType].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setForm({ ...form, category: cat })}
                      style={[
                        styles.categoryOption,
                        form.category === cat && styles.categoryOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          form.category === cat && styles.categoryOptionTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input
                label="Tags (comma-separated)"
                placeholder="e.g., Vegetarian, Spicy"
                value={form.tags}
                onChangeText={(text) => setForm({ ...form, tags: text })}
              />

              {(shopType === 'restaurant' || shopType === 'cafe') && (
                <Input
                  label="Preparation Time (minutes)"
                  placeholder="15"
                  value={form.prepTime}
                  onChangeText={(text) => setForm({ ...form, prepTime: text })}
                  keyboardType="number-pad"
                />
              )}

              <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setShowModal(false)}
                style={{ flex: 1, marginRight: Spacing.md }}
              />
              <Button
                title={editingId ? 'Update' : 'Add Service'}
                onPress={handleSaveService}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  headerTitle: { ...Typography.h4, color: Colors.gray[900] },
  headerSubtitle: { ...Typography.caption, color: Colors.gray[500], marginTop: 2 },
  listContent: { padding: Spacing.lg, gap: Spacing.md },
  serviceCard: { marginBottom: Spacing.md },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  serviceName: { ...Typography.bodyMedium, color: Colors.gray[900], fontWeight: '600', flex: 1 },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.full,
    marginLeft: Spacing.sm,
  },
  availabilityText: { ...Typography.caption, color: Colors.white, fontWeight: '600', fontSize: 10 },
  description: { ...Typography.caption, color: Colors.gray[600], marginBottom: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  categoryTag: { backgroundColor: Colors.primaryFaded, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Spacing.radius.md },
  categoryTagText: { ...Typography.caption, color: Colors.primary, fontWeight: '600', fontSize: 10 },
  tagsRow: { flexDirection: 'row', gap: Spacing.xs },
  tagSmall: { ...Typography.caption, color: Colors.gray[600], fontSize: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  price: { ...Typography.bodyBold, color: Colors.primary, fontSize: 16 },
  prepTimeTag: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  prepTimeText: { ...Typography.caption, color: Colors.gray[600], fontSize: 10 },
  actionsColumn: { gap: Spacing.sm },
  iconButton: { padding: Spacing.sm },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyStateText: { ...Typography.body, color: Colors.gray[700], fontWeight: '600' },
  emptyStateSubtext: { ...Typography.caption, color: Colors.gray[500], marginTop: Spacing.sm },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: Spacing.radius.xl, borderTopRightRadius: Spacing.radius.xl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  modalTitle: { ...Typography.h4, color: Colors.gray[900] },
  modalForm: { padding: Spacing.lg },
  formGroup: { marginBottom: Spacing.lg },
  label: { ...Typography.labelSmall, color: Colors.gray[900], fontWeight: '600', marginBottom: Spacing.sm },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryOption: { flex: 1, minWidth: '45%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radius.md, borderWidth: 2, borderColor: Colors.gray[200] },
  categoryOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaded },
  categoryOptionText: { ...Typography.caption, color: Colors.gray[700], textAlign: 'center', fontWeight: '500' },
  categoryOptionTextActive: { color: Colors.primary, fontWeight: '600' },
  modalActions: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.gray[100] },
});

export default AddServicesScreen;
