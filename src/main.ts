import "./poly";
import "./main.css";

import $ from "cash-dom";

import { Suggestions } from "./suggestions";

import { DATA_ATTR_KEY } from "./constants";

import type { Options } from "./types";

export const suggestions = (selector: string, options: Options) => {
  const inputElement = $(selector) as any;
  inputElement[0]?.[DATA_ATTR_KEY]?.dispose?.();
  const instance = new Suggestions(inputElement, options);
  inputElement[0]![DATA_ATTR_KEY] = instance as never;
  return instance;
};

export { Suggestions } from "./suggestions";
