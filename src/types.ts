import { ADDRESS_TYPE } from "./types/address";
import { NAME_TYPE } from "./types/name";
import { PARTY_TYPE } from "./types/party";
import { EMAIL_TYPE } from "./types/email";
import { BANK_TYPE } from "./types/bank";
import { FMS_TYPE } from "./types/fms";
import { Outward } from "./types/outward";

import type { DataComponents } from "./types/address";
import type { Suggestion } from "./main";

/**
 * Type is a bundle of properties:
 * and methods:
 * - `composeValue` returns string value based on suggestion.data
 * - `formatSelected` returns string to be inserted in textbox
 */

export type SuggestionsType<T> = {
  urlSuffix: string;
  /** Массив функций (с дополнительными данными, привязанными к контексту), которые находят подходящие подсказки для выбора. */
  matchers: any[];
  noSuggestionsHint?: string | false;
  /** Сопоставление полей `suggestion.data` с их отображаемыми именами. */
  fieldNames?: any;
  /** Массив строк, которые не следует выделять */
  unformattableTokens?: string[];
  /** Массив 'bound's можно установить как опцию `bounds`. Порядок важен. */
  dataComponents?: readonly DataComponents[];
  /** Запрещает скрывать выпадающий список после выбора */
  alwaysContinueSelecting?: boolean;
  /** Определяет местоположения клиента, чтобы передать его всем запросам */
  geoEnabled?: boolean;
  /** Делает отправку дополнительного запроса при выборе подсказки */
  enrichmentEnabled?: boolean;
  enrichmentMethod?: string;
  enrichmentParams?: any;
  getEnrichmentQuery?: (suggestion: Suggestion<T>) => string;
  /** Возвращает html для подсказки. Переопределяет метод по умолчанию */
  formatResult?: (value: string, currentValue: string, suggestion: Suggestion<T>, options: any) => string;
  /** Проверяет, можно ли использовать suggestion.data как полные данные своего типа. */
  isDataComplete?: (suggestion: Suggestion<T>) => boolean;
  /** Проверяет, подходит ли запрос для сервера */
  isQueryRequestable?: (query: string) => boolean;
};

const types = {
  NAME: NAME_TYPE,
  ADDRESS: ADDRESS_TYPE,
  PARTY: PARTY_TYPE,
  EMAIL: EMAIL_TYPE,
  BANK: BANK_TYPE,
  FMS: FMS_TYPE,
};

export const getType = (type: string) => {
  return Object.prototype.hasOwnProperty.call(types, type) ? types[type as keyof typeof types] : Outward(type);
};
