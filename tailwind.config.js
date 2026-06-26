/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7fa',
          100: '#e4ebf2',
          200: '#c5d3e2',
          300: '#98b2cd',
          400: '#648bb4',
          500: '#476f98',
          600: '#36567a',
          700: '#2e4764',
          800: '#273c53',
          900: '#253447',
          950: '#18212f',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
