import { factoryConfig } from "@cany748/eslint-config";

export default factoryConfig(
  { typescript: { tsconfigPath: "./tsconfig.json" } },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
    },
  },
  {
    files: ["test/**/*"],
    rules: {
      "unicorn/no-global-object-property-assignment": "off",
    },
  },
  {
    files: ["test/specs/*"],
    rules: {
      "no-undef": "off",
    },
  },
);
