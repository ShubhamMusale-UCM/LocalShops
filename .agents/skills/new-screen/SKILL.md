---
name: new-screen
description: Creates a new React Native screen in CityLocalShop with typed props, SafeAreaView, loading, error, and empty states.
triggers: ["create screen", "new screen", "add screen", "build screen"]
turbo_safe: false
---

# New Screen Skill

When triggered, create a new screen file in `apps/mobile/src/screens/[role]/` (e.g., `buyer/`, `seller/`, `delivery/`, `auth/`) with:

1. **Imports & Types**:
   - Navigation & route props interfaces typed with React Navigation stack/tab param list.
   - React Native components (`View`, `Text`, `TouchableOpacity`, `ActivityIndicator`, `FlatList`, etc.).
   - `SafeAreaView` from `react-native-safe-area-context`.
   - `LinearGradient` from `expo-linear-gradient` for headers (`#0D9488` → `#0F766E`).

2. **Design System & Component Guidelines**:
   - **Colors**: Primary Teal (`#0D9488`), Background (`#F8FAFC`), Card (`#FFFFFF`), Text Primary (`#1F2937`), Text Secondary (`#6B7280`), Border (`#F1F5F9`).
   - **Cards**: Background `#FFFFFF`, `borderRadius: 16`, 1px border `#F1F5F9`, subtle shadow (`shadowOpacity: 0.05-0.08`, `elevation: 2`).
   - **Filter Pills**: `borderRadius: 999`, filled primary state (`#0D9488` + white text) when active.
   - **Header**: LinearGradient `#0D9488` to `#0F766E` with frosted circular action buttons.
   - **Touch Targets**: All pressable elements minimum `44x44px`.
   - **Animations**: Reanimated or Animated entry transitions (FadeInDown with 60-100ms stagger), spring press feedback (`scale: 0.95-0.98`, damping 12-14, stiffness 100-200).
   - **Scroll Content Padding**: `paddingBottom: 100` on scroll containers to prevent overlap with floating elements/tabs.

3. **Required Component States**:
   - `loading`: Show ActivityIndicator or Skeleton loader component.
   - `error`: Show error card/banner with a working "Retry" button.
   - `empty`: Centered large icon in circular background + title + subtitle + CTA button.
   - `content`: Main UI rendering data.

4. **Layout & Safety**:
   - Wrap entire root component in `<SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>`.
   - Use `FlatList` for lists.
   - Wrap all event handlers & API calls in `try/catch`.

