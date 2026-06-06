/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Playfair Display', 'serif']
      },
      colors: {
        navy: {
          50: '#f0f1f5',
          100: '#d8dae3',
          200: '#b1b5c7',
          300: '#8a90ab',
          400: '#636b8f',
          500: '#3c4673',
          600: '#2d3457',
          700: '#1e233b',
          800: '#141829',
          900: '#0a0d17',
          950: '#050710'
        },
        gold: {
          50: '#fdf9ed',
          100: '#f9f0d1',
          200: '#f3dda0',
          300: '#edc96f',
          400: '#e8b847',
          500: '#d9a01e',
          600: '#b87e16',
          700: '#935e15',
          800: '#7a4c18',
          900: '#673f1a'
        }
      }
    }
  },
  plugins: []
};
