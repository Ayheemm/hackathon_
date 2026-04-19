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
        "bg-main": "#FDF5E6",
        "bg-card": "#FFFFFF",
        "text-light": "#FDF5E6",
        "text-dark": "#1E0E04",
        "text-muted": "#D4A050",
        "border-gold": "rgba(212, 160, 80, 0.2)",
      },
      boxShadow: {
        soft: "0 6px 18px rgba(212, 160, 80, 0.13)",
      },
    },
  },
  plugins: [typography],
};

export default config;
