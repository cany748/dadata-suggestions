import { factoryConfig } from "@cany748/eslint-config";

export default factoryConfig(
  {},
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
