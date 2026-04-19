import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-deep": "#1E0E04",
        "bg-dark": "#3D1E08",
        "bg-mid": "#7A4010",
        accent: "#D4A050",
        "accent-soft": "#E7C98E",
        "bg-main": "#FDF5E6",
        "bg-card": "#FFFFFF",
        "bg-alt": "#F6EBDD",
        "text-light": "#FFF8EA",
        "text-dark": "#1E0E04",
        "text-muted": "#7A4B1E",
        "border-gold": "rgba(212, 160, 80, 0.24)",
        success: "#1F6B46",
        warning: "#A65A00",
        danger: "#8F1D1D",
        info: "#245C9A",
      },
      boxShadow: {
        soft: "0 6px 20px rgba(30, 14, 4, 0.08)",
        lift: "0 14px 36px rgba(30, 14, 4, 0.14)",
      },
    },
  },
  plugins: [typography],
};

export default config;
