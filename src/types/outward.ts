import { matchers } from "../matchers";
import type { SuggestionsType } from "../types";

export const Outward = (name: string): SuggestionsType<any> => ({
  urlSuffix: (() => {
    return name.toLowerCase();
  })(),
  noSuggestionsHint: "Неизвестное значение",
  matchers: [matchers.matchByNormalizedQuery(), matchers.matchByWords()],
});
