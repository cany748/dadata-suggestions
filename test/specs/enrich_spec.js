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

    server = helpers.createServer();

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

  it("Should NOT enrich a suggestion for names", async () => {
    instance.setOptions({
      type: "NAME",
    });

    // select address
    input.value = "Р";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorName));
    await expect.poll(() => instance.visible).toBe(true);

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion not sent
    await expect.poll(() => instance.selection).toBeTruthy();
    expect(server.requests.length).toEqual(0);
  });

  it("Should enrich a suggestion for parties", async () => {
    instance.setOptions({
      type: "PARTY",
    });

    // select address
    input.value = "Р";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorParty));
    await expect.poll(() => instance.visible).toBe(true);

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion not sent
    await expect.poll(() => server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).toContain('"count":1');
    expect(server.requests[0].requestBody).toContain(`"query":"${fixtures.poorParty[0].data.hid}"`);
  });

  it("Should enrich a suggestion for banks", async () => {
    instance.setOptions({
      type: "BANK",
    });

    // select bank
    input.value = "а";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorBank));
    await expect.poll(() => instance.visible).toBe(true);

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion not sent
    await expect.poll(() => server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).toContain('"count":1');
    expect(server.requests[0].requestBody).toContain(`"query":"${fixtures.poorBank[0].data.bic}"`);
  });

  it("Should enrich address when selected", async () => {
    // select address
    input.value = "М";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.poorAddress));
    await expect.poll(() => instance.visible).toBe(true);

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion
    await expect.poll(() => server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).toContain('"count":1');
    expect(server.requests[0].requestBody).toContain(`"query":"${fixtures.poorAddress[0].value}"`);
  });

  it("Should send unrestricted_value for enrichment", async () => {
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
    await expect.poll(() => instance.visible).toBe(true);

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion
    await expect.poll(() => server.requests.length).toEqual(1);
    expect(server.requests[0].requestBody).toContain('"count":1');
    expect(server.requests[0].requestBody).toContain(`"query":"${fixtures.poorAddressRestricted[0].unrestricted_value}"`);
  });

  it("Should not send constraints and boost parameters for enrichment", async () => {
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
    await expect.poll(() => instance.visible).toBe(true);

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion
    await expect.poll(() => server.requests.length).toEqual(1);
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

  it("Should ignore server `enrich:false` status", async () => {
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
    await expect.poll(() => instance.visible).toBe(true);

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request enriched suggestion is sent
    await expect.poll(() => server.requests.length).toEqual(1);
  });

  it("Should NOT enrich a suggestion with specified qc", async () => {
    // select address
    input.value = "М";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures.enriched));
    await expect.poll(() => instance.visible).toBe(true);

    server.requests.length = 0;
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // request for enriched suggestion not sent
    await expect.poll(() => instance.selection).toBeTruthy();
    expect(server.requests.length).toEqual(0);
  });
});

describe("Enrichment flow", () => {
  let input, instance, server, onSelect;
  const serviceUrl = "/some/url";
  const poorMoscow = { value: "г Москва", data: { city: "Москва", city_type: "г", qc: null } };
  const richMoscow = { value: "г Москва", data: { city: "Москва", city_type: "г", city_fias_id: "0c5b", qc: 0 } };
  const poorStreet = { value: "г Москва, ул Тверская", data: { city: "Москва", street: "Тверская", qc: null } };

  const suggestRequests = () => server.requests.filter((request) => request.url.includes("/suggest/"));
  const search = async (value, suggestions) => {
    input.value = value;
    instance.onValueChange();
    suggestRequests()
      .at(-1)
      .respond(...helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
  };

  beforeEach(() => {
    Suggestions.resetTokens();
    server = helpers.createServer();
    input = document.createElement("input");
    document.body.append(input);
    onSelect = vi.fn();
    instance = new Suggestions(input, { serviceUrl, type: "ADDRESS", geoLocation: false, onSelect });
    helpers.returnGoodStatus(server);
  });

  afterEach(() => {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should select original suggestion if enrichment request failed", async () => {
    await search("мос", [poorMoscow, poorStreet]);

    const selecting = instance.select(0);
    suggestRequests().at(-1).respond(500, {}, "");
    await selecting;

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].data).toEqual(poorMoscow.data);
    expect(input.value).toEqual("г Москва ");
    expect(input.nextElementSibling.firstElementChild.hasAttribute("disabled")).toBe(false);
  });
  it("Should reuse enriched suggestion when it comes again in later response", async () => {
    await search("мос", [poorMoscow, poorStreet]);
    const selecting = instance.select(0);
    suggestRequests()
      .at(-1)
      .respond(...helpers.responseFor([richMoscow]));
    await selecting;
    const requestsCount = suggestRequests().length;

    await search("г Москва", [poorMoscow, poorStreet]);
    await instance.select(0);

    expect(suggestRequests()).toHaveLength(requestsCount + 1);
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ data: richMoscow.data }), expect.anything());
  });

  it("Should keep enriched data when input loses focus while enrichment is in progress", async () => {
    await search("мос", [poorMoscow, poorStreet]);
    instance.selectedIndex = 0;
    helpers.hitEnter(input);
    await expect.poll(() => suggestRequests()).toHaveLength(2);

    helpers.fireBlur(input);
    await expect.poll(() => instance.visible).toBe(false);
    for (const request of suggestRequests().slice(1)) {
      if (!request.aborted) request.respond(...helpers.responseFor([richMoscow]));
    }

    await expect.poll(() => onSelect.mock.calls.length).toBeGreaterThan(0);
    expect(onSelect.mock.calls.map(([suggestion]) => suggestion.data)).toEqual([richMoscow.data]);
  });
});
