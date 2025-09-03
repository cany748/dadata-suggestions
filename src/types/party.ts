import { WORD_DELIMITERS } from "../constants";
import { highlightMatches } from "../utils";
import { matchers } from "../matchers";
import type { SuggestionsType, Suggestion, SuggestionParty } from "../types";
import { ADDRESS_COMPONENTS, ADDRESS_STOPWORDS } from "./address";

const innPartsLengths = {
  LEGAL: [2, 2, 5, 1],
  INDIVIDUAL: [2, 2, 6, 2],
};

function chooseFormattedField(formattedMain: string, formattedAlt: string) {
  const rHasMatch = /<strong>/;
  return rHasMatch.test(formattedAlt) && !rHasMatch.test(formattedMain) ? formattedAlt : formattedMain;
}

function formattedField(main: string, alt: string, currentValue: string, suggestion: any, options: any) {
  const formattedMain = highlightMatches(main, currentValue, options);
  const formattedAlt = highlightMatches(alt, currentValue, options);

  return chooseFormattedField(formattedMain, formattedAlt);
}

function formatResultInn(ctx: any, suggestion: Suggestion<SuggestionParty>, currentValue: string) {
  const inn = suggestion.data && suggestion.data.inn;
  const innPartsLength = suggestion.data && suggestion.data.type ? innPartsLengths[suggestion.data.type as keyof typeof innPartsLengths] : undefined;
  let innParts;
  let formattedInn: any;
  const rDigit = /\d/;

  if (inn) {
    formattedInn = highlightMatches(inn, currentValue);
    if (innPartsLength) {
      formattedInn = [...formattedInn];
      innParts = innPartsLength.map(function (partLength: number) {
        let formattedPart = "";
        let ch;

        while (partLength && (ch = formattedInn.shift())) {
          formattedPart += ch;
          if (rDigit.test(ch)) partLength--;
        }

        return formattedPart;
      });
      formattedInn = innParts.join(`<span class="${(ctx as any).classes.subtext_delimiter}"></span>`) + formattedInn.join("");
    }

    return formattedInn;
  }
}

export const PARTY_TYPE = {
  urlSuffix: "party",
  noSuggestionsHint: "Неизвестная организация",
  matchers: [
    matchers.matchByFields<Suggestion<SuggestionParty>>([
      (d) => d?.value,
      [(d) => d?.data.address.value, ADDRESS_STOPWORDS],
      (d) => d?.data?.inn,
      (d) => d?.data?.ogrn,
    ]),
  ],
  dataComponents: ADDRESS_COMPONENTS,
  enrichmentEnabled: true,
  enrichmentMethod: "findById",
  enrichmentParams: {
    count: 1,
    locations_boost: null,
  },
  getEnrichmentQuery(suggestion: Suggestion<SuggestionParty>) {
    return suggestion.data.hid;
  },
  geoEnabled: true,
  formatResult(this: any, value: string, currentValue: string, suggestion: Suggestion<SuggestionParty>, options: any = {}) {
    const formattedInn = formatResultInn(this, suggestion, currentValue);
    const formatterOGRN = highlightMatches(suggestion.data?.ogrn || "", currentValue);
    const formattedInnOGRN = chooseFormattedField(formattedInn || "", formatterOGRN);
    const formattedFIO = highlightMatches(suggestion.data?.management?.name || "", currentValue);
    let address = suggestion.data?.address?.value || "";

    if ((this as any).isMobile) {
      options.maxLength = 50;
    }

    value = formattedField.call(this, value, suggestion.data?.name?.latin || "", currentValue, suggestion, options);
    value = (this as any).wrapFormattedValue(value, suggestion);

    if (address) {
      address = address.replace(/^(\d{6}|Россия),\s+/i, "");
      address = (this as any).isMobile
        ? address.replace(new RegExp(`^([^${WORD_DELIMITERS}]+[${WORD_DELIMITERS}]+[^${WORD_DELIMITERS}]+).*`), "$1")
        : highlightMatches(address, currentValue, {
            unformattableTokens: ADDRESS_STOPWORDS,
          });
    }

    if (formattedInnOGRN || address || formattedFIO) {
      value +=
        `<div class="${(this as any).classes.subtext}">` +
        `<span class="${(this as any).classes.subtext_inline}">${formattedInnOGRN || ""}</span>${
          chooseFormattedField(address, formattedFIO) || ""
        }</div>`;
    }
    return value;
  },
} as SuggestionsType<SuggestionParty>;
