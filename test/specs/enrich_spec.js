import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Enrich", function () {
  let input, instance, server;
  const serviceUrl = "some/url";
  const fixtures = {
    poorName: [
      {
        value: "Романов Иван Петрович",
        data: {
          name: "Иван",
          patronymic: "Петрович",
          surname: "Романов",
          gender: "MALE",
          qc: null,
        },
      },
    ],
    poorAddress: [
      {
        value: "Москва",
        data: {
          city: "Москва",
          qc: null,
        },
      },
    ],
    poorAddressRestricted: [
      {
        value: "ул Солянка, д 6",
        unrestricted_value: "г Москва, ул Солянка, д 6",
        data: {
          region: "Москва",
          region_type: "г",
          region_with_type: "г Москва",
          city: "Москва",
          city_type: "г",
          city_with_type: "г Москва",
          street: "Солянка",
          street_type: "ул",
          street_with_type: "ул Солянка",
          house: "6",
          qc: null,
        },
      },
    ],
    poorParty: [
      {
        value: "Фирма",
        data: {
          hid: "123",
        },
      },
    ],
    poorBank: [
      {
        value: "альфа-банк",
        data: {
          bic: "044525593",
        },
      },
    ],
    enriched: [
      {
        value: "Москва",
        data: {
          city: "Москва",
          qc: 0,
        },
      },
    ],
  };

  beforeEach(function () {
    Suggestions.resetTokens();

    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      token: "123",
      geoLocation: false,
    });

    helpers.returnGoodStatus(server);
    server.requests.length = 0;
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should NOT enrich a suggestion for names", function () {
    instance.setOptions({
      type: "NAME",
    });

    // select address
    input.value = "Р";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorName));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion not sent
    expect(server.requests.length).toEqual(0);
  });

  it("Should enrich a suggestion for parties", function () {
    instance.setOptions({
      type: "PARTY",
    });

    // select address
    input.value = "Р";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorParty));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion not sent
    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).toContain('"count":1');
    expect(server.requests[0].requestBody).toContain(`"query":"${fixtures.poorParty[0].data.hid}"`);
  });

  it("Should enrich a suggestion for banks", function () {
    instance.setOptions({
      type: "BANK",
    });

    // select bank
    input.value = "а";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorBank));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion not sent
    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).toContain('"count":1');
    expect(server.requests[0].requestBody).toContain(`"query":"${fixtures.poorBank[0].data.bic}"`);
  });

  it("Should enrich address when selected", function () {
    // select address
    input.value = "М";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorAddress));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion
    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).toContain('"count":1');
    expect(server.requests[0].requestBody).toContain(`"query":"${fixtures.poorAddress[0].value}"`);
  });

  it("Should send unrestricted_value for enrichment", function () {
    instance.setOptions({
      constraints: {
        locations: {
          region_type: "г",
          region: "Москва",
          region_with_type: "г Москва",
        },
      },
      restrict_value: true,
    });

    // select address
    input.value = "Сол";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorAddressRestricted));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion
    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).toContain('"count":1');
    expect(server.requests[0].requestBody).toContain(`"query":"${fixtures.poorAddressRestricted[0].unrestricted_value}"`);
  });

  it("Should not send constraints and boost parameters for enrichment", function () {
    instance.setOptions({
      constraints: {
        locations: {
          region_type: "г",
          region: "Москва",
          region_with_type: "г Москва",
        },
      },
      restrict_value: true,
    });

    // select address
    input.value = "Сол";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorAddressRestricted));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion
    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).not.toContain('"locations"');
    expect(server.requests[0].requestBody).not.toContain('"locations_boost"');
  });

  it("Should not enrich a suggestion when selected by SPACE", function () {
    // select address
    input.value = "Р";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poor));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.keydown(input, 32); // code of Space

    // request for enriched suggestion not sent
    expect(server.requests.length).toEqual(0);
  });

  it("Should ignore server `enrich:false` status", function () {
    Suggestions.resetTokens();
    instance.setOptions({
      token: "456",
    });
    helpers.returnStatus(server, {
      search: true,
      enrich: false,
    });
    server.requests.length = 0;

    // select address
    input.value = "М";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorAddress));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request enriched suggestion is sent
    expect(server.requests.length).toEqual(1);
  });

  it("Should NOT enrich a suggestion with specified qc", function () {
    // select address
    input.value = "М";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.enriched));

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion not sent
    expect(server.requests.length).toEqual(0);
  });
});
