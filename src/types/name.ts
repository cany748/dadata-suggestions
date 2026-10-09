import type { Suggestion, SuggestionName, SuggestionsType } from "../types";

import { WORD_DELIMITERS } from "../constants";
import { escapeRegExChars, fieldsAreNotEmpty } from "../utils";
import { matchers } from "../matchers";

const valueStartsWith = (suggestion: Suggestion<SuggestionName>, field: keyof SuggestionName) => {
  const fieldValue = suggestion.data && suggestion.data[field];

  return fieldValue && new RegExp(`^${escapeRegExChars(fieldValue)}([${WORD_DELIMITERS}]|$)`, "i").test(suggestion.value);
};

const NAME_TYPE = {
  urlSuffix: "fio",
  noSuggestionsHint: false,
  matchers: [matchers.matchByNormalizedQuery(), matchers.matchByWords()],
  // names for labels, describing which fields are displayed
  fieldNames: {
    surname: "фамилия",
    name: "имя",
    patronymic: "отчество",
  },
  isDataComplete(suggestion) {
    const params = this.options.params;
    const parts = (typeof params === "function" ? params.call(this.element, suggestion.value) : params).parts;
    const data = suggestion.data;
    let fields: string[];

    if (Array.isArray(parts)) {
      fields = parts.map((part: string) => {
        return part.toLowerCase();
      });
    } else {
      // when NAME is first, patronymic is mot mandatory
      fields = ["surname", "name"];
      // when SURNAME is first, it is
      if (valueStartsWith(suggestion, "surname")) {
        fields.push("patronymic");
      }
    }
    return fieldsAreNotEmpty(data, fields);
  },
  composeValue(data) {
    return [data.surname, data.name, data.patronymic].filter((e) => !!e).join(" ");
  },
} satisfies SuggestionsType<SuggestionName>;

export { NAME_TYPE };
