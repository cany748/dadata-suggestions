export const KEYS = {
  ENTER: 13,
  ESC: 27,
  TAB: 9,
  SPACE: 32,
  UP: 38,
  DOWN: 40,
};

export const CLASSES = {
  hint: "suggestions-hint",
  mobile: "suggestions-mobile",
  nowrap: "suggestions-nowrap",
  selected: "suggestions-selected",
  suggestion: "suggestions-suggestion",
  subtext: "suggestions-subtext",
  subtext_inline: "suggestions-subtext suggestions-subtext_inline",
  subtext_delimiter: "suggestions-subtext-delimiter",
  removeConstraint: "suggestions-remove",
  value: "suggestions-value",
};

export const EVENT_NS = ".suggestions";
export const DATA_ATTR_KEY = "suggestions";
export const WORD_DELIMITERS = String.raw`\s"'~\*\.,:\|\[\]\(\)\{\}<>№`;
export const WORD_PARTS_DELIMITERS = String.raw`\-\+\\\?!@#$%^&`;
