import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Bounds", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";

  beforeEach(function () {
    Suggestions.resetTokens();

    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      geoLocation: false,
      // disable mobile view features
      mobileWidth: Number.NaN,
    });

    helpers.returnGoodStatus(server);
    server.requests.length = 0;
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should include `bounds` option into request, if it is a range", function () {
    instance.setOptions({
      bounds: "city-street",
    });

    input.value = "Jam";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"from_bound":{"value":"city"}');
    expect(server.requests[0].requestBody).toContain('"to_bound":{"value":"street"}');
  });

  it("Should include `bounds` option into request, if it is a single value", function () {
    instance.setOptions({
      bounds: "city",
    });

    input.value = "Jam";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"from_bound":{"value":"city"}');
    expect(server.requests[0].requestBody).toContain('"to_bound":{"value":"city"}');
  });

  it("Should include `bounds` option into request, if it is an open range", function () {
    instance.setOptions({
      bounds: "street-",
    });

    input.value = "Jam";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"from_bound":{"value":"street"}');
    expect(server.requests[0].requestBody).not.toContain('"to_bound":');
  });

  it("Should treat country as valid single bound", function () {
    instance.setOptions({
      bounds: "country",
    });

    input.value = "Jam";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"from_bound":{"value":"country"}');
    expect(server.requests[0].requestBody).toContain('"to_bound":{"value":"country"}');
  });

  it("Should treat country as valid part of range bound", function () {
    instance.setOptions({
      bounds: "country-city",
    });

    input.value = "Jam";
    instance.onValueChange();

    expect(server.requests[0].requestBody).toContain('"from_bound":{"value":"country"}');
    expect(server.requests[0].requestBody).toContain('"to_bound":{"value":"city"}');
  });

  it("Should modify suggestion according to `bounds`", function () {
    instance.setOptions({
      bounds: "city-settlement",
    });

    instance.setSuggestion({
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
    });

    expect(input.value).toEqual("г Узловая, поселок Брусянский");
    expect(instance.selection.data.street).toBeUndefined();
    expect(instance.selection.data.kladr_id).toEqual("7102200100200");
  });
});
