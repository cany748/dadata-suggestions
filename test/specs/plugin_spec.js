import { fakeServer } from "nise";

import helpers from "../helpers";
import { DEFAULT_OPTIONS, Suggestions } from "@/suggestions";
import { DATA_ATTR_KEY } from "@/constants";

describe("Base features", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";

  beforeEach(function () {
    Suggestions.resetTokens();

    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "NAME",
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

  describe("Misc", function () {
    it("Should get current value", async () => {
      input.value = "Jam";
      instance.onValueChange();

      server.respond(helpers.responseFor([{ value: "Jamaica", data: "B" }]));
      await expect.poll(() => instance.visible).toBe(true);

      expect(instance.visible).toBe(true);
      expect(instance.currentValue).toEqual("Jam");
    });

    it("Should convert suggestions format", async () => {
      input.value = "A";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Alex", "Ammy", "Anny"]));
      await expect.poll(() => instance.visible).toBe(true);
      expect(instance.suggestions[0]).toEqual(helpers.appendUnrestrictedValue({ value: "Alex", data: null }));
      expect(instance.suggestions[1]).toEqual(helpers.appendUnrestrictedValue({ value: "Ammy", data: null }));
      expect(instance.suggestions[2]).toEqual(helpers.appendUnrestrictedValue({ value: "Anny", data: null }));
    });

    it("Should destroy suggestions instance", function () {
      const div = document.createElement("div");

      div.append(input);

      expect(input[DATA_ATTR_KEY]).toBeDefined();

      instance.dispose();

      expect(input[DATA_ATTR_KEY]).toBeUndefined();
      for (const selector of [".suggestions-suggestions", ".suggestions-addon", ".suggestions-constraints"]) {
        expect(div.querySelectorAll(selector).length).toEqual(0);
      }
    });

    it("Should set width to be greater than zero", async () => {
      input.value = "Jam";
      instance.onValueChange();
      server.respond(helpers.responseFor([{ value: "Jamaica", data: "B" }]));
      await expect.poll(() => instance.visible).toBe(true);
      expect(instance.container.offsetWidth).toBeGreaterThan(0);
    });

    it("Should call beforeRender and pass container element", async () => {
      const options = {
        beforeRender() {},
      };
      spyOn(options, "beforeRender");
      instance.setOptions(options);

      input.value = "Jam";
      instance.onValueChange();
      server.respond(helpers.responseFor([{ value: "Jamaica", data: "B" }]));
      await expect.poll(() => instance.visible).toBe(true);

      expect(options.beforeRender.calls.count()).toEqual(1);
      expect(options.beforeRender).toHaveBeenCalledWith(instance.container);
    });

    it("Should prevent Ajax requests if previous query with matching root failed.", async () => {
      instance.setOptions({ preventBadQueries: true });
      input.value = "Jam";
      instance.onValueChange();

      expect(server.requests.length).toEqual(1);
      server.respond(helpers.responseFor([]));
      await expect.poll(() => instance.badQueries).toHaveLength(1);

      input.value = "Jama";
      instance.onValueChange();

      expect(server.requests.length).toEqual(1);

      input.value = "Jamai";
      instance.onValueChange();

      expect(server.requests.length).toEqual(1);
    });
  });

  describe("onSelect callback", function () {
    it("Verify onSelect callback (fully changed)", async () => {
      const suggestions = [{ value: "Abcdef", data: "B" }];
      const options = {
        onSelect() {},
      };
      spyOn(options, "onSelect");

      instance.setOptions(options);
      input.value = "A";
      instance.onValueChange();
      server.respond(helpers.responseFor(suggestions));
      await expect.poll(() => instance.visible).toBe(true);
      await instance.select(0);

      expect(options.onSelect.calls.count()).toEqual(1);
      expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[0]), true);
    });

    it("Verify onSelect callback (just enriched)", async () => {
      const suggestions = [
        {
          value: "Abc",
          data: {
            name: "Name",
            surname: "Surname",
            patronymic: "Patronymic",
          },
        },
      ];
      const options = {
        onSelect() {},
      };
      spyOn(options, "onSelect");

      instance.setOptions(options);
      input.value = "Abc";
      instance.onValueChange();
      server.respond(helpers.responseFor(suggestions));
      await expect.poll(() => instance.visible).toBe(true);
      await instance.select(0);

      expect(options.onSelect.calls.count()).toEqual(1);
      expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[0]), false);
    });
  });

  describe("onSuggestionsFetch callback", function () {
    let suggestions;
    beforeEach(function () {
      suggestions = [
        helpers.appendUnrestrictedValue({
          value: "Afghanistan",
          data: { country: "Afghanistan" },
        }),
        helpers.appendUnrestrictedValue({
          value: "Albania",
          data: { country: "Albania" },
        }),
        helpers.appendUnrestrictedValue({
          value: "Andorra",
          data: { country: "Andorra" },
        }),
      ];

      input.value = "A";
      instance.onValueChange();
    });

    it("invoked", async () => {
      const options = {
        onSuggestionsFetch() {},
      };

      spyOn(options, "onSuggestionsFetch");

      instance.setOptions(options);

      server.respond(helpers.responseFor(suggestions));
      await expect.poll(() => instance.visible).toBe(true);

      expect(options.onSuggestionsFetch.calls.count()).toEqual(1);
      expect(options.onSuggestionsFetch).toHaveBeenCalledWith(suggestions);
    });

    it("can modify argument", async () => {
      instance.setOptions({
        onSuggestionsFetch(suggestions) {
          // Move first option to the end
          suggestions.push(suggestions.shift());
        },
      });

      server.respond(helpers.responseFor(suggestions));
      await expect.poll(() => instance.visible).toBe(true);

      const items = instance.container.querySelectorAll(".suggestions-suggestion");

      // Second option become first
      expect(items[0]).toContainText(suggestions[1].value);
      expect(items[1]).toContainText(suggestions[2].value);
      // First option become last
      expect(items[2]).toContainText(suggestions[0].value);
    });

    it("can use returned array", async () => {
      instance.setOptions({
        onSuggestionsFetch(suggestions) {
          // Return new array
          return [suggestions[1], suggestions[2], suggestions[0]];
        },
      });

      server.respond(helpers.responseFor(suggestions));
      await expect.poll(() => instance.visible).toBe(true);

      const items = instance.container.querySelectorAll(".suggestions-suggestion");

      // Second option become first
      expect(items[0]).toContainText(suggestions[1].value);
      expect(items[1]).toContainText(suggestions[2].value);
      // First option become last
      expect(items[2]).toContainText(suggestions[0].value);
    });
  });

  describe("Hint message", function () {
    it("Should display default hint message above suggestions", async () => {
      input.value = "jam";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Jamaica"]));
      await expect.poll(() => instance.visible).toBe(true);

      const hints = instance.container.querySelectorAll(".suggestions-hint");

      expect(hints.length).toEqual(1);
      expect(hints[0].textContent).toEqual(DEFAULT_OPTIONS.hint);
    });

    it("Should display custom hint message above suggestions", async () => {
      const customHint = "This is custon hint";
      instance.setOptions({
        hint: customHint,
      });

      input.value = "jam";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Jamaica"]));
      await expect.poll(() => instance.visible).toBe(true);

      const hints = instance.container.querySelectorAll(".suggestions-hint");

      expect(hints.length).toEqual(1);
      expect(hints[0].textContent).toEqual(customHint);
    });

    it("Should not display any hint message above suggestions", async () => {
      instance.setOptions({
        hint: false,
      });

      input.value = "jam";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Jamaica"]));
      await expect.poll(() => instance.visible).toBe(true);

      const hints = instance.container.querySelectorAll(".suggestions-hint");

      expect(hints.length).toEqual(0);
    });

    it("Should not display any hint message for narrow-screen (mobile) view", async () => {
      instance.setOptions({
        hint: false,
        mobileWidth: 20_000,
      });

      input.value = "jam";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Jamaica"]));
      await expect.poll(() => instance.visible).toBe(true);

      const hints = instance.container.querySelectorAll(".suggestions-hint");

      expect(hints.length).toEqual(0);
    });
  });

  describe("Language", function () {
    it("Should not include default language into request", function () {
      input.value = "Jam";
      instance.onValueChange();

      expect(server.requests[0].requestBody).not.toContain("language");
    });

    it("Should include custom language into request", function () {
      instance.setOptions({
        language: "en",
      });
      input.value = "Jam";
      instance.onValueChange();

      expect(server.requests[0].requestBody).toContain('"language":"en"');
    });
  });

  describe("Custom params", function () {
    it("Should use custom query parameter name", function () {
      instance.setOptions({
        paramName: "custom",
      });

      input.value = "Jam";
      instance.onValueChange();

      expect(server.requests[0].requestBody).toContain('"custom":"Jam"');
    });

    it("Should include params option into request", function () {
      instance.setOptions({
        params: {
          a: 1,
        },
      });

      input.value = "Jam";
      instance.onValueChange();

      expect(server.requests[0].requestBody).toContain('{"a":1,');
    });

    it("Should include params option into request when it is a function", function () {
      instance.setOptions({
        params() {
          return { a: 2 };
        },
      });

      input.value = "Jam";
      instance.onValueChange();

      expect(server.requests[0].requestBody).toContain('{"a":2,');
    });
  });

  describe("Headers", function () {
    it("Should send custom HTTP headers", function () {
      instance.setOptions({
        headers: { "X-my-header": "blabla" },
      });
      input.value = "jam";
      instance.onValueChange();

      expect(server.requests[0].requestHeaders["X-my-header"]).toEqual("blabla");
    });
  });
});

describe("Typing", () => {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const fixtures = {
    A: [
      { value: "Afghanistan", data: "Af" },
      { value: "Albania", data: "Al" },
      { value: "Andorra", data: "An" },
    ],
    Al: [
      { value: "Albania", data: "Al" },
      { value: "Algeria", data: "Ag" },
    ],
  };

  const type = (value) => {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  };
  const suggestRequests = () => server.requests.filter((request) => request.url.includes("/suggest/"));
  const queryOf = (request) => JSON.parse(request.requestBody).query;
  const shownValues = () => Array.from(input.nextElementSibling.querySelectorAll(".suggestions-suggestion"), (el) => el.textContent);
  const respondTo = (request, suggestions) => request.respond(...helpers.responseFor(suggestions));

  const create = (options) => {
    instance = new Suggestions(input, { serviceUrl, type: "country", ...options });
    helpers.returnGoodStatus(server);
  };

  beforeEach(() => {
    Suggestions.resetTokens();
    server = fakeServer.create();
    input = document.createElement("input");
    document.body.append(input);
  });

  afterEach(() => {
    vi.useRealTimers();
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should send a single request with the last value when typing faster than `deferRequestBy`", () => {
    create({ deferRequestBy: 100 });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    type("A");
    vi.advanceTimersByTime(50);
    type("Al");
    vi.advanceTimersByTime(50);
    type("Alb");
    vi.advanceTimersByTime(99);
    expect(suggestRequests()).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(suggestRequests().map(queryOf)).toEqual(["Alb"]);
  });
  it("Should send request without delay when `deferRequestBy` is 0", () => {
    create({ deferRequestBy: 0 });

    type("A");

    expect(suggestRequests().map(queryOf)).toEqual(["A"]);
  });
  it("Should not refetch when arrow keys change input value while navigating", async () => {
    create({ deferRequestBy: 0 });
    type("A");
    respondTo(suggestRequests()[0], fixtures.A);
    await expect.poll(() => instance.visible).toBe(true);

    helpers.keydown(input, 40);
    helpers.keyup(input, 40);
    helpers.keydown(input, 40);
    helpers.keyup(input, 40);

    expect(input.value).toEqual("Albania");
    expect(suggestRequests()).toHaveLength(1);
    expect(shownValues()).toEqual(["Afghanistan", "Albania", "Andorra"]);
  });
  it("Should abort an outdated request and not report the abort as an error", async () => {
    const onSearchError = vi.fn();
    create({ deferRequestBy: 0, onSearchError });

    type("A");
    type("Al");
    const [first, second] = suggestRequests();
    respondTo(second, fixtures.Al);

    await expect.poll(shownValues).toEqual(["Albania", "Algeria"]);
    expect(first.aborted).toBe(true);
    expect(onSearchError).not.toHaveBeenCalled();
  });
  it("Should take repeated query from cache without a new request", async () => {
    create({ deferRequestBy: 0 });
    type("A");
    respondTo(suggestRequests()[0], fixtures.A);
    await expect.poll(shownValues).toHaveLength(3);
    type("Al");
    respondTo(suggestRequests()[1], fixtures.Al);
    await expect.poll(shownValues).toHaveLength(2);

    type("A");

    await expect.poll(shownValues).toEqual(["Afghanistan", "Albania", "Andorra"]);
    expect(suggestRequests()).toHaveLength(2);
  });
  it("Should request repeated query again when `noCache` is set", async () => {
    create({ deferRequestBy: 0, noCache: true });
    type("A");
    respondTo(suggestRequests()[0], fixtures.A);
    await expect.poll(shownValues).toHaveLength(3);
    type("Al");
    respondTo(suggestRequests()[1], fixtures.Al);
    await expect.poll(shownValues).toHaveLength(2);

    type("A");

    expect(suggestRequests().map(queryOf)).toEqual(["A", "Al", "A"]);
  });
  it("Should not send request when `onSearchStart` returns false", () => {
    const onSearchStart = vi.fn(() => false);
    create({ deferRequestBy: 0, onSearchStart });

    type("A");

    expect(onSearchStart).toHaveBeenCalledWith(expect.objectContaining({ query: "A" }));
    expect(suggestRequests()).toHaveLength(0);
  });
  it("Should request suggestions for existing value on focus", async () => {
    input.value = "A";
    create({});
    server.requests.length = 0;

    input.focus();

    await expect.poll(() => suggestRequests().map(queryOf)).toEqual(["A"]);
  });
  it("Should move cursor to the end on focus on narrow screens", async () => {
    input.value = "Albania";
    create({ mobileWidth: 100_000 });
    input.setSelectionRange(0, 0);
    input.blur();

    input.focus();

    await expect.poll(() => input.selectionStart).toBe("Albania".length);
  });
});

describe("Mouse", () => {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const countries = [
    { value: "Afghanistan", data: "Af" },
    { value: "Albania", data: "Al" },
    { value: "Andorra", data: "An" },
  ];

  const suggestRequests = () => server.requests.filter((request) => request.url.includes("/suggest/"));
  const items = () => [...document.querySelectorAll(".suggestions-suggestion")];
  const mousedown = (el) => {
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  };

  const showSuggestions = async (options, suggestions = countries) => {
    instance = new Suggestions(input, { serviceUrl, type: "country", geoLocation: false, ...options });
    helpers.returnGoodStatus(server);
    input.value = "A";
    instance.onValueChange();
    suggestRequests()[0].respond(...helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
  };

  beforeEach(() => {
    Suggestions.resetTokens();
    server = fakeServer.create();
    input = document.createElement("input");
    document.body.append(input);
  });

  afterEach(() => {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should select clicked suggestion", async () => {
    const onSelect = vi.fn();
    await showSuggestions({ onSelect });

    helpers.click(items()[1]);

    await expect.poll(() => onSelect.mock.calls.length).toBe(1);
    expect(onSelect.mock.calls[0][0]).toEqual(expect.objectContaining({ value: "Albania", data: "Al" }));
    expect(input.value).toEqual("Albania");
    expect(instance.visible).toBe(false);
  });
  it("Should select suggestion when its inner element is clicked", async () => {
    const onSelect = vi.fn();
    await showSuggestions({ onSelect });

    helpers.click(items()[2].querySelector(".suggestions-value"));

    await expect.poll(() => onSelect.mock.calls.length).toBe(1);
    expect(onSelect.mock.calls[0][0]).toEqual(expect.objectContaining({ value: "Andorra" }));
  });
  it("Should keep focus in input when suggestion is pressed", async () => {
    await showSuggestions();

    expect(mousedown(items()[0]).defaultPrevented).toBe(true);
  });
  it("Should ignore clicks while selected suggestion is being enriched", async () => {
    const onSelect = vi.fn();
    const poor = [
      { value: "г Москва", data: { city: "Москва", qc: null } },
      { value: "Московская обл", data: { region: "Московская", qc: null } },
    ];
    await showSuggestions({ type: "ADDRESS", onSelect }, poor);
    instance.selectedIndex = 0;
    helpers.hitEnter(input);
    await expect.poll(() => suggestRequests()).toHaveLength(2);

    helpers.click(items()[1]);
    expect(suggestRequests()).toHaveLength(2);

    suggestRequests()[1].respond(...helpers.responseFor([{ value: "г Москва", data: { city: "Москва", qc: 0 } }]));
    await expect.poll(() => onSelect.mock.calls.length).toBe(1);
    expect(onSelect.mock.calls[0][0].data).toEqual({ city: "Москва", qc: 0 });
  });
  describe("floating dropdown", () => {
    it("Should render dropdown in body and keep focus in input when suggestion is pressed", async () => {
      await showSuggestions({ floating: true });
      const container = items()[0].parentElement;

      expect(container.parentElement).toBe(document.body);
      expect(mousedown(items()[0]).defaultPrevented).toBe(true);
    });

    it("Should remove dropdown from body on dispose", async () => {
      await showSuggestions({ floating: true });
      const container = items()[0].parentElement;

      instance.dispose();

      expect(container.isConnected).toBe(false);
    });
  });
});

describe("Request errors", () => {
  let input, instance, server, onSearchError;
  const serviceUrl = "/some/url";

  const suggestRequests = () => server.requests.filter((request) => request.url.includes("/suggest/"));
  const search = (value) => {
    input.value = value;
    instance.onValueChange();
    return suggestRequests().at(-1);
  };

  beforeEach(() => {
    Suggestions.resetTokens();
    server = fakeServer.create();
    input = document.createElement("input");
    document.body.append(input);
    onSearchError = vi.fn();
    instance = new Suggestions(input, { serviceUrl, type: "country", onSearchError });
    helpers.returnGoodStatus(server);
  });

  afterEach(() => {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should report network error to `onSearchError`", async () => {
    const request = search("A");

    request.error();

    await expect.poll(() => onSearchError.mock.calls.length).toBe(1);
    expect(onSearchError.mock.calls[0][0]).toEqual("A");
    expect(onSearchError.mock.calls[0][2]).toEqual("error");
  });
  it("Should report timeout to `onSearchError`", async () => {
    const request = search("A");

    request.triggerTimeout();

    await expect.poll(() => onSearchError.mock.calls.length).toBe(1);
    expect(onSearchError.mock.calls[0][0]).toEqual("A");
    expect(onSearchError.mock.calls[0][2]).toEqual("timeout");
  });
  it("Should pass request timeout to XHR", () => {
    instance.setOptions({ timeout: 1234 });

    expect(search("A").timeout).toEqual(1234);
  });
  it("Should send `X-Partner` header if `partner` option set", () => {
    instance.setOptions({ partner: " partner-id " });

    expect(search("A").requestHeaders["X-Partner"]).toEqual("partner-id");
  });
});

describe("Public API", () => {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const countries = [
    { value: "Afghanistan", data: "Af" },
    { value: "Albania", data: "Al" },
  ];

  const suggestRequests = () => server.requests.filter((request) => /\/(?:suggest|findById)\//.test(request.url));
  const search = (value) => {
    input.value = value;
    instance.onValueChange();
    return suggestRequests().at(-1);
  };
  const create = (options) => {
    instance = new Suggestions(input, { serviceUrl, type: "country", geoLocation: false, ...options });
    helpers.returnGoodStatus(server);
  };

  beforeEach(() => {
    Suggestions.resetTokens();
    server = fakeServer.create();
    input = document.createElement("input");
    document.body.append(input);
  });

  afterEach(() => {
    instance?.dispose();
    input.remove();
    server.restore();
  });

  describe("clear()", () => {
    it("Should reset value and invalidate current selection", async () => {
      const onInvalidateSelection = vi.fn();
      const onClear = vi.fn();
      create({ onInvalidateSelection });
      input.addEventListener("suggestions-clear", onClear);
      search("A").respond(...helpers.responseFor(countries));
      await expect.poll(() => instance.visible).toBe(true);
      await instance.select(1);

      instance.clear();

      expect(input.value).toEqual("");
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(onInvalidateSelection).toHaveBeenCalledWith(expect.objectContaining({ value: "Albania" }));
    });

    it("Should hide dropdown and drop cached responses", async () => {
      create({});
      search("A").respond(...helpers.responseFor(countries));
      await expect.poll(() => instance.visible).toBe(true);

      instance.clear();
      expect(document.querySelector(".suggestions-suggestion")).toBeNull();
      search("A");

      expect(suggestRequests()).toHaveLength(2);
    });
  });
  it("Should throw on unknown `requestMode`", () => {
    expect(() => create({ requestMode: "unknown" })).toThrow('`requestMode` option is incorrect! Must be one of: "suggest", "findById"');
    instance = null;
  });

  describe("findById request mode", () => {
    const party = { value: "ПАО СБЕРБАНК", data: { inn: "7707083893", hid: "abc" } };

    it("Should select the first found suggestion without showing dropdown or changing value", async () => {
      const onSelect = vi.fn();
      create({ type: "PARTY", requestMode: "findById", onSelect });

      const request = search("7707083893");
      expect(request.url).toEqual(`${serviceUrl}/findById/party`);
      request.respond(...helpers.responseFor([party]));

      await expect.poll(() => onSelect.mock.calls.length).toBe(1);
      expect(onSelect.mock.calls[0][0]).toEqual(expect.objectContaining({ value: "ПАО СБЕРБАНК" }));
      expect(input.value).toEqual("7707083893");
      expect(instance.visible).toBe(false);
      expect(suggestRequests()).toHaveLength(1);
    });
  });
  it("Should hide dropdown on empty response when `noSuggestionsHint` is false", async () => {
    create({ noSuggestionsHint: false });
    search("A").respond(...helpers.responseFor(countries));
    await expect.poll(() => instance.visible).toBe(true);

    search("Ax").respond(...helpers.responseFor([]));

    await expect.poll(() => instance.visible).toBe(false);
    expect(document.querySelector(".suggestions-hint")).toBeNull();
  });
});
