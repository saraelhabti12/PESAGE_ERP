/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pesage 2000 Logo Exact Color Palette
        'pesage-blue': '#001BB7',
        'pesage-blue-dark': '#001394',
        'pesage-blue-deep': '#000E6E',
        'pesage-blue-light': '#2B44FF',
        'pesage-blue-subtle': '#EEF2FF',

        'pesage-orange': '#FF5B36',
        'pesage-orange-dark': '#E03E19',
        'pesage-orange-light': '#FF8266',
        'pesage-orange-subtle': '#FFF1EE',

        // Primary palette aliases (mapping to Pesage corporate blue)
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#3B82F6',
          600: '#001BB7',
          700: '#001394',
          800: '#000E6E',
          900: '#000844',
          DEFAULT: '#001BB7',
        },

        // Nested utilities
        pesage: {
          blue: {
            DEFAULT: '#001BB7',
            dark: '#001394',
            deep: '#000E6E',
            light: '#2B44FF',
            subtle: '#EEF2FF',
          },
          orange: {
            DEFAULT: '#FF5B36',
            dark: '#E03E19',
            light: '#FF8266',
            subtle: '#FFF1EE',
          },
        },

        // Application Semantic Tokens
        app: {
          bg: 'var(--app-bg)',
          sidebar: 'var(--app-sidebar-bg)',
          topbar: 'var(--app-topbar-bg)',
          surface: 'var(--app-surface)',
          'surface-hover': 'var(--app-surface-hover)',
          'surface-subtle': 'var(--app-surface-subtle)',
          border: 'var(--app-border)',
          'border-strong': 'var(--app-border-strong)',
          text: 'var(--app-text)',
          'text-secondary': 'var(--app-text-secondary)',
          'text-muted': 'var(--app-text-muted)',
          primary: 'var(--app-primary)',
          'primary-hover': 'var(--app-primary-hover)',
          accent: 'var(--app-accent)',
          'accent-hover': 'var(--app-accent-hover)',
        },
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
}
