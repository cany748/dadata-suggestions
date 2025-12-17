import type { DataComponents } from "./types/address";

export type Suggestion<T> = {
  value: string;
  unrestricted_value: string;
  data: T;
};

export type SuggestionName = {
  /** Пол */
  gender: "FEMALE" | "MALE" | "UNKNOWN";
  /** Имя */
  name: string | null;
  /** Отчество */
  patronymic: string | null;
  /**
   * Код качества
   * - 0 - если все части ФИО найдены в справочниках.
   * - 1 - если в ФИО есть часть не из справочника
   */
  qc: "0" | "1";
  /** Не используeтся */
  source: null;
  /** Фамилия */
  surname: string | null;
};

export type SuggestionAddress = {
  /** Индекс */
  postal_code: string | null;
  /** Страна */
  country: string;
  /** Двухсимвольный код страны ISO 3166 */
  country_iso_code: string;
  /** Федеральный округ */
  federal_district: string | null;
  /** ФИАС-код региона - Geonames */
  region_fias_id: string;
  /** КЛАДР-код региона */
  region_kladr_id: string;
  /** Код региона ISO 3166 */
  region_iso_code: string;
  /** Регион с типом */
  region_with_type: string;
  /** Тип региона (сокращенный) */
  region_type: string;
  /** Тип региона */
  region_type_full: string;
  /** Регион */
  region: string;
  /** ФИАС-код района - Geonames */
  area_fias_id: string | null;
  /** КЛАДР-код района в регионе */
  area_kladr_id: string | null;
  /** Район в регионе с типом */
  area_with_type: string | null;
  /** Тип района в регионе (сокращенный) */
  area_type: string | null;
  /** Тип района в регионе */
  area_type_full: string | null;
  /** Район в регионе */
  area: string | null;
  /** ФИАС-код города - Geonames */
  city_fias_id: string | null;
  /** КЛАДР-код города */
  city_kladr_id: string | null;
  /** Город с типом */
  city_with_type: string | null;
  /** Тип города (сокращенный) */
  city_type: string | null;
  /** Тип города */
  city_type_full: string | null;
  /** Город */
  city: string | null;
  /** Административный округ (только для Москвы) */
  city_area: string | null;
  /** Не используeтся */
  city_district_fias_id: null;
  /** Не используeтся */
  city_district_kladr_id: null;
  /**
   * Адм. район города с типом
   *
   * Поля заполняются при выборе конкретной подсказки или через метод API findById. До этого они пустые.
   */
  city_district_with_type: string | null;
  /**
   * Тип адм. района города (сокращенный)
   *
   * Поля заполняются при выборе конкретной подсказки или через метод API findById. До этого они пустые.
   */
  city_district_type: string | null;
  /**
   * Тип адм. района города
   *
   * Поля заполняются при выборе конкретной подсказки или через метод API findById. До этого они пустые.
   */
  city_district_type_full: string | null;
  /**
   * Адм. район города
   *
   * Поля заполняются при выборе конкретной подсказки или через метод API findById. До этого они пустые.
   */
  city_district: string | null;
  /** ФИАС-код нас. пункта - Geonames */
  settlement_fias_id: string | null;
  /** КЛАДР-код нас. пункта */
  settlement_kladr_id: string | null;
  /** Населенный пункт с типом */
  settlement_with_type: string | null;
  /** Тип населенного пункта (сокращенный) */
  settlement_type: string | null;
  /** Тип населенного пункта */
  settlement_type_full: string | null;
  /** Населенный пункт */
  settlement: string | null;
  /** ФИАС-код улицы - Geonames */
  street_fias_id: string | null;
  /** КЛАДР-код улицы */
  street_kladr_id: string | null;
  /** Улица с типом */
  street_with_type: string | null;
  /** Тип улицы (сокращенный) */
  street_type: string | null;
  /** Тип улицы */
  street_type_full: string | null;
  /** Улица */
  street: string | null;
  /** ФИАС-код участка */
  stead_fias_id: string | null;
  /** Кадастровый номер участка */
  stead_cadnum: string | null;
  /** Тип участка (сокращенный) */
  stead_type: string | null;
  /** Тип участка */
  stead_type_full: string | null;
  /** Участок */
  stead: string | null;
  /** ФИАС-код дома - Geonames */
  house_fias_id: string | null;
  /** КЛАДР-код дома */
  house_kladr_id: string | null;
  /** Кадастровый номер дома */
  house_cadnum: string | null;
  /** Количество квартир в доме */
  house_flat_count: string | null;
  /** Тип дома (сокращенный) */
  house_type: string | null;
  /** Тип дома */
  house_type_full: string | null;
  /** Дом */
  house: string | null;
  /** Тип корпуса/строения (сокращенный) */
  block_type: string | null;
  /** Тип корпуса/строения */
  block_type_full: string | null;
  /** Корпус/строение */
  block: string | null;
  /** Не используeтся */
  entrance: null;
  /** Не используeтся */
  floor: null;
  /** ФИАС-код квартиры */
  flat_fias_id: string | null;
  /** Кадастровый номер квартиры */
  flat_cadnum: string | null;
  /** Тип квартиры (сокращенный) */
  flat_type: string | null;
  /** Тип квартиры */
  flat_type_full: string | null;
  /** Квартира */
  flat: string | null;
  /** Площадь квартиры */
  flat_area: string | null;
  /** Рыночная стоимость м² */
  square_meter_price: string | null;
  /** Рыночная стоимость квартиры */
  flat_price: string | null;
  /** ФИАС-код комнаты */
  room_fias_id: string | null;
  /** Кадастровый номер комнаты */
  room_cadnum: string | null;
  /** Тип комнаты (сокращенный) */
  room_type: string | null;
  /** Тип комнаты */
  room_type_full: string | null;
  /** Комната */
  room: string | null;
  /** Абонентский ящик */
  postal_box: string | null;
  /** ФИАС-код адреса - Geonames */
  fias_id: string;
  /** Не используeтся */
  fias_code: null;
  /**
   * Уровень детализации, до которого адрес найден в ФИАС:
   * - 0 — страна
   * - 1 — регион
   * - 3 — район
   * - 4 — город
   * - 5 — район города
   * - 6 — населенный пункт
   * - 7 — улица
   * - 8 — дом
   * - 9 — квартира
   * - 65 — планировочная структура
   * - 75 — земельный участок
   * - -1 — иностранный или пустой.
   */
  fias_level: string;
  /**
   * Признак актуальности адреса в ФИАС:
   * - 0 — актуальный
   * - 1-50 — переименован
   * - 51 — переподчинен
   * - 99 — удален
   */
  fias_actuality_state: string;
  /** КЛАДР-код адреса */
  kladr_id: string;
  /** Идентификатор объекта в международной базе GeoNames. */
  geoname_id: string | null;
  /**
   * Признак центра района или региона:
   * - 1 — центр района (Московская обл, Одинцовский р-н, г Одинцово)
   * - 2 — центр региона (Новосибирская обл, г Новосибирск)
   * - 3 — центр района и региона (Томская обл, г Томск)
   * - 4 — центральный район региона (Тюменская обл, Тюменский р-н)
   * - 0 — ничего из перечисленного (Московская обл, г Балашиха)
   */
  capital_marker: "1" | "2" | "3" | "4" | "0";
  /** Код ОКАТО */
  okato: string | null;
  /** Код ОКТМО */
  oktmo: string | null;
  /** Код ИФНС для физических лиц */
  tax_office: string | null;
  /** Код ИФНС для организаций */
  tax_office_legal: string | null;
  /** Часовой пояс */
  timezone: string | null;
  /** Координаты: широта */
  geo_lat: string | null;
  /** Координаты: долгота */
  geo_lon: string | null;
  /** Внутри кольцевой? */
  beltway_hit: string | null;
  /** Расстояние от кольцевой в километрах */
  beltway_distance: string | null;
  /**
   * Ближайшие станции метро (не более 3 станций в радиусе 5 км).
   *
   * Поля заполняются при выборе конкретной подсказки или через метод API findById. До этого они пустые.
   */
  metro:
    | {
        /** Название станции */
        name: string;
        /** Название линии */
        line: string;
        /** Расстояние до станции в километрах */
        distance: number;
      }[]
    | null;
  /** Не используeтся */
  divisions: null;
  /** Код точности координат:
   * - 0 — точные координаты
   * - 1 — ближайший дом
   * - 2 — улица
   * - 3 — населенный пункт
   * - 4 — город
   * - 5 — координаты не определены, отсутствуют в справочнике
   * - 6 — не загружен справочник с геокоординатами
   */
  qc_geo: "0" | "1" | "2" | "3" | "4" | "5" | "6";
  /** Не используeтся */
  qc_complete: null;
  /** Не используeтся */
  qc_house: null;
  /**
   * Список исторических названий объекта нижнего уровня.
   *
   * Если подсказка до улицы — это прошлые названия этой улицы, если до города — города.
   */
  history_values: string[] | null;
  /** Не используeтся */
  unparsed_parts: null;
  /**
   * - Для организаций — адрес как в ЕГРЮЛ.
   * - Для банков — адрес как в справочнике БИК.
   * - В остальных случаях — пустое.
   */
  source: string | null;
  /** Не используeтся */
  qc: null;
};

type PartyAuthorities = {
  /** Код гос. органа */
  type: string;
  /** Код отделения */
  code: string;
  /** Наименование отделения */
  name: string;
  /** Адрес отделения одной строкой */
  address: string | null;
};

type PartyDocument = {
  /** Тип документа */
  type: string;
  /** Серия документа */
  series: string | null;
  /** Номер документа */
  number: number | null;
  /** Дата выдачи */
  issue_date: number;
  /** Код подразделения */
  issue_authority: string | null;
};

type PartyInvalidity = {
  /** Код причины недостоверности */
  code: "PARTY" | "FTS" | "COURT" | "OTHER";
  /** Решение суда (только для code = COURT) */
  decision: {
    /** Наименование суда */
    court_name: string;
    /** Номер судебного решения */
    number: string;
    /** Дата судебного решения */
    date: number;
  } | null;
};

export type SuggestionParty = {
  /** КПП */
  kpp: string;
  /** Не используeтся */
  kpp_largest: null;
  /** Уставной капитал компании */
  capital: {
    /** Тип капитала */
    type: string;
    /** Размер капитала */
    value: number;
  } | null;
  /** Недостоверность сведений о компании */
  invalid: boolean | null;
  /** Руководитель */
  management: {
    /** ФИО руководителя */
    name: string;
    /** Должность руководителя */
    post: string;
    /** Дата вступления в должность */
    start_date: number;
    /** true, если в состав руководства входят дисквалифицированные лица */
    disqualified: boolean | null;
  } | null;
  /** Учредители компании */
  founders:
    | {
        /** ИНН учредителя */
        inn: string;
        /** ФИО учредителя (для физлиц) */
        fio: SuggestionName;
        /** Внутренний идентификатор */
        hid: string;
        /** Тип учредителя */
        type: "PHYSICAL" | "LEGAL";
        /** Доля учредителя */
        share: {
          /** Значение (для type = PERCENT и type = DECIMAL) */
          value: number;
          /** Тип значения */
          type: "PERCENT" | "DECIMAL" | "FRACTION";
          /** Числитель дроби (для type = FRACTION) */
          numerator?: number;
          /** Знаменатель дроби (для type = FRACTION) */
          denominator?: number;
        } | null;
        /** Недостоверность сведений об учредителе */
        invalidity: PartyInvalidity | null;
        /** Дата вступления в должность */
        start_date: number;
      }[]
    | null;

  /** Руководители компании */
  managers:
    | {
        /** ИНН руководителя */
        inn: string;
        /** ФИО руководителя (для физлиц) */
        fio: SuggestionName;
        /** Должность руководителя (для физлиц) */
        post: string;
        /** Внутренний идентификатор */
        hid: string;
        /**
         * Тип руководителя
         * - EMPLOYEE - сотрудник
         * - LEGAL - юрлицо
         */
        type: "EMPLOYEE" | "LEGAL";
        /** Недостоверность сведений о руководителе */
        invalidity: PartyInvalidity | null;
        /** Дата вступления в должность */
        start_date: number;
      }[]
    | null;
  /** Правопредшественники, только для юрлиц */
  predecessors:
    | {
        /** ОГРН предшественника */
        ogrn: string;
        /** ИНН предшественника */
        inn: string;
        /** Наименование предшественника */
        name: string;
      }[]
    | null;
  /** Правопреемники, только для юрлиц */
  successors:
    | {
        /** ОГРН преемника */
        ogrn: string;
        /** ИНН преемника */
        inn: string;
        /** Наименование преемника */
        name: string;
      }[]
    | null;
  /**
   * Тип подразделения
   * - MAIN — головная организация
   * - BRANCH — филиал
   */
  branch_type: "MAIN" | "BRANCH";
  /** Количество филиалов */
  branch_count: number;
  /** Не используeтся */
  source: null;
  /** Не используeтся */
  qc: null;
  /** Внутренний идентификатор */
  hid: string;
  /**
   * Тип организации
   * - LEGAL - юридическое лицо
   * - INDIVIDUAL - индивидуальный предприниматель
   */
  type: "LEGAL" | "INDIVIDUAL";
  /** Состояние */
  state: {
    /**
     * Статус организации
     * - ACTIVE - действующая
     * - LIQUIDATING - ликвидируется
     * - LIQUIDATED -ликвидирована
     * - REORGANIZING - в процессе присоединения к другому юрлицу, с последующей ликвидацией
     * - BANKRUPT - банкрот (с февраля 2021)
     */
    status: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "REORGANIZING" | "BANKRUPT";
    /**
     * Детальный статус
     *
     * https://github.com/hflabs/party-state/blob/master/party-state.cs
     */
    code: string | null;
    /** Дата актуальности сведений */
    actuality_date: number;
    /** Дата регистрации */
    registration_date: number;
    /** Дата ликвидации */
    liquidation_date: number | null;
  };
  /** Организационно-правовая форма */
  opf: {
    /** Версия справочника ОКОПФ */
    type: string;
    /** Код ОКОПФ */
    code: string;
    /** Полное название ОПФ */
    full: string;
    /** Краткое название ОПФ */
    short: string;
  };
  /** Наименование */
  name: {
    /** Полное наименование */
    full_with_opf: string;
    /** Краткое наименование */
    short_with_opf: string;
    /** Не используeтся */
    latin: null;
    /** Полное наименование без ОПФ. Генерируется на основе full_with_opf, может содержать ошибки */
    full: string;
    /** Краткое наименование без ОПФ. Генерируется на основе short_with_opf, может содержать ошибки */
    short: string;
  };
  /** ИНН */
  inn: string;
  /** ОГРН */
  ogrn: string;
  /** Код ОКПО */
  okpo: string | null;
  /** Код ОКАТО */
  okato: string | null;
  /** Код ОКТМО */
  oktmo: string | null;
  /** Код ОКОГУ */
  okogu: string | null;
  /** Код ОКФС */
  okfs: string | null;
  /** Код ОКВЭД */
  okved: string;
  /** Коды ОКВЭД дополнительных видов деятельности */
  okveds:
    | {
        /** Основной или нет */
        main: boolean;
        /** Версия справочника ОКВЭД */
        type: "2001" | "2014";
        /** Код по справочнику */
        code: string;
        /** Наименование по справочнику */
        name: string;
      }[]
    | null;
  /** Сведения о налоговой, ПФР и ФСС */
  authorities: {
    /** ИФНС регистрации */
    fts_registration: PartyAuthorities | null;
    /** ИФНС отчётности */
    fts_report: PartyAuthorities | null;
    /** Отделение Пенсионного фонда */
    pf: PartyAuthorities | null;
    /** Отделение Фонда соц. страхования */
    sif: PartyAuthorities | null;
  } | null;
  /** Документы */
  documents: {
    /** Свидетельство о регистрации в налоговой */
    fts_registration: PartyDocument | null;
    /** Сведения об учете в налоговом органе */
    fts_report: PartyDocument | null;
    /** Свидетельство о регистрации в Пенсионном фонде */
    pf_registration: PartyDocument | null;
    /** Свидетельство о регистрации в Фонде соц. страхования */
    sif_registration: PartyDocument | null;
    /** Запись в реестре малого и среднего предпринимательства */
    smb: PartyDocument | null;
  } | null;
  /** Лицензии */
  licenses: unknown[] | null;
  /** Финансовая информация */
  finance: {
    /** Система налогообложения организации */
    tax_system: string | null;
    /** Доходы по данным бухгалтерской отчетности */
    income: number | null;
    /** Расходы по данным бухгалтерской отчетности */
    expense: number | null;
    /** Выручка по данным бухгалтерской отчетности */
    revenue: number | null;
    /** Задолженность по налоговым платежам за позапрошлый год */
    debt: number | null;
    /** Наложенные штрафы за позапрошлый год */
    penalty: number | null;
    /** Год бухгалтерской отчестности */
    year: number | null;
  } | null;
  /** Адрес */
  address: Suggestion<SuggestionAddress> & {
    /** Недостоверность сведений об адресе */
    invalidity: PartyInvalidity | null;
  };
  /** Телефоны */
  phones: { value: string; unrestricted_value: string }[] | null;
  /** Адреса эл. почты */
  emails: { value: string; unrestricted_value: string }[] | null;
  /** Дата выдачи ОГРН */
  ogrn_date: number;
  /** Версия справочника ОКВЭД (2001 или 2014) */
  okved_type: "2001" | "2014";
  /** Количество сотрудников */
  employee_count: number;
};

export type SuggestionEmail = {
  /** Именная часть */
  local: string;
  /** Доменная часть */
  domain: string | null;
  /** Не используeтся */
  type: null;
  /** Не используeтся */
  source: null;
  /** Не используeтся */
  qc: null;
};

export type SuggestionBank = {
  /** Тип кредитной организации */
  opf: {
    /**
     * Код типа
     * - CBR — главное управление Банка России
     * - BANK — банк
     * - BANK_BRANCH — филиал банка
     * - NKO — небанковская кредитная организация (НКО)
     * - NKO_BRANCH — филиал НКО
     * - RKC — расчетно-кассовый центр
     * - TREASURY — территориальный орган Федерального казначейства
     * - OTHER — другой
     */
    type: "CBR" | "BANK" | "BANK_BRANCH" | "NKO" | "NKO_BRANCH" | "RKC" | "TREASURY" | "OTHER";
    /** Не используeтся */
    full: null;
    /** Не используeтся */
    short: null;
  };
  /** Наименование */
  name: {
    /** Платежное */
    payment: string;
    /** Не используeтся */
    full: null;
    /** Краткое */
    short: string;
  };
  /** БИК */
  bic: string;
  /** SWIFT */
  swift: string | null;
  /** ИНН */
  inn: string;
  /** КПП */
  kpp: string;
  /** Не используeтся */
  okpo: null;
  /** Корреспондентский счет */
  correspondent_account: string;
  /** Казначейские счета территориального ОФК */
  treasury_accounts: string[] | null;
  /** Регистрационный номер */
  registration_number: string;
  /** Город для платежного поручения (поля справочника Tnp + Nnp) */
  payment_city: string;
  /** Состояние */
  state: {
    /**
     * Статус
     * - ACTIVE — действующая
     * - LIQUIDATING — ликвидируется
     * - LIQUIDATED — ликвидирована
     *
     *  Статус LIQUIDATED в реальных данных не встречается, потому что Банк России не возвращает информацию о ликвидированных финансовых организациях.
     */
    status: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED";
    /** Не используeтся */
    code: null;
    /** Дата актуальности сведений */
    actuality_date: number;
    /** Дата регистрации */
    registration_date: number;
    /** Дата ликвидации */
    liquidation_date: number | null;
  };
  /** Не используeтся */
  rkc: null;
  /** Заполняется только при вызове через метод API findById */
  cbr: null;
  /** Адрес регистрации */
  address: Suggestion<SuggestionAddress>;
  /** Не используeтся */
  phones: null;
};

export type SuggestionFms = {
  /** Код подразделения */
  code: string;
  /** Название подразделения в творительном падеже («кем выдан?») */
  name: string;
  /** Код региона (2 цифры) */
  region_code: string;
  /**
   * Вид подразделения
   * - 0 — подразделение ФМС
   * - 1 — ГУВД или МВД региона
   * - 2 — УВД или ОВД района или города
   * - 3 — отделение полиции
   */
  type: "0" | "1" | "2" | "3";
};

type SuggestionMap = {
  NAME: SuggestionName;
  ADDRESS: SuggestionAddress;
  PARTY: SuggestionParty;
  EMAIL: SuggestionEmail;
  BANK: SuggestionBank;
  FMS: SuggestionFms;
};

export type SuggestionAny = SuggestionMap[keyof SuggestionMap];

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
  dataComponentsById?: Record<string, any>;
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
  /** Компонует значение на основе данных */
  composeValue?: (data: any, options?: any) => string;
  /** Получение значения для выбора */
  getSuggestionValue?: (that: any, options: any) => string | null;
};

export type Options<T extends keyof SuggestionMap = keyof SuggestionMap> = {
  token: string;
  type: T;
  params?: Record<string, any>;
  bounds?: string; // TODO:
  constraints?: string;
  triggerSelectOnSpace?: boolean;
  noCache?: boolean;
  hint?: boolean | string;
  addon?: string;
  onSelect?: (suggestion: Suggestion<SuggestionMap[T]>) => void | Promise<void>;
  formatResul?: (value: string, currentValue: string, suggestion: Suggestion<SuggestionMap[T]>) => string;
  onSelectNothing?: (query: string) => void;
};
