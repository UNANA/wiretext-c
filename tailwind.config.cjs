/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-hover': 'rgb(var(--color-surface-hover) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        'text-dim': 'rgb(var(--color-text-dim) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'grid-dot': 'rgb(var(--color-grid-dot) / <alpha-value>)',
        selection: 'rgb(var(--color-selection) / <alpha-value>)',
        'selection-border': 'rgb(var(--color-selection-border) / <alpha-value>)',
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
