import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Les fichiers .cjs sont du CommonJS : require() y est la norme.
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Interface d'administration et outil de relecture : aperçus d'images
  // saisies/uploadées par l'utilisateur (URLs arbitraires, fallbacks onError).
  // <img> natif est le bon outil ici — pas d'enjeu SEO/LCP, et next/image
  // rejetterait les URLs hors remotePatterns.
  {
    files: ["app/admin/**", "app/review/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
