import { factoryConfig } from "@cany748/eslint-config";

export default factoryConfig(
  {},
  {
    files: ["test/specs/*"],
    rules: {
      "no-undef": "off",
    },
  },
);
