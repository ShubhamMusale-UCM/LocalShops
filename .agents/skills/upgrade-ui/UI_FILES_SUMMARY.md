# UI Files Summary

This document contains a comprehensive list of all UI files (Components and Screens) in the CityLocalShop mobile app and their specific purposes. Use this as a reference when tasked with upgrading or modifying the user interface.

## 🧩 Reusable Components (`apps/mobile/src/components/ui/`)
* **AmbientOrbs.tsx**: Animated background orbs for premium visual effects.
* **Badge.tsx**: UI element for displaying statuses, counts, or tags.
* **Button.tsx**: Standard reusable button component with various variants.
* **Card.tsx**: Container component for grouping related information.
* **CircularSearchOverlay.tsx**: Specialized search overlay with circular animation.
* **ErrorBoundary.tsx**: Component to catch and display fallback UI for React errors.
* **Glassmorphism.tsx / GlassPanel.tsx**: Premium glass-like frosted panels for modern UI aesthetics.
* **Input.tsx**: Standardized text input field with validation states.
* **KineticOrbProjectile.tsx**: Advanced animated UI element.
* **MapPickerModal.tsx**: Modal interface for selecting locations on a map.
* **MorphingButton.tsx**: Button with shape-shifting or advanced interactive animations.
* **OfflineBanner.tsx**: Alert banner displayed when the user loses internet connection.
* **ProductCard.tsx**: Card specifically designed for displaying products in lists/grids.
* **ReanimatedWarmup.tsx**: Utility component to preload animations for smooth transitions.
* **ServiceShowcaseCard.tsx**: Card for displaying services (Hotel rooms, Restaurant menus, etc).
* **Skeleton.tsx**: Loading state placeholder component.
* **Toast.tsx**: Temporary notification popups.
* **TouchSpring.tsx**: Wrapper for bouncy, spring-based touch interactions.

## 📊 Review Components (`apps/mobile/src/components/review/`)
* **SentimentBadge.tsx**: Badge showing review sentiment (Positive/Neutral/Negative).
* **SentimentChart.tsx**: Visual chart displaying aggregated sentiment data.

## 📱 Buyer Screens (`apps/mobile/src/screens/buyer/`)
* **HomeScreen.tsx**: Main landing screen for buyers showing categories, banners, and personalized feeds.
* **CartScreen.tsx**: Shopping cart interface where users review items before checkout.
* **CheckoutScreen.tsx**: Multi-step process for address selection, payment, and order confirmation.
* **CategoriesScreen.tsx**: Directory of all available shop and product categories.
* **ShopProductsScreen.tsx / ShopProfileScreen.tsx**: Screens displaying a specific shop's details, catalog, and reviews.
* **ProductDetailScreen.tsx**: Detailed view of a single product (images, description, reviews, add to cart).
* **SearchScreen.tsx**: Search interface for finding shops and products.
* **OrderTrackingScreen.tsx**: Real-time status and tracking for an active order.
* **BuyerOrdersScreen.tsx**: History of past and current orders for the buyer.
* **WishlistScreen.tsx / SavedShopsScreen.tsx**: Lists of user's favorited products and shops.
* **PaymentScreen.tsx**: Interface for handling payment gateways and methods.
* **ProfileScreen.tsx**: Buyer's account settings and main profile hub.
* **ReferralScreen.tsx**: UI for sharing referral codes and tracking rewards.
* **ReviewScreen.tsx**: Interface for submitting feedback on products/shops.
* **WalletScreen.tsx**: Displays user's in-app wallet balance and transaction history.
* **TrendingAllScreen.tsx / NewArrivalsScreen.tsx**: Dedicated feeds for popular and new items.
* **HelpScreen.tsx / TermsAndConditionsScreen.tsx / TermsOfServiceScreen.tsx / PrivacyPolicyScreen.tsx / RefundPolicyScreen.tsx**: Legal and support information screens.

## 🏪 Seller Screens (`apps/mobile/src/screens/seller/`)
* **SellerDashboard.tsx**: Main hub for sellers showing quick stats, pending orders, and alerts.
* **AddProductScreen.tsx / ManageProductsScreen.tsx**: Interfaces for creating, editing, and deleting inventory items.
* **AddServicesScreen.tsx**: Specialized interface for hotels/cafes to add service offerings.
* **OrderManagementScreen.tsx**: Interface for sellers to accept, prepare, and dispatch orders.
* **ManageFlashSalesScreen.tsx**: UI for configuring time-limited discounts and promotions.
* **PromoteProductScreen.tsx / NotificationCampaignScreen.tsx / SellerAdWalletScreen.tsx**: Marketing tools for sellers to boost visibility and reach buyers.
* **EarningsBreakdownScreen.tsx**: Detailed analytics of revenue, commissions, and payouts.
* **ReviewsAnalyticsScreen.tsx / SellerAudienceScreen.tsx**: Insights into customer feedback and demographics.
* **ShopCustomizationScreen.tsx / StoreSettingsScreen.tsx**: Interfaces to update shop appearance, hours, and basic settings.
* **SellerProfileScreen.tsx**: Account management for the seller.
* **SubscriptionScreen.tsx**: Management of seller subscription plans and billing.
* **SellerHelpSupportScreen.tsx / SellerPrivacyPolicyScreen.tsx / SellerTermsConditionsScreen.tsx**: Legal and support screens for sellers.

## 🔐 Auth & System Screens
* **Auth (`apps/mobile/src/screens/auth/`)**:
  * **LoginScreen.tsx**: User login.
  * **RegisterScreen.tsx**: Account creation.
  * **OTPVerificationScreen.tsx**: Phone/Email verification interface.
  * **RoleSelectionScreen.tsx**: Screen to choose between Buyer or Seller modes.
* **Admin (`apps/mobile/src/screens/admin/`)**:
  * **AdminDashboardScreen.tsx**: High-level overview for platform administrators.
* **Shared (`apps/mobile/src/screens/shared/`)**:
  * **OrderDetailScreen.tsx**: Detailed view of a specific order (used by both buyers and sellers).
* **System (`apps/mobile/src/screens/system/`)**:
  * **ForceUpdateScreen.tsx**: Blocks access and prompts the user to download a mandatory app update.

## 🧭 Navigators (`apps/mobile/src/navigation/`)
* **RootNavigator.tsx**: Top-level navigator managing the switch between Auth and Main app flows.
* **AuthNavigator.tsx**: Manages the authentication flow screens.
* **BuyerTabNavigator.tsx / SellerTabNavigator.tsx / AdminTabNavigator.tsx**: Bottom tab navigation layouts for respective roles.
