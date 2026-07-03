import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Clash Display'", "sans-serif"],
        body: ["'Cabinet Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        base: {
          950: "#080810",
          900: "#0d0d1a",
          800: "#12121f",
          700: "#1a1a2e",
        },
        accent: {
          DEFAULT: "#6c63ff",
          dim: "#4f46e5",
          glow: "rgba(108,99,255,0.35)",
        },
        success: "#22d3a5",
        warning: "#f59e0b",
        danger: "#f43f5e",
        muted: "#4a4a6a",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        shimmer: "shimmer 1.6s infinite linear",
      },
      keyframes: {
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "accent-glow":
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(108,99,255,0.2) 0%, transparent 70%)",
      },
      boxShadow: {
        "accent-sm": "0 0 12px rgba(108,99,255,0.3)",
        "accent-md": "0 0 24px rgba(108,99,255,0.4)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
