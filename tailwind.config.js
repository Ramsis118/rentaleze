/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rl: {
          // Baby blue spectrum
          blue:       '#6BB8D4',   // primary baby blue
          'blue-50':  '#F0F8FC',   // near-white tinted background
          'blue-100': '#D6EEF7',   // light blue for hover/surface
          'blue-200': '#AEDCEE',   // card borders, dividers
          'blue-300': '#7DC8E3',   // mid blue
          'blue-400': '#6BB8D4',   // primary
          'blue-500': '#4EA3C0',   // darker hover state
          'blue-600': '#3886A0',   // dark pressed / link
          // Dark grays
          'dark':     '#1E2B37',   // near-black — nav bg, headings
          'dark-2':   '#2D3D4F',   // secondary dark
          'dark-3':   '#435363',   // body text
          'gray':     '#6B7A8A',   // muted / secondary text
          'gray-2':   '#9AAAB8',   // placeholder, caption
          'gray-3':   '#C8D4DC',   // borders, dividers
          'gray-4':   '#E8F0F5',   // input backgrounds, surface
          // White
          'white':    '#FFFFFF',
          'off-white':'#F7FBFD',   // page bg
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':  '0 2px 12px 0 rgba(30,43,55,0.08)',
        'card-hover': '0 6px 24px 0 rgba(30,43,55,0.14)',
        'nav':   '0 1px 0 0 rgba(30,43,55,0.08)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
}
