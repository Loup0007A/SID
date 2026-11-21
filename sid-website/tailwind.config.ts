import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // Refonte (Lot 90) : chaque couleur lit une variable de globals.css,
      // qui change selon qu'on est sur le fond bleu ou sur une carte crème.
      colors: {
        ink: { DEFAULT: v("ink"), soft: v("ink-soft"), border: v("ink-border") },
        paper: { DEFAULT: v("paper"), dark: v("paper-dark"), text: v("paper-text") },
        blue: { DEFAULT: v("blue"), light: v("blue-light"), dark: v("blue-dark") },
        red: { DEFAULT: v("red"), light: v("red-light"), dark: v("red-dark") },
        white: v("white"),
        black: v("black"),
        green: { 200: v("green-200"), 300: v("green-300"), 400: v("green-400") },
        yellow: { 200: v("yellow-200"), 300: v("yellow-300"), 400: v("yellow-400") },
        gold: v("gold"),
        ok: v("ok"),
        ko: v("ko"),
        hausse: v("hausse"),
        baisse: v("baisse"),
        encre: "rgb(var(--encre) / <alpha-value>)",
        creme: "rgb(var(--creme) / <alpha-value>)",
        fond: "rgb(var(--fond) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-2": "rgb(var(--accent-2) / <alpha-value>)",
      },
      // Lisibilité (Lot 95) : un texte « paper » estompé (text-paper/60…)
      // garde au moins 80 % d'opacité, pour rester à 4,5:1 sur le fond et
      // sur les cartes. Les fonds et bordures gardent leur transparence.
      textColor: {
        paper: { DEFAULT: "rgb(var(--c-paper) / calc(0.8 + <alpha-value> * 0.2))" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        body: ["var(--font-body)", "Georgia", "serif"],
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0)",
      },
      boxShadow: {
        dur: "var(--ombre)",
        "dur-sm": "var(--ombre-petite)",
      },
      backgroundSize: {
        grain: "4px 4px",
      },
    },
  },
  plugins: [],
};
export default config;
