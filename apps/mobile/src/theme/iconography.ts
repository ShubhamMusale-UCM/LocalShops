import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const categoryIconMap: Record<string, IoniconName> = {
  grocery: 'basket-outline',
  electronics: 'phone-portrait-outline',
  clothing: 'shirt-outline',
  furniture: 'bed-outline',
  food: 'restaurant-outline',
  health: 'medkit-outline',
  beauty: 'sparkles-outline',
  jewellery: 'diamond-outline',
  books: 'book-outline',
  sports: 'football-outline',
  automotive: 'car-sport-outline',
  hardware: 'hammer-outline',
  pets: 'paw-outline',
  services: 'construct-outline',
};

export const getCategoryIcon = (categoryId: string): IoniconName =>
  categoryIconMap[categoryId] || 'grid-outline';
