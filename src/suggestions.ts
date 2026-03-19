/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import {
  buildCacheKey,
  delay,
  extend,
  generateId,
  highlightMatches,
  isPlainObject,
  makeSuggestionLabel,
  objectsEqual,
  serialize,
  trigger,
  trim,
} from "./utils";
import { CLASSES, DATA_ATTR_KEY, KEYS } from "./constants";
import { Deferred } from "./poly";

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

const notificator = {
  chains: {} as Record<string, Function[]>,

  on(name: string, method: Function) {
    this.get(name).push(method);
    return this;
  },

  get(name: string) {
    const chains = this.chains;
    return chains[name] || (chains[name] = []);
  },
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
  suggest: {
    defaultParams: {
      type: "POST",
      dataType: "json",
      contentType: "application/json",
    },
    addTypeInUrl: true,
  },
  "iplocate/address": {
    defaultParams: {
      type: "GET",
      dataType: "json",
    },
    addTypeInUrl: false,
  },
  status: {
    defaultParams: {
      type: "GET",
      dataType: "json",
    },
    addTypeInUrl: true,
  },
  findById: {
    defaultParams: {
      type: "POST",
      dataType: "json",
      contentType: "application/json",
    },
    addTypeInUrl: true,
  },
};

/**
 * XMLHttpRequest wrapper that returns a Deferred-like object
 * Compatible with nise fakeServer for testing
 */
function ajax(options: any) {
  const deferred = new Deferred();
  const xhr = new XMLHttpRequest();

  const method = options.type || "GET";
  const url = options.url;
  const data = options.data;
  const headers = options.headers || {};
  const contentType = options.contentType;
  const timeout = options.timeout || 0;

  xhr.open(method, url, true);
  xhr.timeout = timeout;

  // Set headers
  if (contentType) {
    xhr.setRequestHeader("Content-Type", contentType);
  }
  for (const [key, value] of Object.entries(headers)) {
    xhr.setRequestHeader(key, value as string);
  }

  // withCredentials
  if (options.xhrFields && options.xhrFields.withCredentials !== undefined) {
    xhr.withCredentials = options.xhrFields.withCredentials;
  }

  xhr.addEventListener("load", function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      let response;
      try {
        response = JSON.parse(xhr.responseText);
      } catch {
        response = xhr.responseText;
      }
      deferred.resolve(response, xhr.statusText, xhr);
    } else {
      deferred.reject(xhr, xhr.statusText, xhr.statusText);
    }
  });

  xhr.addEventListener("error", function () {
    deferred.reject(xhr, "error", xhr.statusText);
  });

  xhr.addEventListener("timeout", function () {
    deferred.reject(xhr, "timeout", "timeout");
  });

  xhr.addEventListener("abort", function () {
    deferred.reject(xhr, "abort", "abort");
  });

  xhr.send(data || null);

  // Add abort method to deferred for compatibility
  const result = deferred as any;
  result.abort = function () {
    xhr.abort();
  };
  result.getResponseHeader = function (name: string) {
    return xhr.getResponseHeader(name);
  };
  result.statusText = xhr.statusText;

  return result;
}

/**
 * Compares two suggestion objects
 * @param suggestion
 * @param instance other Suggestions instance
 */
function belongsToArea(suggestion: any, instance: any) {
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
}

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
function getSignificantKladrId(kladrId: string) {
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
}

/**
 * Пересечение массивов: ([1,2,3,4], [2,4,5,6]) => [2,4]
 * Исходные массивы не меняются.
 */
function intersect(array1: any[], array2: any[]) {
  const result = [] as any[];
  if (!Array.isArray(array1) || !Array.isArray(array2)) {
    return result;
  }
  return array1.filter((el) => array2.includes(el));
}

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
      return !!data.kladr_id && data.kladr_id.indexOf(this.significantKladr) === 0;
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
  public intervalId: number;
  public cachedResponse: Record<string, any>;
  public enrichmentCache: Record<string, any>;
  public abortController: AbortController;
  public inputPhase: any;
  public fetchPhase: any;
  public enrichPhase: any;
  public onChangeTimeout: number | null;
  public triggering: Record<string, any>;
  public wrapper: HTMLElement | null;
  public options: any;
  public classes: typeof CLASSES;
  public selection: any;
  public type: any;
  public status: Record<string, any>;
  public uniqueId: string;
  public currentRequest: any;
  public geoLocation: any;
  public geoLocationValue: any;
  public bounds: any;
  public constraints: any;
  public container: HTMLElement | null;
  public cancelBlur: boolean;
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
    this.intervalId = 0;
    this.cachedResponse = {};
    this.enrichmentCache = {};
    this.abortController = new AbortController();
    this.inputPhase = new Deferred();
    this.fetchPhase = new Deferred();
    this.enrichPhase = new Deferred();
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
    this.cancelBlur = false;
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
    this.uniqueId = generateId("i");
    this.createWrapper();
    this.notify("initialize");
    this.setOptions(undefined);
    this.notify("ready");
  }

  dispose() {
    const that = this;
    that.notify("dispose");
    delete (that.element as any)[DATA_ATTR_KEY];
    that.element.classList.remove("suggestions-input");
    that.removeWrapper();
    trigger(that.element, "suggestions-dispose");
  }

  notify(chainName) {
    const that = this;

    const args = Array.prototype.slice.call(arguments, 1);

    return notificator.get(chainName).map(function (method) {
      return method.apply(that, args);
    });
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
      extend(this.options, suppliedOptions);
    }

    this.type = Object.prototype.hasOwnProperty.call(types, this.options.type)
      ? types[this.options.type as keyof typeof types]
      : Outward(this.options.type);

    // Check mandatory options
    this.requestMode = requestModes[this.options.requestMode as keyof typeof requestModes];
    if (!this.requestMode) {
      throw new Error(
        `\`requestMode\` option is incorrect! Must be one of: ${Object.keys(requestModes)
          .map((name) => `"${name}"`)
          .join(", ")}`,
      );
    }

    this.notify("setOptions");
  }

  // Common public methods

  clearCache() {
    this.cachedResponse = {};
    this.enrichmentCache = {};
    this.badQueries = [];
  }

  clear() {
    const that = this;
    const currentSelection = that.selection;

    that.clearCache();
    that.currentValue = "";
    that.selection = null;
    that.hide();
    that.suggestions = [];
    that.element.value = "";
    trigger(that.element, "suggestions-clear");
    that.notify("clear");
    that.trigger("InvalidateSelection", currentSelection);
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
    const that = this;
    let data;
    let value;

    if (isPlainObject(suggestion) && isPlainObject(suggestion.data)) {
      suggestion = extend(true, {}, suggestion);

      if (that.bounds.own.length > 0) {
        that.checkValueBounds(suggestion);
        data = that.copyDataComponents(suggestion.data, that.bounds.all);
        if (suggestion.data.kladr_id) {
          data.kladr_id = that.getBoundedKladrId(suggestion.data.kladr_id, that.bounds.all);
        }
        suggestion.data = data;
      }

      that.selection = suggestion;

      // `that.suggestions` required by `that.getSuggestionValue` and must be set before
      that.suggestions = [suggestion];
      value = that.getSuggestionValue(suggestion) || "";
      that.currentValue = value;
      that.element.value = value;
      that.abortRequest();
      trigger(that.element, "suggestions-set");
    }
  }

  /**
   * Fetch full object for current INPUT's value
   * if no suitable object found, clean input element
   */
  fixData() {
    const that = this;
    const fullQuery = that.extendedCurrentValue();
    const currentValue = that.element.value;
    const resolver = new Deferred();

    resolver
      .done(function (suggestion) {
        that.selectSuggestion(suggestion, 0, currentValue, {
          hasBeenEnriched: true,
        });
        if (!that.currentValue) {
          that.element.value = currentValue;
        }
        trigger(that.element, "suggestions-fixdata", [suggestion]);
      })
      .fail(function () {
        that.selection = null;
        trigger(that.element, "suggestions-fixdata");
      });

    if (that.isQueryRequestable(fullQuery)) {
      that.currentValue = fullQuery;
      that
        .getSuggestions(fullQuery, {
          count: 1,
          from_bound: null,
          to_bound: null,
        })
        .done(function (suggestions) {
          // data fetched
          const suggestion = suggestions[0];
          if (suggestion) {
            resolver.resolve(suggestion);
          } else {
            resolver.reject();
          }
        })
        .fail(function () {
          // no data fetched
          resolver.reject();
        });
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
    const currentValue = trim(this.element.value);

    return [parentValue, currentValue].filter((e) => !!e).join(" ");
  }

  getAjaxParams(method: string, custom?: any) {
    const token = typeof this.options.token === "string" ? this.options.token.trim() : "";
    const partner = typeof this.options.partner === "string" ? this.options.partner.trim() : "";
    let serviceUrl = this.options.serviceUrl;
    const url = this.options.url;
    const serviceMethod = serviceMethods[method as keyof typeof serviceMethods];
    const params = extend(
      {
        timeout: this.options.timeout,
      },
      serviceMethod.defaultParams,
    );
    const headers = {};

    if (url) {
      serviceUrl = url;
    } else {
      if (!/\/$/.test(serviceUrl)) {
        serviceUrl += "/";
      }
      serviceUrl += method;
      if (serviceMethod.addTypeInUrl) {
        serviceUrl += `/${this.type.urlSuffix}`;
      }
    }

    // for XMLHttpRequest put token in header
    if (token) {
      headers.Authorization = `Token ${token}`;
    }
    if (partner) {
      headers["X-Partner"] = partner;
    }
    if (!params.headers) {
      params.headers = {};
    }
    if (!params.xhrFields) {
      params.xhrFields = {};
    }
    extend(params.headers, this.options.headers, headers);
    // server sets Access-Control-Allow-Origin: *
    // which requires no credentials
    params.xhrFields.withCredentials = false;

    params.url = serviceUrl;

    return extend(params, custom);
  }

  getFetchParams(method: string, body?: string) {
    const options = {
      credentials: "omit",
      headers: { Authorization: `Token ${this.options.token}` },
      timeout: this.options.timeout,
    };

    if (body) {
      options.method = "POST";
      options.body = body;
    } else {
      options.method = "GET";
    }

    let url = this.options.serviceUrl + method;
    if (method !== "iplocate/address") {
      url += `/${this.type.urlSuffix}`;
    }

    return { url, options };
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
    const params = typeof options.params === "function" ? options.params.call(this.element, query) : extend({}, options.params);

    if (this.type.constructRequestParams) {
      extend(params, this.type.constructRequestParams.call(this));
    }
    for (const hookParams of this.notify("requestParams")) {
      extend(params, hookParams);
    }
    params[options.paramName] = query;
    if (!Number.isNaN(Number.parseFloat(options.count)) && Number.isFinite(options.count) && options.count > 0) {
      params.count = options.count;
    }
    if (options.language) {
      params.language = options.language;
    }

    return extend(params, customParams);
  }

  updateSuggestions(query) {
    this.fetchPhase = this.getSuggestions(query).done((suggestions) => {
      this.assignSuggestions(suggestions, query);
    });
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
    const that = this;
    const options = that.options;
    const noCallbacks = requestOptions && requestOptions.noCallbacks;
    const useEnrichmentCache = requestOptions && requestOptions.useEnrichmentCache;
    const method = (requestOptions && requestOptions.method) || that.requestMode.method;
    const params = that.constructRequestParams(query, customParams);
    const cacheKey = buildCacheKey(params);
    const resolver = new Deferred();

    const response = that.cachedResponse[cacheKey];
    if (response && Array.isArray(response.suggestions)) {
      resolver.resolve(response.suggestions);
    } else if (that.isBadQuery(query)) {
      resolver.reject();
    } else if (!noCallbacks && options.onSearchStart.call(that.element, params) === false) {
      resolver.reject();
    } else {
      that
        .doGetSuggestions(params, method)
        .done(function (response) {
          // if response is correct and current value has not been changed
          if (that.processResponse(response) && query == that.currentValue) {
            // Cache results if cache is not disabled:
            if (!options.noCache) {
              if (useEnrichmentCache) {
                that.enrichmentCache[query] = response.suggestions[0];
              } else {
                that.enrichResponse(response, query);
                that.cachedResponse[cacheKey] = response;
                if (options.preventBadQueries && response.suggestions.length === 0) {
                  that.badQueries.push(query);
                }
              }
            }

            resolver.resolve(response.suggestions);
          } else {
            resolver.reject();
          }
          if (!noCallbacks) {
            options.onSearchComplete.call(that.element, query, response.suggestions);
          }
        })
        .fail(function (jqXHR, textStatus, errorThrown) {
          resolver.reject();
          if (!noCallbacks && textStatus !== "abort") {
            options.onSearchError.call(that.element, query, jqXHR, textStatus, errorThrown);
          }
        });
    }
    return resolver;
  }

  doGetSuggestions(params: object, method: string) {
    const that = this;
    const request = ajax(that.getAjaxParams(method, { data: serialize(params) }));

    that.abortRequest();
    that.currentRequest = request;
    that.notify("request");

    request.always(function () {
      that.currentRequest = null;
      that.notify("request");
    });

    return request;
  }

  isBadQuery(q) {
    if (!this.options.preventBadQueries) {
      return false;
    }

    for (const query of this.badQueries) {
      if (q.indexOf(query) === 0) {
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
    this.notify("assignSuggestions");
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
    const that = this;
    const resolver = new Deferred();

    if (
      !that.options.enrichmentEnabled ||
      !that.type.enrichmentEnabled ||
      !that.requestMode.enrichmentEnabled ||
      (selectionOptions && selectionOptions.dontEnrich)
    ) {
      return resolver.resolve(suggestion);
    }

    // if current suggestion is already enriched, use it
    if (suggestion.data && suggestion.data.qc != null) {
      return resolver.resolve(suggestion);
    }

    that.disableDropdown();

    const query = that.type.getEnrichmentQuery(suggestion);
    const customParams = that.type.enrichmentParams;
    const requestOptions = {
      noCallbacks: true,
      useEnrichmentCache: true,
      method: that.type.enrichmentMethod,
    };

    // Set `currentValue` to make `processResponse` to consider enrichment response valid
    that.currentValue = query;

    // prevent request abortion during onBlur
    that.enrichPhase = that
      .getSuggestions(query, customParams, requestOptions)
      .always(function () {
        that.enableDropdown();
      })
      .done(function (suggestions) {
        const enrichedSuggestion = suggestions && suggestions[0];

        resolver.resolve(enrichedSuggestion || suggestion, !!enrichedSuggestion);
      })
      .fail(function () {
        resolver.resolve(suggestion);
      });

    return resolver;
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
    const that = this;
    const token = (that.options.token && that.options.token.trim()) || "";
    const requestKey = that.options.type + token;
    let request = statusRequests[requestKey];

    if (!request) {
      request = statusRequests[requestKey] = ajax(that.getAjaxParams("status"));
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

    function triggerError(errorThrown) {
      // If unauthorized
      if (typeof that.options.onSearchError === "function") {
        that.options.onSearchError.call(that.element, null, request, "error", errorThrown);
      }
    }

    request
      .done(function (status, textStatus, request) {
        if (status.search) {
          const plan = request.getResponseHeader("X-Plan");
          status.plan = plan;
          extend(that.status, status);
        } else {
          triggerError("Service Unavailable");
        }
      })
      .fail(function () {
        triggerError(request.statusText);
      });
  }

  setupBounds(this: Suggestions) {
    this.bounds = {
      from: null,
      to: null,
    };
  }

  setBoundsOptions(this: Suggestions) {
    const that = this;
    const newBounds = trim(that.options.bounds).split("-");
    let boundFrom = newBounds[0];
    let boundTo = newBounds.at(-1);
    const boundsOwn = [];
    let boundIsOwn;
    const boundsAll = [];

    const boundsAvailable = that.type.dataComponents
      ? that.type.dataComponents.filter((item) => item.forBounds).map((item) => item.id)
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

    that.bounds.from = boundFrom;
    that.bounds.to = boundTo;
    that.bounds.all = boundsAll;
    that.bounds.own = boundsOwn;
  }

  constructBoundsParams(this: Suggestions) {
    const that = this;
    const params = {};

    if (that.bounds.from) {
      params.from_bound = { value: that.bounds.from };
    }
    if (that.bounds.to) {
      params.to_bound = { value: that.bounds.to };
    }

    return params;
  }

  /**
   * Подстраивает suggestion.value под that.bounds.own
   * Ничего не возвращает, меняет в самом suggestion
   * @param suggestion
   */
  checkValueBounds(this: Suggestions, suggestion: Suggestion<SuggestionAny>) {
    const that = this;
    let valueData;

    // If any bounds set up
    if (that.bounds.own.length > 0 && that.type.composeValue) {
      // делаем копию
      const bounds = [...that.bounds.own];
      // если роль текущего инстанса плагина показывать только район города
      // то для корректного формировния нужен city_district_fias_id
      if (bounds.length === 1 && bounds[0] === "city_district") {
        bounds.push("city_district_fias_id");
      }
      valueData = that.copyDataComponents(suggestion.data, bounds);
      suggestion.value = that.type.composeValue(valueData);
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

    return kladrId.slice(0, Math.max(0, kladrFormat.digits)) + Array.from({ length: (kladrFormat.zeros || 0) + 1 }).join("0");
  }

  bindElementEvents() {
    this.element.addEventListener("keydown", this.onElementKeyDown.bind(this));
    this.element.addEventListener("keyup", this.onElementKeyUp.bind(this));
    this.element.addEventListener("input", this.onElementKeyUp.bind(this));
    this.element.addEventListener("blur", this.onElementBlur.bind(this));
    this.element.addEventListener("focus", this.onElementFocus.bind(this));
  }

  unbindElementEvents() {
    this.element.removeEventListener("keydown", this.onElementKeyDown);
    this.element.removeEventListener("keyup", this.onElementKeyUp);
    this.element.removeEventListener("input", this.onElementKeyUp);
    this.element.removeEventListener("blur", this.onElementBlur);
    this.element.removeEventListener("focus", this.onElementFocus);
  }

  onElementBlur() {
    // suggestion was clicked, blur should be ignored
    // see container mousedown handler
    if (this.cancelBlur) {
      this.cancelBlur = false;
      return;
    }

    if (this.options.triggerSelectOnBlur) {
      this.selectCurrentValue({ noSpace: true }).always(() => {
        // For NAMEs selecting keeps suggestions list visible, so hide it
        this.hide();
      });
    } else {
      this.hide();
    }

    if (this.fetchPhase.abort) {
      this.fetchPhase.abort();
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
      switch (e.which) {
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

    switch (e.which) {
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
          this.selectCurrentValue();
        }
        break;
      }

      case KEYS.SPACE: {
        if (this.options.triggerSelectOnSpace && this.isCursorAtEnd()) {
          e.preventDefault();
          this.selectCurrentValue({
            continueSelecting: true,
            dontEnrich: true,
          }).fail(() => {
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
    switch (e.which) {
      case KEYS.UP:
      case KEYS.DOWN:
      case KEYS.ENTER: {
        return;
      }
    }

    // Cancel pending change
    if (this.onChangeTimeout) clearTimeout(this.onChangeTimeout);
    this.inputPhase.reject();

    if (this.currentValue !== this.element.value) {
      this.proceedChangedValue();
    }
  }

  proceedChangedValue() {
    // Cancel fetching, because it became obsolete
    this.abortRequest();

    this.inputPhase = new Deferred();
    this.inputPhase.done(() => {
      this.onValueChange();
    });

    if (this.options.deferRequestBy > 0) {
      // Defer lookup in case when value changes very quickly:
      this.onChangeTimeout = delay(() => {
        this.inputPhase.resolve();
      }, this.options.deferRequestBy);
    } else {
      this.inputPhase.resolve();
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
    this.notify("valueChange");
  }

  completeOnFocus() {
    if (document.activeElement === this.element) {
      this.update();
      if (globalThis.innerWidth <= this.options.mobileWidth) {
        this.setCursorAtEnd();
      }
    }
  }

  isElementDisabled() {
    return Boolean(this.element.getAttribute("disabled") || this.element.getAttribute("readonly"));
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

  proceedQuery(query) {
    const that = this;

    if (query.length >= that.options.minChars) {
      that.updateSuggestions(query);
    } else {
      that.hide();
    }
  }

  /**
   * Selects current or first matched suggestion, but firstly waits for data ready
   * @param selectionOptions
   * @returns {} promise, resolved with index of selected suggestion or rejected if nothing matched
   */
  selectCurrentValue(selectionOptions) {
    const that = this;
    const result = new Deferred();

    // force onValueChange to be executed if it has been deferred
    that.inputPhase.resolve();

    that.fetchPhase
      .done(function () {
        let index;

        // When suggestion has already been selected and not modified
        if (that.selection && !that.visible) {
          result.reject();
        } else {
          index = that.findSuggestionIndex();

          that.select(index, selectionOptions);

          if (index === -1) {
            result.reject();
          } else {
            result.resolve(index);
          }
        }
      })
      .fail(function () {
        result.reject();
      });

    return result;
  }

  /**
   * Selects first when user interaction is not supposed
   */
  selectFoundSuggestion() {
    const that = this;

    if (!that.requestMode.userSelect) {
      that.select(0, {});
    }
  }

  /**
   * Selects current or first matched suggestion
   * @returns {number} index of found suggestion
   */
  findSuggestionIndex() {
    const that = this;
    let index = that.selectedIndex;

    if (index === -1) {
      // matchers always operate with trimmed strings
      const value = that.element.value.trim();
      if (value) {
        that.type.matchers.some(function (matcher) {
          index = matcher(value, that.suggestions);
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
    const that = this;
    const suggestion = that.suggestions[index];
    const continueSelecting = selectionOptions && selectionOptions.continueSelecting;
    const currentValue = that.currentValue;

    // Prevent recursive execution
    if (that.triggering.Select) return;

    // if no suggestion to select
    if (!suggestion) {
      if (!continueSelecting && !that.selection) {
        that.triggerOnSelectNothing();
      }
      that.onSelectComplete(continueSelecting);
      return;
    }

    const hasSameValues = that.hasSameValues(suggestion);

    that.enrichSuggestion(suggestion, selectionOptions)?.done(function (enrichedSuggestion: any, hasBeenEnriched: boolean) {
      const newSelectionOptions = extend(
        {
          hasBeenEnriched,
          hasSameValues,
        },
        selectionOptions,
      );
      that.selectSuggestion(enrichedSuggestion, index, currentValue, newSelectionOptions);
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
    const that = this;
    let continueSelecting = selectionOptions.continueSelecting;
    const assumeDataComplete = !that.type.isDataComplete || that.type.isDataComplete.call(that, suggestion);
    const currentSelection = that.selection;

    // Prevent recursive execution
    if (that.triggering.Select) return;

    if (that.type.alwaysContinueSelecting) {
      continueSelecting = true;
    }

    if (assumeDataComplete) {
      continueSelecting = false;
    }

    // `suggestions` cat be empty, e.g. during `fixData`
    if (selectionOptions.hasBeenEnriched && that.suggestions[index]) {
      that.suggestions[index].data = suggestion.data;
    }

    if (that.requestMode.updateValue) {
      that.checkValueBounds(suggestion);
      that.currentValue = that.getSuggestionValue(suggestion, selectionOptions);

      if (that.currentValue && !selectionOptions.noSpace && !assumeDataComplete) {
        that.currentValue += " ";
      }
      that.element.value = that.currentValue;
    }

    if (that.currentValue) {
      that.selection = suggestion;
      if (!that.areSuggestionsSame(suggestion, currentSelection)) {
        that.trigger("Select", suggestion, that.currentValue !== lastValue);
      }
      if (that.requestMode.userSelect) {
        that.onSelectComplete(continueSelecting);
      }
    } else {
      that.selection = null;
      that.triggerOnSelectNothing();
    }

    that.shareWithParent(suggestion);
  }

  onSelectComplete(continueSelecting: boolean) {
    const that = this;

    if (continueSelecting) {
      that.selectedIndex = -1;
      that.updateSuggestions(that.currentValue);
    } else {
      that.hide();
    }
  }

  triggerOnSelectNothing() {
    const that = this;

    if (!that.triggering.SelectNothing) {
      that.trigger("SelectNothing", that.currentValue);
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

  getContainer() {
    return this.container;
  }

  removeContainer() {
    if (this.options.floating && this.container) {
      this.container.remove();
    }
  }

  setContainerOptions() {
    const listener = (e: Event) => e.preventDefault();
    if (this.container) {
      this.container.removeEventListener("mousedown", listener);
      if (this.options.floating) {
        this.container.addEventListener("mousedown", listener);
      }
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
    const that = this;

    return (
      that.suggestions.length > 1 ||
      (that.suggestions.length === 1 && (!that.selection || trim(that.suggestions[0].value) !== trim(that.selection.value)))
    );
  }

  suggest() {
    const that = this;
    const options = that.options;
    const html = [];

    if (!that.requestMode.userSelect) {
      return;
    }

    // если нечего показывать, то сообщаем об этом
    if (that.hasSuggestionsToChoose()) {
      // Build hint html
      if (options.hint && that.suggestions.length > 0) {
        html.push(`<div class="${that.classes.hint}">${options.hint}</div>`);
      }
      that.selectedIndex = -1;
      // Build suggestions inner HTML:
      for (const [i, suggestion] of that.suggestions.entries()) {
        if (suggestion == that.selection) {
          that.selectedIndex = i;
        }
        that.buildSuggestionHtml(suggestion, i, html);
      }
    } else if (that.suggestions.length > 0) {
      that.hide();
      return;
    } else {
      const noSuggestionsHint = that.getNoSuggestionsHint();
      if (noSuggestionsHint) {
        html.push(`<div class="${that.classes.hint}">${noSuggestionsHint}</div>`);
      } else {
        that.hide();
        return;
      }
    }

    that.container!.innerHTML = html.join("");

    // Select first value by default:
    if (options.autoSelectFirst && that.selectedIndex === -1) {
      that.selectedIndex = 0;
    }
    if (that.selectedIndex !== -1) {
      const items = that.getSuggestionsItems();
      const selectedItem = items[that.selectedIndex];
      if (selectedItem) {
        selectedItem.classList.add(that.classes.selected);
      }
    }

    if (typeof options.beforeRender === "function") {
      options.beforeRender.call(that.element, that.container);
    }

    if (that.container) {
      that.container.style.display = "";
    }
    that.visible = true;
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
    const that = this;
    const status = suggestion.data?.state?.status;

    return `<span class="${that.classes.value}"${status ? ` data-suggestion-status="${status}"` : ""}>${value}</span>`;
  }

  formatResult(value, currentValue, suggestion, options) {
    const that = this;

    value = highlightMatches(value, currentValue, options);

    return that.wrapFormattedValue(value, suggestion);
  }

  hide() {
    const that = this;
    that.visible = false;
    that.selectedIndex = -1;
    if (that.container) {
      that.container.style.display = "none";
      that.container.innerHTML = "";
    }
  }

  activate(index) {
    const that = this;
    const selected = that.classes.selected;

    if (!that.dropdownDisabled) {
      const children = that.getSuggestionsItems();

      for (const child of children) {
        child.classList.remove(selected);
      }

      that.selectedIndex = index;

      if (that.selectedIndex !== -1 && children.length > that.selectedIndex) {
        const activeItem = children[that.selectedIndex];
        if (activeItem) {
          activeItem.classList.add(selected);
          return activeItem;
        }
      }
    }

    return null;
  }

  deactivate(restoreValue) {
    const that = this;

    if (!that.dropdownDisabled) {
      that.selectedIndex = -1;
      for (const item of that.getSuggestionsItems()) {
        item.classList.remove(that.classes.selected);
      }
      if (restoreValue) {
        that.element.value = that.currentValue;
      }
    }
  }

  moveUp() {
    const that = this;

    if (that.dropdownDisabled) {
      return;
    }
    if (that.selectedIndex === -1) {
      if (that.suggestions.length > 0) {
        that.adjustScroll(that.suggestions.length - 1);
      }
      return;
    }

    if (that.selectedIndex === 0) {
      that.deactivate(true);
      return;
    }

    that.adjustScroll(that.selectedIndex - 1);
  }

  moveDown() {
    const that = this;

    if (that.dropdownDisabled) {
      return;
    }
    if (that.selectedIndex === that.suggestions.length - 1) {
      that.deactivate(true);
      return;
    }

    that.adjustScroll(that.selectedIndex + 1);
  }

  adjustScroll(index) {
    const that = this;
    const activeItem = that.activate(index);

    if (!activeItem || !that.container) {
      return;
    }

    const scrollTop = that.container.scrollTop;
    const itemTop = activeItem.offsetTop - that.container.offsetTop;

    if (itemTop < scrollTop) {
      that.container.scrollTop = itemTop;
    } else {
      const itemBottom = itemTop + activeItem.offsetHeight;
      const containerHeight = that.container.clientHeight;
      if (itemBottom > scrollTop + containerHeight) {
        that.container.scrollTop = itemBottom - containerHeight;
      }
    }

    that.element.value = that.suggestions[index].value;
  }

  createConstraints() {
    this.constraints = {};
  }

  setupConstraints() {
    const that = this;
    let constraints = that.options.constraints;

    if (!constraints) {
      that.unbindFromParent();
      return;
    }

    // Handle Cash/jQuery objects - extract the HTMLElement
    if (constraints && typeof constraints === "object" && constraints[0] instanceof HTMLElement && typeof constraints.length === "number") {
      constraints = constraints[0];
    }

    // Constraints can be: element, selector, or constraint object(s)
    if (typeof constraints === "string" || constraints instanceof HTMLElement) {
      // Constraint is an element or selector - find parent suggestions instance
      const parentEl =
        typeof constraints === "string" ? (document.querySelector(constraints) as HTMLInputElement) : (constraints as HTMLInputElement);
      if (parentEl && parentEl !== that.element) {
        const parentInstance = (parentEl as any)[DATA_ATTR_KEY] as Suggestions | undefined;
        if (parentInstance) {
          that.unbindFromParent();
          that.constraints = parentEl;
          that.bindToParent();
        }
      }
    } else {
      // Constraint is an object or array of objects
      for (const key of Object.keys(that.constraints)) {
        delete that.constraints[key];
      }
      for (const constraint of Array.isArray(constraints) ? constraints : [constraints]) {
        that.addConstraint(constraint);
      }
    }
  }

  filteredLocation(data) {
    const locationComponents = new Set();
    const location = {};

    if (this.type.dataComponents) {
      for (const component of this.type.dataComponents) {
        if (component.forLocations) locationComponents.push(component.id);
      }
    }

    if (isPlainObject(data)) {
      // Copy to location only allowed fields
      for (const [key, value] of Object.entries(data)) {
        if (value && locationComponents.has(key)) {
          location[key] = value;
        }
      }
    }

    if (Object.keys(location).length > 0) {
      return location.kladr_id ? { kladr_id: location.kladr_id } : location;
    }
  }

  addConstraint(constraint) {
    const that = this;

    constraint = new Constraint(constraint, that);

    if (constraint.isValid()) {
      that.constraints[constraint.id] = constraint;
    }
  }

  constructConstraintsParams() {
    const that = this;
    let locations = [];
    let constraints = that.constraints;
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
        if (that.bounds.own.includes("city")) {
          delete parentData.city_fias_id;
        }
        params.locations = [parentData];
        params.restrict_value = true;
      }
    } else if (constraints && isPlainObject(constraints)) {
      for (const constraint of Object.values(constraints) as Constraint[]) {
        locations = locations.concat(constraint.getFields());
      }

      if (locations.length > 0) {
        params.locations = locations;
        params.restrict_value = that.options.restrict_value;
      }
    }

    return params;
  }

  /**
   * Returns label of the first constraint (if any), empty string otherwise
   * @returns {String}
   */
  getFirstConstraintLabel() {
    const that = this;
    const constraintsId = isPlainObject(that.constraints) && Object.keys(that.constraints)[0];

    return constraintsId ? that.constraints[constraintsId].label : "";
  }

  bindToParent() {
    const parentEl = this.constraints as HTMLElement;
    if (!parentEl) return;

    parentEl.addEventListener("suggestions-select", (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const valueChanged = detail?.[1];
      // Don't clear if parent has been just enriched
      if (valueChanged) {
        this.clear();
      }
    });

    parentEl.addEventListener("suggestions-invalidateselection", this.clear.bind(this));
    parentEl.addEventListener("suggestions-clear", this.clear.bind(this));
    parentEl.addEventListener("suggestions-dispose", this.onParentDispose.bind(this));
  }

  unbindFromParent() {
    const that = this;
    const parentEl = that.constraints as HTMLElement;

    if (parentEl instanceof HTMLElement) {
      // TODO:
      // off(parentEl, `.${that.uniqueId}`);
    }
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
    // that is the parent control's instance
    const that = this.getParentInstance();

    if (!that || that.type !== this.type || belongsToArea(suggestion, that)) {
      return;
    }

    that.shareWithParent(suggestion);
    that.setSuggestion(suggestion);
  }

  /**
   * Pick only fields that absent in restriction
   */
  getUnrestrictedData(data) {
    const that = this;
    const restrictedKeys = [];
    let unrestrictedData = {};
    let maxSpecificity = -1;

    // Find most specific location that could restrict current data
    if (isPlainObject(that.constraints)) {
      for (const constraint of Object.values(that.constraints) as Constraint[]) {
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
        restrictedKeys.push(...that.type.dataComponentsById.city.fields);
      }

      // Collect all fieldnames from all restricted components
      for (const component of that.type.dataComponents.slice(0, maxSpecificity + 1)) {
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
const defaultGeoLocation = true;

Suggestions.getGeoLocation = () => {
  return this.geoLocation;
};

Suggestions.resetLocation = () => {
  locationRequest = null;
  DEFAULT_OPTIONS.geoLocation = defaultGeoLocation;
};

Suggestions.resetTokens = () => {
  for (const req of Object.values(statusRequests)) {
    req.abort();
  }
  statusRequests = {};
};

function checkLocation(this: Suggestions) {
  const that = this;
  const providedLocation = that.options.geoLocation;

  if (!that.type.geoEnabled || !providedLocation) {
    return;
  }

  that.geoLocation = new Deferred();
  if (isPlainObject(providedLocation) || Array.isArray(providedLocation)) {
    that.geoLocation.resolve(providedLocation);
    that.geoLocationValue = providedLocation;
  } else {
    if (!locationRequest) {
      locationRequest = ajax(that.getAjaxParams("iplocate/address"));
    }

    locationRequest
      .done(function (resp) {
        const locationData = resp && resp.location && resp.location.data;
        if (locationData && locationData.kladr_id) {
          that.geoLocation.resolve({
            kladr_id: locationData.kladr_id,
          });
        } else {
          that.geoLocation.reject();
        }
      })
      .fail(function () {
        that.geoLocation.reject();
      });
  }
}

function constructParams(this: Suggestions) {
  const params = {};

  if (this.geoLocation && typeof this.geoLocation.promise === "function" && this.geoLocation.state() === "resolved") {
    this.geoLocation.done(function (locationData) {
      params.locations_boost = Array.isArray(locationData) ? locationData : [locationData];
    });
  }

  return params;
}

Suggestions.ConstraintLocation = ConstraintLocation;

notificator
  .on("assignSuggestions", Suggestions.prototype.suggest)
  .on("assignSuggestions", Suggestions.prototype.selectFoundSuggestion)
  .on("dispose", Suggestions.prototype.unbindElementEvents)
  .on("dispose", Suggestions.prototype.removeContainer)
  .on("dispose", Suggestions.prototype.unbindFromParent)
  .on("initialize", Suggestions.prototype.bindElementEvents)
  .on("initialize", Suggestions.prototype.createContainer)
  .on("initialize", Suggestions.prototype.createConstraints)
  .on("initialize", Suggestions.prototype.setupBounds)
  .on("ready", Suggestions.prototype.showContainer)
  .on("requestParams", constructParams)
  .on("requestParams", Suggestions.prototype.constructConstraintsParams)
  .on("requestParams", Suggestions.prototype.constructBoundsParams)
  .on("setOptions", Suggestions.prototype.checkStatus)
  .on("setOptions", checkLocation)
  .on("setOptions", Suggestions.prototype.setContainerOptions)
  .on("setOptions", Suggestions.prototype.setupConstraints)
  .on("setOptions", Suggestions.prototype.setBoundsOptions);

export { Suggestions };
