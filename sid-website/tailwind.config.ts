import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1B1E19", // fond "salle des cartes" quasi-noir olive
          soft: "#242821",
          border: "#333A2E",
        },
        paper: {
          DEFAULT: "#E4DCC3", // papier kraft / dossier vieilli
          dark: "#D3C9A8",
          text: "#23281F", // encre sombre sur papier
        },
        brass: {
          DEFAULT: "#B08D45", // tampon laiton
          light: "#D4B876",
        },
        olive: {
          DEFAULT: "#4B5842", // accent tactique
          light: "#6B7A5E",
        },
        redact: "#8C3B2E", // rouge "urgent / classifié"
        teal: "#3E5C5B", // liens / info
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
