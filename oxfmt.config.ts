import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: {
    groups: [
      ["type-builtin", "value-builtin", "type-external", "value-external"],
      ["type-internal", "value-internal"],
      ["type-parent", "value-parent", "type-sibling", "value-sibling", "type-index", "value-index"],
      "style",
      "unknown",
    ],

    newlinesBetween: true,
    order: "asc",
    ignoreCase: true,

    internalPattern: ["@/"],

    sortSideEffects: true,
  },
});
