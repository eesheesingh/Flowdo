import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        surface: {
          DEFAULT: "hsl(var(--surface))",
          lowest: "hsl(var(--surface-lowest))",
          low: "hsl(var(--surface-low))",
          container: "hsl(var(--surface-container))",
          high: "hsl(var(--surface-high))",
          highest: "hsl(var(--surface-highest))",
        },

        "on-surface": "hsl(var(--on-surface))",
        "on-surface-variant": "hsl(var(--on-surface-variant))",
        outline: "hsl(var(--outline))",
        "outline-variant": "hsl(var(--outline-variant))",

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--on-primary))",
          container: "hsl(var(--primary-container))",
          fixed: "hsl(var(--primary-fixed))",
        },
        "on-primary-container": "hsl(var(--on-primary-container))",
        "on-primary-fixed": "hsl(var(--on-primary-fixed))",

        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          container: "hsl(var(--secondary-container))",
          fixed: "hsl(var(--secondary-fixed))",
        },
        "on-secondary-container": "hsl(var(--on-secondary-container))",
        "on-secondary-fixed": "hsl(var(--on-secondary-fixed))",
        "on-secondary-fixed-variant": "hsl(var(--on-secondary-fixed-variant))",

        tertiary: {
          DEFAULT: "hsl(var(--tertiary))",
          container: "hsl(var(--tertiary-container))",
          fixed: "hsl(var(--tertiary-fixed))",
        },
        "on-tertiary-fixed": "hsl(var(--on-tertiary-fixed))",
        "on-tertiary-fixed-variant": "hsl(var(--on-tertiary-fixed-variant))",

        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          container: "hsl(var(--error-container))",
        },
        "on-error-container": "hsl(var(--on-error-container))",

        "inverse-surface": "hsl(var(--inverse-surface))",
        "inverse-on-surface": "hsl(var(--inverse-on-surface))",
        "inverse-primary": "hsl(var(--inverse-primary))",

        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "1.25rem",
      },
      boxShadow: {
        // Shadows tinted toward the ink-violet hue instead of neutral grey,
        // so a lifted card reads as "this palette" rather than generic.
        xs: "0 1px 2px rgba(45,29,110,0.06)",
        sm: "0 1px 2px rgba(45,29,110,0.06), 0 6px 16px rgba(45,29,110,0.08)",
        md: "0 4px 10px rgba(45,29,110,0.10), 0 14px 32px rgba(45,29,110,0.12)",
        glow: "0 4px 14px rgba(94,74,227,0.35)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
