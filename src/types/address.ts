import { fieldsAreNotEmpty, highlightMatches, isPlainObject, tokenize } from "../utils";
import { matchers } from "../matchers";
import type { ComposeValueOptions, Suggestion, SuggestionAddress, SuggestionsType } from "../types";
import type { Suggestions } from "../suggestions";

export const ADDRESS_STOPWORDS = [
  "ао",
  "аобл",
  "дом",
  "респ",
  "а/я",
  "аал",
  "автодорога",
  "аллея",
  "арбан",
  "аул",
  "б-р",
  "берег",
  "бугор",
  "вал",
  "вл",
  "волость",
  "въезд",
  "высел",
  "г",
  "городок",
  "гск",
  "д",
  "двлд",
  "днп",
  "дор",
  "дп",
  "ж/д_будка",
  "ж/д_казарм",
  "ж/д_оп",
  "ж/д_платф",
  "ж/д_пост",
  "ж/д_рзд",
  "ж/д_ст",
  "жилзона",
  "жилрайон",
  "жт",
  "заезд",
  "заимка",
  "зона",
  "к",
  "казарма",
  "канал",
  "кв",
  "кв-л",
  "км",
  "кольцо",
  "комн",
  "кордон",
  "коса",
  "кп",
  "край",
  "линия",
  "лпх",
  "м",
  "массив",
  "местность",
  "мкр",
  "мост",
  "н/п",
  "наб",
  "нп",
  "обл",
  "округ",
  "остров",
  "оф",
  "п",
  "п/о",
  "п/р",
  "п/ст",
  "парк",
  "пгт",
  "пер",
  "переезд",
  "пл",
  "пл-ка",
  "платф",
  "погост",
  "полустанок",
  "починок",
  "пр-кт",
  "проезд",
  "промзона",
  "просек",
  "просека",
  "проселок",
  "проток",
  "протока",
  "проулок",
  "р-н",
  "рзд",
  "россия",
  "рп",
  "ряды",
  "с",
  "с/а",
  "с/мо",
  "с/о",
  "с/п",
  "с/с",
  "сад",
  "сквер",
  "сл",
  "снт",
  "спуск",
  "ст",
  "ст-ца",
  "стр",
  "тер",
  "тракт",
  "туп",
  "у",
  "ул",
  "уч-к",
  "ф/х",
  "ферма",
  "х",
  "ш",
  "бульвар",
  "владение",
  "выселки",
  "гаражно-строительный",
  "город",
  "деревня",
  "домовладение",
  "дорога",
  "квартал",
  "километр",
  "комната",
  "корпус",
  "литер",
  "леспромхоз",
  "местечко",
  "микрорайон",
  "набережная",
  "область",
  "переулок",
  "платформа",
  "площадка",
  "площадь",
  "поселение",
  "поселок",
  "проспект",
  "разъезд",
  "район",
  "республика",
  "село",
  "сельсовет",
  "слобода",
  "сооружение",
  "станица",
  "станция",
  "строение",
  "территория",
  "тупик",
  "улица",
  "улус",
  "участок",
  "хутор",
  "шоссе",
];

export const ADDRESS_COMPONENTS = [
  {
    id: "kladr_id",
    fields: ["kladr_id"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "postal_code",
    fields: ["postal_code"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "country_iso_code",
    fields: ["country_iso_code"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "country",
    fields: ["country"],
    forBounds: true,
    forLocations: true,
    kladrFormat: { digits: 0, zeros: 13 },
    fiasType: "country_iso_code",
  },
  {
    id: "region_iso_code",
    fields: ["region_iso_code"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "region_fias_id",
    fields: ["region_fias_id"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "region_type_full",
    fields: ["region_type_full"],
    forBounds: false,
    forLocations: true,
    kladrFormat: { digits: 2, zeros: 11 },
    fiasType: "region_fias_id",
  },
  {
    id: "region",
    fields: ["region", "region_type", "region_type_full", "region_with_type"],
    forBounds: true,
    forLocations: true,
    kladrFormat: { digits: 2, zeros: 11 },
    fiasType: "region_fias_id",
  },
  {
    id: "area_fias_id",
    fields: ["area_fias_id"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "area_type_full",
    fields: ["area_type_full"],
    forBounds: false,
    forLocations: true,
    kladrFormat: { digits: 5, zeros: 8 },
    fiasType: "area_fias_id",
  },
  {
    id: "area",
    fields: ["area", "area_type", "area_type_full", "area_with_type"],
    forBounds: true,
    forLocations: true,
    kladrFormat: { digits: 5, zeros: 8 },
    fiasType: "area_fias_id",
  },
  {
    id: "city_fias_id",
    fields: ["city_fias_id"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "city_type_full",
    fields: ["city_type_full"],
    forBounds: false,
    forLocations: true,
    kladrFormat: { digits: 8, zeros: 5 },
    fiasType: "city_fias_id",
  },
  {
    id: "city",
    fields: ["city", "city_type", "city_type_full", "city_with_type"],
    forBounds: true,
    forLocations: true,
    kladrFormat: { digits: 8, zeros: 5 },
    fiasType: "city_fias_id",
  },
  {
    id: "city_district_fias_id",
    fields: ["city_district_fias_id"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "city_district_type_full",
    fields: ["city_district_type_full"],
    forBounds: false,
    forLocations: true,
    kladrFormat: { digits: 11, zeros: 2 },
    fiasType: "city_district_fias_id",
  },
  {
    id: "city_district",
    fields: ["city_district", "city_district_type", "city_district_type_full", "city_district_with_type"],
    forBounds: true,
    forLocations: true,
    kladrFormat: { digits: 11, zeros: 2 },
    fiasType: "city_district_fias_id",
  },
  {
    id: "settlement_fias_id",
    fields: ["settlement_fias_id"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "settlement_type_full",
    fields: ["settlement_type_full"],
    forBounds: false,
    forLocations: true,
    kladrFormat: { digits: 11, zeros: 2 },
    fiasType: "settlement_fias_id",
  },
  {
    id: "settlement",
    fields: ["settlement", "settlement_type", "settlement_type_full", "settlement_with_type"],
    forBounds: true,
    forLocations: true,
    kladrFormat: { digits: 11, zeros: 2 },
    fiasType: "settlement_fias_id",
  },
  {
    id: "street_fias_id",
    fields: ["street_fias_id"],
    forBounds: false,
    forLocations: true,
  },
  {
    id: "street_type_full",
    fields: ["street_type_full"],
    forBounds: false,
    forLocations: true,
    kladrFormat: { digits: 15, zeros: 2 },
    fiasType: "street_fias_id",
  },
  {
    id: "street",
    fields: ["street", "street_type", "street_type_full", "street_with_type"],
    forBounds: true,
    forLocations: true,
    kladrFormat: { digits: 15, zeros: 2 },
    fiasType: "street_fias_id",
  },
  {
    id: "house",
    fields: ["house", "house_type", "house_type_full", "block", "block_type"],
    forBounds: true,
    forLocations: true,
    kladrFormat: { digits: 19 },
    fiasType: "house_fias_id",
  },
  {
    id: "flat",
    fields: ["flat", "flat_type", "flat_type_full"],
    forBounds: true,
    forLocations: false,
    kladrFormat: { digits: 19 },
    fiasType: "flat_fias_id",
  },
] as const;

export type DataComponents = (typeof ADDRESS_COMPONENTS)[number];

/**
 * Возвращает карту объектов по их идентификаторам.
 * Принимает на вход массив объектов и идентифицирующее поле.
 * Возвращает карты, ключом в которой является значение идентифицирующего поля, а значением — исходный объект.
 * Заодно добавляет объектам поле с порядковым номером.
 */
const indexObjectsById = (objectsArray: readonly DataComponents[]) => {
  const result = {} as Record<DataComponents["id"], { index: number } & DataComponents>;

  for (const [idx, obj] of objectsArray.entries()) {
    const key = obj.id;

    const val = { index: idx };

    result[key] = Object.assign(val, obj);
  }

  return result;
};

const componentsUnderCityDistrict = ADDRESS_COMPONENTS.slice(
  ADDRESS_COMPONENTS.findIndex((component) => component.id === "city_district") + 1,
).map((component) => component.id);

/**
 * Возвращает список слов в запросе,
 * которые не встречаются в подсказке
 */
const findUnusedTokens = (tokens: string[], value: string) => {
  return tokens.filter((token) => {
    return !value.includes(token);
  });
};

/**
 * Возвращает исторические названия для слов запроса,
 * для которых не найдено совпадения в основном значении подсказки
 */
const getFormattedHistoryValues = (unusedTokens: string[], historyValues: string[]) => {
  const values = [];
  let formatted = "";

  for (const historyValue of historyValues) {
    for (const token of unusedTokens) {
      if (historyValue.toLowerCase().includes(token)) {
        values.push(historyValue);
        break;
      }
    }
  }

  if (values.length > 0) {
    formatted = ` (бывш. ${values.join(", ")})`;
  }

  return formatted;
};

const composeValue = (data: Partial<SuggestionAddress>, options?: ComposeValueOptions) => {
  const country = data.country;
  let region = data.region_with_type || [data.region, data.region_type].filter((e) => !!e).join(" ") || data.region_type_full;
  const area = data.area_with_type || [data.area_type, data.area].filter((e) => !!e).join(" ") || data.area_type_full;
  const city = data.city_with_type || [data.city_type, data.city].filter((e) => !!e).join(" ") || data.city_type_full;
  const settelement =
    data.settlement_with_type || [data.settlement_type, data.settlement].filter((e) => !!e).join(" ") || data.settlement_type_full;
  let cityDistrict =
    data.city_district_with_type ||
    [data.city_district_type, data.city_district].filter((e) => !!e).join(" ") ||
    data.city_district_type_full;
  const street = data.street_with_type || [data.street_type, data.street].filter((e) => !!e).join(" ") || data.street_type_full;
  const house = [data.stead_type, data.stead, data.house_type, data.house, data.block_type, data.block].filter((e) => !!e).join(" ");
  const flat = [data.flat_type, data.flat].filter((e) => !!e).join(" ");
  const postalBox = data.postal_box && `а/я ${data.postal_box}`;

  // если регион совпадает с городом
  // например г Москва, г Москва
  // то не показываем регион
  if (region === city) {
    region = "";
  }

  // иногда не показываем район
  if (!(options && options.saveCityDistrict)) {
    if (options && options.excludeCityDistrict) {
      // если район явно запрещен
      cityDistrict = "";
    } else if (cityDistrict && !data.city_district_fias_id) {
      // если район взят из ОКАТО (у него пустой city_district_fias_id)
      cityDistrict = "";
    }
  }

  return [country, region, area, city, cityDistrict, settelement, street, house, flat, postalBox].filter((e) => !!e).join(", ");
};

/*
 * Compose suggestion value with respect to constraints
 */
const getValueWithinConstraints = (
  instance: Suggestions<any>,
  suggestion: Suggestion<SuggestionAddress>,
  options?: ComposeValueOptions,
) => {
  return composeValue(instance.getUnrestrictedData(suggestion.data), options);
};

/*
 * Compose suggestion value with respect to bounds
 */
const getValueWithinBounds = (instance: Suggestions<any>, suggestion: Suggestion<SuggestionAddress>, options?: ComposeValueOptions) => {
  // для корректного составления адреса нужен city_district_fias_id
  const data = instance.copyDataComponents(suggestion.data, [...instance.bounds.own, "city_district_fias_id"]);

  return composeValue(data, options);
};

export const ADDRESS_TYPE = {
  urlSuffix: "address",
  noSuggestionsHint: "Неизвестный адрес",
  matchers: [matchers.matchByNormalizedQuery(ADDRESS_STOPWORDS), matchers.matchByWordsAddress(ADDRESS_STOPWORDS)],
  dataComponents: ADDRESS_COMPONENTS,
  dataComponentsById: indexObjectsById(ADDRESS_COMPONENTS),
  unformattableTokens: ADDRESS_STOPWORDS,
  enrichmentEnabled: true,
  enrichmentMethod: "suggest",
  enrichmentParams: {
    count: 1,
    locations: null,
    locations_boost: null,
    from_bound: null,
    to_bound: null,
  },
  getEnrichmentQuery(suggestion) {
    return suggestion.unrestricted_value;
  },
  geoEnabled: true,
  isDataComplete(suggestion) {
    const fields = [this.bounds.to || "flat"];
    const data = suggestion.data;

    return !isPlainObject(data) || fieldsAreNotEmpty(data, fields);
  },
  composeValue,
  formatResult(value, currentValue, suggestion, options) {
    const district = suggestion.data && suggestion.data.city_district_with_type;
    const unformattableTokens = options && options.unformattableTokens;
    const historyValues = suggestion.data && suggestion.data.history_values;
    let tokens;
    let unusedTokens;
    let formattedHistoryValues;

    // добавляем исторические значения
    if (historyValues && historyValues.length > 0) {
      tokens = tokenize(currentValue, unformattableTokens);
      unusedTokens = findUnusedTokens(tokens, value);
      formattedHistoryValues = getFormattedHistoryValues(unusedTokens, historyValues);
      if (formattedHistoryValues) {
        value += formattedHistoryValues;
      }
    }

    value = highlightMatches(value, currentValue, options);
    value = this.wrapFormattedValue(value, suggestion);

    if (
      district &&
      (this.bounds.own.length === 0 || this.bounds.own.includes("street")) &&
      Object.keys(this.copyDataComponents(suggestion.data, componentsUnderCityDistrict)).length > 0
    ) {
      value += `<div class="${this.classes.subtext}">${highlightMatches(district, currentValue)}</div>`;
    }

    return value;
  },

  getSuggestionValue(instance, options) {
    let formattedValue = null;

    if (options.hasSameValues) {
      if (instance.options.restrict_value) {
        // Can not use unrestricted address,
        // because some components (from constraints) must be omitted
        formattedValue = getValueWithinConstraints(instance, options.suggestion);
      } else if (instance.bounds.own.length > 0) {
        // Can not use unrestricted address,
        // because only components from bounds must be included
        formattedValue = getValueWithinBounds(instance, options.suggestion);
      } else {
        // Can use full unrestricted address
        formattedValue = options.suggestion.unrestricted_value;
      }
    } else if (options.hasBeenEnriched && instance.options.restrict_value) {
      formattedValue = getValueWithinConstraints(instance, options.suggestion, { excludeCityDistrict: true });
    }

    return formattedValue;
  },
} satisfies SuggestionsType<SuggestionAddress>;
