import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe2fe",
          300: "#93cffd",
          400: "#60b1fa",
          500: "#3b8ff6",
          600: "#2570eb",
          700: "#1d59d8",
          800: "#1f49af",
          900: "#1f408a",
          950: "#172a55",
        },
      },
    },
  },
  plugins: [],
};

export default config;
