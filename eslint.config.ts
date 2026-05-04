import { factoryConfig } from "@cany748/eslint-config";

export default factoryConfig(
  {
    rules: {
      "unicorn/no-array-sort": "off",
    },
  },
  {
    files: ["test/specs/*"],
    rules: {
      "no-undef": "off",
      "e18e/prefer-static-regex": "off",
    },
  },
);
