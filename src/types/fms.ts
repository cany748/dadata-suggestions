import { matchers } from "../matchers";
import type { SuggestionsType } from "../types";

export const FMS_TYPE = {
  urlSuffix: "fms_unit",
  noSuggestionsHint: "Неизвестное подразделение",
  matchers: [matchers.matchByNormalizedQuery(), matchers.matchByWords()],
  formatResult(value, currentValue, suggestion) {
    return `${suggestion.data.code} — ${suggestion.data.name}`;
  },
} as SuggestionsType<SuggestionFms>;
