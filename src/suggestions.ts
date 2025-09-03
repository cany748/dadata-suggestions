/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import $, { type Cash } from "cash-dom";
import { $fetch } from "ofetch";
import { buildCacheKey, delay, generateId, highlightMatches, isPlainObject, objectsEqual, serialize, trim } from "./utils";
import { getType } from "./types";
import { CLASSES, DATA_ATTR_KEY, EVENT_NS, KEYS } from "./constants";
import type { Suggestion, SuggestionAny } from "./types";

// Simple Deferred implementation since cash-dom doesn't include one
class Deferred<T = any> {
  public promise: Promise<T>;
  public resolve!: (value: T | PromiseLike<T>) => void;
  public reject!: (reason?: any) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  done(onFulfilled: (value: T) => void): this {
    this.promise.then(onFulfilled);
    return this;
  }

  fail(onRejected: (reason: any) => void): this {
    this.promise.catch(onRejected);
    return this;
  }

  always(onFinally: () => void): this {
    this.promise.finally(onFinally);
    return this;
  }
}

// Extend cash-dom with Deferred
($ as any).Deferred = function<T = any>() {
  return new Deferred<T>();
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

const DEFAULT_OPTIONS = {
  token: "",
  $helpers: null,
  autoSelectFirst: false,
  containerClass: "suggestions-suggestions",
  count: 5,
  deferRequestBy: 100,
  enrichmentEnabled: true,
  formatResult: null,
  formatSelected: null,
  headers: null,
  // hint: "Выберите вариант или продолжите ввод",
  hint: false,
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
  scrollOnFocus: false,
  // основной url, может быть переопределен
  serviceUrl: "https://suggestions.dadata.ru/suggestions/api/4_1/rs/",
  tabDisabled: false,
  timeout: 3000,
  triggerSelectOnBlur: true,
  triggerSelectOnEnter: true,
  triggerSelectOnSpace: false,
  type: null,
  // url, который заменяет serviceUrl + method + type
  // то есть, если он задан, то для всех запросов будет использоваться именно он
  url: null,

  width: "auto",
  floating: false,
  bounds: null,
  constraints: null,
  restrict_value: false,
};

const contains = function (a: Element, b: Element) {
  const bup = b && b.parentNode;

  return a === bup || !!(bup && bup.nodeType === 1 && a.contains(bup));
};

/**
 * Compares two suggestion objects
 * @param suggestion
 * @param instance other Suggestions instance
 */
function belongsToArea(suggestion: any, instance: any) {
  const parentSuggestion = instance.selection;
  let result = parentSuggestion && parentSuggestion.data && instance.bounds;

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

const statusRequests = {} as Record<string, any>;

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
      $.each(instance.type.dataComponents, (i, component) => {
        const fieldName = component.id;
        if (component.forLocations && data[fieldName]) {
          this.fields[fieldName] = data[fieldName];
          this.specificity = i;
        }
      });
    }

    const fieldNames = Object.keys(this.fields);
    const fiasFieldNames = intersect(fieldNames, fiasParamNames);
    if (fiasFieldNames.length > 0) {
      $.each(fiasFieldNames, (index, fieldName) => {
        fiasFields[fieldName] = this.fields[fieldName];
      });
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
    $.each(this.instance.type.dataComponents, function (i, component) {
      if (component.kladrFormat && kladrLength === component.kladrFormat.digits) {
        specificity = i;
      }
    });
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
    $.each(this.instance.type.dataComponents, function (i, component) {
      if (component.fiasType && fiasFieldNames.includes(component.fiasType) && specificity < i) {
        specificity = i;
      }
    });
    return specificity;
  }

  containsData(data) {
    let result = true;
    if (this.fields.kladr_id) {
      return !!data.kladr_id && data.kladr_id.indexOf(this.significantKladr) === 0;
    } else {
      $.each(this.fields, function (fieldName, value) {
        return (result = !!data[fieldName] && data[fieldName].toLowerCase() === value.toLowerCase());
      });
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
    this.locations = [data && (data.locations || data.restrictions)].map((data) => new ConstraintLocation(data, instance));
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

class Suggestions {
  public element: HTMLInputElement;
  public el: Cash;
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
  public $wrapper: any;
  public options: any;
  public classes: typeof CLASSES;
  public selection: any;
  public $viewport: Cash;
  public $body: Cash;
  public type: any;
  public status: Record<string, any>;
  public uniqueId: string;
  $container: Cash | undefined;

  constructor(el: HTMLInputElement, options: any, vue?: {}) {
    // Shared variables:
    this.element = el;
    this.el = $(el);
    this.suggestions = [];
    this.badQueries = [];
    this.selectedIndex = -1;
    this.currentValue = this.element.value;
    this.intervalId = 0;
    this.cachedResponse = {};
    this.enrichmentCache = {};
    this.abortController = new AbortController();
    this.inputPhase = new $.Deferred();
    this.fetchPhase = new $.Deferred();
    this.enrichPhase = new $.Deferred();
    this.onChangeTimeout = null;
    this.triggering = {};
    this.$wrapper = null;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.classes = CLASSES;
    this.selection = null;
    this.$viewport = $(globalThis);
    this.$body = $(document.body);
    this.type = null;
    this.status = {};

    this.uniqueId = generateId("i");
    this.createWrapper();
    this.notify("initialize");
    this.bindWindowEvents();
    this.setOptions();
    this.inferIsMobile(this);
    this.notify("ready");
  }

  dispose() {
    const that = this;
    that.notify("dispose");
    that.el.removeData(DATA_ATTR_KEY).removeClass("suggestions-input");
    that.unbindWindowEvents();
    that.removeWrapper();
    that.el.trigger("suggestions-dispose");
  }

  notify(chainName) {
    const that = this;

    const args = Array.prototype.slice.call(arguments, 1);

    return notificator.get(chainName).map(function (method) {
      return method.apply(that, args);
    });
  }

  createWrapper() {
    const that = this;

    that.$wrapper = $('<div class="suggestions-wrapper"/>');
    that.el.after(that.$wrapper);

    that.$wrapper.on(`mousedown${EVENT_NS}`, (e) => {
      that.onMousedown(e, that);
    });
  }

  removeWrapper() {
    const that = this;

    if (that.$wrapper) {
      that.$wrapper.remove();
    }
    $(that.options.$helpers).off(EVENT_NS);
  }

  /** This whole handler is needed to prevent blur event on textbox
   * when suggestion is clicked (blur leads to suggestions hide, so we need to prevent it).
   * See https://github.com/jquery/jquery-ui/blob/master/ui/autocomplete.js for details
   */
  onMousedown(e, ctx) {
    const that = ctx;

    // prevent moving focus out of the text field
    e.preventDefault();

    // IE doesn't prevent moving focus even with e.preventDefault()
    // so we set a flag to know when we should ignore the blur event
    that.cancelBlur = true;
    delay(function () {
      delete that.cancelBlur;
    });

    // clicking on the scrollbar causes focus to shift to the body
    // but we can't detect a mouseup or a click immediately afterward
    // so we have to track the next mousedown and close the menu if
    // the user clicks somewhere outside of the autocomplete
    if ($(e.target).closest(".ui-menu-item").length === 0) {
      delay(function () {
        $(document).one("mousedown", function (e) {
          let $elements = that.el.add(that.$wrapper).add(that.options.$helpers);

          if (that.options.floating) {
            $elements = $elements.add(that.$container);
          }

          $elements = $elements.filter(function () {
            return this === e.target || contains(this, e.target);
          });

          if ($elements.length === 0) {
            that.hide();
          }
        });
      });
    }
  }

  bindWindowEvents() {
    this.$viewport.on(`resize${EVENT_NS}${this.uniqueId}`, () => {
      this.inferIsMobile(this);
    });
  }

  unbindWindowEvents() {
    this.$viewport.off(`resize${EVENT_NS}${this.uniqueId}`);
  }

  // Configuration methods

  setOptions(suppliedOptions) {
    const that = this;

    $.extend(that.options, suppliedOptions);

    that.type = getType(that.options.type);

    // Check mandatory options
    $.each(
      {
        requestMode: requestModes,
      },
      function (option, available) {
        that[option] = available[that.options[option]];
        if (!that[option]) {
          throw `\`${option}\` option is incorrect! Must be one of: ${available
            .map(function (value, name) {
              return `"${name}"`;
            })
            .join(", ")}`;
        }
      },
    );

    $(that.options.$helpers)
      .off(EVENT_NS)
      .on(`mousedown${EVENT_NS}`, (e) => {
        that.onMousedown(e, that);
      });

    that.notify("setOptions");
  }

  // Common public methods

  inferIsMobile(ctx) {
    ctx.isMobile = ctx.$viewport.width() <= ctx.options.mobileWidth;
  }

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
    that.el.val("");
    that.el.trigger("suggestions-clear");
    that.notify("clear");
    that.trigger("InvalidateSelection", currentSelection);
  }

  update() {
    const that = this;
    const query = that.el.val();

    that.currentValue = query;
    if (that.isQueryRequestable(query)) {
      that.updateSuggestions(query);
    } else {
      that.hide();
    }
  }

  setSuggestion(suggestion) {
    const that = this;
    let data;
    let value;

    if (isPlainObject(suggestion) && isPlainObject(suggestion.data)) {
      suggestion = $.extend(true, {}, suggestion);

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
      that.el.val(value);
      that.trigger("Select", suggestion);
      that.abortRequest();
      that.el.trigger("suggestions-set");
    }
  }

  /**
   * Fetch full object for current INPUT's value
   * if no suitable object found, clean input element
   */
  fixData() {
    const that = this;
    const fullQuery = that.extendedCurrentValue();
    const currentValue = that.el.val();
    const resolver = new $.Deferred();

    resolver
      .done(function (suggestion) {
        that.selectSuggestion(suggestion, 0, currentValue, {
          hasBeenEnriched: true,
        });
        that.el.trigger("suggestions-fixdata", suggestion);
      })
      .fail(function () {
        that.selection = null;
        that.el.trigger("suggestions-fixdata");
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
    const that = this;
    const parentInstance = that.getParentInstance();
    const parentValue = parentInstance && parentInstance.extendedCurrentValue();
    const currentValue = trim(that.el.val());

    return [parentValue, currentValue].filter((e) => !!e).join(" ");
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
    const that = this;
    let result;

    result = query.length >= that.options.minChars;

    if (result && that.type.isQueryRequestable) {
      result = that.type.isQueryRequestable.call(that, query);
    }

    return result;
  }

  constructRequestParams(query, customParams) {
    const that = this;
    const options = that.options;
    const params = typeof options.params === "function" ? options.params.call(that.element, query) : $.extend({}, options.params);

    if (that.type.constructRequestParams) {
      $.extend(params, that.type.constructRequestParams.call(that));
    }
    $.each(that.notify("requestParams"), function (i, hookParams) {
      $.extend(params, hookParams);
    });
    params[options.paramName] = query;
    if (!Number.isNaN(Number.parseFloat(options.count)) && Number.isFinite(options.count) && options.count > 0) {
      params.count = options.count;
    }
    if (options.language) {
      params.language = options.language;
    }

    return $.extend(params, customParams);
  }

  updateSuggestions(query) {
    const that = this;

    that.fetchPhase = that.getSuggestions(query).done(function (suggestions) {
      that.assignSuggestions(suggestions, query);
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
    const resolver = new $.Deferred();

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
        .then(function (response) {
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
        .catch(function (error, textStatus, errorThrown) {
          resolver.reject();
          if (!noCallbacks && textStatus !== "abort") {
            options.onSearchError.call(that.element, query, error, textStatus, errorThrown);
          }
        });
    }
    return resolver;
  }

  async doGetSuggestions(params: object, method: string) {
    const { url, options } = this.getFetchParams(method, serialize(params));

    this.abortRequest();

    const data = await $fetch(url, { signal: this.abortController.signal, ...options });

    this.notify("request");

    return data;
  }

  isBadQuery(q) {
    if (!this.options.preventBadQueries) {
      return false;
    }

    let result = false;
    $.each(this.badQueries, function (i, query) {
      return !(result = q.indexOf(query) === 0);
    });
    return result;
  }

  abortRequest() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }

  /**
   * Checks response format and data
   * @return {Boolean} response contains acceptable data
   */
  processResponse(response) {
    const that = this;
    let suggestions;

    if (!response || !Array.isArray(response.suggestions)) {
      return false;
    }

    that.verifySuggestionsFormat(response.suggestions);
    that.setUnrestrictedValues(response.suggestions);

    if (typeof that.options.onSuggestionsFetch === "function") {
      suggestions = that.options.onSuggestionsFetch.call(that.element, response.suggestions);
      if (Array.isArray(suggestions)) {
        response.suggestions = suggestions;
      }
    }

    return true;
  }

  verifySuggestionsFormat(suggestions) {
    if (typeof suggestions[0] === "string") {
      $.each(suggestions, function (i, value) {
        suggestions[i] = { value, data: null };
      });
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
    const that = this;
    const formatSelected = that.options.formatSelected || that.type.formatSelected;
    const hasSameValues = selectionOptions && selectionOptions.hasSameValues;
    const hasBeenEnriched = selectionOptions && selectionOptions.hasBeenEnriched;
    let formattedValue;
    let typeFormattedValue = null;

    if (typeof formatSelected === "function") {
      formattedValue = formatSelected.call(that, suggestion);
    }

    if (typeof formattedValue !== "string") {
      formattedValue = suggestion.value;

      if (that.type.getSuggestionValue) {
        typeFormattedValue = that.type.getSuggestionValue(that, {
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
    let hasSame = false;

    $.each(this.suggestions, function (i, anotherSuggestion) {
      if (anotherSuggestion.value === suggestion.value && anotherSuggestion !== suggestion) {
        hasSame = true;
        return false;
      }
    });

    return hasSame;
  }

  assignSuggestions(suggestions, query) {
    const that = this;
    that.suggestions = suggestions;
    that.notify("assignSuggestions", query);
  }

  shouldRestrictValues() {
    const that = this;
    // treat suggestions value as restricted only if there is one constraint
    // and restrict_value is true
    return that.options.restrict_value && that.constraints && Object.keys(that.constraints).length == 1;
  }

  /**
   * Fills suggestion.unrestricted_value property
   */
  setUnrestrictedValues(suggestions) {
    const that = this;
    const shouldRestrict = that.shouldRestrictValues();
    const label = that.getFirstConstraintLabel();

    $.each(suggestions, function (i, suggestion) {
      if (!suggestion.unrestricted_value) {
        suggestion.unrestricted_value = shouldRestrict ? `${label}, ${suggestion.value}` : suggestion.value;
      }
    });
  }

  areSuggestionsSame(a, b) {
    return a && b && a.value === b.value && objectsEqual(a.data, b.data);
  }

  getNoSuggestionsHint() {
    const that = this;
    if (that.options.noSuggestionsHint === false) {
      return false;
    }
    return that.options.noSuggestionsHint || that.type.noSuggestionsHint;
  }

  enrichSuggestion(this: Suggestions, suggestion, selectionOptions) {
    const that = this;
    const resolver = new $.Deferred();

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
    const token = (this.options.token && this.options.token.trim()) || "";
    const requestKey = this.options.type + token;
    const request = statusRequests[requestKey];

    type Status = {
      count: number;
      name: "address" | "fio";
      plan: string;
      resources: { name: string; version: string }[];
      search: boolean;
      state: "ENABLED";
      version: string;
    };

    if (!request) {
      const { url, options } = this.getFetchParams("status");
      statusRequests[requestKey] = $fetch.raw<Status>(url, options).then(({ _data: status, headers }) => {
        if (status && status.search) {
          const plan = headers.get("X-Plan");
          status.plan = plan!;
          this.status = status;
        }
      });
    }
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
      boundFrom = null;
    }

    if (!boundsAvailable.includes(boundTo)) {
      boundTo = null;
    }

    if (boundFrom || boundTo) {
      boundIsOwn = !boundFrom;
      for (const bound of boundsAvailable) {
        if (bound == boundFrom) boundIsOwn = true;
        boundsAll.push(bound);
        if (boundIsOwn) boundsOwn.push(bound);
        if (bound == boundTo) break;
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
    const that = this;

    that.el.on(`keydown${EVENT_NS}`, (e) => {
      that.onElementKeyDown(e, that);
    });
    // IE is buggy, it doesn't trigger `input` on text deletion, so use following events
    that.el.on([`keyup${EVENT_NS}`, `cut${EVENT_NS}`, `paste${EVENT_NS}`, `input${EVENT_NS}`].join(" "), (e) => {
      that.onElementKeyUp(e, that);
    });
    that.el.on(`blur${EVENT_NS}`, () => {
      that.onElementBlur(that);
    });
    that.el.on(`focus${EVENT_NS}`, () => {
      that.onElementFocus(that);
    });
  }

  unbindElementEvents() {
    this.el.off(EVENT_NS);
  }

  onElementBlur(ctx) {
    const that = ctx;

    // suggestion was clicked, blur should be ignored
    // see container mousedown handler
    if (that.cancelBlur) {
      that.cancelBlur = false;
      return;
    }

    if (that.options.triggerSelectOnBlur) {
      that.selectCurrentValue({ noSpace: true }).always(function () {
        // For NAMEs selecting keeps suggestions list visible, so hide it
        that.hide();
      });
    } else {
      that.hide();
    }

    if (that.fetchPhase.abort) {
      that.fetchPhase.abort();
    }
  }

  onElementFocus(ctx) {
    const that = ctx;

    if (!that.cancelFocus) {
      // defer methods to allow browser update input's style before
      delay(() => that.completeOnFocus(that));
    }
    that.cancelFocus = false;
  }

  onElementKeyDown(e, ctx) {
    const that = ctx;

    if (!that.visible) {
      switch (e.which) {
        // If suggestions are hidden and user presses arrow down, display suggestions
        case KEYS.DOWN: {
          that.suggest();
          break;
        }
        // if no suggestions available and user pressed Enter
        case KEYS.ENTER: {
          if (that.options.triggerSelectOnEnter) {
            that.triggerOnSelectNothing();
          }
          break;
        }
      }
      return;
    }

    switch (e.which) {
      case KEYS.ESC: {
        that.el.val(that.currentValue);
        that.hide();
        that.abortRequest();
        break;
      }

      case KEYS.TAB: {
        if (that.options.tabDisabled === false) {
          return;
        }
        break;
      }

      case KEYS.ENTER: {
        if (that.options.triggerSelectOnEnter) {
          that.selectCurrentValue();
        }
        break;
      }

      case KEYS.SPACE: {
        if (that.options.triggerSelectOnSpace && that.isCursorAtEnd()) {
          e.preventDefault();
          that
            .selectCurrentValue({
              continueSelecting: true,
              dontEnrich: true,
            })
            .fail(function () {
              // If all data fetched but nothing selected
              that.currentValue += " ";
              that.el.val(that.currentValue);
              that.proceedChangedValue();
            });
        }
        return;
      }
      case KEYS.UP: {
        that.moveUp();
        break;
      }
      case KEYS.DOWN: {
        that.moveDown();
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

  onElementKeyUp(e, ctx) {
    const that = ctx;

    switch (e.which) {
      case KEYS.UP:
      case KEYS.DOWN:
      case KEYS.ENTER: {
        return;
      }
    }

    // Cancel pending change
    clearTimeout(that.onChangeTimeout);
    that.inputPhase.reject();

    if (that.currentValue !== that.el.val()) {
      that.proceedChangedValue();
    }
  }

  proceedChangedValue() {
    const that = this;

    // Cancel fetching, because it became obsolete
    that.abortRequest();

    that.inputPhase = new $.Deferred().done(() => {
      that.onValueChange(that);
    });

    if (that.options.deferRequestBy > 0) {
      // Defer lookup in case when value changes very quickly:
      that.onChangeTimeout = delay(function () {
        that.inputPhase.resolve();
      }, that.options.deferRequestBy);
    } else {
      that.inputPhase.resolve();
    }
  }

  onValueChange(ctx) {
    const that = ctx;
    let currentSelection;

    if (that.selection) {
      currentSelection = that.selection;
      that.selection = null;
      that.trigger("InvalidateSelection", currentSelection);
    }

    that.selectedIndex = -1;

    that.update();
    that.notify("valueChange");
  }

  completeOnFocus(ctx) {
    const that = ctx;

    if (document.activeElement === this.element[0]) {
      that.update();
      if (that.isMobile) {
        that.setCursorAtEnd();
      }
    }
  }

  isElementDisabled() {
    return Boolean(this.element.getAttribute("disabled") || this.element.getAttribute("readonly"));
  }

  isCursorAtEnd() {
    const that = this;
    const valLength = that.el.val().length;
    let selectionStart;
    let range;

    // `selectionStart` and `selectionEnd` are not supported by some input types
    try {
      selectionStart = that.element.selectionStart;
      if (typeof selectionStart === "number") {
        return selectionStart === valLength;
      }
    } catch {}

    if (document.selection) {
      range = document.selection.createRange();
      range.moveStart("character", -valLength);
      return valLength === range.text.length;
    }
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
    const result = new $.Deferred();

    // force onValueChange to be executed if it has been defered
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
      that.select(0);
    }
  }

  /**
   * Selects current or first matched suggestion
   * @returns {number} index of found suggestion
   */
  findSuggestionIndex() {
    const that = this;
    let index = that.selectedIndex;
    let value;

    if (index === -1) {
      // matchers always operate with trimmed strings
      value = that.el.val().trim();
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

    that.enrichSuggestion(suggestion, selectionOptions).done(function (enrichedSuggestion, hasBeenEnriched) {
      const newSelectionOptions = $.extend(
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
      that.el.val(that.currentValue);
    }

    if (that.currentValue) {
      that.selection = suggestion;
      if (!that.areSuggestionsSame(suggestion, currentSelection)) {
        that.trigger("Select", suggestion, that.currentValue != lastValue);
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

  onSelectComplete(continueSelecting) {
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

  trigger(event) {
    const that = this;

    const args = Array.prototype.slice.call(arguments, 1);
    const callback = that.options[`on${event}`];

    that.triggering[event] = true;
    if (typeof callback === "function") {
      callback.apply(that.element, args);
    }
    that.el.trigger.call(that.el, `suggestions-${event.toLowerCase()}`, args);
    that.triggering[event] = false;
  }

  createContainer() {
    const that = this;
    const $container = $("<div/>").addClass("suggestions-suggestions").css({ display: "none" });

    that.$container = $container;

    $container.on(`click${EVENT_NS}`, ".suggestions-suggestion", (e) => {
      that.onSuggestionClick(e, that);
    });
  }

  showContainer() {
    this.$container.appendTo(this.options.floating ? this.$body : this.$wrapper);
  }

  getContainer() {
    return this.$container.get(0);
  }

  removeContainer() {
    const that = this;

    if (that.options.floating) {
      that.$container.remove();
    }
  }

  setContainerOptions() {
    const that = this;
    const mousedownEvent = `mousedown${EVENT_NS}`;

    that.$container.off(mousedownEvent);
    if (that.options.floating) {
      that.$container.on(mousedownEvent, (e) => {
        that.onMousedown(e, that);
      });
    }
  }

  /**
   * Listen for click event on suggestions list:
   */
  onSuggestionClick(e, ctx) {
    const that = ctx;
    let $el = $(e.target);
    let index;

    if (!that.dropdownDisabled) {
      that.cancelFocus = true;
      that.el.trigger("focus");

      while ($el.length > 0 && !(index = $el.attr("data-index"))) {
        $el = $el.closest(`.${that.classes.suggestion}`);
      }

      if (index && !Number.isNaN(index)) {
        that.select(+index);
      }
    }
  }

  // Dropdown UI methods

  getSuggestionsItems() {
    return this.$container.children(`.${this.classes.suggestion}`);
  }

  toggleDropdownEnabling(enable) {
    this.dropdownDisabled = !enable;
    this.$container.attr("disabled", !enable);
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

    that.$container.html(html.join(""));

    // Select first value by default:
    if (options.autoSelectFirst && that.selectedIndex === -1) {
      that.selectedIndex = 0;
    }
    if (that.selectedIndex !== -1) {
      that.getSuggestionsItems().eq(that.selectedIndex).addClass(that.classes.selected);
    }

    if (typeof options.beforeRender === "function") {
      options.beforeRender.call(that.element, that.$container);
    }

    that.$container.show();
    that.visible = true;
  }

  buildSuggestionHtml(suggestion, ordinal, html) {
    html.push(`<div class="${this.classes.suggestion}" data-index="${ordinal}">`);

    const formatResult = this.options.formatResult || this.type.formatResult || this.formatResult;
    html.push(
      formatResult.call(this, suggestion.value, this.currentValue, suggestion, {
        unformattableTokens: this.type.unformattableTokens,
      }),
      "</div>",
    );
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
    that.$container.hide().empty();
  }

  activate(index) {
    const that = this;
    let $activeItem;
    const selected = that.classes.selected;
    let $children;

    if (!that.dropdownDisabled) {
      $children = that.getSuggestionsItems();

      $children.removeClass(selected);

      that.selectedIndex = index;

      if (that.selectedIndex !== -1 && $children.length > that.selectedIndex) {
        $activeItem = $children.eq(that.selectedIndex);
        $activeItem.addClass(selected);
        return $activeItem;
      }
    }

    return null;
  }

  deactivate(restoreValue) {
    const that = this;

    if (!that.dropdownDisabled) {
      that.selectedIndex = -1;
      that.getSuggestionsItems().removeClass(that.classes.selected);
      if (restoreValue) {
        that.el.val(that.currentValue);
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
    const $activeItem = that.activate(index);
    let itemBottom;
    const scrollTop = that.$container[0].scrollTop;
    let containerHeight;

    if (!$activeItem || $activeItem.length === 0) {
      return;
    }

    const itemTop = $activeItem.position().top;
    if (itemTop < 0) {
      that.$container[0].scrollTop = scrollTop + itemTop;
    } else {
      itemBottom = itemTop + $activeItem.outerHeight();
      containerHeight = that.$container.innerHeight();
      if (itemBottom > containerHeight) {
        that.$container[0].scrollTop = scrollTop - containerHeight + itemBottom;
      }
    }

    that.el.val(that.suggestions[index].value);
  }

  createConstraints() {
    this.constraints = {};
  }

  setupConstraints() {
    const that = this;
    const constraints = that.options.constraints;
    let $parent;

    if (!constraints) {
      that.unbindFromParent();
      return;
    }

    if (constraints instanceof $ || typeof constraints === "string" || typeof constraints.nodeType === "number") {
      $parent = $(constraints);
      if (!$parent.is(that.constraints)) {
        that.unbindFromParent();
        if (!$parent.is(that.el)) {
          that.constraints = $parent;
          that.bindToParent();
        }
      }
    } else {
      $.each(that.constraints, function (id) {
        delete that.constraints[id];
      });
      for (const [, constraint] of (Array.isArray(constraints) ? constraints : [constraints]).entries()) {
        that.addConstraint(constraint);
      }
    }
  }

  filteredLocation(data) {
    const locationComponents = [];
    const location = {};

    $.each(this.type.dataComponents, function () {
      if (this.forLocations) locationComponents.push(this.id);
    });

    if (isPlainObject(data)) {
      // Copy to location only allowed fields
      $.each(data, function (key, value) {
        if (value && locationComponents.includes(key)) {
          location[key] = value;
        }
      });
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

    while (
      constraints instanceof $ &&
      (parentInstance = constraints[0][DATA_ATTR_KEY]) &&
      !(parentData = parentInstance?.selection?.data)
    ) {
      constraints = parentInstance.constraints;
    }

    if (constraints instanceof $) {
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
    } else if (constraints) {
      $.each(constraints, function (id, constraint) {
        locations = locations.concat(constraint.getFields());
      });

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
    const that = this;

    that.constraints
      .on(
        [
          `suggestions-select.${that.uniqueId}`,
          `suggestions-invalidateselection.${that.uniqueId}`,
          `suggestions-clear.${that.uniqueId}`,
        ].join(" "),
        (e, suggestion, valueChanged) => {
          // Don't clear if parent has been just enriched
          if (e.type !== "suggestions-select" || valueChanged) {
            that.clear();
          }
        },
      )
      .on(`suggestions-dispose.${that.uniqueId}`, () => {
        that.unbindFromParent();
      });
  }

  unbindFromParent() {
    const that = this;
    const $parent = that.constraints;

    if ($parent instanceof $) {
      $parent.off(`.${that.uniqueId}`);
    }
  }

  getParentInstance() {
    return this.constraints instanceof $ && this.constraints[0][DATA_ATTR_KEY];
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
    $.each(that.constraints, function (id, constraint) {
      $.each(constraint.locations, function (i, location) {
        if (location.containsData(data) && location.specificity > maxSpecificity) {
          maxSpecificity = location.specificity;
        }
      });
    });

    if (maxSpecificity >= 0) {
      // Для городов-регионов нужно также отсечь и город
      if (data.region_kladr_id && data.region_kladr_id === data.city_kladr_id) {
        restrictedKeys.push.apply(restrictedKeys, that.type.dataComponentsById.city.fields);
      }

      // Collect all fieldnames from all restricted components
      $.each(that.type.dataComponents.slice(0, maxSpecificity + 1), function (i, component) {
        restrictedKeys.push.apply(restrictedKeys, component.fields);
      });

      // Copy skipping restricted fields
      $.each(data, function (key, value) {
        if (!restrictedKeys.includes(key)) {
          unrestrictedData[key] = value;
        }
      });
    } else {
      unrestrictedData = data;
    }

    return unrestrictedData;
  }
}

notificator
  .on("assignSuggestions", Suggestions.prototype.selectFoundSuggestion)
  .on("assignSuggestions", Suggestions.prototype.suggest)
  .on("dispose", Suggestions.prototype.removeContainer)
  .on("dispose", Suggestions.prototype.unbindElementEvents)
  .on("dispose", Suggestions.prototype.unbindFromParent)
  .on("initialize", Suggestions.prototype.bindElementEvents)
  .on("initialize", Suggestions.prototype.createConstraints)
  .on("initialize", Suggestions.prototype.createContainer)
  .on("initialize", Suggestions.prototype.setupBounds)
  .on("ready", Suggestions.prototype.showContainer)
  .on("requestParams", Suggestions.prototype.constructBoundsParams)
  .on("requestParams", Suggestions.prototype.constructConstraintsParams)
  .on("setOptions", Suggestions.prototype.checkStatus)
  .on("setOptions", Suggestions.prototype.setBoundsOptions)
  .on("setOptions", Suggestions.prototype.setContainerOptions)
  .on("setOptions", Suggestions.prototype.setupConstraints);

let geoLocation;
let locationChecked = false;

async function checkLocation(this: Suggestions) {
  const providedLocation = this.options.geoLocation;
  if (!this.type.geoEnabled && !providedLocation) {
    return;
  }

  if (locationChecked) return;
  locationChecked = true;

  if (providedLocation && Array.isArray(providedLocation)) {
    geoLocation = providedLocation;
  } else {
    const { url, options } = this.getFetchParams("iplocate/address");

    const resp = await $fetch(url, options);

    const locationData = resp?.location?.data;
    if (locationData?.kladr_id) {
      geoLocation = { kladr_id: locationData.kladr_id };
    }
  }
}

function constructParams(this: Suggestions) {
  const params = {};

  if (this.options.type === "ADDRESS" && geoLocation) {
    params.locations_boost = [geoLocation];
  }

  return params;
}

notificator.on("setOptions", checkLocation).on("requestParams", constructParams);

export { Suggestions };
