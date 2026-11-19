/** @type {import('tailwindcss').Config} */
// Rentaleze brand v1.0 - electric blue + chrome silver.
// The rl-* names are kept so every existing class picks up the new brand;
// see src/styles/rentaleze-brand.css and the brand book for usage rules.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rl: {
          // Volt Blue spectrum (primary)
          blue:       '#1F5BFF',   // Volt Blue - primary buttons, links, active states
          'blue-50':  '#EEF3FF',   // tinted background
          'blue-100': '#DCE6FF',   // hover / surface / secondary button
          'blue-200': '#AFC6FF',   // borders on light, light text on dark
          'blue-300': '#5B8CFF',   // accent text on dark grounds (5.7:1 on navy)
          'blue-400': '#1F5BFF',   // primary
          'blue-500': '#1546D9',   // hover
          'blue-600': '#0F35A8',   // pressed / dark link / labels
          // Electric + chrome (signature)
          'electric': '#00C8FF',   // Electric Cyan - glow, accents on dark only
          'volt':     '#1F5BFF',
          'chrome':   '#C7CCD6',   // Chrome Silver - secondary brand color
          'platinum': '#E9ECF2',
          'steel':    '#8A93A6',
          'gunmetal': '#4A5368',
          // Darks
          'midnight': '#070D24',   // deepest ground - heroes, footer
          'dark':     '#0B1430',   // navy ink - headings, dark surfaces
          'dark-2':   '#121C44',   // raised dark surface
          'dark-3':   '#2B3550',   // body text
          'gray':     '#5B6478',   // muted / secondary text
          'gray-2':   '#8A93A6',   // placeholder, caption (icons, not body text)
          'gray-3':   '#C7CCD6',   // borders, dividers (chrome)
          'gray-4':   '#EEF0F4',   // input backgrounds, surface
          // White
          'white':    '#FFFFFF',
          'off-white':'#F5F7FA',   // page bg (mist)
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':  '0 1px 2px rgba(11,20,48,.06), 0 4px 14px -4px rgba(11,20,48,.10)',
        'card-hover': '0 10px 30px -8px rgba(11,20,48,.22), 0 0 0 1px rgba(31,91,255,.18)',
        'nav':   '0 1px 0 0 rgba(11,20,48,0.08)',
        'glow':  '0 0 0 1px rgba(0,200,255,.35), 0 8px 30px -6px rgba(31,91,255,.55)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '20px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
}
