/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#f2f4f5',
        pharos: {
          blue: '#0012b8',
          blueHover: '#000ea0',
          indigo: '#5c41ff',
          indigoHover: '#4930d6',
          dark: '#0d1117',
          surface: '#ffffff',
          border: '#e5e7eb',
          subtle: '#f9fafb',
          mutedText: '#6b7280',
          heading: '#111827',
        },
      },
      borderRadius: {
        'pharos-btn': '6px',
        'pharos-card': '12px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'pharos-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'pharos-card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'pharos-glow': '0 0 16px -2px rgba(92, 65, 255, 0.18)',
      },
    },
  },
  plugins: [],
};
