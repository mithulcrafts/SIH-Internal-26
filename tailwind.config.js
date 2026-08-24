/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'campus-red': {
          DEFAULT: '#8C3A36',
          dark: '#6F2A27',
          tint: '#F7ECEB',
        },
        'iiitm-blue': {
          DEFAULT: '#1E4E8C',
          deep: '#0A1C30',
          tint: '#EAF0F7',
        },
        'campus-gold': {
          DEFAULT: '#D99B26',
          light: '#FFF2D6',
        },
        'campus-stone': {
          DEFAULT: '#FBF9F5',
          dark: '#081422',
          card: '#FFFFFF',
          border: '#E9D9D7',
          muted: '#7A8694',
        },
      },
    },
  },
  plugins: [],
}
