/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Ethiopic"', 'Nyala', '"Abyssinica SIL"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        ethiopic: ['"Noto Sans Ethiopic"', 'Nyala', '"Abyssinica SIL"', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.875rem', { lineHeight: '1.35rem' }],   // ~15.75px (previously 12px)
        sm: ['1rem', { lineHeight: '1.5rem' }],         // ~18px (previously 14px)
        base: ['1.125rem', { lineHeight: '1.75rem' }],  // ~20.25px (previously 16px)
        lg: ['1.25rem', { lineHeight: '1.875rem' }],    // ~22.5px (previously 18px)
        xl: ['1.4rem', { lineHeight: '2rem' }],         // ~25.2px (previously 20px)
        '2xl': ['1.75rem', { lineHeight: '2.25rem' }],  // ~31.5px (previously 24px)
        '3xl': ['2.125rem', { lineHeight: '2.5rem' }],  // ~38.25px (previously 30px)
        '4xl': ['2.625rem', { lineHeight: '3rem' }],    // ~47.25px (previously 36px)
      },
      colors: {
        parchment: {
          50: '#fdfbf7',
          100: '#f9f6ef',
          200: '#f1ebd9',
          300: '#e5dcbe',
          400: '#d5c69e',
          500: '#c2ad7e',
          600: '#a69062',
          700: '#84704d',
          800: '#69583e',
          900: '#544633',
        },
        heritage: {
          blue: '#1e3a5f',
          gold: '#c29014',
          emerald: '#1e5f48',
          crimson: '#8b1e2f',
        }
      }
    },
  },
  plugins: [],
}

