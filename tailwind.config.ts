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
        brand: {
          50: "#eefbf4",
          100: "#d6f5e3",
          200: "#b0ebca",
          300: "#7bdca8",
          400: "#41c280",
          500: "#25D366", // WhatsApp Green
          600: "#128C7E", // WhatsApp Dark Green
          700: "#075E54", // WhatsApp Deep Teal
          800: "#0b4d45",
          900: "#0a3f39",
          950: "#022421",
        },
      },
    },
  },
  plugins: [],
};
export default config;
