// ESLint (Next 16 : « next lint » n'existe plus, on passe par ESLint direct).
import next from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: [".next/**", "node_modules/**", "test-results/**", "playwright-report/**", "src/components/sceaux/**", ".scelle/**", "public/**"] },
  ...next,
  {
    // Règles du React Compiler (eslint-plugin-react-hooks 7), que le site
    // n'utilise pas : elles signalent des tournures valides sans lui.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // Apostrophes dans le texte français : sans danger en JSX.
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
