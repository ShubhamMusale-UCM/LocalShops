import { create } from 'zustand';

interface SearchState {
  query: string;
  recentSearches: string[];
  selectedCategory: string | null;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    radius: number;
    sort: string;
    inStock?: boolean;
  };
  setQuery: (query: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setCategory: (category: string | null) => void;
  setFilters: (filters: Partial<SearchState['filters']>) => void;
  resetFilters: () => void;
  isSearchOverlayVisible: boolean;
  setSearchOverlayVisible: (visible: boolean) => void;
}

const DEFAULT_FILTERS = { radius: 50, sort: 'relevance' };

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  recentSearches: [],
  selectedCategory: null,
  filters: { ...DEFAULT_FILTERS },
  isSearchOverlayVisible: false,

  setSearchOverlayVisible: (visible) => set({ isSearchOverlayVisible: visible }),
  setQuery: (query) => set({ query }),

  addRecentSearch: (query) => {
    const recent = get().recentSearches.filter(s => s !== query);
    set({ recentSearches: [query, ...recent].slice(0, 10) });
  },

  clearRecentSearches: () => set({ recentSearches: [] }),

  setCategory: (selectedCategory) => set({ selectedCategory }),

  setFilters: (filters) => set({ filters: { ...get().filters, ...filters } }),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
}));
