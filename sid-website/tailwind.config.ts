import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14161C", // fond quasi-noir, légèrement bleuté (comme le logo)
          soft: "#1B1E26",
          border: "#2B303C",
        },
        paper: {
          DEFAULT: "#E4DCC3", // papier kraft / dossier vieilli — pour les quêtes
          dark: "#D3C9A8",
          text: "#23281F",
        },
        blue: {
          DEFAULT: "#3B6EA8", // bleu du "S" du logo
          light: "#6B9BD1",
          dark: "#24466B",
        },
        red: {
          DEFAULT: "#9B3232", // rouge du "D" du logo
          light: "#C1504F",
          dark: "#6E2222",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        body: ["var(--font-body)", "Georgia", "serif"],
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0)",
      },
      backgroundSize: {
        grain: "4px 4px",
      },
    },
  },
  plugins: [],
};
export default config;
