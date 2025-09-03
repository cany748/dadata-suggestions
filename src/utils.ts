import { CLASSES, WORD_DELIMITERS, WORD_PARTS_DELIMITERS } from "./constants";

export function isPlainObject(value: unknown) {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

let idCounter = 0;
/**
 * Возвращает автоинкрементный идентификатор.
 */
export function generateId(prefix = "") {
  return prefix + ++idCounter;
}

/**
 * Эскейпирует символы RegExp-шаблона обратным слешем
 * (для передачи в конструктор регулярных выражений)
 */
export function escapeRegExChars(value: string) {
  return value.replace(/[-[\]/{}()*+?.\\^$|]/g, String.raw`\$&`);
}

/**
 * Приводит слово к нижнему регистру и заменяет ё → е
 */
export function formatToken(token: string) {
  return token && token.toLowerCase().replace(/ё/gi, "е");
}

/**
 * Разность массивов: ([1,2,3,4], [2,4,5,6]) => [1,3]
 * Исходные массивы не меняются.
 */
export function arrayMinus(array1: string[], array2?: string[]) {
  if (!array2 || array2.length === 0) {
    return array1;
  }
  return array1.filter(function (el) {
    return !array2.includes(el);
  });
}

export function serialize(data: any) {
  return JSON.stringify(data, (_, value) => (value === null ? undefined : value));
}

/**
 * Выполняет функцию с указанной задержкой.
 */
export function delay(handler: () => any, delay = 0) {
  return setTimeout(handler, delay);
}

export function buildCacheKey(params = {} as Record<string, any>) {
  const keys = Object.keys(params).sort();
  return keys.map((key) => `${key}=${JSON.stringify(params[key])}`).join("&");
}

export const trim = (text: string) => (text == null ? "" : text.replace(/^\s+|(\S)\s+$/g, "$1"));

export function objectsEqual(a: Record<string, any>, b: Record<string, any>) {
  if (a === b) return true;

  if (a && b && typeof a == "object" && typeof b == "object") {
    let i;
    const keys = Object.keys(a);
    const length = keys.length;

    if (length !== Object.keys(b).length) return false;

    for (i = length; i-- !== 0; ) if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

    for (i = length; i-- !== 0; ) {
      const key = keys[i];

      if (!objectsEqual(a[key], b[key])) return false;
    }

    return true;
  }

  // eslint-disable-next-line no-self-compare
  return a !== a && b !== b;
}

/**
 * Проверяет, что указанные поля в объекте заполнены.
 */
export function fieldsAreNotEmpty(obj: Record<string, any>, fields: string[]) {
  if (!isPlainObject(obj)) {
    return false;
  }
  let result = true;
  for (const field of fields) {
    result = !!obj[field];
    if (!result) return result;
  }
  return result;
}

const WORD_PARTS_SPLITTER = new RegExp(`[${WORD_PARTS_DELIMITERS}]+`, "g");

/**
 * Разбивает составные слова на части
 * и дописывает их к исходному массиву.
 */
function withSubTokens(tokens: string[]) {
  let result: string[] = [];
  for (const token of tokens) {
    const subtokens = token.split(WORD_PARTS_SPLITTER);
    result.push(token);
    if (subtokens.length > 1) {
      result = [...result, ...subtokens.filter((e) => !!e)];
    }
  }
  return result;
}

const WORD_SPLITTER = new RegExp(`[${WORD_DELIMITERS}]+`, "g");

/**
 * Возвращает список слов из строки.
 * При этом первыми по порядку идут «предпочтительные» слова
 * (те, что не входят в список «нежелательных»).
 * Составные слова тоже разбивает на части.
 */
export function tokenize(value: string, unformattableTokens?: string[]) {
  let tokens = formatToken(value)
    .split(WORD_SPLITTER)
    .filter((e) => !!e);
  // Move unformattableTokens to the end.
  // This will help to apply them only if no other tokens match
  const preferredTokens = arrayMinus(tokens, unformattableTokens);
  const otherTokens = arrayMinus(tokens, preferredTokens);
  tokens = withSubTokens([...preferredTokens, ...otherTokens]);
  return tokens;
}

/**
 * Заменяет слова на составные части.
 */
export function splitTokens(tokens: string[]) {
  let result: string[] = [];
  for (const token of tokens) {
    const subtokens = token.split(WORD_PARTS_SPLITTER);
    result = [...result, ...subtokens.filter((e) => !!e)];
  }
  return result;
}

/**
 * Нормализует строку, разбивает на слова,
 * отсеивает стоп-слова из списка.
 * Расклеивает буквы и цифры, написанные слитно.
 */
export function split(str: string, stopwords?: string[]) {
  const cleanStr = str
    .toLowerCase()
    .replace("ё", "е")
    .replace(/(\d+)([а-я]{2,})/g, "$1 $2")
    .replace(/([а-я]+)(\d+)/g, "$1 $2");

  const words = cleanStr.split(WORD_SPLITTER).filter((e) => !!e);
  if (words.length === 0) {
    return [];
  }
  const lastWord = words.pop()!;
  const goodWords: string[] = arrayMinus(words, stopwords);
  goodWords.push(lastWord);
  return goodWords;
}

function nowrapLinkedParts(formattedStr: string) {
  const delimitedParts = formattedStr.split(", ");
  // string has no delimiters, should not wrap
  if (delimitedParts.length === 1) {
    return formattedStr;
  }
  // disable word-wrap inside delimited parts
  return delimitedParts
    .map(function (part) {
      return `<span class="${CLASSES.nowrap}">${part}</span>`;
    })
    .join(", ");
}

/**
 * Makes HTML contents for suggestion item
 */
export function highlightMatches(value: string, currentValue: string, options?: { unformattableTokens?: string[]; maxLength?: number }) {
  type Chunk = any;
  const chunks: Chunk[] = [];
  const unformattableTokens = options && options.unformattableTokens;
  let maxLength = options && options.maxLength;
  const rWords = new RegExp(`([^${WORD_DELIMITERS}]*)([${WORD_DELIMITERS}]*)`, "g");
  let match;
  let word;
  let i: number;
  let chunk: Chunk;

  if (!value) return "";

  const tokens = tokenize(currentValue, unformattableTokens);

  const tokenMatchers = tokens.map(function (token) {
    return new RegExp(
      `^((.*)([${WORD_PARTS_DELIMITERS}]+))?` +
        `(${escapeRegExChars(token)})` +
        `([^${WORD_PARTS_DELIMITERS}]*[${WORD_PARTS_DELIMITERS}]*)`,
      "i",
    );
  });

  // parse string by words
  // eslint-disable-next-line no-cond-assign
  while ((match = rWords.exec(value)) && match[0]) {
    word = match[1];
    chunks.push({
      text: word,

      // upper case means a word is a name and can be highlighted even if presents in unformattableTokens
      hasUpperCase: word.toLowerCase() !== word,
      formatted: formatToken(word),
      matchable: true,
    });
    if (match[2]) {
      chunks.push({
        text: match[2],
      });
    }
  }

  // use simple loop because length can change
  for (i = 0; i < chunks.length; i++) {
    chunk = chunks[i];
    if (
      chunk.matchable &&
      !chunk.matched &&
      ((unformattableTokens == null ? -1 : unformattableTokens.indexOf(chunk.formatted)) === -1 || chunk.hasUpperCase)
    ) {
      for (const [, matcher] of tokenMatchers.entries()) {
        const $tokenMatch = matcher.exec(chunk.formatted)!;
        let length;
        let nextIndex = i + 1;

        if ($tokenMatch) {
          const tokenMatch = {
            before: $tokenMatch[1] || "",
            beforeText: $tokenMatch[2] || "",
            beforeDelimiter: $tokenMatch[3] || "",
            text: $tokenMatch[4] || "",
            after: $tokenMatch[5] || "",
          };

          if (tokenMatch.before) {
            // insert chunk before current
            chunks.splice(
              i,
              0,
              {
                text: chunk.text.slice(0, tokenMatch.beforeText.length),
                formatted: tokenMatch.beforeText,
                matchable: true,
              },
              {
                text: tokenMatch.beforeDelimiter,
              },
            );
            nextIndex += 2;

            length = tokenMatch.before.length;
            chunk.text = chunk.text.slice(length);
            chunk.formatted = chunk.formatted.slice(length);
            i--;
          }

          length = tokenMatch.text.length + tokenMatch.after.length;
          if (chunk.formatted.length > length) {
            chunks.splice(nextIndex, 0, {
              text: chunk.text.slice(length),
              formatted: chunk.formatted.slice(length),
              matchable: true,
            });
            chunk.text = chunk.text.slice(0, Math.max(0, length));
            chunk.formatted = chunk.formatted.slice(0, Math.max(0, length));
          }

          if (tokenMatch.after) {
            length = tokenMatch.text.length;
            chunks.splice(nextIndex, 0, {
              text: chunk.text.slice(length),
              formatted: chunk.formatted.slice(length),
            });
            chunk.text = chunk.text.slice(0, Math.max(0, length));
            chunk.formatted = chunk.formatted.slice(0, Math.max(0, length));
          }
          chunk.matched = true;
          break;
        }
      }
    }
  }

  if (maxLength) {
    for (i = 0; i < chunks.length && maxLength >= 0; i++) {
      chunk = chunks[i];
      maxLength -= chunk.text.length;
      if (maxLength < 0) {
        chunk.text = `${chunk.text.slice(0, Math.max(0, chunk.text.length + maxLength))}...`;
      }
    }
    chunks.length = i;
  }

  const formattedStr = chunks
    .map(function (chunk) {
      let text = chunk.text;

      for (const [ch, html] of Object.entries({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "/": "&#x2F;",
      })) {
        text = text.replace(new RegExp(ch, "g"), html);
      }

      if (text && chunk.matched) {
        text = `<strong>${text}</strong>`;
      }
      return text;
    })
    .join("");
  return nowrapLinkedParts(formattedStr);
}
