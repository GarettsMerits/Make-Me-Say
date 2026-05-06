/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Layered color system for consistent theming
        // Light mode: Layer 5 is pure white, each decrement darkens by 5%
        // Dark mode: Layer 1 is pure black, each increment brightens by 5%
        layer: {
          1: {
            light: '#CCCCCC', // 80% brightness
            dark: '#000000',  // 0% brightness (pure black)
          },
          2: {
            light: '#D9D9D9', // 85% brightness
            dark: '#0D0D0D',  // 5% brightness
          },
          3: {
            light: '#E6E6E6', // 90% brightness
            dark: '#1A1A1A',  // 10% brightness
          },
          4: {
            light: '#F2F2F2', // 95% brightness
            dark: '#262626',  // 15% brightness
          },
          5: {
            light: '#FFFFFF', // 100% brightness (pure white)
            dark: '#333333',  // 20% brightness
          },
        },
        
        // Override gray with pure grayscale colors (no blue undertones)
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
      },
    },
  },
  plugins: [],
}