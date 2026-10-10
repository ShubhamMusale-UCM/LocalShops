Phase 1: Operational Strategy by Scenario
Case 1: Disambiguating Multiple / Unlabeled Stitch Screens
Action: The agent queries list_screens and downloads screen metadata. It extracts key structural anchors (headers, CTA buttons, layout hierarchy, and data bindings) and cross-references them against your existing routes (e.g., /cart, /checkout, /product/:id, /profile).

Resolution Rule: If multiple variations exist for the same view (e.g., two distinct "Product Page" mockups), the agent checks version timestamps, screen hierarchy, or state flags (e.g., logged-in vs. guest, empty cart vs. full cart). If ambiguity persists, it defaults to the most complete state and explicitly logs the selection.

Case 2: Screens or Components Missing from Stitch
Action: The agent creates a Design Gap Audit Report before touching any code.

Deliverable: A structured table listing:

Missing View / Component name.

Current code location (src/...).

Feature purpose & backend bindings attached to it.

Precise design recommendations (typography, color tokens, button styles, card elevations) extrapolated directly from Stitch's existing design tokens so the missing piece matches the new aesthetic seamlessly.

Case 3: Stitch Screen Exists, but an Existing Feature is Missing from the Mockup
Action: Additive Adaptation. Never drop working functionality just because a Stitch mockup omitted it (e.g., the mockup shows a product card without a wishlist heart, or a checkout page without a split-payment/coupon input that exists in your current app).

Execution: The agent extracts the design system rules (border radii, typography classes, active states, padding tokens) from Stitch, extracts the functional logic/elements from your original code, and styles the existing feature using the new design language.

Case 4: Preserving Backend Wiring, State, and Native Animations
Action: Strict Separation of Concerns.

All API calls, TanStack Query hooks, Redux/Zustand slices, Capacitor plugin calls (@capacitor/preferences, @capacitor/network), and forms stay untouched.

The agent only swaps the JSX presentation layer and styling classes.

Native-like transitions (tab switches, slide-over modals, pull-to-refresh) are preserved by binding the new UI elements to the existing animation controllers.

Case 5: Mobile & Capacitor Optimization
Stack Decision: React (SPA) + TypeScript + Vite.

Avoid Next.js server components/SSR because Capacitor runs locally on a file:// WebView. Next.js adds hydration delays, larger bundle sizes, and static export headaches.

Exact HTML/CSS visual fidelity from Stitch is preserved while organizing it into modular, strictly typed .tsx components.

Mobile optimizations applied automatically: safe-area insets (env(safe-area-inset-top) / bottom), hardware-accelerated transforms (transform: translate3d(0,0,0)), minimum 44×44px touch targets, and touch-action: manipulation to remove double-tap zoom lag.

Case 6: Full-Depth Scrolling and Dynamic Data States
Action: Stitch mockups typically show only the top fold. The agent will not stop at the static screenshot.

Execution: It builds complete, functional views:

Scroll containers with sticky headers, elastic bouncing, and safe bottom tab offsets.

Virtualized lists (or paginated infinite scrolling) for product feeds so the WebView does not drop below 60fps when rendering dozens of items.

Real dynamic states: loading skeletons, empty states, and error toasts styled in the new design system.

Case 7: Updating Workspace Design Skill Files
Action: The agent inspects existing .skill, .md, or design guideline files in your project, extracts the core Stitch design tokens (color variables, typography scales, spacing units, elevation levels), and overwrites or appends the new design system rules into the workspace skill files.

Master Antigravity IDE Prompt
Copy and paste the entire prompt below into your Antigravity Agent:

Markdown
You are a Principal Mobile Frontend Engineer and UI/UX Architect. You have access to the Stitch MCP server configured in this environment:

MCP Configuration:
- Server: "stitch" (https://stitch.googleapis.com/mcp)
- Tool Capabilities: Screen listing, design token extraction, HTML/CSS inspection.

Your goal is to fully adapt the new Stitch design system across our entire existing mobile application, preserving 100% of the existing functionality, backend wiring, state management, and animations, while optimizing everything for high-performance production use inside a Capacitor mobile WebView.

Follow these strict rules and operational workflows step-by-step:

--------------------------------------------------------------------------------
1. ARCHITECTURE & OPTIMIZATION TARGET (CAPACITOR MOBILE)
--------------------------------------------------------------------------------
- Framework: React Single Page Application (SPA) with TypeScript and Vite.
- Rule: DO NOT introduce Next.js, SSR, Server Actions, or dynamic server-side routing. The build output must be purely static client-side bundles compatible with Capacitor's `file://` WebView.
- Visual Fidelity: The exact HTML structure and CSS styling from Stitch must be preserved, converted cleanly into modular `.tsx` components and CSS/Tailwind modules.
- Mobile WebView Smoothness:
  * Safe Areas: Ensure headers, modals, and bottom navigation bars respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
  * Touch Targets: Minimum 44x44px hit-box on all interactive elements. Add immediate active-touch feedback (`active:opacity-75` or ripple).
  * Smooth Scrolling: Implement hardware-accelerated scrolling (`-webkit-overflow-scrolling: touch`) and ensure long product feeds use virtualized/lazy rendering to maintain 60 FPS.
  * Prevent Web-Jank: Ensure `user-select: none` on native-like controls and `touch-action: manipulation` to eliminate the 300ms mobile tap delay.

--------------------------------------------------------------------------------
2. STITCH MCP INSPECTION & SCREEN MAPPING
--------------------------------------------------------------------------------
- Call `list_screens` on the Stitch MCP server to pull all available design screens.
- Analyze and map each Stitch screen to our existing codebase routes and components (e.g., Home, Catalog/Search, Product Detail, Cart, Checkout, Order History, Profile).
- Multiple Design Ambiguity: If multiple versions of a screen exist in Stitch, compare timestamps and layout richness. Identify the primary/latest production variant and document your choice before proceeding.

--------------------------------------------------------------------------------
3. GAP AUDIT & MISSING ELEMENTS
--------------------------------------------------------------------------------
Before making code changes, run a two-way differential audit:
A. Missing Screens in Stitch:
   - Identify any route or page currently in our frontend that has NO corresponding screen in Stitch.
   - Output a "Missing Screen List" describing each view, its purpose, and instructions on how to design/adapt it using the new design system tokens.
B. Missing Features in Stitch Screens:
   - For every mapped screen, inspect our existing code for features, inputs, badges, or buttons that the Stitch mockup omitted (e.g., search filters, cart counts, payment methods, coupon inputs).
   - RULE: DO NOT DELETE OR OMIT EXISTING FUNCTIONALITY. You must style and integrate the existing feature directly into the new Stitch layout using Stitch's extracted design tokens.

--------------------------------------------------------------------------------
4. FULL WORKING DEPTH (BEYOND STATIC MOCKUPS)
--------------------------------------------------------------------------------
- Stitch mockups often show only a static first fold. You MUST implement the complete, end-to-end interactive and scrollable screen:
  * Build the full scrollable view with appropriate content padding above bottom nav bars.
  * Ensure sticky navigation headers transition cleanly during scroll.
  * Provide dynamic states matching the design: Loading Skeletons, Empty State views, Error states, and infinite-scroll pagination.

--------------------------------------------------------------------------------
5. PRESERVATION OF BUSINESS LOGIC & BACKEND WIRING
--------------------------------------------------------------------------------
- Strictly preserve all existing:
  * API services, query hooks, fetch calls, and WebSocket connections.
  * State management stores (Zustand, Redux, Context) and local storage/Capacitor Preferences bindings.
  * Form validation logic, event handlers, and payment gateway integrations.
  * Page transition animations and custom gestures.
- Only refactor the UI/JSX layer and CSS styling to match Stitch. Never break the logic layer.

--------------------------------------------------------------------------------
6. UPDATE DESIGN SKILL FILES
--------------------------------------------------------------------------------
- Extract design tokens from Stitch: Primary/Secondary Colors, Neutral Palettes, Typography Scale, Border Radii, Box Shadows, and Spacing Grids.
- Locate the existing workspace design skill files (under `.skills/`, `.antigravity/`, or markdown design docs) and update them with the new Stitch design system rules so subsequent agent tasks stay visually consistent.

--------------------------------------------------------------------------------
EXECUTION ORDER:
1. Call Stitch MCP to list all screens and pull global styles/tokens.
2. Present the Screen Mapping Table and the Gap Audit Report (missing screens/features).
3. Update the workspace design skill files with the new design tokens.
4. Incrementally convert screens to React + TypeScript, starting with shared UI components (buttons, cards, headers), followed by core application views.
5. Validate build output (`npm run build`) and test for type safety and WebView responsiveness.