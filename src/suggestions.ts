import {
  buildCacheKey,
  generateId,
  highlightMatches,
  isPlainObject,
  makeSuggestionLabel,
  objectsEqual,
  serialize,
  trigger,
  withResolvers,
} from "./utils";
import { CLASSES, DATA_ATTR_KEY, KEYS } from "./constants";

import { ADDRESS_TYPE } from "./types/address";
import { NAME_TYPE } from "./types/name";
import { PARTY_TYPE } from "./types/party";
import { EMAIL_TYPE } from "./types/email";
import { BANK_TYPE } from "./types/bank";
import { FMS_TYPE } from "./types/fms";
import { Outward } from "./types/outward";
import type { Options, Suggestion, SuggestionAny, SuggestionMap } from "./types";

const types = {
  NAME: NAME_TYPE,
  ADDRESS: ADDRESS_TYPE,
  PARTY: PARTY_TYPE,
  EMAIL: EMAIL_TYPE,
  BANK: BANK_TYPE,
  FMS: FMS_TYPE,
};

export const DEFAULT_OPTIONS = {
  autoSelectFirst: false,
  containerClass: "suggestions-suggestions",
  count: 5,
  deferRequestBy: 100,
  enrichmentEnabled: true,
  formatResult: null,
  formatSelected: null,
  headers: null,
  hint: "Выберите вариант или продолжите ввод",
  initializeInterval: 100,
  language: null,
  minChars: 1,
  mobileWidth: 600,
  noCache: false,
  noSuggestionsHint: null,
  onInvalidateSelection: null,
  onSearchComplete: () => {},
  onSearchError: () => {},
  onSearchStart: () => {},
  onSelect: null,
  onSelectNothing: null,
  onSuggestionsFetch: null,
  paramName: "query",
  params: {},
  preventBadQueries: false,
  requestMode: "suggest",
  // основной url, может быть переопределен
  serviceUrl: "https://suggestions.dadata.ru/suggestions/api/4_1/rs",
  tabDisabled: false,
  timeout: 3000,
  triggerSelectOnBlur: true,
  triggerSelectOnEnter: true,
  triggerSelectOnSpace: false,
  type: null,
  // url, который заменяет serviceUrl + method + type
  // то есть, если он задан, то для всех запросов будет использоваться именно он
  url: null,
};

const serviceMethods = {
  suggest: { httpMethod: "POST", addTypeInUrl: true },
  "iplocate/address": { httpMethod: "GET", addTypeInUrl: false },
  status: { httpMethod: "GET", addTypeInUrl: true },
  findById: { httpMethod: "POST", addTypeInUrl: true },
};

export class HttpError extends Error {
  response: Response;

  constructor(response: Response) {
    super(`${response.status} ${response.statusText}`.trim());
    this.name = "HttpError";
    this.response = response;
  }
}

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * fetch wrapper this returns a Promise with `abort` method
 */
const fetchJson = (url: string, init: RequestInit, timeout: number) => {
  const controller = new AbortController();
  const timer =
    timeout > 0 ? setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeout) : undefined;

  const promise = fetch(url, { ...init, signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) {
        throw new HttpError(response);
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { data, response };
    })
    .finally(() => clearTimeout(timer));

  return Object.assign(promise, { abort: () => controller.abort() });
};

/**
 * Compares two suggestion objects
 * @param suggestion
 * @param instance other Suggestions instance
 */
const belongsToArea = (suggestion: any, instance: any) => {
  const parentSuggestion = instance.selection;
  let result = parentSuggestion && parentSuggestion.data && instance.bounds && instance.bounds.all && instance.bounds.all.length > 0;

  if (result) {
    for (const bound of instance.bounds.all) {
      if (parentSuggestion.data[bound] === suggestion.data[bound]) {
        result = true;
      } else {
        result = false;
        break;
      }
    }
  }
  return result;
};

const requestModes = {
  suggest: {
    method: "suggest",
    userSelect: true,
    updateValue: true,
    enrichmentEnabled: true,
  },
  findById: {
    method: "findById",
    userSelect: false,
    updateValue: false,
    enrichmentEnabled: false,
  },
};

let statusRequests = {} as Record<string, any>;

const fiasParamNames = [
  "country_iso_code",
  "region_iso_code",
  "region_fias_id",
  "area_fias_id",
  "city_fias_id",
  "city_district_fias_id",
  "settlement_fias_id",
  "planning_structure_fias_id",
  "street_fias_id",
];

/**
 * Возвращает КЛАДР-код, обрезанный до последнего непустого уровня
 * 50 000 040 000 00 → 50 000 040
 * @param {string} kladrId
 * @returns {string}
 */
const getSignificantKladrId = (kladrId: string) => {
  const significantKladrId = kladrId.replace(/^(\d{2})(\d*?)(0+)$/g, "$1$2");
  const length = significantKladrId.length;
  let significantLength = -1;
  if (length <= 2) {
    significantLength = 2;
  } else if (length > 2 && length <= 5) {
    significantLength = 5;
  } else if (length > 5 && length <= 8) {
    significantLength = 8;
  } else if (length > 8 && length <= 11) {
    significantLength = 11;
  } else if (length > 11 && length <= 15) {
    significantLength = 15;
  } else if (length > 15) {
    significantLength = 19;
  }
  return significantKladrId.padEnd(significantLength, "0");
};

/**
 * Пересечение массивов: ([1,2,3,4], [2,4,5,6]) => [2,4]
 * Исходные массивы не меняются.
 */
const intersect = (array1: any[], array2: any[]) => {
  const result = [] as any[];
  if (!Array.isArray(array1) || !Array.isArray(array2)) {
    return result;
  }
  return array1.filter((el) => array2.includes(el));
};

/**
 * @param {Object} data  fields
 * @param {Suggestions} instance
 * @constructor
 */
class ConstraintLocation {
  instance: any;
  fields: any;
  specificity: number;
  significantKladr?: string;

  constructor(data, instance) {
    const fiasFields = {};
    this.instance = instance;
    this.fields = {};
    this.specificity = -1;

    if (isPlainObject(data) && instance.type.dataComponents) {
      for (const [i, component] of instance.type.dataComponents.entries()) {
        const fieldName = component.id;
        if (component.forLocations && data[fieldName]) {
          this.fields[fieldName] = data[fieldName];
          this.specificity = i;
        }
      }
    }

    const fieldNames = Object.keys(this.fields);
    const fiasFieldNames = intersect(fieldNames, fiasParamNames);
    if (fiasFieldNames.length > 0) {
      for (const fieldName of fiasFieldNames) {
        fiasFields[fieldName] = this.fields[fieldName];
      }
      this.fields = fiasFields;
      this.specificity = this.getFiasSpecificity(fiasFieldNames);
    } else if (this.fields.kladr_id) {
      this.fields = { kladr_id: this.fields.kladr_id };
      this.significantKladr = getSignificantKladrId(this.fields.kladr_id);
      this.specificity = this.getKladrSpecificity(this.significantKladr);
    }
  }

  getLabel() {
    return this.instance.type.composeValue(this.fields, {
      saveCityDistrict: true,
    });
  }

  getFields() {
    return this.fields;
  }

  isValid() {
    return Object.keys(this.fields).length > 0;
  }

  /**
   * Возвращает specificity для КЛАДР
   * Описание ниже, в getFiasSpecificity
   * @param kladrId
   * @returns {number}
   */
  getKladrSpecificity(kladrId) {
    let specificity = -1;
    const kladrLength = kladrId.length;
    for (const [i, component] of this.instance.type.dataComponents.entries()) {
      if (component.kladrFormat && kladrLength === component.kladrFormat.digits) {
        specificity = i;
      }
    }
    return specificity;
  }

  /**
   * Возвращает особую величину specificity для ФИАС
   * Specificity это индекс для массива this.instance.type.dataComponents
   * до которого (включительно) обрежется этот массив при формировании строки адреса.
   * Этот параметр нужен для случаев, когда в настройках плагина restrict_value = true
   * Например, установлено ограничение (locations) по region_fias_id (Краснодарский край)
   * В выпадашке нажимаем на "г. Сочи"
   * Если restrict_value отключен, то выведется значение "Краснодарский край, г Сочи"
   * Если включен, то просто "г Сочи"
   *
   * @param fiasFieldNames
   * @returns {number}
   */
  getFiasSpecificity(fiasFieldNames) {
    let specificity = -1;
    for (const [i, component] of this.instance.type.dataComponents.entries()) {
      if (component.fiasType && fiasFieldNames.includes(component.fiasType) && specificity < i) {
        specificity = i;
      }
    }
    return specificity;
  }

  containsData(data) {
    let result = true;
    if (this.fields.kladr_id) {
      return !!data.kladr_id && data.kladr_id.startsWith(this.significantKladr);
    } else {
      for (const [fieldName, value] of Object.entries(this.fields)) {
        result = !!data[fieldName] && data[fieldName].toLowerCase() === (value as string).toLowerCase();
        if (!result) break;
      }
      return result;
    }
  }
}

/**
 * @param {Object} data
 * @param {Object|Array} data.locations
 * @param {string} [data.label]
 * @param {boolean} [data.deletable]
 * @param {Suggestions} [instance]
 * @constructor
 */
class Constraint {
  id: string;
  deletable: boolean;
  instance: any;
  locations: any[];
  label: string;

  constructor(data, instance) {
    this.id = generateId("c");
    this.deletable = !!data.deletable;
    this.instance = instance;
    const locationsData = data && (data.locations || data.restrictions);
    const locationsArray = Array.isArray(locationsData) ? locationsData : [locationsData];
    this.locations = locationsArray.map((data) => new ConstraintLocation(data, instance));
    this.locations = this.locations.filter((location) => location.isValid());
    this.label = data.label;
    if (this.label == null && instance.type.composeValue) {
      this.label = this.locations.map((location) => location.getLabel()).join(", ");
    }
  }

  isValid() {
    return this.locations.length > 0;
  }

  getFields() {
    return this.locations.map((location) => location.getFields());
  }
}

class Suggestions<T extends keyof SuggestionMap = keyof SuggestionMap> {
  public element: HTMLInputElement;
  public suggestions: Suggestion<SuggestionAny>[];
  public badQueries: string[];
  public selectedIndex: number;
  public currentValue: string;
  public cachedResponse: Record<string, any>;
  public enrichmentCache: Record<string, any>;
  public abortController: AbortController;
  public parentAbortController: AbortController | null;
  public fetchPhase: any;
  public onChangeTimeout: number | null;
  public triggering: Record<string, any>;
  public wrapper: HTMLElement | null;
  public options: any;
  public classes: typeof CLASSES;
  public selection: any;
  public type: any;
  public status: Record<string, any>;
  public currentRequest: any;
  public geoLocation: any;
  public bounds: any;
  public constraints: any;
  public container: HTMLElement | null;
  public cancelFocus: boolean;
  public visible: boolean;
  public dropdownDisabled: boolean;
  public requestMode: any;

  constructor(el: HTMLInputElement, options: Options<T>) {
    // Shared variables:
    this.element = el;
    this.suggestions = [];
    this.badQueries = [];
    this.selectedIndex = -1;
    this.currentValue = this.element.value;
    this.cachedResponse = {};
    this.enrichmentCache = {};
    this.abortController = new AbortController();
    this.parentAbortController = null;
    this.fetchPhase = new Promise(() => {});
    this.onChangeTimeout = null;
    this.triggering = {};
    this.wrapper = null;
    this.container = null;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.classes = CLASSES;
    this.selection = null;
    this.type = null;
    this.status = {};
    this.currentRequest = null;
    this.cancelFocus = false;
    this.visible = false;
    this.dropdownDisabled = false;
    this.requestMode = null;

    // if it stops working, see https://stackoverflow.com/q/15738259
    // chrome is constantly changing this logic
    this.element.setAttribute("autocomplete", "new-password");
    this.element.setAttribute("autocorrect", "off");
    this.element.setAttribute("autocapitalize", "off");
    this.element.setAttribute("spellcheck", "false");
    this.element.classList.add("suggestions-input");
    this.element.style.boxSizing = "border-box";

    (this.element as any)[DATA_ATTR_KEY] = this;
    this.createWrapper();
    this.bindElementEvents();
    this.createContainer();
    this.createConstraints();
    this.setupBounds();
    this.setOptions(undefined);
    this.showContainer();
  }

  dispose() {
    this.unbindElementEvents();
    this.removeContainer();
    this.unbindFromParent();
    delete (this.element as any)[DATA_ATTR_KEY];
    this.element.classList.remove("suggestions-input");
    this.removeWrapper();
    trigger(this.element, "suggestions-dispose");
  }

  createWrapper() {
    const template = document.createElement("template");
    template.innerHTML = '<div class="suggestions-wrapper"/>';

    this.wrapper = template.content.firstChild as HTMLElement;
    this.element.parentNode?.insertBefore(this.wrapper, this.element.nextSibling);

    this.wrapper.addEventListener("mousedown", (e) => e.preventDefault());
  }

  removeWrapper() {
    if (this.wrapper) {
      this.wrapper.remove();
    }
  }

  // Configuration methods

  setOptions(suppliedOptions) {
    if (suppliedOptions) {
      Object.assign(this.options, suppliedOptions);
    }

    this.type = Object.hasOwn(types, this.options.type) ? types[this.options.type as keyof typeof types] : Outward(this.options.type);

    // Check mandatory options
    this.requestMode = requestModes[this.options.requestMode as keyof typeof requestModes];
    if (!this.requestMode) {
      throw new Error(
        `\`requestMode\` option is incorrect! Must be one of: ${Object.keys(requestModes)
          .map((name) => `"${name}"`)
          .join(", ")}`,
      );
    }

    this.checkStatus();
    checkLocation(this);
    this.setupConstraints();
    this.setBoundsOptions();
  }

  // Common public methods

  clearCache() {
    this.cachedResponse = {};
    this.enrichmentCache = {};
    this.badQueries = [];
  }

  clear() {
    const currentSelection = this.selection;

    this.clearCache();
    this.currentValue = "";
    this.selection = null;
    this.hide();
    this.suggestions = [];
    this.element.value = "";
    trigger(this.element, "suggestions-clear");
    this.trigger("InvalidateSelection", currentSelection);
  }

  update() {
    const query = this.element.value;

    this.currentValue = query;
    if (this.isQueryRequestable(query)) {
      this.updateSuggestions(query);
    } else {
      this.hide();
    }
  }

  setSuggestion(suggestion) {
    let data;
    let value;

    if (isPlainObject(suggestion) && isPlainObject(suggestion.data)) {
      suggestion = structuredClone(suggestion);

      if (this.bounds.own.length > 0) {
        this.checkValueBounds(suggestion);
        data = this.copyDataComponents(suggestion.data, this.bounds.all);
        if (suggestion.data.kladr_id) {
          data.kladr_id = this.getBoundedKladrId(suggestion.data.kladr_id, this.bounds.all);
        }
        suggestion.data = data;
      }

      this.selection = suggestion;

      // `this.suggestions` required by `this.getSuggestionValue` and must be set before
      this.suggestions = [suggestion];
      value = this.getSuggestionValue(suggestion) || "";
      this.currentValue = value;
      this.element.value = value;
      this.abortRequest();
      trigger(this.element, "suggestions-set");
    }
  }

  /**
   * Fetch full object for current INPUT's value
   * if no suitable object found, clean input element
   */
  fixData() {
    const fullQuery = this.extendedCurrentValue();
    const currentValue = this.element.value;
    const resolver = withResolvers<any>();

    resolver.promise.then(
      (suggestion) => {
        this.selectSuggestion(suggestion, 0, currentValue, {
          hasBeenEnriched: true,
        });
        if (!this.currentValue) {
          this.element.value = currentValue;
        }
        trigger(this.element, "suggestions-fixdata", [suggestion]);
      },
      () => {
        this.selection = null;
        trigger(this.element, "suggestions-fixdata");
      },
    );

    if (this.isQueryRequestable(fullQuery)) {
      this.currentValue = fullQuery;
      this.getSuggestions(fullQuery, {
        count: 1,
        from_bound: null,
        to_bound: null,
      }).then(
        (suggestions) => {
          // data fetched
          const suggestion = suggestions[0];
          if (suggestion) {
            resolver.resolve(suggestion);
          } else {
            resolver.reject();
          }
        },
        () => {
          // no data fetched
          resolver.reject();
        },
      );
    } else {
      resolver.reject();
    }
  }

  // Querying related methods

  /**
   * Looks up parent instances
   * @returns {String} current value prepended by parents' values
   */
  extendedCurrentValue() {
    const parentInstance = this.getParentInstance();
    const parentValue = parentInstance ? parentInstance.extendedCurrentValue() : "";
    const currentValue = this.element.value.trim();

    return [parentValue, currentValue].filter((e) => !!e).join(" ");
  }

  request(method: keyof typeof serviceMethods, params?: object) {
    const token = typeof this.options.token === "string" ? this.options.token.trim() : "";
    const partner = typeof this.options.partner === "string" ? this.options.partner.trim() : "";
    const { httpMethod, addTypeInUrl } = serviceMethods[method];
    let url = this.options.url;

    if (!url) {
      url = this.options.serviceUrl;
      if (!/\/$/.test(url)) {
        url += "/";
      }
      url += method;
      if (addTypeInUrl) {
        url += `/${this.type.urlSuffix}`;
      }
    }

    const headers: Record<string, string> = httpMethod === "POST" ? { "Content-Type": "application/json" } : {};
    Object.assign(headers, this.options.headers);
    if (token) {
      headers.Authorization = `Token ${token}`;
    }
    if (partner) {
      headers["X-Partner"] = partner;
    }

    return fetchJson(
      url,
      {
        method: httpMethod,
        headers,
        body: params && serialize(params),
        // server sets Access-Control-Allow-Origin: *
        // which requires no credentials
        credentials: "omit",
      },
      this.options.timeout,
    );
  }

  isQueryRequestable(query) {
    let result = query.length >= this.options.minChars;

    if (result && this.type.isQueryRequestable) {
      result = this.type.isQueryRequestable.call(this, query);
    }

    return result;
  }

  constructRequestParams(query, customParams) {
    const options = this.options;
    const params = typeof options.params === "function" ? options.params.call(this.element, query) : { ...options.params };

    Object.assign(params, constructParams(this), this.constructConstraintsParams(), this.constructBoundsParams());
    params[options.paramName] = query;
    if (!Number.isNaN(Number.parseFloat(options.count)) && Number.isFinite(options.count) && options.count > 0) {
      params.count = options.count;
    }
    if (options.language) {
      params.language = options.language;
    }

    return Object.assign(params, customParams);
  }

  updateSuggestions(query) {
    this.fetchPhase = this.getSuggestions(query);
    this.fetchPhase.then(
      (suggestions) => {
        this.assignSuggestions(suggestions, query);
      },
      () => {},
    );
  }

  /**
   * Get suggestions from cache or from server
   * @param {String} query
   * @param {Object} customParams parameters specified here will be passed to request body
   * @param {Object} requestOptions
   * @param {Boolean} [requestOptions.noCallbacks]  flag, request competence callbacks will not be invoked
   * @param {Boolean} [requestOptions.useEnrichmentCache]
   * @return {} waiter which is to be resolved with suggestions as argument
   */
  getSuggestions(query: string, customParams?: object, requestOptions?: object) {
    const options = this.options;
    const noCallbacks = requestOptions && requestOptions.noCallbacks;
    const useEnrichmentCache = requestOptions && requestOptions.useEnrichmentCache;
    const method = (requestOptions && requestOptions.method) || this.requestMode.method;
    const params = this.constructRequestParams(query, customParams);
    const cacheKey = buildCacheKey(params);
    const resolver = withResolvers<any>();

    const response = this.cachedResponse[cacheKey];
    if (response && Array.isArray(response.suggestions)) {
      resolver.resolve(response.suggestions);
    } else if (this.isBadQuery(query)) {
      resolver.reject();
    } else if (!noCallbacks && options.onSearchStart.call(this.element, params) === false) {
      resolver.reject();
    } else {
      this.doGetSuggestions(params, method).then(
        ({ data: response }) => {
          // if response is correct and current value has not been changed
          if (this.processResponse(response) && query == this.currentValue) {
            // Cache results if cache is not disabled:
            if (!options.noCache) {
              if (useEnrichmentCache) {
                this.enrichmentCache[query] = response.suggestions[0];
              } else {
                this.enrichResponse(response, query);
                this.cachedResponse[cacheKey] = response;
                if (options.preventBadQueries && response.suggestions.length === 0) {
                  this.badQueries.push(query);
                }
              }
            }

            resolver.resolve(response.suggestions);
          } else {
            resolver.reject();
          }
          if (!noCallbacks) {
            options.onSearchComplete.call(this.element, query, response?.suggestions);
          }
        },
        (error) => {
          resolver.reject();
          if (!noCallbacks && !isAbortError(error)) {
            options.onSearchError.call(this.element, query, error);
          }
        },
      );
    }
    return resolver.promise;
  }

  doGetSuggestions(params: object, method: string) {
    const request = this.request(method, params);

    this.abortRequest();
    this.currentRequest = request;

    const onComplete = () => {
      if (this.currentRequest === request) {
        this.currentRequest = null;
      }
    };
    request.then(onComplete, onComplete);

    return request;
  }

  isBadQuery(q) {
    if (!this.options.preventBadQueries) {
      return false;
    }

    for (const query of this.badQueries) {
      if (q.startsWith(query)) {
        return true;
      }
    }
    return false;
  }

  abortRequest() {
    if (this.currentRequest) {
      this.currentRequest.abort();
    }
  }

  /**
   * Checks response format and data
   * @return {Boolean} response contains acceptable data
   */
  processResponse(response) {
    let suggestions;

    if (!response || !Array.isArray(response.suggestions)) {
      return false;
    }

    this.verifySuggestionsFormat(response.suggestions);
    this.setUnrestrictedValues(response.suggestions);

    if (typeof this.options.onSuggestionsFetch === "function") {
      suggestions = this.options.onSuggestionsFetch.call(this.element, response.suggestions);
      if (Array.isArray(suggestions)) {
        response.suggestions = suggestions;
      }
    }

    return true;
  }

  verifySuggestionsFormat(suggestions) {
    if (typeof suggestions[0] === "string") {
      for (let i = 0; i < suggestions.length; i++) {
        suggestions[i] = { value: suggestions[i], data: null };
      }
    }
  }

  /**
   * Gets string to set as input value
   *
   * @param suggestion
   * @param {Object} [selectionOptions]
   * @param {boolean} selectionOptions.hasBeenEnriched
   * @param {boolean} selectionOptions.hasSameValues
   * @return {string}
   */
  getSuggestionValue(suggestion, selectionOptions) {
    const formatSelected = this.options.formatSelected || this.type.formatSelected;
    const hasSameValues = selectionOptions && selectionOptions.hasSameValues;
    const hasBeenEnriched = selectionOptions && selectionOptions.hasBeenEnriched;
    let formattedValue;
    let typeFormattedValue = null;

    if (typeof formatSelected === "function") {
      formattedValue = formatSelected.call(this, suggestion);
    }

    if (typeof formattedValue !== "string") {
      formattedValue = suggestion.value;

      if (this.type.getSuggestionValue) {
        typeFormattedValue = this.type.getSuggestionValue(this, {
          suggestion,
          hasSameValues,
          hasBeenEnriched,
        });

        if (typeFormattedValue !== null) {
          formattedValue = typeFormattedValue;
        }
      }
    }

    return formattedValue;
  }

  hasSameValues(suggestion) {
    for (const anotherSuggestion of this.suggestions) {
      if (anotherSuggestion.value === suggestion.value && anotherSuggestion !== suggestion) {
        return true;
      }
    }
    return false;
  }

  assignSuggestions(suggestions, query) {
    this.suggestions = suggestions;
    this.suggest();
    this.selectFoundSuggestion();
  }

  shouldRestrictValues() {
    // treat suggestions value as restricted only if there is one constraint
    // and restrict_value is true
    return this.options.restrict_value && this.constraints && Object.keys(this.constraints).length === 1;
  }

  /**
   * Fills suggestion.unrestricted_value property
   */
  setUnrestrictedValues(suggestions) {
    const shouldRestrict = this.shouldRestrictValues();
    const label = this.getFirstConstraintLabel();

    for (const suggestion of suggestions) {
      if (!suggestion.unrestricted_value) {
        suggestion.unrestricted_value = shouldRestrict ? `${label}, ${suggestion.value}` : suggestion.value;
      }
    }
  }

  areSuggestionsSame(a, b) {
    return a && b && a.value === b.value && objectsEqual(a.data, b.data);
  }

  getNoSuggestionsHint() {
    if (this.options.noSuggestionsHint === false) {
      return false;
    }
    return this.options.noSuggestionsHint || this.type.noSuggestionsHint;
  }

  enrichSuggestion(this: Suggestions, suggestion, selectionOptions) {
    if (
      !this.options.enrichmentEnabled ||
      !this.type.enrichmentEnabled ||
      !this.requestMode.enrichmentEnabled ||
      (selectionOptions && selectionOptions.dontEnrich)
    ) {
      return Promise.resolve([suggestion]);
    }

    // if current suggestion is already enriched, use it
    if (suggestion.data && suggestion.data.qc != null) {
      return Promise.resolve([suggestion]);
    }

    const resolver = withResolvers<[any, boolean?]>();
    this.disableDropdown();

    const query = this.type.getEnrichmentQuery(suggestion);
    const customParams = this.type.enrichmentParams;
    const requestOptions = {
      noCallbacks: true,
      useEnrichmentCache: true,
      method: this.type.enrichmentMethod,
    };

    // Set `currentValue` to make `processResponse` to consider enrichment response valid
    this.currentValue = query;

    this.getSuggestions(query, customParams, requestOptions)
      .finally(() => {
        this.enableDropdown();
      })
      .then(
        (suggestions) => {
          const enrichedSuggestion = suggestions && suggestions[0];

          resolver.resolve([enrichedSuggestion || suggestion, !!enrichedSuggestion]);
        },
        () => {
          resolver.resolve([suggestion]);
        },
      );

    return resolver.promise;
  }

  /**
   * Injects enriched suggestion into response
   */
  enrichResponse(response, query) {
    const enrichedSuggestion = this.enrichmentCache[query];

    if (enrichedSuggestion) {
      for (const [i, suggestion] of response.suggestions.entries()) {
        if (suggestion.value === query) {
          response.suggestions[i] = enrichedSuggestion;
          continue;
        }
      }
    }
  }

  checkStatus(this: Suggestions) {
    const token = (this.options.token && this.options.token.trim()) || "";
    const requestKey = this.options.type + token;
    let request = statusRequests[requestKey];

    if (!request) {
      request = statusRequests[requestKey] = this.request("status");
    }

    type Status = {
      count: number;
      name: "address" | "fio";
      plan: string;
      resources: { name: string; version: string }[];
      search: boolean;
      state: "ENABLED";
      version: string;
    };

    const triggerError = (error: unknown) => {
      // If unauthorized
      if (typeof this.options.onSearchError === "function") {
        this.options.onSearchError.call(this.element, null, error);
      }
    };

    request.then(
      ({ data: status, response }) => {
        if (status?.search) {
          const plan = response.headers.get("X-Plan");
          status.plan = plan;
          Object.assign(this.status, status);
        } else {
          triggerError(new Error("Service Unavailable"));
        }
      },
      (error) => {
        triggerError(error);
      },
    );
  }

  setupBounds(this: Suggestions) {
    this.bounds = {
      from: null,
      to: null,
    };
  }

  setBoundsOptions(this: Suggestions) {
    const newBounds = (this.options.bounds || "").trim().split("-");
    let boundFrom = newBounds[0];
    let boundTo = newBounds.at(-1);
    const boundsOwn = [];
    let boundIsOwn;
    const boundsAll = [];

    const boundsAvailable = this.type.dataComponents
      ? this.type.dataComponents.filter((item) => item.forBounds).map((item) => item.id)
      : [];

    if (!boundsAvailable.includes(boundFrom)) {
      boundFrom = undefined;
    }

    if (!boundsAvailable.includes(boundTo)) {
      boundTo = undefined;
    }

    if (boundFrom || boundTo) {
      boundIsOwn = !boundFrom;
      for (const bound of boundsAvailable) {
        if (bound === boundFrom) boundIsOwn = true;
        boundsAll.push(bound);
        if (boundIsOwn) boundsOwn.push(bound);
        if (bound === boundTo) break;
      }
    }

    this.bounds.from = boundFrom;
    this.bounds.to = boundTo;
    this.bounds.all = boundsAll;
    this.bounds.own = boundsOwn;
  }

  constructBoundsParams(this: Suggestions) {
    const params = {};

    if (this.bounds.from) {
      params.from_bound = { value: this.bounds.from };
    }
    if (this.bounds.to) {
      params.to_bound = { value: this.bounds.to };
    }

    return params;
  }

  /**
   * Подстраивает suggestion.value под this.bounds.own
   * Ничего не возвращает, меняет в самом suggestion
   * @param suggestion
   */
  checkValueBounds(this: Suggestions, suggestion: Suggestion<SuggestionAny>) {
    let valueData;

    // If any bounds set up
    if (this.bounds.own.length > 0 && this.type.composeValue) {
      // делаем копию
      const bounds = [...this.bounds.own];
      // если роль текущего инстанса плагина показывать только район города
      // то для корректного формировния нужен city_district_fias_id
      if (bounds.length === 1 && bounds[0] === "city_district") {
        bounds.push("city_district_fias_id");
      }
      valueData = this.copyDataComponents(suggestion.data, bounds);
      suggestion.value = this.type.composeValue(valueData);
    }
  }

  copyDataComponents(this: Suggestions, data, components) {
    const result = {};
    const dataComponentsById = this.type.dataComponentsById;

    if (dataComponentsById) {
      for (const component of components) {
        for (const field of dataComponentsById[component].fields) {
          if (data[field] != null) {
            result[field] = data[field];
          }
        }
      }
    }

    return result;
  }

  getBoundedKladrId(this: Suggestions, kladrId, boundsRange) {
    const boundTo = boundsRange.at(-1);
    let kladrFormat;

    for (const component of this.type!.dataComponents!) {
      if (component.id === boundTo) {
        kladrFormat = component.kladrFormat;
        break;
      }
    }

    return kladrId.slice(0, Math.max(0, kladrFormat.digits)) + "0".repeat(kladrFormat.zeros || 0);
  }

  bindElementEvents() {
    const { signal } = this.abortController;
    this.element.addEventListener("keydown", (e) => this.onElementKeyDown(e), { signal });
    this.element.addEventListener("keyup", (e) => this.onElementKeyUp(e), { signal });
    this.element.addEventListener("input", (e) => this.onElementKeyUp(e as KeyboardEvent), { signal });
    this.element.addEventListener("blur", () => this.onElementBlur(), { signal });
    this.element.addEventListener("focus", () => this.onElementFocus(), { signal });
  }

  unbindElementEvents() {
    this.abortController.abort();
  }

  onElementBlur() {
    // dropdown is disabled while selected suggestion is being enriched,
    // selecting again would abort the enrichment
    if (this.options.triggerSelectOnBlur && !this.dropdownDisabled) {
      this.selectCurrentValue({ noSpace: true })
        .catch(() => {})
        .finally(() => {
          // For NAMEs selecting keeps suggestions list visible, so hide it
          this.hide();
        });
    } else {
      this.hide();
    }
  }

  onElementFocus() {
    if (!this.cancelFocus) {
      // defer methods to allow browser update input's style before
      setTimeout(() => {
        this.completeOnFocus();
      }, 0);
    }
    this.cancelFocus = false;
  }

  onElementKeyDown(e: KeyboardEvent) {
    if (!this.visible) {
      switch (e.key) {
        // If suggestions are hidden and user presses arrow down, display suggestions
        case KEYS.DOWN: {
          this.suggest();
          break;
        }
        // if no suggestions available and user pressed Enter
        case KEYS.ENTER: {
          if (this.options.triggerSelectOnEnter) {
            this.triggerOnSelectNothing();
          }
          break;
        }
      }
      return;
    }

    switch (e.key) {
      case KEYS.ESC: {
        this.element.value = this.currentValue;
        this.hide();
        this.abortRequest();
        break;
      }

      case KEYS.TAB: {
        if (this.options.tabDisabled === false) {
          return;
        }
        break;
      }

      case KEYS.ENTER: {
        if (this.options.triggerSelectOnEnter) {
          this.selectCurrentValue().catch(() => {});
        }
        break;
      }

      case KEYS.SPACE: {
        if (this.options.triggerSelectOnSpace && this.isCursorAtEnd()) {
          e.preventDefault();
          this.selectCurrentValue({
            continueSelecting: true,
            dontEnrich: true,
          }).catch(() => {
            // If all data fetched but nothing selected
            this.currentValue += " ";
            this.element.value = this.currentValue;
            this.proceedChangedValue();
          });
        }
        return;
      }
      case KEYS.UP: {
        this.moveUp();
        break;
      }
      case KEYS.DOWN: {
        this.moveDown();
        break;
      }
      default: {
        return;
      }
    }

    // Cancel event if function did not return:
    e.stopImmediatePropagation();
    e.preventDefault();
  }

  onElementKeyUp(e: KeyboardEvent) {
    switch (e.key) {
      case KEYS.UP:
      case KEYS.DOWN:
      case KEYS.ENTER: {
        return;
      }
    }

    // Cancel pending change
    if (this.onChangeTimeout) clearTimeout(this.onChangeTimeout);
    this.onChangeTimeout = null;

    if (this.currentValue !== this.element.value) {
      this.proceedChangedValue();
    }
  }

  proceedChangedValue() {
    // Cancel fetching, because it became obsolete
    this.abortRequest();

    if (this.options.deferRequestBy > 0) {
      // Defer lookup in case when value changes very quickly:
      this.onChangeTimeout = setTimeout(() => {
        this.onChangeTimeout = null;
        this.onValueChange();
      }, this.options.deferRequestBy);
    } else {
      this.onValueChange();
    }
  }

  onValueChange() {
    let currentSelection;

    if (this.selection) {
      currentSelection = this.selection;
      this.selection = null;
      this.trigger("InvalidateSelection", currentSelection);
    }

    this.selectedIndex = -1;

    this.update();
  }

  completeOnFocus() {
    if (document.activeElement === this.element) {
      this.update();
      if (globalThis.innerWidth <= this.options.mobileWidth) {
        this.setCursorAtEnd();
      }
    }
  }

  isCursorAtEnd() {
    const valLength = this.element.value.length;

    // `selectionStart` and `selectionEnd` are not supported by some input types
    try {
      const selectionStart = this.element.selectionStart;
      if (typeof selectionStart === "number") {
        return selectionStart === valLength;
      }
    } catch {}

    return true;
  }

  setCursorAtEnd() {
    const element = this.element;

    // `selectionStart` and `selectionEnd` are not supported by some input types
    try {
      element.selectionEnd = element.selectionStart = element.value.length;
      element.scrollLeft = element.scrollWidth;
    } catch {
      // eslint-disable-next-line no-self-assign
      element.value = element.value;
    }
  }

  /**
   * Selects current or first matched suggestion, but firstly waits for data ready
   * @param selectionOptions
   * @returns {} promise, resolved with index of selected suggestion or rejected if nothing matched
   */
  selectCurrentValue(selectionOptions) {
    const result = withResolvers<number>();

    // force onValueChange to be executed if it has been deferred
    if (this.onChangeTimeout) {
      clearTimeout(this.onChangeTimeout);
      this.onChangeTimeout = null;
      this.onValueChange();
    }

    this.fetchPhase.then(
      () => {
        let index;

        // When suggestion has already been selected and not modified
        if (this.selection && !this.visible) {
          result.reject();
        } else {
          index = this.findSuggestionIndex();

          this.select(index, selectionOptions);

          if (index === -1) {
            result.reject();
          } else {
            result.resolve(index);
          }
        }
      },
      () => {
        result.reject();
      },
    );

    return result.promise;
  }

  /**
   * Selects first when user interaction is not supposed
   */
  selectFoundSuggestion() {
    if (!this.requestMode.userSelect) {
      this.select(0, {});
    }
  }

  /**
   * Selects current or first matched suggestion
   * @returns {number} index of found suggestion
   */
  findSuggestionIndex() {
    let index = this.selectedIndex;

    if (index === -1) {
      // matchers always operate with trimmed strings
      const value = this.element.value.trim();
      if (value) {
        this.type.matchers.some((matcher) => {
          index = matcher(value, this.suggestions);
          return index !== -1;
        });
      }
    }

    return index;
  }

  /**
   * Selects a suggestion at specified index
   * @param index index of suggestion to select. Can be -1
   * @param {Object} selectionOptions
   * @param {boolean} [selectionOptions.continueSelecting]  prevents hiding after selection
   * @param {boolean} [selectionOptions.noSpace]  prevents adding space at the end of current value
   */
  select(index, selectionOptions) {
    const suggestion = this.suggestions[index];
    const continueSelecting = selectionOptions && selectionOptions.continueSelecting;
    const currentValue = this.currentValue;

    // Prevent recursive execution
    if (this.triggering.Select) return;

    // if no suggestion to select
    if (!suggestion) {
      if (!continueSelecting && !this.selection) {
        this.triggerOnSelectNothing();
      }
      this.onSelectComplete(continueSelecting);
      return;
    }

    const hasSameValues = this.hasSameValues(suggestion);

    return this.enrichSuggestion(suggestion, selectionOptions).then(([enrichedSuggestion, hasBeenEnriched]) => {
      const newSelectionOptions = { hasBeenEnriched, hasSameValues, ...selectionOptions };
      this.selectSuggestion(enrichedSuggestion, index, currentValue, newSelectionOptions);
    });
  }

  /**
   * Formats and selects final (enriched) suggestion
   * @param suggestion
   * @param index
   * @param lastValue
   * @param {Object} selectionOptions
   * @param {boolean} [selectionOptions.continueSelecting]  prevents hiding after selection
   * @param {boolean} [selectionOptions.noSpace]  prevents adding space at the end of current value
   * @param {boolean} selectionOptions.hasBeenEnriched
   * @param {boolean} selectionOptions.hasSameValues
   */
  selectSuggestion(suggestion, index, lastValue, selectionOptions) {
    let continueSelecting = selectionOptions.continueSelecting;
    const assumeDataComplete = !this.type.isDataComplete || this.type.isDataComplete.call(this, suggestion);
    const currentSelection = this.selection;

    // Prevent recursive execution
    if (this.triggering.Select) return;

    if (assumeDataComplete) {
      continueSelecting = false;
    }

    // `suggestions` cat be empty, e.g. during `fixData`
    if (selectionOptions.hasBeenEnriched && this.suggestions[index]) {
      this.suggestions[index].data = suggestion.data;
    }

    if (this.requestMode.updateValue) {
      this.checkValueBounds(suggestion);
      this.currentValue = this.getSuggestionValue(suggestion, selectionOptions);

      if (this.currentValue && !selectionOptions.noSpace && !assumeDataComplete) {
        this.currentValue += " ";
      }
      this.element.value = this.currentValue;
    }

    if (this.currentValue) {
      this.selection = suggestion;
      if (!this.areSuggestionsSame(suggestion, currentSelection)) {
        this.trigger("Select", suggestion, this.currentValue !== lastValue);
      }
      if (this.requestMode.userSelect) {
        this.onSelectComplete(continueSelecting);
      }
    } else {
      this.selection = null;
      this.triggerOnSelectNothing();
    }

    this.shareWithParent(suggestion);
  }

  onSelectComplete(continueSelecting: boolean) {
    if (continueSelecting) {
      this.selectedIndex = -1;
      this.updateSuggestions(this.currentValue);
    } else {
      this.hide();
    }
  }

  triggerOnSelectNothing() {
    if (!this.triggering.SelectNothing) {
      this.trigger("SelectNothing", this.currentValue);
    }
  }

  trigger(event: string, ...args: any[]) {
    const callback = this.options[`on${event}`];

    this.triggering[event] = true;
    if (typeof callback === "function") {
      callback.apply(this.element, args);
    }

    trigger(this.element, `suggestions-${event.toLowerCase()}`, args);
    this.triggering[event] = false;
  }

  createContainer() {
    const container = document.createElement("div");
    container.classList.add("suggestions-suggestions");
    container.style.display = "none";

    this.container = container;

    // keep focus in the input when the container is floating outside of the wrapper
    container.addEventListener("mousedown", (e) => e.preventDefault());
    container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".suggestions-suggestion")) {
        this.onSuggestionClick(e);
      }
    });
  }

  showContainer() {
    const parent = this.options.floating ? document.body : this.wrapper;
    if (this.container && parent) {
      parent.append(this.container);
    }
  }

  removeContainer() {
    if (this.options.floating && this.container) {
      this.container.remove();
    }
  }

  /**
   * Listen for click event on suggestions list:
   */
  onSuggestionClick(e) {
    let el = e.target as HTMLElement | null;
    let index: string | null = null;

    if (!this.dropdownDisabled) {
      this.cancelFocus = true;
      this.element.focus();

      // eslint-disable-next-line no-cond-assign
      while (el && !(index = el.dataset.index)) {
        el = el.closest(`.${this.classes.suggestion}`);
      }

      if (index && !Number.isNaN(+index)) {
        this.select(+index, {});
      }
    }
  }

  // Dropdown UI methods

  getSuggestionsItems() {
    if (!this.container) return [];
    return [...this.container.querySelectorAll(`.${this.classes.suggestion}`)] as HTMLElement[];
  }

  toggleDropdownEnabling(enable) {
    this.dropdownDisabled = !enable;
    if (this.container) {
      if (enable) {
        this.container.removeAttribute("disabled");
      } else {
        this.container.setAttribute("disabled", "true");
      }
    }
  }

  disableDropdown() {
    this.toggleDropdownEnabling(false);
  }

  enableDropdown() {
    this.toggleDropdownEnabling(true);
  }

  /**
   * Shows if there are any suggestions besides currently selected
   * @returns {boolean}
   */
  hasSuggestionsToChoose() {
    return (
      this.suggestions.length > 1 ||
      (this.suggestions.length === 1 && (!this.selection || this.suggestions[0].value.trim() !== this.selection.value.trim()))
    );
  }

  suggest() {
    const options = this.options;
    const html = [];

    if (!this.requestMode.userSelect) {
      return;
    }

    // если нечего показывать, то сообщаем об этом
    if (this.hasSuggestionsToChoose()) {
      // Build hint html
      if (options.hint && this.suggestions.length > 0) {
        html.push(`<div class="${this.classes.hint}">${options.hint}</div>`);
      }
      this.selectedIndex = -1;
      // Build suggestions inner HTML:
      for (const [i, suggestion] of this.suggestions.entries()) {
        if (suggestion == this.selection) {
          this.selectedIndex = i;
        }
        this.buildSuggestionHtml(suggestion, i, html);
      }
    } else if (this.suggestions.length > 0) {
      this.hide();
      return;
    } else {
      const noSuggestionsHint = this.getNoSuggestionsHint();
      if (noSuggestionsHint) {
        html.push(`<div class="${this.classes.hint}">${noSuggestionsHint}</div>`);
      } else {
        this.hide();
        return;
      }
    }

    this.container!.innerHTML = html.join("");

    // Select first value by default:
    if (options.autoSelectFirst && this.selectedIndex === -1) {
      this.selectedIndex = 0;
    }
    if (this.selectedIndex !== -1) {
      const items = this.getSuggestionsItems();
      const selectedItem = items[this.selectedIndex];
      if (selectedItem) {
        selectedItem.classList.add(this.classes.selected);
      }
    }

    if (typeof options.beforeRender === "function") {
      options.beforeRender.call(this.element, this.container);
    }

    if (this.container) {
      this.container.style.display = "";
    }
    this.visible = true;
  }

  buildSuggestionHtml(suggestion, ordinal, html) {
    html.push(`<div class="${this.classes.suggestion}" data-index="${ordinal}">`);

    const formatResult = this.options.formatResult || this.type.formatResult || this.formatResult;
    html.push(
      formatResult.call(this, suggestion.value, this.currentValue, suggestion, {
        unformattableTokens: this.type.unformattableTokens,
      }),
    );

    const labels = makeSuggestionLabel(this.suggestions, suggestion, this.type.fieldNames);
    if (labels) {
      html.push(`<span class="${this.classes.subtext_label}">${labels}</span>`);
    }

    html.push("</div>");
  }

  wrapFormattedValue(value, suggestion) {
    const status = suggestion.data?.state?.status;

    return `<span class="${this.classes.value}"${status ? ` data-suggestion-status="${status}"` : ""}>${value}</span>`;
  }

  formatResult(value, currentValue, suggestion, options) {
    value = highlightMatches(value, currentValue, options);

    return this.wrapFormattedValue(value, suggestion);
  }

  hide() {
    this.visible = false;
    this.selectedIndex = -1;
    if (this.container) {
      this.container.style.display = "none";
      this.container.innerHTML = "";
    }
  }

  activate(index) {
    const selected = this.classes.selected;

    if (!this.dropdownDisabled) {
      const children = this.getSuggestionsItems();

      for (const child of children) {
        child.classList.remove(selected);
      }

      this.selectedIndex = index;

      if (this.selectedIndex !== -1 && children.length > this.selectedIndex) {
        const activeItem = children[this.selectedIndex];
        if (activeItem) {
          activeItem.classList.add(selected);
          return activeItem;
        }
      }
    }

    return null;
  }

  deactivate(restoreValue) {
    if (!this.dropdownDisabled) {
      this.selectedIndex = -1;
      for (const item of this.getSuggestionsItems()) {
        item.classList.remove(this.classes.selected);
      }
      if (restoreValue) {
        this.element.value = this.currentValue;
      }
    }
  }

  moveUp() {
    if (this.dropdownDisabled) {
      return;
    }
    if (this.selectedIndex === -1) {
      if (this.suggestions.length > 0) {
        this.adjustScroll(this.suggestions.length - 1);
      }
      return;
    }

    if (this.selectedIndex === 0) {
      this.deactivate(true);
      return;
    }

    this.adjustScroll(this.selectedIndex - 1);
  }

  moveDown() {
    if (this.dropdownDisabled) {
      return;
    }
    if (this.selectedIndex === this.suggestions.length - 1) {
      this.deactivate(true);
      return;
    }

    this.adjustScroll(this.selectedIndex + 1);
  }

  adjustScroll(index) {
    const activeItem = this.activate(index);

    if (!activeItem || !this.container) {
      return;
    }

    const scrollTop = this.container.scrollTop;
    const itemTop = activeItem.offsetTop - this.container.offsetTop;

    if (itemTop < scrollTop) {
      this.container.scrollTop = itemTop;
    } else {
      const itemBottom = itemTop + activeItem.offsetHeight;
      const containerHeight = this.container.clientHeight;
      if (itemBottom > scrollTop + containerHeight) {
        this.container.scrollTop = itemBottom - containerHeight;
      }
    }

    this.element.value = this.suggestions[index].value;
  }

  createConstraints() {
    this.constraints = {};
  }

  setupConstraints() {
    const constraints = this.options.constraints;

    if (!constraints) {
      this.unbindFromParent();
      this.constraints = {};
      return;
    }

    // Constraints can be: element, selector, or constraint object(s)
    if (typeof constraints === "string" || constraints instanceof HTMLElement) {
      // Constraint is an element or selector - find parent suggestions instance
      const parentEl =
        typeof constraints === "string" ? (document.querySelector(constraints) as HTMLInputElement) : (constraints as HTMLInputElement);
      if (parentEl && parentEl !== this.element) {
        const parentInstance = (parentEl as any)[DATA_ATTR_KEY] as Suggestions | undefined;
        if (parentInstance) {
          this.unbindFromParent();
          this.constraints = parentEl;
          this.bindToParent();
        }
      }
    } else {
      // Constraint is an object or array of objects
      this.unbindFromParent();
      this.constraints = {};
      for (const constraint of Array.isArray(constraints) ? constraints : [constraints]) {
        this.addConstraint(constraint);
      }
    }
  }

  addConstraint(constraint) {
    constraint = new Constraint(constraint, this);

    if (constraint.isValid()) {
      this.constraints[constraint.id] = constraint;
    }
  }

  constructConstraintsParams() {
    const locations = [];
    let constraints = this.constraints;
    let parentInstance;
    let parentData;
    const params = {};

    // Walk up the parent chain to get constraint data
    while (constraints instanceof HTMLElement) {
      parentInstance = (constraints as any)[DATA_ATTR_KEY] as Suggestions | undefined;
      if (!parentInstance) break;
      parentData = parentInstance?.selection?.data;
      if (parentData) break;
      constraints = parentInstance.constraints;
    }

    if (constraints instanceof HTMLElement && parentInstance) {
      parentData = new ConstraintLocation(parentData, parentInstance).getFields();

      if (parentData) {
        // if send city_fias_id for city request
        // then no cities will responded
        if (this.bounds.own.includes("city")) {
          delete parentData.city_fias_id;
        }
        params.locations = [parentData];
        params.restrict_value = true;
      }
    } else if (constraints && isPlainObject(constraints)) {
      for (const constraint of Object.values(constraints) as Constraint[]) {
        locations.push(...constraint.getFields());
      }

      if (locations.length > 0) {
        params.locations = locations;
        params.restrict_value = this.options.restrict_value;
      }
    }

    return params;
  }

  /**
   * Returns label of the first constraint (if any), empty string otherwise
   * @returns {String}
   */
  getFirstConstraintLabel() {
    const constraintsId = isPlainObject(this.constraints) && Object.keys(this.constraints)[0];

    return constraintsId ? this.constraints[constraintsId].label : "";
  }

  bindToParent() {
    const parentEl = this.constraints as HTMLElement;
    if (!parentEl) return;

    this.parentAbortController = new AbortController();
    const { signal } = this.parentAbortController;

    parentEl.addEventListener(
      "suggestions-select",
      (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const valueChanged = detail?.[1];
        // Don't clear if parent has been just enriched
        if (valueChanged) {
          this.clear();
        }
      },
      { signal },
    );

    parentEl.addEventListener("suggestions-invalidateselection", () => this.clear(), { signal });
    parentEl.addEventListener("suggestions-clear", () => this.clear(), { signal });
    parentEl.addEventListener("suggestions-dispose", () => this.onParentDispose(), { signal });
  }

  unbindFromParent() {
    this.parentAbortController?.abort();
    this.parentAbortController = null;
  }

  onParentDispose() {
    this.unbindFromParent();
  }

  getParentInstance() {
    if (this.constraints instanceof HTMLElement) {
      return ((this.constraints as any)[DATA_ATTR_KEY] as Suggestions) || null;
    }
    return null;
  }

  shareWithParent(suggestion) {
    const parentInstance = this.getParentInstance();

    if (!parentInstance || parentInstance.type !== this.type || belongsToArea(suggestion, parentInstance)) {
      return;
    }

    parentInstance.shareWithParent(suggestion);
    parentInstance.setSuggestion(suggestion);
  }

  /**
   * Pick only fields this absent in restriction
   */
  getUnrestrictedData(data) {
    const restrictedKeys = [];
    let unrestrictedData = {};
    let maxSpecificity = -1;

    // Find most specific location that could restrict current data
    if (isPlainObject(this.constraints)) {
      for (const constraint of Object.values(this.constraints) as Constraint[]) {
        for (const location of constraint.locations) {
          if (location.containsData(data) && location.specificity > maxSpecificity) {
            maxSpecificity = location.specificity;
          }
        }
      }
    }

    if (maxSpecificity >= 0) {
      // Для городов-регионов нужно также отсечь и город
      if (data.region_kladr_id && data.region_kladr_id === data.city_kladr_id) {
        restrictedKeys.push(...this.type.dataComponentsById.city.fields);
      }

      // Collect all fieldnames from all restricted components
      for (const component of this.type.dataComponents.slice(0, maxSpecificity + 1)) {
        restrictedKeys.push(...component.fields);
      }

      // Copy skipping restricted fields
      for (const [key, value] of Object.entries(data)) {
        if (!restrictedKeys.includes(key)) {
          unrestrictedData[key] = value;
        }
      }
    } else {
      unrestrictedData = data;
    }

    return unrestrictedData;
  }
}

let locationRequest;
let detectedLocation: { kladr_id: string } | null = null;
const defaultGeoLocation = true;

Suggestions.resetLocation = () => {
  locationRequest = null;
  detectedLocation = null;
  DEFAULT_OPTIONS.geoLocation = defaultGeoLocation;
};

Suggestions.resetTokens = () => {
  for (const req of Object.values(statusRequests)) {
    req.abort();
  }
  statusRequests = {};
};

const checkLocation = (instance: Suggestions) => {
  const providedLocation = instance.options.geoLocation;

  if (!instance.type.geoEnabled || !providedLocation) {
    return;
  }

  instance.geoLocation = detectedLocation;
  if (isPlainObject(providedLocation) || Array.isArray(providedLocation)) {
    instance.geoLocation = providedLocation;
  } else {
    if (!locationRequest) {
      locationRequest = instance.request("iplocate/address");
    }

    locationRequest.then(
      ({ data: resp }) => {
        const locationData = resp && resp.location && resp.location.data;
        if (locationData && locationData.kladr_id) {
          detectedLocation = {
            kladr_id: locationData.kladr_id,
          };
          instance.geoLocation = detectedLocation;
        }
      },
      () => {},
    );
  }
};

const constructParams = (instance: Suggestions) => {
  const params = {};

  if (instance.geoLocation) {
    const locationData = instance.geoLocation;
    params.locations_boost = Array.isArray(locationData) ? locationData : [locationData];
  }

  return params;
};

Suggestions.ConstraintLocation = ConstraintLocation;

export { Suggestions };
