# Project: CityLocalShop

Hyperlocal Shop Discovery & Commerce Platform.

## Stack & Target Architecture
- **Active Mobile / Web Frontend (`temp_github_repo`)**: Capacitor hybrid application (React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Capacitor Android shell). ALL active UI development, mobile features, shop/buyer screens, and data syncing target THIS codebase.
- **Backend Server (`/server`)**: Node.js, Express, Prisma ORM, PostgreSQL, Redis, Socket.io, BullMQ.
- **DEPRECATED / IGNORED (`/apps/mobile`)**: Legacy React Native / Expo app. STRICT RULE: DO NOT modify, update, test, or commit to `/apps/mobile`.

## Code Rules & Quality Standards
- **Component States**: Every UI screen/component must gracefully handle:
  1. Loading state (Skeleton or ActivityIndicator)
  2. Error state (User-friendly message with Retry trigger)
  3. Empty state (Informative graphic or placeholder message)
  4. Success/Content state
- **Safety**: Wrap all async handlers in `try/catch`.
- **Data Validation**: Validate external API data with TypeScript types or Zod schemas before consumption.
- **Clean Code**: No `console.log` in committed production code. Clean up unhandled promise rejections.
- **Style Rules**: Use existing design tokens and unified color theme. Never hardcode random hex colors without fallback tokens.

## Agent Behavior & Boundaries
- Complete files only. Never output partial files with `// ... rest of code`.
- Verify code compiles or runs tests before declaring task complete.
- Do not install new npm dependencies without explicit user confirmation.
- Do not touch files outside the scope of the assigned task.
- If an API or library usage is uncertain, inspect existing workspace usage or request docs instead of hallucinating parameters.

## Design Tokens & Theme Context (Dark Sky Blue / Neon Style)
- **Backgrounds**: Screen: `#050814` (Deep Dark Blue/Black) | Card: `rgba(255,255,255,0.02)` | Modal Overlay: `rgba(0, 0, 0, 0.7)`
- **Primary Color**: `#38BDF8` (Sky Blue) | Dark/Border: `rgba(56, 189, 248, 0.2)` | Faded: `rgba(56, 189, 248, 0.1)`
- **Secondary/Action Colors**:
  - Success: `#10B981`
  - Error: `#EF4444`
  - Warning: `#F59E0B`
  - WhatsApp: `#25D366`
- **Neutrals**:
  - Text Primary: `#FFFFFF` | Text Secondary: `rgba(255,255,255,0.6)` | Placeholder: `rgba(255,255,255,0.4)`
  - Borders: `rgba(255,255,255,0.05)` | Input Border: `rgba(255,255,255,0.1)`
- **Typography Hierarchy (Use Inter & Outfit)**:
  - Headings (Outfit): 20px-24px (font-weight 700-800)
  - Subheadings (Inter): 16px-18px (font-weight 600-700)
  - Body (Inter): 13px-14px (font-weight 400-500)
  - Captions (Inter): 10px-12px (font-weight 500-600)
  - Price (Outfit): 14px-18px (font-weight 800, color `#38BDF8`)
- **Spacing Scale**: xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 20px, 2xl: 24px, screenHorizontal: 16px
- **Border Radius**: sm: 8px, md: 12px, lg: 16px, xl: 24px, full: 999px
- **Shadows**:
  - `sm`: opacity 0.05, radius 2, elevation 1
  - `md`: opacity 0.08, radius 4, elevation 2
  - `lg`: opacity 0.12, radius 8, elevation 4
- **Animation Specs**: Spring (damping 12-14, stiffness 100-200), Active press scale (0.95-0.98), Staggered entry delay (60-100ms)
- **Touch Targets**: Minimum 44x44px for all pressable elements.

## Repositories & Execution Roles
- **Backend API Server**: `CityLocalShop/server/` (Repo: `LocalShops`, branch `main`)
- **Active Frontend / Hybrid App**: `temp_github_repo/` (Repo: `UI-design-lCS`, branch `main`)
- **Legacy Mobile App**: `CityLocalShop/apps/mobile/` (IGNORED)
