import { arrayMinus, split, splitTokens } from "./utils";

/**
 * Factory to create same parent checker function
 * @param preprocessFn called on each value before comparison
 * @returns {Function} same parent checker function
 */
function sameParentChecker(preprocessFn) {
  return function (suggestions) {
    if (suggestions.length === 0) {
      return false;
    }
    if (suggestions.length === 1) {
      return true;
    }

    const parentValue = preprocessFn(suggestions[0].value);
    const aliens = suggestions.filter(function (suggestion) {
      return preprocessFn(suggestion.value).indexOf(parentValue) !== 0;
    });

    return aliens.length === 0;
  };
}

/**
 * Default same parent checker. Compares raw values.
 * @type {Function}
 */
const haveSameParent = sameParentChecker(function (val) {
  return val;
});

/**
 * Сравнивает запрос c подсказками, по словам.
 * Срабатывает, только если у всех подсказок общий родитель
 * (функция сверки передаётся параметром).
 * Игнорирует стоп-слова.
 * Возвращает индекс единственной подходящей подсказки
 * или -1, если подходящих нет или несколько.
 */
function _matchByWords(stopwords, parentCheckerFn) {
  return function (query, suggestions) {
    let queryTokens;
    const matches = [];

    if (parentCheckerFn(suggestions)) {
      queryTokens = splitTokens(split(query, stopwords));

      for (const [i, suggestion] of suggestions.entries()) {
        const suggestedValue = suggestion.value;
        if (query.length > suggestedValue.length && query.toLowerCase().includes(suggestedValue.toLowerCase())) {
          break;
        }

        // check if query words are a subset of suggested words
        const suggestionWords = splitTokens(split(suggestedValue, stopwords));

        if (arrayMinus(queryTokens, suggestionWords).length === 0) {
          matches.push(i);
        }
      }
    }

    return matches.length === 1 ? matches[0] : -1;
  };
}

/**
 * Разность массивов с частичным совпадением элементов.
 * Если элемент второго массива включает в себя элемент первого,
 * элементы считаются равными.
 */
function minusWithPartialMatching(array1, array2) {
  if (!array2 || array2.length === 0) {
    return array1;
  }
  return array1.filter(function (el) {
    return !array2.some(function (el2) {
      return el2.indexOf(el) === 0;
    });
  });
}
/**
 * Вырезает из строки стоп-слова
 */
function normalize(str: string, stopwords?: string[]) {
  return split(str, stopwords).join(" ");
}

/**
 * Matchers return index of suitable suggestion
 * Context inside is optionally set in types.js
 */
const matchers = {
  /**
   * Matches query against suggestions, removing all the stopwords.
   */
  matchByNormalizedQuery(stopwords?: string[]) {
    return function (query, suggestions) {
      const normalizedQuery = normalize(query, stopwords);
      const matches = [];

      for (const [i, suggestion] of suggestions.entries()) {
        const suggestedValue = suggestion.value.toLowerCase();
        // if query encloses suggestion, than it has already been selected
        // so we should not select it anymore
        if (query.length > suggestedValue.length && query.toLowerCase().includes(suggestedValue.toLowerCase())) {
          break;
        }
        // if there is suggestion that contains query as its part
        // than we should ignore all other matches, even full ones
        if (suggestedValue.indexOf(normalizedQuery) > 0) {
          break;
        }
        if (normalizedQuery === normalize(suggestedValue, stopwords)) {
          matches.push(i);
        }
      }

      return matches.length === 1 ? matches[0] : -1;
    };
  },

  matchByWords(stopwords?: string[]) {
    return _matchByWords(stopwords, haveSameParent);
  },

  matchByWordsAddress(stopwords) {
    return _matchByWords(stopwords, haveSameParent);
  },

  /**
   * Matches query against values contained in suggestion fields
   * for cases, when there is only one suggestion
   * only considers fields specified in fields map
   * uses partial matching:
   *   "0445" vs { value: "ALFA-BANK", data: { "bic": "044525593" }} is a match
   */
  matchByFields<T extends Suggestion<SuggestionAny>>(fields: (((s: T) => string) | [(s: T) => string, string[]])[]) {
    return function (query, suggestions) {
      const tokens = splitTokens(split(query));
      let suggestionWords = [];

      if (suggestions.length === 1) {
        if (fields) {
          for (let getField of fields) {
            let stopwords;
            if (Array.isArray(getField)) {
              stopwords = getField[1];
              getField = getField[0];
            }
            const fieldValue = getField(suggestions[0]);
            const fieldWords = fieldValue && splitTokens(split(fieldValue, stopwords));

            if (fieldWords && fieldWords.length > 0) {
              suggestionWords = [...suggestionWords, ...fieldWords];
            }
          }
        }

        if (minusWithPartialMatching(tokens, suggestionWords).length === 0) {
          return 0;
        }
      }

      return -1;
    };
  },
};

export { matchers };
