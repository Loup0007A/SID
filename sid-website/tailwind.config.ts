import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#262A38", // fond sombre bleuté, plus clair et plus "glass"
          soft: "#2F3444",
          border: "#414759",
        },
        paper: {
          DEFAULT: "#EDE6D3", // papier kraft / dossier vieilli — pour les quêtes
          dark: "#DCD2B6",
          text: "#2B2F28",
        },
        blue: {
          DEFAULT: "#8FB3D9", // bleu pastel (inspiré du "S" du logo)
          light: "#BBD3EA",
          dark: "#6D93BC",
        },
        red: {
          DEFAULT: "#D99A9A", // rouge pastel / rose poudré (inspiré du "D" du logo)
          light: "#E8C0C0",
          dark: "#B97575",
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
