import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        hse: {
          blue:       "#0F2D69",
          "blue-mid": "#374B9B",
          accent:     "#0FA0D7",
          light:      "#CDDCF0",
          "page-bg":  "#F4F5F7",
          border:     "#E6E7E8",
          success:    "#009B64",
          warning:    "#FAB900",
          danger:     "#E61E3C",
          info:       "#0FA0D7",
        }
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" }
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" }
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(18px)" },
          to:   { opacity: "1", transform: "translateX(0)" }
        },
        shimmer: {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" }
        },
        "pulse-dot": {
          "0%, 80%, 100%": { transform: "scale(0)", opacity: "0" },
          "40%":           { transform: "scale(1)", opacity: "1" }
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(-10px) scale(0.97)" },
          to:   { opacity: "1", transform: "translateY(0) scale(1)" }
        },
        "toast-out": {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to:   { opacity: "0", transform: "translateY(-8px) scale(0.97)" }
        },
        "progress-bar": {
          from: { width: "0%" },
          to:   { width: "100%" }
        }
      },
      animation: {
        "fade-in":        "fade-in 0.25s ease-out both",
        "slide-up":       "slide-up 0.3s ease-out both",
        "fade-in-scale":  "fade-in-scale 0.2s ease-out both",
        "slide-in-right": "slide-in-right 0.25s ease-out both",
        shimmer:          "shimmer 1.6s linear infinite",
        "pulse-dot":      "pulse-dot 1.2s ease-in-out infinite",
        "toast-in":       "toast-in 0.22s ease-out both",
        "toast-out":      "toast-out 0.2s ease-in both",
        "progress-bar":   "progress-bar 4s linear forwards"
      }
    }
  },
  plugins: []
};

export default config;
