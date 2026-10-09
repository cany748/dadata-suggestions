import { WORD_DELIMITERS } from "../constants";
import { highlightMatches } from "../utils";
import { matchers } from "../matchers";
import type { FormatResultOptions, Suggestion, SuggestionParty, SuggestionsType } from "../types";
import type { Suggestions } from "../suggestions";
import { ADDRESS_COMPONENTS, ADDRESS_STOPWORDS } from "./address";

const innPartsLengths = {
  LEGAL: [2, 2, 5, 1],
  INDIVIDUAL: [2, 2, 6, 2],
};

const chooseFormattedField = (formattedMain: string, formattedAlt: string) => {
  const rHasMatch = /<strong>/;
  return rHasMatch.test(formattedAlt) && !rHasMatch.test(formattedMain) ? formattedAlt : formattedMain;
};

const formattedField = (main: string, alt: string | null, currentValue: string, options: FormatResultOptions) => {
  const formattedMain = highlightMatches(main, currentValue, options);
  const formattedAlt = highlightMatches(alt, currentValue, options);

  return chooseFormattedField(formattedMain, formattedAlt);
};

const formatResultInn = (ctx: Suggestions<any>, suggestion: Suggestion<SuggestionParty>, currentValue: string) => {
  const inn = suggestion.data && suggestion.data.inn;
  const innPartsLength =
    suggestion.data && suggestion.data.type ? innPartsLengths[suggestion.data.type as keyof typeof innPartsLengths] : undefined;
  const rDigit = /\d/;

  if (inn) {
    const formattedInn = highlightMatches(inn, currentValue);
    if (!innPartsLength) {
      return formattedInn;
    }

    const chars = [...formattedInn];
    const innParts = innPartsLength.map((partLength: number) => {
      let formattedPart = "";
      let ch;

      // eslint-disable-next-line no-cond-assign
      while (partLength && (ch = chars.shift())) {
        formattedPart += ch;
        if (rDigit.test(ch)) partLength--;
      }

      return formattedPart;
    });
    return innParts.join(`<span class="${ctx.classes.subtext_delimiter}"></span>`) + chars.join("");
  }

  return "";
};

export const PARTY_TYPE = {
  urlSuffix: "party",
  noSuggestionsHint: "Неизвестная организация",
  matchers: [
    matchers.matchByFields<SuggestionParty>([
      (d) => d.value,
      [(d) => d.data?.address?.value, ADDRESS_STOPWORDS],
      (d) => d.data?.inn,
      (d) => d.data?.ogrn,
    ]),
  ],
  dataComponents: ADDRESS_COMPONENTS,
  enrichmentEnabled: true,
  enrichmentMethod: "findById",
  enrichmentParams: {
    count: 1,
    locations_boost: null,
  },
  getEnrichmentQuery(suggestion) {
    return suggestion.data.hid;
  },
  geoEnabled: true,
  formatResult(value, currentValue, suggestion, options) {
    const formattedInn = formatResultInn(this, suggestion, currentValue);
    const formatterOGRN = highlightMatches(suggestion.data?.ogrn, currentValue);
    const formattedInnOGRN = chooseFormattedField(formattedInn, formatterOGRN);
    const formattedFIO = highlightMatches(suggestion.data?.management?.name, currentValue);
    let address = suggestion.data?.address?.value || "";

    const isMobile = globalThis.innerWidth <= this.options.mobileWidth;

    if (isMobile) {
      options.maxLength = 50;
    }

    value = formattedField(value, suggestion.data?.name?.latin, currentValue, options);
    value = this.wrapFormattedValue(value, suggestion);

    if (address) {
      address = address.replace(/^(\d{6}|Россия),\s+/i, "");
      address = isMobile
        ? address.replace(new RegExp(`^([^${WORD_DELIMITERS}]+[${WORD_DELIMITERS}]+[^${WORD_DELIMITERS}]+).*`), "$1")
        : highlightMatches(address, currentValue, {
            unformattableTokens: ADDRESS_STOPWORDS,
          });
    }

    if (formattedInnOGRN || address || formattedFIO) {
      value +=
        `<div class="${this.classes.subtext}">` +
        `<span class="${this.classes.subtext_inline}">${formattedInnOGRN || ""}</span>${
          chooseFormattedField(address, formattedFIO) || ""
        }</div>`;
    }
    return value;
  },
} satisfies SuggestionsType<SuggestionParty>;
