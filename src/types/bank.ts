import { WORD_DELIMITERS } from "../constants";
import { matchers } from "../matchers";
import type { SuggestionsType } from "../types";
import { highlightMatches } from "../utils";
import { ADDRESS_COMPONENTS, ADDRESS_STOPWORDS } from "./address";

const BANK_TYPE = {
  urlSuffix: "bank",
  noSuggestionsHint: "Неизвестный банк",
  matchers: [matchers.matchByFields([(d) => d?.value, (d) => d?.data?.bic, (d) => d?.data?.swift])],
  dataComponents: ADDRESS_COMPONENTS,
  enrichmentEnabled: true,
  enrichmentMethod: "findById",
  enrichmentParams: {
    count: 1,
  },
  getEnrichmentQuery(suggestion) {
    return suggestion.data.bic;
  },
  geoEnabled: true,
  formatResult(value, currentValue, suggestion, options) {
    const that = this;
    const formattedBIC = highlightMatches(suggestion.data?.bic, currentValue);
    let address = suggestion.data?.address?.value || "";

    value = highlightMatches(value, currentValue, options);
    value = that.wrapFormattedValue(value, suggestion);

    if (address) {
      address = address.replace(/^\d{6}( РОССИЯ)?, /i, "");
      address = that.isMobile
        ? address.replace(new RegExp(`^([^${WORD_DELIMITERS}]+[${WORD_DELIMITERS}]+[^${WORD_DELIMITERS}]+).*`), "$1")
        : highlightMatches(address, currentValue, {
            unformattableTokens: ADDRESS_STOPWORDS,
          });
    }

    if (formattedBIC || address) {
      value +=
        `<div class="${that.classes.subtext}">` + `<span class="${that.classes.subtext_inline}">${formattedBIC}</span>${address}</div>`;
    }
    return value;
  },
  formatSelected(suggestion) {
    return suggestion?.data?.name?.payment || null;
  },
} as SuggestionsType<SuggestionBank>;

export { BANK_TYPE };
