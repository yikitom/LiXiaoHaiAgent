import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"PingFang SC"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "ui-monospace",
          "Menlo",
          "Monaco",
          '"Cascadia Mono"',
          "monospace",
        ],
      },
      colors: {
        ios: {
          blue: "#007AFF",
          blueHover: "#0062CC",
          green: "#34C759",
          red: "#FF3B30",
          orange: "#FF9500",
          yellow: "#FFCC00",
          indigo: "#5856D6",
          purple: "#AF52DE",
          pink: "#FF2D55",
          teal: "#5AC8FA",
          gray: "#8E8E93",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)",
        cardHover: "0 4px 14px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)",
        modal: "0 24px 60px -12px rgba(0,0,0,0.25)",
      },
      borderRadius: {
        ios: "10px",
        "ios-lg": "14px",
      },
    },
  },
  plugins: [],
};

export default config;
