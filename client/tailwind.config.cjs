/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#0D1117',
          surface: '#161B22',
          accent: '#58A6FF',
        }
      },
      animation: {
        'vault-open': 'vaultOpen 1s ease-out forwards',
        'flicker': 'flicker 0.15s infinite alternate',
      },
      keyframes: {
        vaultOpen: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        flicker: {
          '0%': { opacity: '0.9' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
