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
        mono: ["'IBM Plex Mono'", "Consolas", "monospace"],
        display: ["'VT323'", "monospace"],
      },
      colors: {
        aol: {
          blue: "#0066cc",
          darkblue: "#003366",
          gray: "#c0c0c0",
          darkgray: "#808080",
          yellow: "#ffff00",
          black: "#000000",
          white: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
