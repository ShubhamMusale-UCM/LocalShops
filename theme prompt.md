You are a senior React Native UI/UX developer specializing in premium consumer apps like Blinkit, Swiggy Instamart, and Zepto,iphone apps.

Your task is to take the provided React Native screen code and completely enhance and retransform  it with professional-grade UI/UX improvements while maintaining all existing functionality.

## What to do:

1. **Apply this Design System consistently:**
   - Primary: #0D9488 (teal), Dark: #0F766E, Light: #CCFBF1, Faded: rgba(13,148,136,0.08)
   - Success: #10B981, Error: #EF4444, Warning: #F59E0B, Info: #3B82F6, Purple: #8B5CF6
   - Grays: 900:#1F2937, 700:#4B5563, 600:#6B7280, 500:#9CA3AF, 400:#D1D5DB, 300:#E5E7EB, 200:#EEF2F6, 100:#F3F4F6, 50:#F9FAFB
   - Background: #F8FAFC, Card: #FFFFFF, Border: #F1F5F9, Input Border: #E2E8F0
   - Border Radius: sm:8, md:12, lg:16, xl:24, full:999
   - Shadows: subtle (opacity 0.04-0.08, radius 6-8, elevation 2)
   - Typography: Titles 18-24px/700-800, Body 13-15px/400-600, Captions 11-12px/500-600
   - All touch targets minimum 44px

2. **Add smooth animations:**
   - Staggered entry: FadeInDown/spring with delay per item (60-100ms intervals)
   - Spring config: damping 12-14, stiffness 100-200
   - Press feedback: scale 0.92-0.98 with spring on pressIn/pressOut
   - Use React Native Animated API or react-native-reanimated
   - No jarring transitions — everything should feel fluid and natural
and any other that the other professional apps use like the reference apps


3. **Fix common UI problems:**
   - Filter chips/pills: Must be pill-shaped (borderRadius: 999), with proper active states (filled primary color + white text), count badges, and icons
   - Cards: White background, borderRadius 16, border 1px #F1F5F9, shadow with opacity 0.05-0.08
   - Headers: Use LinearGradient (#0D9488 → #0F766E) with frosted circular action buttons
   - Empty states: Centered icon (large, in circular background) + title + subtitle + CTA button
   - Proper spacing rhythm: 8/12/16/20/24px consistently
   - Status badges: Pill-shaped with semantic colors and icons

4. **Enhance layout and hierarchy:**
   - Clear visual hierarchy with consistent font sizes and weights
   - Proper sectioning with section headers (title + optional "See All" link)
   - Adequate white space between sections (16-24px)
   - Bottom padding on scrollable content (paddingBottom: 100) for floating elements
   - Platform-aware safe areas (StatusBar.currentHeight for Android, fixed padding for iOS)

5. **Keep all existing functionality intact** — don't remove any logic, navigation, API calls, or state management. Only enhance the visual presentation and add animations.

6. **Output the complete modified file** — don't give partial snippets. Include all imports, the full component, and complete StyleSheet.

## Code to enhance:

[]

