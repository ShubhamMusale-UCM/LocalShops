import React from 'react';
import { View, Text } from 'react-native';

const MapView = (props) => (
  <View style={[{ backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', minHeight: 200, borderRadius: 8 }, props.style]}>
    <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>🗺️ Interactive Map (Native Mobile Only)</Text>
    {props.children}
  </View>
);

export const Marker = () => null;
export const Polyline = () => null;
export const Callout = () => null;
export const Circle = () => null;
export const Polygon = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

export default MapView;
