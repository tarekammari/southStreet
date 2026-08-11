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
          deep: "#022c22",
          dark: "#064E3B",
          main: "#047857",
          light: "#059669",
          soft: "#ecfdf5",
        },
        gold: {
          dark: "#9a7b1c",
          main: "#d4af37",
          light: "#fef08a",
          soft: "#fffbeb",
        },
        slate: {
          app: "#f8fafc",
          card: "#ffffff",
          darkBg: "#0f172a",
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
