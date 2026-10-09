/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans Ethiopic', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        ethiopic: ['"Noto Sans Ethiopic"', 'Nyala', '"Abyssinica SIL"', 'sans-serif'],
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
