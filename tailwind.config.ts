import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: "#1B3560",
        orange: "#E05738",
        "light-gray": "#F2F4F8",
        green: "#1D9E75",
      },
      ringColor: {
        DEFAULT: "#1B3560",
        navy: "#1B3560",
      },
    },
  },
  plugins: [],
};
export default config;
