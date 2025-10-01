
export default {
  plugins: {
    tailwindcss: {
      content: [
        "./index.html",
        "./*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./contexts/**/*.ts",
        "./hooks/**/*.ts",
        "./services/**/*.ts",
        "./types/**/*.ts",
        "./utils/**/*.ts"
      ],
      theme: {
        extend: {
          boxShadow: {
            lg: '0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.1), inset 0 1px 0 0 rgb(255 255 255 / 0.07)',
          },
          backgroundColor: {
            primary: 'rgb(var(--bg-primary) / <alpha-value>)',
            secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--bg-tertiary) / <alpha-value>)',
            accent: 'rgb(var(--accent) / <alpha-value>)',
            'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
            danger: 'rgb(var(--danger) / <alpha-value>)',
            'danger-hover': 'rgb(var(--danger-hover) / <alpha-value>)',
            success: 'rgb(var(--success) / <alpha-value>)',
            panel: 'var(--bg-panel)',
          },
          textColor: {
            primary: 'rgb(var(--text-primary) / <alpha-value>)',
            secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
            highlight: 'rgb(var(--highlight) / <alpha-value>)',
            accent: 'rgb(var(--accent) / <alpha-value>)',
            'on-panel': 'var(--text-on-panel)',
          },
          borderColor: {
            DEFAULT: 'rgb(var(--border-color) / <alpha-value>)',
            'color': 'rgb(var(--border-color) / <alpha-value>)',
            accent: 'rgb(var(--accent) / <alpha-value>)',
          },
          ringColor: {
            DEFAULT: 'rgb(var(--ring-color) / <alpha-value>)',
            'color': 'rgb(var(--ring-color) / <alpha-value>)',
            accent: 'rgb(var(--accent) / <alpha-value>)'
          },
        },
      },
      plugins: [],
    },
    autoprefixer: {},
  },
}