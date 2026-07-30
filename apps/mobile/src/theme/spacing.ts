export const Spacing = {
  /** 4px */ xs: 4,
  /** 8px */ sm: 8,
  /** 12px */ md: 12,
  /** 16px */ lg: 16,
  /** 20px */ xl: 20,
  /** 24px */ xxl: 24,
  /** 32px */ xxxl: 32,
  /** 40px */ huge: 40,
  /** 48px */ massive: 48,
  /** compatibility */ xxs: 4,

  // Screen padding
  screenHorizontal: 16,
  screenVertical: 12,

  // Component spacing
  cardPadding: 16,
  sectionGap: 24,
  itemGap: 12,
  inlineGap: 8,

  // Border radius
  radius: {
    /** 4px */ xs: 4,
    /** 8px */  sm: 8,
    /** 12px */ md: 12,
    /** 16px */ lg: 16,
    /** 24px */ xl: 24,
    /** 32px */ xxl: 32,
    /** 9999px */ full: 9999,
  },

  // Special
  tabBarHeight: 68,
  headerHeight: 56,
  searchBarHeight: 48,
  buttonHeight: 48,
  buttonHeightSmall: 36,
  inputHeight: 48,
  avatarSize: {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  },
} as const;

// Compatibility alias for modules that import lowercase spacing tokens.
export const spacing = Spacing;
