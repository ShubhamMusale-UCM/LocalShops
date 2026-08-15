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

## Overview of Setup Files Created

| File | Purpose |
|------|---------|
| `AGENTS.md` | Central brain file for CityLocalShop (stack, Dark Sky Blue / Neon design tokens, conventions, domain splits, permissions). |
| `AGENTS.md` (Root) | Global workspace pointer to `CityLocalShop/.agents/AGENTS.md`. |
| `new-screen` SKILL | Skill for building standard React Native Expo screens with 4 UI states, Dark Sky Blue design tokens, & SafeAreaView. |
| `api-service` SKILL | Skill for building typed Axios API services with Zod validation & standard error handling. |
| `write-tests` SKILL | Skill for generating Jest + React Native Testing Library test suites. |
| `/newfeature` Workflow | Custom macro command for building full feature skeletons. |
| `/review` Workflow | Custom macro command for automated code and design system compliance reviews. |
| `/optimize` Workflow | Custom macro command for performance & re-render optimizations. |
