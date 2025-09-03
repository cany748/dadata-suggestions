import "./poly";
import "./main.css";

import $ from "cash-dom";

import { Suggestions } from "./suggestions";
import { DATA_ATTR_KEY } from "./constants";
import type { 
  Suggestion, 
  SuggestionName, 
  SuggestionAddress, 
  SuggestionParty, 
  SuggestionEmail, 
  SuggestionBank, 
  SuggestionFms 
} from "./types";

type SuggestionMap = {
  NAME: SuggestionName;
  ADDRESS: SuggestionAddress;
  PARTY: SuggestionParty;
  EMAIL: SuggestionEmail;
  BANK: SuggestionBank;
  FMS: SuggestionFms;
};

export type Options<T extends keyof SuggestionMap = keyof SuggestionMap> = {
  token: string;
  type: T;
  params?: Record<string, any>;
  bounds?: string;
  constraints?: string;
  triggerSelectOnSpace?: boolean;
  noCache?: boolean;
  hint?: boolean | string;
  scrollOnFocus?: boolean;
  addon?: string;
  onSelect?: (suggestion: Suggestion<SuggestionMap[T]>) => void | Promise<void>;
  formatResult?: (value: string, currentValue: string, suggestion: Suggestion<SuggestionMap[T]>) => string;
  onSelectNothing?: (query: string) => void;
  [key: string]: any; // Allow additional options
};

export const suggestions = (selector: string, options: Options) => {
  const inputElement = $(selector) as any;
  inputElement[0]?.[DATA_ATTR_KEY]?.dispose?.();
  const instance = new Suggestions(inputElement, options);
  inputElement[0]![DATA_ATTR_KEY] = instance as never;
  return instance;
};

export { Suggestions } from "./suggestions";
export type { 
  Suggestion, 
  SuggestionName, 
  SuggestionAddress, 
  SuggestionParty, 
  SuggestionEmail, 
  SuggestionBank, 
  SuggestionFms 
} from "./types";