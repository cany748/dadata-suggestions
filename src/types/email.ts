import { matchers } from "../matchers";
import type { SuggestionsType } from "../types";

const EMAIL_TYPE = {
  urlSuffix: "email",
  noSuggestionsHint: false,
  matchers: [matchers.matchByNormalizedQuery()],
  isQueryRequestable(query) {
    return query.includes("@");
  },
} as SuggestionsType<SuggestionEmail>;

export { EMAIL_TYPE };
