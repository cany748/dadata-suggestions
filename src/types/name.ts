import type { SuggestionsType } from "../types";

import { WORD_DELIMITERS } from "../constants";
import { escapeRegExChars, fieldsAreNotEmpty } from "../utils";
import { matchers } from "../matchers";

function valueStartsWith(suggestion, field) {
  const fieldValue = suggestion.data && suggestion.data[field];

  return fieldValue && new RegExp(`^${escapeRegExChars(fieldValue)}([${WORD_DELIMITERS}]|$)`, "i").test(suggestion.value);
}

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
    const that = this;
    let params = that.options.params;
    const data = suggestion.data;
    let fields;

    if (typeof params === "function") {
      params = params.call(that.element, suggestion.value);
    }
    if (params && params.parts) {
      fields = params.parts.map(function (part) {
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
} as SuggestionsType<SuggestionName>;

export { NAME_TYPE };
