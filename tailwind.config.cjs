/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        surface: '#12121a',
        'surface-hover': '#1a1a26',
        border: '#2a2a3a',
        text: '#e0e0e8',
        'text-dim': '#8585a0',
        accent: '#6c8aff',
        'grid-dot': '#131320',
        selection: 'rgba(108, 138, 255, 0.15)',
        'selection-border': 'rgba(108, 138, 255, 0.5)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '10px',
        '3xs': '9px',
      },
    },
  },
  plugins: [],
}
