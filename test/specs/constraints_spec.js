import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Address constraints", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const fixtures = {
    fullyAddress: {
      value: "Тульская обл, Узловский р-н, г Узловая, поселок Брусянский, ул Строителей, д 1-бара",
      unrestricted_value: "Тульская обл, Узловский р-н, г Узловая, поселок Брусянский, ул Строителей, д 1-бара",
      data: {
        country: "Россия",
        region_type: "обл",
        region_type_full: "область",
        region: "Тульская",
        region_with_type: "Тульская обл",
        area_type: "р-н",
        area_type_full: "район",
        area: "Узловский",
        area_with_type: "Узловский р-н",
        city_type: "г",
        city_type_full: "город",
        city: "Узловая",
        city_with_type: "г Узловая",
        settlement_type: "п",
        settlement_type_full: "поселок",
        settlement: "Брусянский",
        settlement_with_type: "поселок Брусянский",
        street_type: "ул",
        street_type_full: "улица",
        street: "Строителей",
        street_with_type: "ул Строителей",
        house_type: "д",
        house_type_full: "дом",
        house: "1-бара",
        kladr_id: "7102200100200310001",
      },
    },
    foreign: {
      unrestricted_value: "Италия, Lombardy, г Милан",
      value: "Италия, Lombardy, г Милан",
      data: {
        postal_code: "20121",
        country: "Италия",
        country_iso_code: "IT",
        region: "Lombardy",
        region_iso_code: "IT-25",
        city_type: "г",
        city: "Милан",
        city_with_type: "г Милан",
        geoname_id: "3173435",
        geo_lat: "45.46427",
        geo_lon: "9.18951",
        timezone: "UTC+1",
      },
    },
  };

  beforeEach(function () {
    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      geoLocation: false,
      enrichmentEnabled: false,
    });

    server.requests.length = 0;
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should not have `locations` parameter in request by default", function () {
    input.value = "A";
    instance.onValueChange();

    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).not.toContain("locations");
  });

  it("Should not have `locations` parameter in request if empty constraints specified", function () {
    instance.setOptions({
      constraints: {},
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).not.toContain("locations");
  });

  it("Should not have `locations` parameter in request if bad-formatted constraints specified", function () {
    instance.setOptions({
      constraints: {
        region: "Москва",
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).not.toContain("locations");
  });

  it("Should have `locations` parameter in request if constraints specified as single object", function () {
    instance.setOptions({
      constraints: {
        locations: {
          region: "Москва",
        },
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"region":"Москва"}]');
  });

  it("Should have `locations` parameter in request with only `kladr_id` if it is specified", function () {
    instance.setOptions({
      constraints: {
        locations: {
          country: "россия",
          region: "москва",
          city: "москва",
          kladr_id: "77",
          qc_complete: 1,
        },
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"kladr_id":"77"}]');
  });

  // если в locations указан фиас параметр, то другие параметры не используются
  it("Should have `locations` parameter in request with only `region_fias_id` if it is specified", function () {
    instance.setOptions({
      constraints: {
        locations: {
          country: "россия",
          region: "москва",
          city: "москва",
          qc_complete: 1,
          region_fias_id: "44",
        },
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"region_fias_id":"44"}]');
  });

  // если в locations указан фиас параметр, то другие параметры не используются, даже кладр
  it("Should have `locations` parameter in request with only `region_fias_id` if specified fias and kladr", function () {
    instance.setOptions({
      constraints: {
        locations: {
          country: "россия",
          region: "москва",
          city: "москва",
          kladr_id: "77",
          qc_complete: 1,
          region_fias_id: "44",
        },
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"region_fias_id":"44"}]');
  });

  // можно указать несколько фиас параметров
  it("Should have `locations` parameter in request with several fias params", function () {
    instance.setOptions({
      constraints: {
        locations: {
          country: "россия",
          region: "москва",
          city: "москва",
          kladr_id: "77",
          qc_complete: 1,
          region_fias_id: "44",
          area_fias_id: "55",
        },
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"region_fias_id":"44","area_fias_id":"55"}]');
  });

  it("Should have `locations` parameter in request with only acceptable fields", function () {
    instance.setOptions({
      constraints: {
        locations: {
          planet: "земля",
          country: "россия",
          region: "москва",
          city: "москва",
          qc_complete: 1,
        },
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"country":"россия","region":"москва","city":"москва"}]');
  });

  it("Should have `locations` parameter in request if constraints specified as single object named `restrictions`", function () {
    instance.setOptions({
      constraints: {
        restrictions: {
          region: "Москва",
        },
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"region":"Москва"}]');
  });

  it("Should have `locations` parameter in request if constraints specified as array of objects", function () {
    instance.setOptions({
      constraints: [
        {
          locations: {
            region: "Москва",
          },
        },
        {
          locations: {
            kladr_id: "6500000000000",
          },
        },
      ],
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"region":"Москва"},{"kladr_id":"6500000000000"}]');
  });

  it("Should have `locations` parameter in request if constraints and their locations specified as arrays", function () {
    const locations = [
      [
        { region: "адыгея" },
        { region: "астраханская" },
        { region: "волгоградская" },
        { region: "калмыкия" },
        { region: "краснодарский" },
        { region: "ростовская" },
      ],
      [
        { region: "курганская" },
        { region: "свердловская" },
        { region: "тюменская" },
        { region: "ханты-мансийский" },
        { region: "челябинская" },
        { region: "ямало-ненецкая" },
      ],
    ];

    instance.setOptions({
      constraints: [
        {
          label: "ЮФО",
          locations: locations[0],
        },
        {
          label: "УФО",
          locations: locations[1],
        },
      ],
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain(`"locations":${JSON.stringify([...locations[0], ...locations[1]])}`);
  });

  it("Should constrain by country", function () {
    instance.setOptions({
      constraints: {
        locations: {
          country: "Италия",
        },
      },
    });

    input.value = "А";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"country":"Италия"}]');
  });

  it("Should constrain by country_iso_code", function () {
    instance.setOptions({
      constraints: {
        locations: {
          country_iso_code: "IT",
        },
      },
    });

    input.value = "А";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"country_iso_code":"IT"}]');
  });

  it("Should constrain by region_iso_code", function () {
    instance.setOptions({
      constraints: {
        locations: {
          country_iso_code: "IT",
          region_iso_code: "IT-25",
        },
      },
    });

    input.value = "А";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"country_iso_code":"IT","region_iso_code":"IT-25"}]');
  });

  it("Should have `locations` parameter for parties", function () {
    instance.setOptions({
      type: "PARTY",
      constraints: {
        locations: { kladr_id: "77" },
      },
      restrict_value: true,
    });

    helpers.returnGoodStatus(server);
    server.requests.length = 0;

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"locations":[{"kladr_id":"77"}]');
  });

  it("Should have `locations` parameter in request for x_type_full constraints", function () {
    const locations = {
      region_type_full: "region",
      area_type_full: "area",
      city_type_full: "city",
      city_district_type_full: "city_district",
      settlement_type_full: "settlement",
      street_type_full: "street",
    };

    instance.setOptions({
      constraints: {
        locations,
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain(JSON.stringify(locations));
  });

  it("Should set unrestricted suggestion value", function () {
    instance.setOptions({
      constraints: {
        label: "обл Ростовская, г Ростов-на-Дону",
        locations: {
          region: "Ростовская",
          city: "Ростов-на-Дону",
        },
      },
      restrict_value: true,
    });
    const suggestions = [{ value: "ул Буквенная, д 20", data: null }];

    input.value = "Буквенная 20";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    expect(instance.suggestions[0]).toEqual({
      value: "ул Буквенная, д 20",
      unrestricted_value: "обл Ростовская, г Ростов-на-Дону, ул Буквенная, д 20",
      data: null,
    });
  });

  it("Should not set unrestricted suggestion value on multiple constraints", function () {
    instance.setOptions({
      constraints: [
        {
          label: "обл Ростовская, г Ростов-на-Дону",
          locations: {
            region: "Ростовская",
            city: "Ростов-на-Дону",
          },
        },
        {
          locations: {
            region: "Москва",
          },
        },
      ],
      restrict_value: true,
    });
    const suggestions = [{ value: "ул Буквенная, д 20", data: null }];

    input.value = "Буквенная 20";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    expect(instance.suggestions[0]).toEqual({
      value: "ул Буквенная, д 20",
      unrestricted_value: "ул Буквенная, д 20",
      data: null,
    });
  });

  describe("in cooperation with other control", function () {
    let parentInput, parentInstance;
    beforeEach(function () {
      parentInput = document.createElement("input");
      document.body.append(parentInput);

      parentInstance = new Suggestions(parentInput, {
        type: "ADDRESS",
        serviceUrl,
        geoLocation: false,
        bounds: "region-area",
      });
    });

    afterEach(function () {
      parentInput.remove();
    });

    it("Should use parent data as a constraint in child", function () {
      parentInstance.setSuggestion({
        value: "г. Санкт-Петербург",
        data: {
          region: "Санкт-Петербург",
          region_type: "г",
          kladr_id: "7800000000000",
        },
      });

      instance.setOptions({
        constraints: parentInput,
      });

      input.value = "улица";
      instance.onValueChange();

      expect(server.requests[0].requestBody).toContain('"locations":[{"kladr_id":"7800000000000"}]');
      expect(server.requests[0].requestBody).toContain('"restrict_value":true');
    });

    it("Should fill empty parent control when suggestion is selected in child", function () {
      instance.setOptions({
        bounds: "street-",
        constraints: parentInput,
      });

      input.value = "бара";
      instance.onValueChange();
      server.respond(helpers.responseFor([fixtures.fullyAddress]));
      instance.selectedIndex = 0;
      instance.select(0);

      expect(parentInput.value).toEqual("Тульская обл, Узловский р-н");
      expect(parentInstance.selection.data).toEqual(
        jasmine.objectContaining({
          region: "Тульская",
          area: "Узловский",
        }),
      );
    });

    it("Should fill non-empty parent control with region different from selected", function () {
      parentInstance.setSuggestion({
        value: "Новосибирская обл",
        data: {
          region: "новосибирская",
        },
      });

      instance.setOptions({
        bounds: "street-",
        constraints: parentInput,
      });

      input.value = "бара";
      instance.onValueChange();
      server.respond(helpers.responseFor([fixtures.fullyAddress]));
      instance.selectedIndex = 0;
      instance.select(0);

      expect(parentInput.value).toEqual("Тульская обл, Узловский р-н");
      expect(parentInstance.selection.data).toEqual(
        jasmine.objectContaining({
          region: "Тульская",
          area: "Узловский",
        }),
      );
    });

    it("Should not fill non-empty parent control with region same as selected", function () {
      const selectionData = {
        country: "Россия",
        region: "Тульская",
        area: "Узловский",
      };
      parentInstance.setSuggestion({
        value: "Тульская, Узловский",
        data: selectionData,
      });

      instance.setOptions({
        bounds: "street-",
        constraints: parentInput,
      });

      input.value = "бара";
      instance.onValueChange();
      server.respond(helpers.responseFor([fixtures.fullyAddress]));
      instance.selectedIndex = 0;
      instance.select(0);

      expect(parentInput.value).toEqual("Тульская, Узловский");
      expect(parentInstance.selection.data).toEqual(selectionData);
    });

    it("Should spread data to all parents", function () {
      parentInput.value = "Тульская обл, Узловский р-н";
      input.value = "г Узловая, поселок Брусянский, ул Строителей, д 1-бара";

      instance.setOptions({
        bounds: "city-",
        constraints: parentInput,
      });

      instance.fixData();
      server.respond(helpers.responseFor([fixtures.fullyAddress]));

      expect(parentInstance.selection.data).toEqual(
        jasmine.objectContaining({
          region: "Тульская",
          region_type: "обл",
          area: "Узловский",
          area_type: "р-н",
        }),
      );
    });

    it("Should remove city_fias_id from city request", function () {
      const suggestions = [
        {
          value: "г Санкт-Петербург",
          data: {
            city_fias_id: "c2deb16a-0330-4f05-821f-1d09c93331e6",
            city: "Санкт-Петербург",
            city_type: "г",
            region_fias_id: "c2deb16a-0330-4f05-821f-1d09c93331e6",
            region: "Санкт-Петербург",
            region_type: "г",
          },
        },
      ];

      parentInput.value = "Санкт";
      parentInstance.onValueChange();
      server.respond(helpers.responseFor(suggestions));
      parentInstance.selectedIndex = 0;
      helpers.hitEnter(parentInput);
      server.respond(helpers.responseFor(suggestions));

      instance.setOptions({
        bounds: "city",
        constraints: parentInput,
      });

      input.value = "кол";
      instance.onValueChange();
      const body = JSON.parse(server.lastRequest.requestBody);
      expect(body.locations[0].city_fias_id).toBe(undefined);
    });
  });

  describe("can restrict values", function () {
    it("one constraint (country_iso_code)", function () {
      instance.setOptions({
        constraints: {
          locations: {
            country_iso_code: "IT",
          },
        },
        restrict_value: true,
      });

      expect(
        instance.getSuggestionValue(fixtures.foreign, {
          hasBeenEnriched: true,
        }),
      ).toEqual("Lombardy, г Милан");
    });

    it("one constraint (country)", function () {
      instance.setOptions({
        constraints: {
          locations: {
            country: "Италия",
          },
        },
        restrict_value: true,
      });

      expect(
        instance.getSuggestionValue(fixtures.foreign, {
          hasBeenEnriched: true,
        }),
      ).toEqual("Lombardy, г Милан");
    });

    it("one constraint (region)", function () {
      instance.setOptions({
        constraints: {
          locations: {
            region: "тульская",
          },
        },
        restrict_value: true,
      });

      expect(
        instance.getSuggestionValue(fixtures.fullyAddress, {
          hasBeenEnriched: true,
        }),
      ).toEqual("Узловский р-н, г Узловая, поселок Брусянский, ул Строителей, д 1-бара");
    });

    it("one constraint (city)", function () {
      instance.setOptions({
        constraints: {
          locations: {
            city: "узловая",
          },
        },
        restrict_value: true,
      });

      expect(
        instance.getSuggestionValue(fixtures.fullyAddress, {
          hasBeenEnriched: true,
        }),
      ).toEqual("поселок Брусянский, ул Строителей, д 1-бара");
    });

    it("one constraint (street)", function () {
      instance.setOptions({
        constraints: {
          locations: {
            street: "строителей",
          },
        },
        restrict_value: true,
      });

      expect(
        instance.getSuggestionValue(fixtures.fullyAddress, {
          hasBeenEnriched: true,
        }),
      ).toEqual("д 1-бара");
    });

    it("one constraint (region by kladr_id)", function () {
      instance.setOptions({
        constraints: {
          locations: {
            // kladr of region
            kladr_id: "7100000000",
          },
        },
        restrict_value: true,
      });

      expect(
        instance.getSuggestionValue(fixtures.fullyAddress, {
          hasBeenEnriched: true,
        }),
      ).toEqual("Узловский р-н, г Узловая, поселок Брусянский, ул Строителей, д 1-бара");
    });

    it("one constraint (street by kladr_id)", function () {
      instance.setOptions({
        constraints: {
          locations: {
            // Kladr of street
            kladr_id: "71022001002003100",
          },
        },
        restrict_value: true,
      });

      expect(
        instance.getSuggestionValue(fixtures.fullyAddress, {
          hasBeenEnriched: true,
        }),
      ).toEqual("д 1-бара");
    });

    it("one constraint (region by region_fias_id)", function () {
      instance.setOptions({
        constraints: {
          label: "Краснодарский край",
          locations: {
            region_fias_id: "d00e1013-16bd-4c09-b3d5-3cb09fc54bd8",
          },
        },
        restrict_value: true,
      });
      const suggestion = {
        data: {
          capital_marker: "0",
          city: "Сочи",
          city_fias_id: "79da737a-603b-4c19-9b54-9114c96fb912",
          city_kladr_id: "2300000700000",
          city_type: "г",
          city_type_full: "город",
          city_with_type: "г Сочи",
          country: "Россия",
          fias_id: "79da737a-603b-4c19-9b54-9114c96fb912",
          fias_level: "4",
          geo_lat: "43.5816249",
          geo_lon: "39.7229455",
          kladr_id: "2300000700000",
          okato: "03426000000",
          oktmo: "03726000",
          qc_geo: "4",
          region: "Краснодарский",
          region_fias_id: "d00e1013-16bd-4c09-b3d5-3cb09fc54bd8",
          region_kladr_id: "2300000000000",
          region_type: "край",
          region_type_full: "край",
          region_with_type: "Краснодарский край",
          tax_office: "2300",
        },
        unrestricted_value: "Краснодарский край, г Сочи",
        value: "г Сочи",
      };

      const value = instance.getSuggestionValue(suggestion, {
        hasBeenEnriched: true,
      });
      expect(value).toEqual("г Сочи");
    });

    describe("multiple constraints", function () {
      beforeEach(function () {
        instance.setOptions({
          constraints: [
            // Москва
            {
              locations: { region: "Москва" },
              deletable: true,
            },
            // Московская область
            {
              label: "МО",
              locations: { kladr_id: "50" },
              deletable: true,
            },
          ],
          restrict_value: true,
        });
      });

      it("crop city if matches", function () {
        expect(
          instance.getSuggestionValue(
            {
              data: {
                city: "Москва",
                city_area: "Центральный",
                city_district: "Хамовники р-н",
                city_district_fias_id: "0c5b2444-70a0-4932-980c-b4dc0d3f02b5",
                city_fias_id: "0c5b2444-70a0-4932-980c-b4dc0d3f02b5",
                city_kladr_id: "7700000000000",
                city_type: "г",
                city_type_full: "город",
                city_with_type: "г Москва",
                kladr_id: "77000000000714800",
                okato: "45286590000",
                oktmo: "45383000",
                region: "Москва",
                region_fias_id: "0c5b2444-70a0-4932-980c-b4dc0d3f02b5",
                region_kladr_id: "7700000000000",
                region_type: "г",
                region_type_full: "город",
                region_with_type: "г Москва",
                street: "Турчанинов",
                street_fias_id: "0f7981e6-65c6-4513-b771-f5db3bfafe60",
                street_kladr_id: "77000000000714800",
                street_type: "пер",
                street_type_full: "переулок",
                street_with_type: "Турчанинов пер",
              },
            },
            { hasBeenEnriched: true },
          ),
        ).toEqual("Турчанинов пер");
      });

      it("crop region if matches", function () {
        expect(
          instance.getSuggestionValue(
            {
              data: {
                city: "Коломна",
                city_fias_id: "b367fb03-29f9-4dac-8d85-01595cfb6ad9",
                city_kladr_id: "5000002700000",
                city_type: "г",
                city_type_full: "город",
                city_with_type: "г Коломна",
                country: "Россия",
                fias_id: "b367fb03-29f9-4dac-8d85-01595cfb6ad9",
                fias_level: "4",
                kladr_id: "5000002700000",
                okato: "46438000000",
                oktmo: "46738000001",
                region: "Московская",
                region_fias_id: "29251dcf-00a1-4e34-98d4-5c47484a36d4",
                region_kladr_id: "5000000000000",
                region_type: "обл",
                region_type_full: "область",
                region_with_type: "Московская обл",
              },
            },
            { hasBeenEnriched: true },
          ),
        ).toEqual("г Коломна");
      });
    });
  });
});
