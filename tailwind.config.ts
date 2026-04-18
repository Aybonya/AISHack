import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070d11",
        foreground: "#ecf6ef",
        panel: "#0c1519",
        "panel-2": "#101d22",
        border: "#193139",
        muted: "#9db4ab",
        accent: "#22c55e",
        "accent-soft": "#0f3420",
        danger: "#fb7185",
        warning: "#fbbf24",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(51, 118, 78, 0.24), 0 28px 70px rgba(0, 0, 0, 0.38)",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top left, rgba(52, 211, 153, 0.18), transparent 36%), radial-gradient(circle at top right, rgba(34, 197, 94, 0.08), transparent 24%)",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
        brand: ["var(--font-space-grotesk)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
