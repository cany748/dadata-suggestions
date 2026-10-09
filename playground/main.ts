import { Suggestions } from "@/main";
import type { Options } from "@/main";

const common = {
  token: import.meta.env.VITE_DADATA_API_KEY,
  noCache: true,
  hint: false,
} satisfies Partial<Options>;

const fields: Options<string>[] = [
  { ...common, type: "NAME" },
  { ...common, type: "EMAIL" },
  { ...common, type: "FMS" },
];

const app = document.querySelector("#app")!;
const instances = fields.map((options) => {
  const field = document.createElement("div");
  const input = document.createElement("input");
  input.name = options.type.toLowerCase();
  field.append(input);
  app.append(field);
  return new Suggestions(input, options);
});

// для отладки из консоли браузера
Object.assign(globalThis, { suggestions: instances });
