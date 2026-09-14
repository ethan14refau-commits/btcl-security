/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#374151',
          850: '#1a202c',
          950: '#111827',
        },
      },
    },
  },
  plugins: [],
};
