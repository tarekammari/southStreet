import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          deep: "rgb(var(--brand-primary-deep-rgb, 2 44 34) / <alpha-value>)",
          // Brand colour from «هوية الوكالة» (lib/brand.ts), South Street green by default.
          dark: "rgb(var(--brand-primary-dark-rgb, 6 78 59) / <alpha-value>)",
          main: "rgb(var(--brand-primary-rgb, 4 120 87) / <alpha-value>)",
          light: "rgb(var(--brand-primary-light-rgb, 5 150 105) / <alpha-value>)",
          soft: "#ecfdf5",
        },
        gold: {
          dark: "#9a7b1c",
          main: "rgb(var(--brand-accent-rgb, 212 175 55) / <alpha-value>)",
          light: "#fef08a",
          soft: "#fffbeb",
        },
        slate: {
          app: "#f4f6f9",
          card: "#ffffff",
          darkBg: "#0f172a",
          950: "#020617",
        },
      },
      fontFamily: {
        tajawal: ["var(--font-tajawal)", "sans-serif"],
        amiri: ["var(--font-amiri)", "serif"],
        cairo: ["var(--font-cairo)", "sans-serif"],
        ruqaa: ["var(--font-ruqaa)", "serif"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 15px rgba(212, 175, 55, 0.4)" },
          "50%": { boxShadow: "0 0 25px rgba(212, 175, 55, 0.8)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease forwards",
        "pulse-glow": "pulseGlow 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
