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
    it("Should get current value", function () {
      input.value = "Jam";
      instance.onValueChange();

      server.respond(helpers.responseFor([{ value: "Jamaica", data: "B" }]));

      expect(instance.visible).toBe(true);
      expect(instance.currentValue).toEqual("Jam");
    });

    it("Should convert suggestions format", function () {
      input.value = "A";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Alex", "Ammy", "Anny"]));
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

    it("Should set width to be greater than zero", function () {
      input.value = "Jam";
      instance.onValueChange();
      server.respond(helpers.responseFor([{ value: "Jamaica", data: "B" }]));
      expect(instance.container.offsetWidth).toBeGreaterThan(0);
    });

    it("Should call beforeRender and pass container element", function () {
      const options = {
        beforeRender() {},
      };
      spyOn(options, "beforeRender");
      instance.setOptions(options);

      input.value = "Jam";
      instance.onValueChange();
      server.respond(helpers.responseFor([{ value: "Jamaica", data: "B" }]));

      expect(options.beforeRender.calls.count()).toEqual(1);
      expect(options.beforeRender).toHaveBeenCalledWith(instance.container);
    });

    it("Should prevent Ajax requests if previous query with matching root failed.", function () {
      instance.setOptions({ preventBadQueries: true });
      input.value = "Jam";
      instance.onValueChange();

      expect(server.requests.length).toEqual(1);
      server.respond(helpers.responseFor([]));

      input.value = "Jama";
      instance.onValueChange();

      expect(server.requests.length).toEqual(1);

      input.value = "Jamai";
      instance.onValueChange();

      expect(server.requests.length).toEqual(1);
    });
  });

  describe("onSelect callback", function () {
    it("Verify onSelect callback (fully changed)", function () {
      const suggestions = [{ value: "Abcdef", data: "B" }];
      const options = {
        onSelect() {},
      };
      spyOn(options, "onSelect");

      instance.setOptions(options);
      input.value = "A";
      instance.onValueChange();
      server.respond(helpers.responseFor(suggestions));
      instance.select(0);

      expect(options.onSelect.calls.count()).toEqual(1);
      expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[0]), true);
    });

    it("Verify onSelect callback (just enriched)", function () {
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
      instance.select(0);

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

    it("invoked", function () {
      const options = {
        onSuggestionsFetch() {},
      };

      spyOn(options, "onSuggestionsFetch");

      instance.setOptions(options);

      server.respond(helpers.responseFor(suggestions));

      expect(options.onSuggestionsFetch.calls.count()).toEqual(1);
      expect(options.onSuggestionsFetch).toHaveBeenCalledWith(suggestions);
    });

    it("can modify argument", function () {
      instance.setOptions({
        onSuggestionsFetch(suggestions) {
          // Move first option to the end
          suggestions.push(suggestions.shift());
        },
      });

      server.respond(helpers.responseFor(suggestions));

      const items = instance.container.querySelectorAll(".suggestions-suggestion");

      // Second option become first
      expect(items[0]).toContainText(suggestions[1].value);
      expect(items[1]).toContainText(suggestions[2].value);
      // First option become last
      expect(items[2]).toContainText(suggestions[0].value);
    });

    it("can use returned array", function () {
      instance.setOptions({
        onSuggestionsFetch(suggestions) {
          // Return new array
          return [suggestions[1], suggestions[2], suggestions[0]];
        },
      });

      server.respond(helpers.responseFor(suggestions));

      const items = instance.container.querySelectorAll(".suggestions-suggestion");

      // Second option become first
      expect(items[0]).toContainText(suggestions[1].value);
      expect(items[1]).toContainText(suggestions[2].value);
      // First option become last
      expect(items[2]).toContainText(suggestions[0].value);
    });
  });

  describe("Hint message", function () {
    it("Should display default hint message above suggestions", function () {
      input.value = "jam";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Jamaica"]));

      const hints = instance.container.querySelectorAll(".suggestions-hint");

      expect(hints.length).toEqual(1);
      expect(hints[0].textContent).toEqual(DEFAULT_OPTIONS.hint);
    });

    it("Should display custom hint message above suggestions", function () {
      const customHint = "This is custon hint";
      instance.setOptions({
        hint: customHint,
      });

      input.value = "jam";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Jamaica"]));

      const hints = instance.container.querySelectorAll(".suggestions-hint");

      expect(hints.length).toEqual(1);
      expect(hints[0].textContent).toEqual(customHint);
    });

    it("Should not display any hint message above suggestions", function () {
      instance.setOptions({
        hint: false,
      });

      input.value = "jam";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Jamaica"]));

      const hints = instance.container.querySelectorAll(".suggestions-hint");

      expect(hints.length).toEqual(0);
    });

    it("Should not display any hint message for narrow-screen (mobile) view", function () {
      instance.setOptions({
        hint: false,
        mobileWidth: 20_000,
      });

      input.value = "jam";
      instance.onValueChange();
      server.respond(helpers.responseFor(["Jamaica"]));

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
