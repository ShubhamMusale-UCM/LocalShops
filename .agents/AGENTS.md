# Project: CityLocalShop

Hyperlocal Shop Discovery & Commerce Platform (Monorepo).

## Stack
- **Mobile App (`/apps/mobile`)**: React Native 0.73 / Expo SDK 50, TypeScript strict, Zustand 4.5 for global state, TanStack Query 5.17 for server state, React Navigation 6 (Native & Tabs), Axios, Reanimated, Safe Area Context.
- **Server (`/server`)**: Node.js, Express, Prisma ORM, PostgreSQL, Redis, Socket.io, BullMQ.
- **Web Admin (`/apps/web-admin`)**: React, Vite, TypeScript, TailwindCSS / Vanilla CSS.
- **Shared (`/packages`)**: Shared types, utils, UI tokens.

## File & Directory Conventions
- **Mobile Screens**: PascalCase in `/apps/mobile/src/screens/[role]/` (e.g. `buyer/HomeScreen.tsx`, `auth/OTPVerificationScreen.tsx`).
- **Mobile Components**: PascalCase in `/apps/mobile/src/components/` (e.g. `common/`, `buyer/`, `seller/`).
- **Mobile Hooks**: camelCase starting with `use` in `/apps/mobile/src/hooks/`.
- **Mobile Services**: camelCase ending with `Service.ts` in `/apps/mobile/src/services/`.
- **Mobile Stores**: camelCase ending with `Store.ts` in `/apps/mobile/src/store/` or `/src/stores/`.
- **Server Controllers**: camelCase ending with `Controller.ts` in `/server/src/controllers/`.
- **Server Routes**: camelCase ending with `Routes.ts` in `/server/src/routes/`.

## Code Rules & Quality Standards
- **Component States**: Every UI screen/component must gracefully handle:
  1. Loading state (Skeleton or ActivityIndicator)
  2. Error state (User-friendly message with Retry trigger)
  3. Empty state (Informative graphic or placeholder message)
  4. Success/Content state
- **Safety**: Wrap all screen contents in `SafeAreaView`. Wrap all async handlers in `try/catch`.
- **Data Validation**: Validate external API data with TypeScript types or Zod schemas before consumption.
- **Lists**: Use `FlatList` or `FlashList` for lists. Never use `ScrollView` with `.map()` for unbounded data arrays.
- **Clean Code**: No `console.log` in committed production code. Clean up unhandled promise rejections.
- **Style Rules**: Use existing design tokens and unified color theme. Never hardcode random hex colors without fallback tokens.

## Agent Behavior & Boundaries
- Complete files only. Never output partial files with `// ... rest of code`.
- Verify code compiles or runs tests before declaring task complete.
- Do not install new npm dependencies without explicit user confirmation.
- Do not touch files outside the scope of the assigned task.
- If an API or library usage is uncertain, inspect existing workspace usage or request docs instead of hallucinating parameters.

## Design Tokens & Theme Context (Blinkit/Instamart Style)
- **Primary Color**: `#0D9488` (Teal/Blinkit-style green) | Dark: `#0F766E` | Light: `#CCFBF1` | Faded: `rgba(13, 148, 136, 0.1)`
- **Secondary/Action Colors**:
  - Success: `#10B981` / `#059669`
  - Error: `#EF4444` / `#DC2626`
  - Warning: `#F59E0B` / `#D97706`
  - Info: `#3B82F6` / `#2563EB`
  - Purple: `#8B5CF6` / `#7C3AED`
  - WhatsApp: `#25D366` / `#128C7E`
- **Neutrals**:
  - Text Primary: `#1F2937` (Gray 900) | Secondary: `#6B7280` (Gray 600) | Placeholder: `#9CA3AF` (Gray 500)
  - Borders: `#F1F5F9` | Input Border: `#E2E8F0`
  - Gray Scale: 50: `#F9FAFB`, 100: `#F3F4F6`, 200: `#EEF2F6`, 300: `#E5E7EB`, 400: `#D1D5DB`, 700: `#4B5563`, 800: `#374151`
- **Backgrounds**: Screen: `#F8FAFC` | Card: `#FFFFFF` | Modal Overlay: `rgba(0, 0, 0, 0.5)`
- **Typography Hierarchy**:
  - Headings: 24px-32px (font-weight 700-800)
  - Subheadings: 18px-20px (font-weight 600-700)
  - Body: 14px-16px (font-weight 400-500)
  - Captions: 11px-12px (font-weight 500)
  - Price: 22px-28px (font-weight 700-800, color `#0D9488`)
- **Spacing Scale**: xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 20px, 2xl: 24px, screenHorizontal: 16px
- **Border Radius**: sm: 8px, md: 12px, lg: 16px, xl: 24px, full: 999px
- **Shadows**:
  - `sm`: opacity 0.05, radius 2, elevation 1
  - `md`: opacity 0.08, radius 4, elevation 2
  - `lg`: opacity 0.12, radius 8, elevation 4
- **Animation Specs**: Spring (damping 12-14, stiffness 100-200), Active press scale (0.95-0.98), Staggered entry delay (60-100ms)
- **Touch Targets**: Minimum 44x44px for all pressable elements.


## Multi-Agent Domain Division
When running multiple agents in parallel, respect folder boundaries strictly:
- **UIAgent**: Owns `/apps/mobile/src/screens/`, `/apps/mobile/src/components/`, `/apps/web-admin/src/`
- **DataAgent**: Owns `/apps/mobile/src/services/`, `/apps/mobile/src/store/`
- **ServerAgent**: Owns `/server/src/`
- **TestAgent**: Owns `/apps/mobile/__tests__/`, `/server/src/__tests__/`
*Rule*: No agent may mutate another agent's assigned directories. Inter-module wiring happens after domain tasks complete.

## Execution Modes & Risk Policy
- **Auto-continue Mode**: Default for general UI creation, refactoring, and feature work.
- **Review-Driven Mode**: MANDATORY for authentication flows (`auth/`), payment gateway integrations (Razorpay), Prisma database migrations, native code (`/android/`, `/ios/`), and environment configuration (`.env`).

## Terminal Permissions Policy

### Allow List (Safe commands - run without prompt when in Turbo):
- `npm run mobile:start`
- `npm run server:dev`
- `npm run prisma:generate`
- `npm test`
- `npx prettier --write`
- `npx eslint --fix`

### Deny List (Forbidden without explicit user confirmation):
- `rm -rf` or `Remove-Item -Recurse -Force`
- `git push --force` / `git reset --hard`
- `npx prisma migrate reset` or database drop commands
- Any command containing `production` or `eas submit`
- Direct editing of native build files inside `/android` or `/ios`
