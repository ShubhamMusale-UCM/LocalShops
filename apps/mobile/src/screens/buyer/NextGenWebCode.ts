export const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/lucide-react@0.292.0/dist/umd/lucide-react.min.js"></script>
  <style>
    /* Prevent webview bounce/scrolling issues */
    html, body, #root { width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; background: #02040a; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useRef } = React;
    const { Check, Sun, Moon, Sparkles, Bell, Sliders, ShoppingBag, Search, Mic, Box, Grid, Headphones, Watch, Heart, Plus, ShieldCheck, ChevronRight, Truck, Settings, Package, Hand, X, Home, Compass, User, ArrowLeft, Share2, Star, ArrowRight, Maximize, Camera, Tag, CreditCard, CheckCircle, Scan, RefreshCw, Zap } = window.lucideReact;

import {
  Check, Sun, Moon, Sparkles, Bell, Sliders, ShoppingBag, Search, Mic, Box,
  Grid, Headphones, Watch, Heart, Plus, ShieldCheck, ChevronRight, Truck,
  Settings, Package, Hand, X, Home, Compass, User, ArrowLeft, Share2,
  Star, ArrowRight, Maximize, Camera, Tag, CreditCard, CheckCircle,
  Scan, RefreshCw, Zap
} from 'lucide-react';

type Category = 'all' | 'audio' | 'wearable' | 'design';

interface Product {
  id: string;
  title: string;
  price: number;
  category: Category;
  image: string;
  desc: string;
  badge?: string;
  badgeColor?: string;
  subtitle?: string;
}

interface CartItem extends Product {
  qty: number;
}

const PRODUCTS: Record<string, Product> = {
  'hero-vision': {
    id: 'hero-vision',
    title: 'Vision Pro Studio',
    price: 3499,
    category: 'design',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    desc: 'Revolutionary spatial headset blending digital media with physical environments. Dual micro-OLED 4K displays per eye and spatial audio engines.'
  },
  'sony-xm5': {
    id: 'sony-xm5',
    title: 'Sony WH-1000XM5',
    price: 399,
    category: 'audio',
    subtitle: 'Noise Cancelling',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    desc: 'Industry-leading noise canceling with two processors and 8 microphones for unparalleled acoustic depth.',
    badge: '360 Audio',
    badgeColor: 'text-cyan-400'
  },
  'apple-watch': {
    id: 'apple-watch',
    title: 'Watch Ultra 2',
    price: 799,
    category: 'wearable',
    subtitle: 'Titanium Chassis',
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    desc: 'Rugged titanium Apple Watch engineered for endurance sports with up to 72 hours battery life.',
    badge: 'Wearable',
    badgeColor: 'text-purple-400'
  },
  'te-op1': {
    id: 'te-op1',
    title: 'OP-1 Field Synthesizer',
    price: 1999,
    category: 'design',
    subtitle: 'Portable Acoustic Engine',
    image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    desc: 'Ultra-portable synth, sampler and controller in aluminum body with dynamic color screen.',
    badge: 'Studio Rig',
    badgeColor: 'text-emerald-400'
  },
  'nothing-ear': {
    id: 'nothing-ear',
    title: 'Nothing Ear (2)',
    price: 149,
    category: 'audio',
    subtitle: 'Transparent Shell',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    desc: 'Transparent wireless earbuds with custom 11.6mm drivers and active noise cancellation.',
    badge: 'Acoustics',
    badgeColor: 'text-cyan-400'
  },
  'leica-q3': {
    id: 'leica-q3',
    title: 'Leica Q3 Camera',
    price: 5995,
    category: 'design',
    subtitle: 'Summilux 28mm f/1.7',
    image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    desc: 'Full-frame compact camera with Summilux 28mm f/1.7 ASPH prime lens and 60MP sensor.',
    badge: 'Optics',
    badgeColor: 'text-amber-400'
  },
  'spatial-wand': {
    id: 'spatial-wand',
    title: 'Spatial Wand',
    price: 299,
    category: 'wearable',
    subtitle: 'Zero Latency',
    image: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    desc: 'Zero-latency haptic controller designed for high-precision spatial modeling.',
    badge: 'Haptic Tech',
    badgeColor: 'text-purple-400'
  }
};

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{
    __html: \`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800&display=swap');

    :root {
      --spring-easing: cubic-bezier(0.175, 0.885, 0.32, 1.275);
      --hinge-easing: cubic-bezier(0.32, 0.72, 0, 1);
    }

    html, body, #root {
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      background-color: #02040a;
      font-family: 'Inter', sans-serif;
      overflow: hidden;
    }

    * {
      -webkit-tap-highlight-color: transparent;
      box-sizing: border-box;
      user-select: none;
    }

    .device-container {
      width: 100vw;
      max-width: 414px; 
      height: 100vh;
      max-height: 896px;
      background-color: #050814;
      position: relative;
      overflow: hidden;
      margin: 0 auto;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 30px 80px -10px rgba(0, 0, 0, 0.95);
    }

    @media (min-height: 850px) and (min-width: 440px) {
      body {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .device-container {
        height: 850px;
        border-radius: 44px;
        border: 8px solid #111526;
      }
    }

    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    /* Glassmorphism Surface Tokens */
    .glass-panel {
      background: rgba(255, 255, 255, 0.035);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.12), 0 8px 32px rgba(0,0,0,0.4);
    }

    .glass-card {
      background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.015) 100%);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.15), 0 16px 36px rgba(0,0,0,0.5);
    }

    .glass-button {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    /* 3D Perspective Stage */
    .perspective-stage {
      perspective: 1200px;
      transform-style: preserve-3d;
      width: 100%;
      height: 100%;
      position: relative;
    }

    /* Spatial Morph Tab Views */
    .tab-view {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      padding-top: 104px;
      padding-bottom: 110px;
      overflow-y: auto;
      transform-origin: center center;
      will-change: transform, opacity, filter;
      transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), 
                  opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
                  filter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .tab-view.hidden-view {
      display: none !important;
      opacity: 0;
    }

    .spatial-active {
      transform: scale(1) translateZ(0) rotateX(0deg);
      opacity: 1;
      filter: blur(0px);
      pointer-events: auto;
    }

    .spatial-out-next {
      transform: scale(0.85) translateY(20px) translateZ(-100px) rotateX(4deg);
      opacity: 0;
      filter: blur(12px);
      pointer-events: none;
    }

    .spatial-start-next {
      transform: scale(1.15) translateY(-20px) translateZ(100px) rotateX(-4deg);
      opacity: 0;
      filter: blur(12px);
      pointer-events: none;
    }

    .spatial-out-prev {
      transform: scale(1.15) translateY(-20px) translateZ(100px) rotateX(-4deg);
      opacity: 0;
      filter: blur(12px);
      pointer-events: none;
    }

    .spatial-start-prev {
      transform: scale(0.85) translateY(20px) translateZ(-100px) rotateX(4deg);
      opacity: 0;
      filter: blur(12px);
      pointer-events: none;
    }

    /* Magnetic Elevation Card */
    .magnetic-card {
      transform-style: preserve-3d;
      transition: transform 0.4s var(--spring-easing), box-shadow 0.4s ease, border-color 0.4s ease;
      will-change: transform;
    }

    .magnetic-card .layer-depth {
      transition: transform 0.4s var(--spring-easing);
      transform: translateZ(0px);
    }

    .magnetic-card:hover, .magnetic-card:active {
      transform: translateY(-4px) rotateX(4deg) scale(1.02);
      box-shadow: 0 16px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(6, 182, 212, 0.25);
      border-color: rgba(6, 182, 212, 0.4);
    }

    .magnetic-card:hover .layer-depth, .magnetic-card:active .layer-depth {
      transform: translateZ(16px);
    }

    .glare-wrapper {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      overflow: hidden;
      pointer-events: none;
      z-index: 10;
    }
    .glare {
      position: absolute;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 60%);
      transform: translate(-50%, -50%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .magnetic-card:hover .glare {
      opacity: 1;
    }

    .tactile {
      transition: transform 0.25s var(--spring-easing), filter 0.2s ease;
    }
    .tactile:active {
      transform: scale(0.92) !important;
      filter: brightness(0.9);
    }

    .tactile-soft {
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .tactile-soft:active {
      transform: scale(0.96);
    }

    .ambient-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      opacity: 0.35;
      pointer-events: none;
    }

    @keyframes wavePulse {
      0%, 100% { height: 8px; opacity: 0.5; }
      50% { height: 28px; opacity: 1; }
    }
    .wave-bar {
      animation: wavePulse 1.2s infinite ease-in-out;
    }

    @keyframes biometricRing {
      0% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.7); }
      70% { transform: scale(1.1); opacity: 0.3; box-shadow: 0 0 0 20px rgba(6, 182, 212, 0); }
      100% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
    }
    .pulse-biometric {
      animation: biometricRing 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Modal Overlay & Card Animations */
    .modal-overlay {
      transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.5s ease;
      will-change: opacity, backdrop-filter;
      opacity: 0;
      pointer-events: none;
    }

    /* Ultra-Smooth Apple-Style Sheet Presentation Depth Effect */
    .cart-drawer-backdrop {
      transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.5s ease;
      will-change: opacity, backdrop-filter;
    }

    .cart-drawer-sheet {
      transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
      will-change: transform, opacity;
      transform: translateY(100%);
    }

    .cart-drawer-backdrop.active .cart-drawer-sheet {
      transform: translateY(0%) !important;
    }

    /* Main Stage Scale Down when Cart is active */
    .perspective-stage {
      perspective: 1200px;
      transform-style: preserve-3d;
      width: 100%;
      height: 100%;
      position: relative;
      transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), filter 0.5s ease, border-radius 0.5s ease;
      will-change: transform, filter;
    }

    .perspective-stage.stage-pushed-back {
      transform: scale(0.94) translateY(-12px) translateZ(-40px) !important;
      filter: brightness(0.65) blur(1px) !important;
      border-radius: 36px !important;
      pointer-events: none !important;
    }

    .modal-card-scale {
      transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
      transform-origin: center center;
      will-change: transform, opacity;
      transform: scale(0.88) translateY(30px) translateZ(-40px);
      opacity: 0;
    }

    .modal-overlay.active {
      opacity: 1 !important;
      pointer-events: auto !important;
    }

    .modal-overlay.active .modal-card-scale {
      transform: scale(1) translateY(0) translateZ(0) !important;
      opacity: 1 !important;
    }

    .modal-overlay.inactive .modal-card-scale {
      transform: scale(0.88) translateY(30px) translateZ(-40px) !important;
      opacity: 0 !important;
    }

    /* Premium iOS/VisionOS Light Glass Theme Architecture */
    .light-theme {
      background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%) !important;
      color: #0f172a !important;
    }

    /* Ambient Glow Adjustments for Light Theme */
    .light-theme .ambient-orb {
      opacity: 0.28 !important;
      filter: blur(90px) !important;
    }

    /* Refined Light Glass Panels & Cards */
    .light-theme .glass-panel {
      background: rgba(255, 255, 255, 0.65) !important;
      backdrop-filter: blur(28px) saturate(190%) !important;
      -webkit-backdrop-filter: blur(28px) saturate(190%) !important;
      border: 1px solid rgba(255, 255, 255, 0.85) !important;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9) !important;
    }

    .light-theme .glass-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.82) 0%, rgba(248, 250, 252, 0.58) 100%) !important;
      backdrop-filter: blur(32px) saturate(200%) !important;
      -webkit-backdrop-filter: blur(32px) saturate(200%) !important;
      border: 1px solid rgba(255, 255, 255, 0.95) !important;
      box-shadow: 0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03), inset 0 1px 1px 0 rgba(255, 255, 255, 1) !important;
    }

    .light-theme .glass-button {
      background: rgba(255, 255, 255, 0.75) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      border: 1px solid rgba(255, 255, 255, 0.9) !important;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05) !important;
    }

    /* High-Contrast Typography Hierarchy in Light Mode */
    .light-theme h1, .light-theme h2, .light-theme h3, .light-theme h4 {
      color: #0f172a !important;
    }

    /* Scoped text colors so dark cards / primary buttons preserve crisp white text */
    .light-theme .text-white:not(button):not(button *):not(.bg-gradient-to-r *):not(.bg-blue-600 *):not(.bg-slate-900 *):not(.bg-black *) {
      color: #0f172a !important;
    }

    .light-theme .text-white\/80 { color: #334155 !important; }
    .light-theme .text-white\/70 { color: #475569 !important; }
    .light-theme .text-white\/60 { color: #64748b !important; }
    .light-theme .text-white\/50 { color: #64748b !important; }
    .light-theme .text-white\/40 { color: #94a3b8 !important; }
    .light-theme .text-white\/30 { color: #cbd5e1 !important; }

    /* High-contrast Jewel Tone Accents for Light Mode */
    .light-theme .text-cyan-400 { color: #0284c7 !important; } /* Sky 600 */
    .light-theme .text-cyan-400\/90 { color: #0369a1 !important; }
    .light-theme .text-purple-400 { color: #7c3aed !important; } /* Violet 600 */
    .light-theme .text-emerald-400 { color: #059669 !important; } /* Emerald 600 */
    .light-theme .text-amber-400 { color: #d97706 !important; } /* Amber 600 */

    /* Invert White Secondary Buttons in Light Mode to Sleek Dark Obsidian CTAs */
    .light-theme .bg-white {
      background-color: #0f172a !important;
      color: #ffffff !important;
      box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.25) !important;
    }
    .light-theme .bg-white .text-black,
    .light-theme .bg-white span,
    .light-theme .bg-white svg {
      color: #ffffff !important;
    }

    /* Solid Dark Button/Overlay backgrounds for Light Mode */
    .light-theme .bg-black\/30,
    .light-theme .bg-black\/40,
    .light-theme .bg-black\/60 {
      background-color: rgba(241, 245, 249, 0.6) !important;
    }

    .light-theme .bg-black\/80,
    .light-theme .bg-black\/85,
    .light-theme .bg-black\/90 {
      background-color: rgba(255, 255, 255, 0.92) !important;
    }

    /* Modals & Backdrops in Light Theme */
    .light-theme .modal-overlay,
    .light-theme .cart-drawer-backdrop {
      background-color: rgba(15, 23, 42, 0.25) !important;
      backdrop-filter: blur(20px) !important;
    }

    .light-theme .cart-drawer-sheet,
    .light-theme .modal-card-scale {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.92) 100%) !important;
      border-top: 1px solid rgba(255, 255, 255, 1) !important;
      box-shadow: 0 -20px 50px rgba(15, 23, 42, 0.15) !important;
    }

    /* Light Theme Input Bar Fix */
    .light-theme input {
      color: #0f172a !important;
    }
    .light-theme input::placeholder {
      color: #94a3b8 !important;
    }

    /* Floating Navigation in Light Theme */
    .light-theme nav.glass-card {
      background: rgba(255, 255, 255, 0.82) !important;
      backdrop-filter: blur(36px) saturate(200%) !important;
      border: 1px solid rgba(255, 255, 255, 0.95) !important;
      box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.12), inset 0 1px 1px rgba(255, 255, 255, 1) !important;
    }

    .light-theme nav .text-white\/40 {
      color: #64748b !important;
    }

    .light-theme nav .text-white {
      color: #2563eb !important;
    }
  \` }} />
);

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [tabClasses, setTabClasses] = useState<string[]>([
    'spatial-active', 'hidden-view', 'hidden-view', 'hidden-view', 'hidden-view', 'hidden-view', 'hidden-view'
  ]);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  // Modal active states matching HTML exact class-driven animations
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [arModalState, setArModalState] = useState<'inactive' | 'active'>('inactive');
  const [notifModalState, setNotifModalState] = useState<'inactive' | 'active'>('inactive');
  const [aiModalState, setAiModalState] = useState<'inactive' | 'active'>('inactive');
  const [checkoutModalState, setCheckoutModalState] = useState<'inactive' | 'active'>('inactive');
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [currentDetailProduct, setCurrentDetailProduct] = useState<Product | null>(null);
  const [aiResponse, setAiResponse] = useState('"Listening... Ask me to configure your spatial audio or track your order."');
  const [biometricStatus, setBiometricStatus] = useState<'idle' | 'success'>('idle');
  const [studioFinish, setStudioFinish] = useState('Space Black');

  // Spring pill indicator position tracking
  const [indicatorLeft, setIndicatorLeft] = useState(8);
  const navBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [toast, setToast] = useState({ visible: false, title: '', message: '' });
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (title: string, message: string) => {
    setToast({ visible: true, title, message });
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2500);
  };

  const switchTab = (nextTab: number) => {
    if (nextTab === currentTab) return;
    const isNext = nextTab > currentTab;
    const prev = currentTab;

    // Phase 1: Begin outward spatial transform for current, and prepare next view
    setTabClasses(prevClasses => {
      const updated = [...prevClasses];
      updated[prev] = isNext ? 'spatial-out-next' : 'spatial-out-prev';
      updated[nextTab] = isNext ? 'spatial-start-next' : 'spatial-start-prev';
      return updated;
    });

    // Phase 2: Reflow step to animate next tab into active state
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTabClasses(prevClasses => {
          const updated = [...prevClasses];
          updated[nextTab] = 'spatial-active';
          return updated;
        });
      });
    });

    // Phase 3: Hide previous view after 750ms CSS transition finishes
    setTimeout(() => {
      setTabClasses(prevClasses => {
        const updated = [...prevClasses];
        if (updated[prev] === (isNext ? 'spatial-out-next' : 'spatial-out-prev')) {
          updated[prev] = 'hidden-view';
        }
        return updated;
      });
    }, 750);

    setCurrentTab(nextTab);
  };

  useEffect(() => {
    const navIndex = currentTab > 5 ? 5 : currentTab;
    const btn = navBtnRefs.current[navIndex];
    if (btn) {
      setIndicatorLeft(btn.offsetLeft);
    }
  }, [currentTab]);

  const toggleTheme = () => {
    setTheme(prev => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      showToast(
        nextTheme === 'light' ? 'Light Mode Activated' : 'Dark Mode Activated',
        nextTheme === 'light' ? 'Pristine frosted light glass theme applied.' : 'Deep OLED glassmorphism theme applied.'
      );
      return nextTheme;
    });
  };

  const addToCart = (productId: string) => {
    const product = PRODUCTS[productId];
    if (!product) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing) {
        return prev.map(item => item.id === productId ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    showToast('Added to Cart', \`\${product.title} added to your bag.\`);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => item.id === productId ? { ...item, qty: item.qty + delta } : item).filter(item => item.qty > 0);
    });
  };

  const toggleFavorite = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const newFavs = new Set(prev);
      if (newFavs.has(productId)) {
        newFavs.delete(productId);
        showToast('Removed', 'Removed from saved items.');
      } else {
        newFavs.add(productId);
        showToast('Saved', 'Saved to your wishlist.');
      }
      return newFavs;
    });
  };

  const openDetail = (productId: string) => {
    const product = PRODUCTS[productId];
    if (product) {
      setCurrentDetailProduct(product);
      setIsDetailOpen(true);
    }
  };

  const processApplePay = () => {
    setBiometricStatus('success');
    setTimeout(() => {
      setCheckoutModalState('inactive');
      setCart([]);
      setBiometricStatus('idle');
      showToast('Order Placed!', 'Spatial dispatch confirmed.');
      switchTab(3);
    }, 1200);
  };

  const cartTotalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const filteredProducts = Object.values(PRODUCTS).filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const tabTitles = ["Alexandra S.", "Explore", "Spatial Studio", "Deliveries", "Wishlist", "VIP Profile", "Settings"];

  return (
    <>
      <GlobalStyles />
      <div className={\`device-container text-white \${theme === 'light' ? 'light-theme' : ''}\`} id="app-root">

        {/* Ambient Glowing Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="ambient-orb w-80 h-80 bg-blue-600 top-[-5%] left-[-10%]" id="orb1" />
          <div className="ambient-orb w-72 h-72 bg-cyan-500 top-[35%] right-[-15%]" id="orb2" />
          <div className="ambient-orb w-80 h-80 bg-violet-600 bottom-[-10%] left-[10%]" id="orb3" />
        </div>

        {/* Dynamic Glass Toast Notification */}
        <div className={\`absolute top-4 left-1/2 -translate-x-1/2 z-[150] pointer-events-none transition-all duration-300 w-[90%] max-w-[340px] \${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'}\`}>
          <div className="glass-panel rounded-full px-4 py-2.5 flex items-center gap-3 border border-white/20 shadow-2xl bg-black/85 backdrop-blur-2xl">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 text-cyan-400 flex items-center justify-center border border-cyan-400/40 text-xs">
              <Check className="w-4 h-4" strokeWidth={3} />
            </div>
            <div className="flex-1 pr-2">
              <p className="text-xs font-semibold text-white leading-tight">{toast.title}</p>
              <p className="text-[11px] text-white/60 leading-tight">{toast.message}</p>
            </div>
          </div>
        </div>

        {/* REDESIGNED FLOATING CONTROL PANEL / TOP NAVBAR */}
        <header className="px-4 pt-10 pb-2 flex justify-between items-center absolute top-0 left-0 w-full z-40 pointer-events-none">

          {/* Left Pod: User Profile & Context Capsule */}
          <div className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-2.5 border border-white/15 shadow-2xl pointer-events-auto bg-black/40 backdrop-blur-2xl tactile cursor-pointer group" onClick={() => switchTab(5)}>
            <div className="relative">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80" alt="Profile" className="w-8 h-8 rounded-full object-cover ring-2 ring-cyan-400/40 group-hover:ring-cyan-400 transition-all duration-300" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#050814] shadow-sm"></div>
            </div>
            <div className="flex flex-col pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-tight font-['Outfit',sans-serif]">{tabTitles[currentTab] || "Alexandra"}</span>
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"></span>
              </div>
              <span className="text-[9px] font-medium text-cyan-400/90 tracking-wider uppercase">Studio Live</span>
            </div>
          </div>

          {/* Right Pod: Integrated Floating Control Capsule */}
          <div className="glass-panel rounded-full px-1.5 py-1 flex items-center gap-1 border border-white/15 shadow-2xl pointer-events-auto bg-black/40 backdrop-blur-2xl">

            {/* Theme Switcher */}
            <button className="w-8 h-8 rounded-full flex items-center justify-center tactile text-white/80 hover:text-white transition-colors relative group" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'dark'
                ? <Sun className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-45 transition-transform" strokeWidth={2.5} />
                : <Moon className="w-3.5 h-3.5 text-violet-400 group-hover:-rotate-12 transition-transform" strokeWidth={2.5} />
              }
            </button>

            <div className="w-[1px] h-4 bg-white/10"></div>

            {/* Spatial AI Assist */}
            <button className="w-8 h-8 rounded-full flex items-center justify-center tactile text-cyan-400 hover:scale-110 transition-transform relative group" onClick={() => setAiModalState('active')} title="Spatial AI Assistant">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" strokeWidth={2.5} />
            </button>

            <div className="w-[1px] h-4 bg-white/10"></div>

            {/* Notifications Activity */}
            <button className="w-8 h-8 rounded-full flex items-center justify-center tactile text-white/80 hover:text-cyan-400 transition-colors relative" onClick={() => setNotifModalState('active')} title="Notifications">
              <Bell className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500"></span>
            </button>

            <div className="w-[1px] h-4 bg-white/10"></div>

            {/* Filter Catalog */}
            <button className="w-8 h-8 rounded-full flex items-center justify-center tactile text-white/80 hover:text-cyan-400 transition-colors" onClick={() => setFilterModalOpen(true)} title="Filter Products">
              <Sliders className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>

            <div className="w-[1px] h-4 bg-white/10"></div>

            {/* Spatial Bag Trigger Button */}
            <button className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex items-center justify-center tactile relative shadow-md" onClick={() => setIsCartOpen(true)} title="Shopping Bag">
              <ShoppingBag className="w-3.5 h-3.5" strokeWidth={2.5} />
              {cartTotalQty > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-[#050814]">
                  {cartTotalQty}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Perspective Stage (Shrinks back smoothly when cart opens) */}
        <div className={\`perspective-stage \${isCartOpen ? 'stage-pushed-back' : ''}\`}>

          {/* TAB 0: HOME FEED */}
          <div className={\`tab-view no-scrollbar px-6 flex flex-col gap-6 \${tabClasses[0]}\`}>
            <div className="relative tactile-soft group mt-2">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-500/20 to-purple-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative glass-panel rounded-2xl flex items-center px-4 py-3.5 border border-white/10 shadow-lg">
                <Search className="w-4 h-4 text-white/40 mr-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search gadgets, audio, spatial..."
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-white/40 flex-1 font-medium"
                />
                <button className="w-7 h-7 rounded-xl glass-button flex items-center justify-center text-white/60 hover:text-white transition-colors" onClick={() => setAiModalState('active')}>
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              </div>
            </div>

            <div className="relative w-full h-[260px] rounded-[32px] overflow-hidden glass-card tactile group cursor-pointer border border-white/15 shadow-2xl" onClick={() => openDetail('hero-vision')}>
              <div className="glare-wrapper"><div className="glare"></div></div>
              <img src={PRODUCTS['hero-vision'].image} alt="Vision Pro" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050814]/90 via-[#050814]/30 to-transparent"></div>

              <div className="absolute inset-0 p-6 flex flex-col justify-end z-20">
                <div className="glass-panel inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/20 w-max mb-2">
                  <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white">Spatial Flagship</span>
                </div>
                <h2 className="text-3xl font-bold font-['Outfit',sans-serif] leading-tight mb-1.5 text-white">Vision Pro Studio</h2>
                <p className="text-xs text-white/80 mb-4 line-clamp-2 font-light">Spatial computing transforms digital interactions into your physical space.</p>

                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-white font-['Outfit',sans-serif]">\$3,499</span>
                  <button className="bg-white text-black font-semibold text-xs px-5 py-2.5 rounded-full flex items-center gap-2 shadow-xl tactile-soft hover:bg-cyan-400 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setArModalState('active'); }}>
                    <Box className="w-4 h-4" />
                    <span>Try AR</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 py-1">
              {[
                { id: 'all', label: 'All Items', icon: Grid, color: 'text-white' },
                { id: 'audio', label: 'Acoustics', icon: Headphones, color: 'text-cyan-400' },
                { id: 'wearable', label: 'Wearables', icon: Watch, color: 'text-purple-400' },
                { id: 'design', label: 'Hardware', icon: Box, color: 'text-emerald-400' },
              ].map(cat => {
                const IconComponent = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={\`snap-start flex items-center gap-2 border px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 \${isActive ? 'bg-gradient-to-r from-blue-600 to-cyan-500 border-white/20 text-white shadow-lg' : 'glass-panel border-white/10 text-white/70 hover:text-white'}\`}
                    onClick={() => setActiveCategory(cat.id as Category)}
                  >
                    <IconComponent className={\`w-3.5 h-3.5 \${isActive ? 'text-white' : cat.color}\`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-xl font-bold font-['Outfit',sans-serif] tracking-tight text-white">Spotlight</h3>
                  <p className="text-[11px] text-white/50 mt-0.5">Featured gear of the week</p>
                </div>
              </div>

              <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 py-2 snap-x">
                {['te-op1', 'leica-q3'].map(id => {
                  const product = PRODUCTS[id];
                  if (!product) return null;
                  return (
                    <div key={id} className="snap-start min-w-[270px] glass-card rounded-[28px] p-4 flex flex-col border border-white/10 magnetic-card cursor-pointer relative group" onClick={() => openDetail(id)}>
                      <div className="glare-wrapper"><div className="glare"></div></div>
                      <div className="w-full h-36 rounded-2xl overflow-hidden relative bg-black/30 mb-3 layer-depth">
                        <img src={product.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={product.title} />
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full glass-panel text-[9px] font-bold uppercase tracking-wider text-emerald-400 border border-white/20 shadow-lg">{product.badge}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white line-clamp-1">{product.title}</h4>
                      <p className="text-xs text-white/50 mb-3">{product.subtitle}</p>
                      <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-auto">
                        <span className="text-sm font-bold font-['Outfit',sans-serif] text-white">\${product.price.toLocaleString()}</span>
                        <button className="px-4 py-1.5 rounded-full bg-white text-black font-bold text-xs tactile-soft hover:bg-cyan-400 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); addToCart(id); }}>
                          + Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-bold font-['Outfit',sans-serif] tracking-tight text-white">Popular Devices</h3>
              <div className="grid grid-cols-2 gap-4">
                {filteredProducts.filter(p => p.id !== 'hero-vision' && !['te-op1', 'leica-q3'].includes(p.id)).map(product => (
                  <div key={product.id} className="glass-card rounded-[28px] p-3.5 flex flex-col cursor-pointer group border border-white/10 relative shadow-lg magnetic-card" onClick={() => openDetail(product.id)}>
                    <div className="glare-wrapper"><div className="glare"></div></div>
                    <div className="w-full h-36 rounded-2xl overflow-hidden relative bg-black/30 mb-3 layer-depth">
                      <img src={product.image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <button className="absolute top-2 right-2 w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white/80 hover:text-red-400 transition-colors z-10" onClick={(e) => toggleFavorite(product.id, e)}>
                        <Heart className={\`w-3.5 h-3.5 \${favorites.has(product.id) ? 'text-red-500 fill-red-500' : ''}\`} />
                      </button>
                    </div>
                    {product.badge && <span className={\`text-[9px] font-bold uppercase tracking-wider mb-0.5 block \${product.badgeColor}\`}>{product.badge}</span>}
                    <h4 className="text-xs font-bold leading-tight text-white line-clamp-1 mb-1">{product.title}</h4>
                    <p className="text-[11px] text-white/50 mb-3 line-clamp-1">{product.subtitle}</p>
                    <div className="mt-auto flex justify-between items-center border-t border-white/10 pt-2.5">
                      <span className="text-sm font-bold text-white font-['Outfit',sans-serif]">\${product.price}</span>
                      <button className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center tactile-soft hover:bg-cyan-400 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); addToCart(product.id); }}>
                        <Plus className="w-4 h-4" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TAB 1: EXPLORE CATALOG */}
          <div className={\`tab-view no-scrollbar px-6 flex flex-col gap-5 \${tabClasses[1]}\`}>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold font-['Outfit',sans-serif] text-white">Explore Catalog</h2>
              <p className="text-xs text-white/50">Discover spatial hardware and acoustics.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4 rounded-2xl flex flex-col gap-2 tactile cursor-pointer border border-white/10" onClick={() => { setActiveCategory('audio'); switchTab(0); }}>
                <Headphones className="w-6 h-6 text-cyan-400" />
                <span className="text-xs font-bold">Acoustic Devices</span>
                <span className="text-[10px] text-white/40">12 Products</span>
              </div>
              <div className="glass-card p-4 rounded-2xl flex flex-col gap-2 tactile cursor-pointer border border-white/10" onClick={() => { setActiveCategory('wearable'); switchTab(0); }}>
                <Watch className="w-6 h-6 text-purple-400" />
                <span className="text-xs font-bold">Wearable Tech</span>
                <span className="text-[10px] text-white/40">8 Products</span>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-4 flex items-center justify-between border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600/20 text-cyan-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Apple Certified Spatial Refurb</p>
                  <p className="text-[10px] text-white/50">2-Year Spatial warranty included</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40" />
            </div>
          </div>

          {/* TAB 2: SPATIAL STUDIO */}
          <div className={\`tab-view no-scrollbar px-6 flex flex-col gap-5 \${tabClasses[2]}\`}>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold font-['Outfit',sans-serif] text-white">Spatial Studio</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold border border-cyan-500/30">3D Interactive</span>
              </div>
              <p className="text-xs text-white/50">Configure finishes, acoustic drivers, and spatial bands.</p>
            </div>
            <div className="glass-card rounded-[28px] p-5 flex flex-col items-center border border-white/15 relative overflow-hidden">
              <div className="w-full h-44 rounded-2xl overflow-hidden relative mb-4 bg-gradient-to-b from-black/40 to-black/10 flex items-center justify-center">
                <img src={PRODUCTS['sony-xm5'].image} className="w-36 h-36 object-cover rounded-xl shadow-2xl transition-all duration-500 scale-105" alt="product" />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full glass-panel text-[9px] font-bold text-cyan-400 border border-white/10">
                  {studioFinish} Finish
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                <span className="text-[11px] font-bold text-white/70">Select Anodized Finish</span>
                <div className="flex gap-3 justify-center py-1">
                  <button className={\`w-8 h-8 rounded-full bg-slate-900 border-2 tactile \${studioFinish === 'Space Black' ? 'border-cyan-400 shadow-lg' : 'border-white/20'}\`} onClick={() => { setStudioFinish('Space Black'); showToast('Finish Updated', 'Space Black selected.'); }}></button>
                  <button className={\`w-8 h-8 rounded-full bg-slate-300 border-2 tactile \${studioFinish === 'Silver Titanium' ? 'border-cyan-400 shadow-lg' : 'border-white/20'}\`} onClick={() => { setStudioFinish('Silver Titanium'); showToast('Finish Updated', 'Silver Titanium selected.'); }}></button>
                  <button className={\`w-8 h-8 rounded-full bg-amber-800 border-2 tactile \${studioFinish === 'Deep Bronze' ? 'border-cyan-400 shadow-lg' : 'border-white/20'}\`} onClick={() => { setStudioFinish('Deep Bronze'); showToast('Finish Updated', 'Deep Bronze selected.'); }}></button>
                  <button className={\`w-8 h-8 rounded-full bg-emerald-800 border-2 tactile \${studioFinish === 'Alpine Green' ? 'border-cyan-400 shadow-lg' : 'border-white/20'}\`} onClick={() => { setStudioFinish('Alpine Green'); showToast('Finish Updated', 'Alpine Green selected.'); }}></button>
                </div>
              </div>

              <div className="w-full flex justify-between items-center border-t border-white/10 pt-3 mt-3">
                <div>
                  <span className="text-[10px] text-white/50 block">Configured Price</span>
                  <span className="text-lg font-bold text-white font-['Outfit',sans-serif]">\$449</span>
                </div>
                <button className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-xs tactile shadow-lg" onClick={() => addToCart('sony-xm5')}>
                  Order Custom Build
                </button>
              </div>
            </div>
          </div>

          {/* TAB 3: LIVE DELIVERIES */}
          <div className={\`tab-view no-scrollbar px-6 flex flex-col gap-5 \${tabClasses[3]}\`}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold font-['Outfit',sans-serif] text-white">Live Deliveries</h2>
                <p className="text-xs text-white/50">Track active spatial shipments in real-time.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live Tracking
              </span>
            </div>
            <div className="glass-card rounded-[28px] p-5 border border-white/15 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-black/40 overflow-hidden border border-white/10">
                  <img src={PRODUCTS['hero-vision'].image} className="w-full h-full object-cover" alt="product" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white">Vision Pro Studio</h4>
                  <p className="text-[10px] text-white/50">Order #SP-89210 • Express Air</p>
                </div>
                <span className="text-xs font-bold text-cyan-400 font-['Outfit',sans-serif]">\$3,499</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] font-semibold text-white/70">
                  <span>Dispatched</span>
                  <span className="text-cyan-400">Out for Delivery</span>
                  <span className="text-white/30">Arrived</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 rounded-full w-[70%]"></div>
                </div>
              </div>

              <div className="p-3 rounded-xl glass-panel border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <div>
                    <p className="text-[11px] font-bold text-white">Arriving Today by 4:30 PM</p>
                    <p className="text-[9px] text-white/50">Driver: Marcus K. • Autonomous Drone</p>
                  </div>
                </div>
                <button className="px-3 py-1.5 rounded-lg glass-button text-[10px] font-bold text-white tactile" onClick={() => showToast('Driver Contacted', 'Opening encrypted audio channel...')}>
                  Call
                </button>
              </div>
            </div>
          </div>

          {/* TAB 4: SAVED WISHLIST */}
          <div className={\`tab-view no-scrollbar px-6 flex flex-col gap-5 \${tabClasses[4]}\`}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold font-['Outfit',sans-serif] text-white">Saved Wishlist</h2>
                <p className="text-xs text-white/50">Your saved hardware.</p>
              </div>
              <span className="px-3 py-1 rounded-full glass-panel text-xs text-cyan-400 border border-white/10">{favorites.size} Saved</span>
            </div>
            <div className="flex flex-col gap-3">
              {favorites.size === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 border border-white/10">
                  <Heart className="w-8 h-8 text-white/20" />
                  <p className="text-xs text-white/40">No favorite items saved yet.<br />Tap heart icon on cards to save.</p>
                </div>
              ) : (
                Array.from(favorites).map(id => {
                  const item = PRODUCTS[id];
                  if (!item) return null;
                  return (
                    <div key={id} className="glass-card rounded-2xl p-2.5 flex items-center gap-3 border border-white/10">
                      <img src={item.image} className="w-12 h-12 rounded-xl object-cover" alt={item.title} />
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-white">{item.title}</h4>
                        <span className="text-xs font-['Outfit',sans-serif] text-cyan-400 font-semibold">\${item.price}</span>
                      </div>
                      <button className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs tactile-soft" onClick={() => addToCart(id)}>
                        Add
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* TAB 5: VIP PROFILE */}
          <div className={\`tab-view no-scrollbar px-6 flex flex-col gap-5 \${tabClasses[5]}\`}>
            <div className="glass-card rounded-[28px] p-5 flex items-center gap-4 border border-white/15">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80" className="w-14 h-14 rounded-2xl object-cover shadow-lg border border-white/20" alt="profile" />
              <div className="flex-1">
                <span className="px-2 py-0.5 rounded-full bg-blue-600/30 text-cyan-400 text-[9px] font-bold uppercase tracking-wider">VIP Spatial Member</span>
                <h3 className="text-base font-bold text-white mt-1">Alexandra Spencer</h3>
                <p className="text-[11px] text-white/50">alexandra.spencer@apple.com</p>
              </div>
              <button className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/80 tactile" onClick={() => switchTab(6)}>
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <div className="glass-card rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/5">
              <div className="p-3.5 flex items-center justify-between tactile cursor-pointer" onClick={() => switchTab(3)}>
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold">Active Orders & Drone Tracking</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">1 active</span>
              </div>
              <div className="p-3.5 flex items-center justify-between tactile cursor-pointer" onClick={() => switchTab(2)}>
                <div className="flex items-center gap-3">
                  <Box className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold">Spatial Studio Builds</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
              <div className="p-3.5 flex items-center justify-between tactile cursor-pointer" onClick={() => switchTab(6)}>
                <div className="flex items-center gap-3">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold">System Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </div>
          </div>

          {/* TAB 6: SYSTEM SETTINGS */}
          <div className={\`tab-view no-scrollbar px-6 flex flex-col gap-5 \${tabClasses[6]}\`}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold font-['Outfit',sans-serif] text-white">System Settings</h2>
                <p className="text-xs text-white/50">Configure spatial preferences.</p>
              </div>
              <button className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white/60 tactile" onClick={() => switchTab(5)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="glass-card rounded-[28px] p-5 flex flex-col gap-4 border border-white/15">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Headphones className="w-4 h-4 text-cyan-400" />
                  <div>
                    <p className="text-xs font-bold text-white">Lossless Spatial Audio</p>
                    <p className="text-[10px] text-white/50">24-bit / 192kHz Dolby Atmos</p>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full bg-cyan-500/30 p-0.5 cursor-pointer border border-cyan-500/40 flex items-center justify-end" onClick={() => showToast('Saved', 'Audio preference updated.')}>
                  <div className="w-5 h-5 rounded-full bg-cyan-400"></div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <div className="flex items-center gap-3">
                  <Hand className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-xs font-bold text-white">Haptic Feedback</p>
                    <p className="text-[10px] text-white/50">Tactile spring physical vibrations</p>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full bg-blue-600 p-0.5 cursor-pointer border border-blue-600 flex items-center justify-end" onClick={() => showToast('Saved', 'Haptics updated.')}>
                  <div className="w-5 h-5 rounded-full bg-white"></div>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-[24px] p-4 flex flex-col gap-2 border border-white/10">
              <h4 className="text-xs font-bold text-white">System Diagnostics</h4>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50">Spatial Engine Kernel</span>
                <span className="text-cyan-400 font-mono font-bold text-[11px]">v4.8.2-glass</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50">Render Latency</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">1.2 ms (60 FPS)</span>
              </div>
            </div>
          </div>
        </div>

        { }
        <div className="absolute bottom-5 left-0 w-full px-4 z-50 pointer-events-none">
          <nav className="glass-card rounded-[28px] h-[68px] flex items-center justify-between px-2 relative shadow-2xl border border-white/20 pointer-events-auto max-w-[380px] mx-auto">

            {/* Sliding dynamic spring pill indicator */}
            <div
              className="absolute h-[44px] rounded-[20px] bg-white/10 border border-white/15 z-0 transition-all duration-300"
              style={{
                width: '48px',
                transform: \`translateX(\${indicatorLeft - 8}px)\`,
                transitionTimingFunction: 'var(--spring-easing)'
              }}
            />

            <button
              ref={el => { navBtnRefs.current[0] = el; }}
              className={\`relative z-10 w-[48px] h-[44px] flex items-center justify-center rounded-[20px] tactile-soft \${currentTab === 0 ? 'text-white' : 'text-white/40'}\`}
              onClick={() => switchTab(0)}
            >
              <Home className="w-5 h-5" />
            </button>
            <button
              ref={el => { navBtnRefs.current[1] = el; }}
              className={\`relative z-10 w-[48px] h-[44px] flex items-center justify-center rounded-[20px] tactile-soft \${currentTab === 1 ? 'text-white' : 'text-white/40'}\`}
              onClick={() => switchTab(1)}
            >
              <Compass className="w-5 h-5" />
            </button>
            <button
              ref={el => { navBtnRefs.current[2] = el; }}
              className={\`relative z-10 w-[48px] h-[44px] flex items-center justify-center rounded-[20px] tactile-soft \${currentTab === 2 ? 'text-white' : 'text-white/40'}\`}
              onClick={() => switchTab(2)}
            >
              <Box className="w-5 h-5" />
            </button>

            <div className="relative z-20 -mt-6">
              <button className="w-[52px] h-[52px] rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg border-4 border-[#050814] tactile group relative" onClick={() => setIsCartOpen(true)}>
                <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2.5} />
                {cartTotalQty > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#050814]">
                    {cartTotalQty}
                  </span>
                )}
              </button>
            </div>

            <button
              ref={el => { navBtnRefs.current[3] = el; }}
              className={\`relative z-10 w-[48px] h-[44px] flex items-center justify-center rounded-[20px] tactile-soft \${currentTab === 3 ? 'text-white' : 'text-white/40'}\`}
              onClick={() => switchTab(3)}
            >
              <Truck className="w-5 h-5" />
            </button>
            <button
              ref={el => { navBtnRefs.current[4] = el; }}
              className={\`relative z-10 w-[48px] h-[44px] flex items-center justify-center rounded-[20px] tactile-soft \${currentTab === 4 ? 'text-white' : 'text-white/40'}\`}
              onClick={() => switchTab(4)}
            >
              <Heart className="w-5 h-5" />
            </button>
            <button
              ref={el => { navBtnRefs.current[5] = el; }}
              className={\`relative z-10 w-[48px] h-[44px] flex items-center justify-center rounded-[20px] tactile-soft \${currentTab === 5 || currentTab === 6 ? 'text-white' : 'text-white/40'}\`}
              onClick={() => switchTab(5)}
            >
              <User className="w-5 h-5" />
            </button>
          </nav>
        </div>
        {/* SHOPPING CART BOTTOM SHEET DRAWER WITH SMOOTH IOS DEPTH ANIMATION */}
        <div
          className={\`cart-drawer-backdrop absolute inset-0 z-[110] bg-black/60 backdrop-blur-xl flex flex-col justify-end transition-opacity duration-500 \${isCartOpen ? 'opacity-100 pointer-events-auto active' : 'opacity-0 pointer-events-none'
            }\`}
          onClick={() => setIsCartOpen(false)}
        >
          <div
            className={\`cart-drawer-sheet glass-card rounded-t-[36px] p-6 pt-4 flex flex-col max-h-[85vh] w-full border-t border-white/20 shadow-2xl z-10\`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 rounded-full bg-white/25 mx-auto mb-4 cursor-pointer hover:bg-white/50 transition-colors" onClick={() => setIsCartOpen(false)}></div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-['Outfit',sans-serif] text-white">Your Spatial Bag</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-600/30 text-cyan-400 text-xs font-bold border border-cyan-400/20">{cartTotalQty}</span>
              </div>
              <button className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white/60 hover:text-white tactile" onClick={() => setIsCartOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 my-2 no-scrollbar">
              {cart.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                  <ShoppingBag className="w-8 h-8 text-white/20" />
                  <p className="text-xs text-white/40">Your bag is currently empty.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="glass-card p-3 rounded-2xl flex items-center gap-3 border border-white/10">
                    <img src={item.image} className="w-11 h-11 rounded-xl object-cover" alt={item.title} />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-white line-clamp-1">{item.title}</h4>
                      <span className="text-xs font-['Outfit',sans-serif] text-cyan-400 font-semibold">\${item.price.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 glass-panel rounded-full px-2.5 py-1 border border-white/10">
                      <button className="text-xs text-white/70 hover:text-white font-bold px-1 tactile" onClick={() => updateCartQty(item.id, -1)}>-</button>
                      <span className="text-xs font-bold text-white px-1">{item.qty}</span>
                      <button className="text-xs text-white/70 hover:text-white font-bold px-1 tactile" onClick={() => updateCartQty(item.id, 1)}>+</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-white/10 pt-3.5 mt-2 flex flex-col gap-2.5">
              <div className="flex justify-between items-center text-xs text-white">
                <span className="text-white/50">Subtotal</span>
                <span className="font-semibold font-['Outfit',sans-serif]">\${cartSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50">Express Spatial Shipping</span>
                <span className="text-emerald-400 font-semibold">FREE</span>
              </div>
              <div className="flex justify-between items-center text-base font-bold text-white pt-1">
                <span>Total</span>
                <span className="text-lg font-['Outfit',sans-serif] text-cyan-400">\${cartSubtotal.toLocaleString()}</span>
              </div>
              <button className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-xs shadow-xl tactile flex items-center justify-center gap-2 mt-1 hover:bg-cyan-400 hover:text-white transition-colors" onClick={() => { setIsCartOpen(false); if (cart.length > 0) setCheckoutModalState('active'); else showToast('Bag Empty', 'Add items before checking out.'); }}>
                <span>Checkout with Apple Pay</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        { }
        <div
          className={\`absolute inset-0 z-[100] transition-opacity duration-300 bg-[#050814]/95 backdrop-blur-3xl flex flex-col p-6 pt-12 overflow-y-auto \${isDetailOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }\`}
        >
          <div className="flex justify-between items-center mb-4">
            <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-white tactile" onClick={() => setIsDetailOpen(false)}>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-2">
              <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-cyan-400 tactile" onClick={() => { setIsDetailOpen(false); setArModalState('active'); }}>
                <Box className="w-4 h-4" />
              </button>
              <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-white tactile" onClick={() => showToast('Link Copied', 'Product link copied to clipboard.')}>
                <Share2 className="w-4 h-4" />
              </button>
              <button className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-white tactile" onClick={() => currentDetailProduct && toggleFavorite(currentDetailProduct.id)}>
                <Heart className={\`w-4 h-4 \${currentDetailProduct && favorites.has(currentDetailProduct.id) ? 'text-red-500 fill-red-500' : ''}\`} />
              </button>
            </div>
          </div>
          <div className="w-full h-[240px] rounded-[28px] overflow-hidden glass-card mb-5 border border-white/15">
            <img src={currentDetailProduct?.image} className="w-full h-full object-cover" alt="detail" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> In Stock • Express Air
            </span>
            <div className="flex items-center gap-1 text-xs text-amber-400 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>4.9</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold font-['Outfit',sans-serif] text-white mb-2">{currentDetailProduct?.title}</h1>
          <p className="text-xs text-white/60 leading-relaxed mb-auto font-light">{currentDetailProduct?.desc}</p>
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10 mt-6">
            <div className="flex flex-col">
              <span className="text-[9px] font-medium text-white/50 uppercase tracking-wider">Price</span>
              <span className="text-xl font-bold font-['Outfit',sans-serif] text-white">\${currentDetailProduct?.price.toLocaleString()}</span>
            </div>
            <button className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 font-bold text-xs text-white tactile flex items-center justify-center gap-2 shadow-lg" onClick={() => { if (currentDetailProduct) addToCart(currentDetailProduct.id); setIsDetailOpen(false); }}>
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Bag</span>
            </button>
          </div>
        </div>

        { }
        <div className={\`modal-overlay absolute inset-0 z-[130] bg-black/90 backdrop-blur-3xl flex flex-col justify-between p-6 \${arModalState}\`}>
          <div className="modal-card-scale w-full h-full flex flex-col justify-between relative">
            <div className="flex justify-between items-center relative z-20 pt-6">
              <div className="glass-panel px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">AR Room View • Live 60FPS</span>
              </div>
              <button className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-white tactile" onClick={() => setArModalState('inactive')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative flex-1 my-6 rounded-[32px] overflow-hidden border border-white/20 glass-card flex items-center justify-center bg-gradient-to-b from-slate-950/80 to-slate-900/90">
              <div className="relative z-10 flex flex-col items-center gap-3 cursor-grab">
                <img src={currentDetailProduct?.image || PRODUCTS['hero-vision'].image} className="w-48 h-48 object-cover rounded-2xl shadow-2xl transition-transform duration-300" alt="ar-view" />
                <span className="px-3 py-1 rounded-full glass-panel text-[10px] font-bold text-cyan-400 border border-white/20">Drag to rotate in 3D Space</span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-3 flex items-center justify-around border border-white/20 relative z-20">
              <button className="flex flex-col items-center gap-1 tactile" onClick={() => showToast('Lighting Mode', 'Set to Cyber Ambient')}>
                <Sun className="w-4 h-4 text-cyan-400" />
                <span className="text-[9px] text-white/60">Lighting</span>
              </button>
              <button className="flex flex-col items-center gap-1 tactile" onClick={() => showToast('Scale Reset', '1:1 True Spatial Scale')}>
                <Maximize className="w-4 h-4 text-purple-400" />
                <span className="text-[9px] text-white/60">1:1 Scale</span>
              </button>
              <button className="flex flex-col items-center gap-1 tactile" onClick={() => showToast('Snapshot Saved', 'Saved to Photo Library')}>
                <Camera className="w-4 h-4 text-emerald-400" />
                <span className="text-[9px] text-white/60">Capture</span>
              </button>
            </div>
          </div>
        </div>

        { }
        <div className={\`modal-overlay absolute inset-0 z-[125] bg-black/70 backdrop-blur-2xl flex flex-col justify-start p-4 pt-12 \${notifModalState}\`}>
          <div className="modal-card-scale glass-card rounded-[32px] p-5 w-full max-w-[380px] mx-auto border border-white/20 flex flex-col gap-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <h3 className="text-base font-bold font-['Outfit',sans-serif] text-white">Live Activity</h3>
              </div>
              <button className="w-7 h-7 rounded-full glass-panel flex items-center justify-center text-white/60" onClick={() => setNotifModalState('inactive')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="glass-panel p-3 rounded-xl border border-white/10 flex gap-3 items-start">
                <Truck className="w-5 h-5 text-cyan-400" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-white">Drone Shipment Dispatched</p>
                  <p className="text-[10px] text-white/50">Vision Pro Studio order #SP-89210 is en route.</p>
                  <span className="text-[9px] text-cyan-400 font-semibold mt-1 block">2 mins ago</span>
                </div>
              </div>
            </div>

            <button className="w-full py-2.5 rounded-xl glass-button text-xs font-bold text-white/70 hover:text-white tactile" onClick={() => { setNotifModalState('inactive'); showToast('Notifications Cleared', ''); }}>
              Mark All as Read
            </button>
          </div>
        </div>

        { }
        <div className={\`modal-overlay absolute inset-0 z-[130] bg-black/85 backdrop-blur-3xl flex flex-col justify-between p-6 \${aiModalState}\`}>
          <div className="modal-card-scale w-full h-full flex flex-col justify-between">
            <div className="flex justify-between items-center pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white font-['Outfit',sans-serif]">Spatial AI Assist</span>
              </div>
              <button className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white" onClick={() => setAiModalState('inactive')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-6 my-auto">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 via-cyan-400 to-purple-500 blur-xl opacity-60 animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full glass-card border border-white/30 flex items-center justify-center text-cyan-400 text-2xl">
                    <Mic className="w-7 h-7" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 h-8">
                <div className="w-1 bg-cyan-400 rounded-full wave-bar" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1 bg-blue-600 rounded-full wave-bar" style={{ animationDelay: '0.3s' }}></div>
                <div className="w-1 bg-purple-500 rounded-full wave-bar" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 bg-cyan-400 rounded-full wave-bar" style={{ animationDelay: '0.4s' }}></div>
                <div className="w-1 bg-blue-600 rounded-full wave-bar" style={{ animationDelay: '0.1s' }}></div>
              </div>

              <p className="text-sm font-bold text-white font-['Outfit',sans-serif] text-center max-w-[260px]">{aiResponse}</p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Suggested Prompts</span>
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                <button className="px-3 py-1.5 rounded-full glass-panel border border-white/10 text-xs text-white/80 whitespace-nowrap tactile" onClick={() => setAiResponse('"Recommending Sony WH-1000XM5 at \$399 with 360 Audio."')}>
                  🎧 Audio under \$400
                </button>
                <button className="px-3 py-1.5 rounded-full glass-panel border border-white/10 text-xs text-white/80 whitespace-nowrap tactile" onClick={() => setAiResponse('"Your drone shipment #SP-89210 is 1.2 miles away."')}>
                  📦 Track Drone
                </button>
              </div>
            </div>
          </div>
        </div>

        { }
        <div className={\`modal-overlay absolute inset-0 z-[135] bg-black/80 backdrop-blur-2xl flex flex-col justify-end \${checkoutModalState}\`}>
          <div className="modal-card-scale glass-card rounded-t-[36px] p-6 w-full border-t border-white/20 flex flex-col gap-4">
            <div className="w-12 h-1 rounded-full bg-white/20 mx-auto cursor-pointer" onClick={() => setCheckoutModalState('inactive')}></div>

            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Pay with Apple Pay</h3>
              <button className="w-7 h-7 rounded-full glass-panel flex items-center justify-center text-white/60" onClick={() => setCheckoutModalState('inactive')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="glass-panel p-3.5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs font-bold text-white">Apple Card (•••• 9841)</p>
                  <p className="text-[10px] text-white/50">3% Daily Cash Back Applied</p>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="flex flex-col items-center gap-3 py-4">
              {biometricStatus === 'idle' ? (
                <button className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center text-white pulse-biometric tactile shadow-lg" onClick={processApplePay}>
                  <Scan className="w-8 h-8" />
                </button>
              ) : (
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle className="w-6 h-6 animate-bounce" />
                  <span>Payment Confirmed via Face ID</span>
                </div>
              )}
              <span className="text-xs font-bold text-white/70">Double Click or Tap for Face ID</span>
            </div>
          </div>
        </div>

        { }
        <div className={\`absolute inset-0 z-[110] transition-opacity duration-300 bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 \${filterModalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}\`}>
          <div className={\`glass-card rounded-[32px] p-6 w-full max-w-[320px] border border-white/20 flex flex-col gap-4 transition-transform duration-300 \${filterModalOpen ? 'scale-100' : 'scale-95'}\`}>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold font-['Outfit',sans-serif] text-white">Filter Products</h3>
              <button className="w-7 h-7 rounded-full glass-panel flex items-center justify-center text-white/60" onClick={() => setFilterModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <button className="w-full py-3 rounded-xl bg-blue-600 font-bold text-xs text-white tactile shadow-lg" onClick={() => { setFilterModalOpen(false); showToast('Filters Applied', 'Catalog updated.'); }}>
              Apply Filters
            </button>
          </div>
        </div>

      </div>
    </>
  );
}

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`;
