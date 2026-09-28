import { defineConfig } from "oxlint";

export default defineConfig({
  options: {
    typeAware: true,
    typeCheck: true,
  },

  plugins: ["typescript", "react", "import"],

  rules: {
    // Type-aware TypeScript
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/no-for-in-array": "error",
    "typescript/no-unnecessary-type-assertion": "error",

    // React
    "react/rules-of-hooks": "error",

    // Imports
    "import/no-cycle": "error",
    "import/no-duplicates": "error",
  },

  ignorePatterns: ["dist", "node_modules", "scripts"],
});
