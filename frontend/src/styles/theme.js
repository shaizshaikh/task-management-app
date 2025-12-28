/**
 * Dark Theme Design System
 * WCAG 2.2 Compliant Dark Theme with Azure Portal Inspiration
 */

export const darkTheme = {
  // Primary Colors (Modern Dark Theme)
  colors: {
    // Background Colors - Deep, rich blacks with subtle variations
    background: {
      primary: '#0a0e14',      // Main background (deeper, more modern)
      secondary: '#151a21',    // Card/panel background
      tertiary: '#1e2329',     // Elevated surfaces
      quaternary: '#282e38',   // Interactive elements
      overlay: 'rgba(0, 0, 0, 0.75)', // Modal overlay with blur
      hover: '#1a1f26',        // Hover states
    },
    
    // Foreground Colors (Crisp, high contrast)
    text: {
      primary: '#e6edf3',      // Primary text (bright, crisp)
      secondary: '#9198a1',    // Secondary text
      tertiary: '#6e7681',     // Muted text
      inverse: '#0a0e14',      // Text on light backgrounds
      accent: '#58a6ff',       // Accent text (links, highlights)
    },
    
    // Border Colors - Subtle but visible
    border: {
      primary: '#2d333b',      // Default borders
      secondary: '#21262d',    // Subtle borders
      focus: '#58a6ff',        // Focus indicators (bright blue)
      hover: '#3d444d',        // Hover states
      accent: '#388bfd',       // Accent borders
    },
    
    // Status Colors - Vibrant and modern
    status: {
      success: '#3fb950',      // Success states (brighter green)
      successLight: '#56d364', // Success hover
      successDark: '#2ea043',  // Success dark
      warning: '#d29922',      // Warning states
      warningLight: '#e3b341',  // Warning hover
      warningDark: '#9e6a03',  // Warning dark
      error: '#f85149',        // Error states (brighter red)
      errorLight: '#ff7b72',   // Error hover
      errorDark: '#da3633',    // Error dark
      info: '#388bfd',         // Info states (brighter blue)
      infoLight: '#58a6ff',    // Info hover
      infoDark: '#1f6feb',     // Info dark
    },
    
    // Role-Based Colors (Maintaining your existing logic)
    roles: {
      admin: '#f85149',        // Red for admin
      manager: '#fb8500',      // Orange for manager
      member: '#2ea043',       // Green for member
      viewer: '#58a6ff',       // Blue for viewer
    },
    
    // Interactive Elements - Modern, vibrant
    interactive: {
      primary: '#3fb950',      // Primary buttons (vibrant green)
      primaryHover: '#56d364', // Primary button hover
      primaryActive: '#2ea043', // Primary button active
      secondary: '#21262d',    // Secondary buttons
      secondaryHover: '#2d333b', // Secondary button hover
      secondaryActive: '#373e47', // Secondary button active
      danger: '#f85149',       // Danger buttons (vibrant red)
      dangerHover: '#ff7b72',  // Danger button hover
      dangerActive: '#da3633', // Danger button active
      accent: '#388bfd',       // Accent buttons (vibrant blue)
      accentHover: '#58a6ff',  // Accent button hover
      accentActive: '#1f6feb', // Accent button active
    },
    
    // Navigation Colors (Azure Portal Inspired)
    navigation: {
      background: '#161b22',   // Sidebar background
      item: 'transparent',     // Nav item background
      itemHover: '#21262d',    // Nav item hover
      itemActive: '#0d1117',   // Active nav item
      itemText: '#8b949e',     // Nav item text
      itemTextActive: '#f0f6fc', // Active nav item text
      border: '#30363d',       // Nav borders
    }
  },
  
  // Typography (Accessible Font Sizes)
  typography: {
    fontFamily: {
      primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px (WCAG minimum)
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    }
  },
  
  // Spacing System
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
  },
  
  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',  // 2px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    full: '9999px',
  },
  
  // Shadows (Subtle for Dark Theme)
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
  },
  
  // Z-Index Scale
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
  },
  
  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // Accessibility Features
  accessibility: {
    focusRing: '0 0 0 2px #58a6ff',
    focusRingOffset: '2px',
    minTouchTarget: '44px', // WCAG minimum touch target
    animationDuration: '0.15s',
    reducedMotion: 'prefers-reduced-motion: reduce',
  }
};

// CSS Custom Properties Generator
export const generateCSSVariables = (theme) => {
  const cssVars = {};
  
  const flattenObject = (obj, prefix = '') => {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const cssKey = prefix ? `${prefix}-${key}` : key;
      
      if (typeof value === 'object' && value !== null) {
        flattenObject(value, cssKey);
      } else {
        cssVars[`--${cssKey}`] = value;
      }
    });
  };
  
  flattenObject(theme);
  return cssVars;
};

export default darkTheme;