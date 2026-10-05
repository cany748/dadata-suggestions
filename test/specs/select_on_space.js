import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Select on Space", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";

  beforeEach(function () {
    Suggestions.resetTokens();

    server = helpers.createServer();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "NAME",
      deferRequestBy: 0,
      triggerSelectOnSpace: true,
    });

    helpers.returnGoodStatus(server);
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should trigger when suggestion is selected", async () => {
    const suggestions = [{ value: "Jamaica", data: "J" }];
    const options = {
      onSelect() {},
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);

    input.value = "Jam";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);

    instance.selectedIndex = 0;

    helpers.keydown(input, 32);

    await expect.poll(() => options.onSelect.calls.count()).toEqual(1);
    expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[0]), true);
  });

  it("Should trigger when nothing is selected but there is exact match", async () => {
    const suggestions = [{ value: "Jamaica", data: "J" }];
    const options = {
      onSelect() {},
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);
    instance.selectedIndex = -1;

    input.value = "Jamaica";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);

    helpers.keydown(input, 32); // code of space

    await expect.poll(() => options.onSelect.calls.count()).toEqual(1);
    expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[0]), true);
  });

  it("Should NOT trigger when triggerSelectOnSpace = false", async () => {
    const suggestions = [{ value: "Jamaica", data: "J" }];
    const options = {
      triggerSelectOnSpace: false,
      onSelect() {},
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);

    input.value = "Jam";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);

    instance.selectedIndex = 0;
    helpers.keydown(input, 32); // code of space

    expect(options.onSelect).not.toHaveBeenCalled();
  });

  it("Should keep SPACE if selecting has been caused by space", async () => {
    const suggestions = [
      {
        value: "name",
        data: { name: "name" },
      },
      {
        value: "name surname",
        data: { name: "name", surname: "surname" },
      },
    ];
    const options = { onSelect: () => {} };

    spyOn(options, "onSelect");
    instance.setOptions(options);

    input.value = "name";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);

    instance.selectedIndex = 0;
    helpers.keydown(input, 32);

    await expect.poll(() => options.onSelect.calls.count()).toEqual(1);
    expect(input.value).toEqual("name ");
  });
});

describe("Select on Space with keyboard", () => {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const suggestions = [
    { value: "Afghanistan", data: "Af" },
    { value: "Albania", data: "Al" },
    { value: "Andorra", data: "An" },
  ];

  const keydown = (keyCode) => {
    const event = new KeyboardEvent("keydown", { keyCode, which: keyCode, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    return event;
  };
  const type = (value) => {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  };
  const suggestRequests = () => server.requests.filter((request) => request.url.includes("/suggest/"));
  const queryOf = (request) => JSON.parse(request.requestBody).query;

  const showSuggestions = async (options) => {
    instance = new Suggestions(input, { serviceUrl, type: "country", deferRequestBy: 0, ...options });
    helpers.returnGoodStatus(server);
    type("A");
    suggestRequests()[0].respond(...helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
  };

  beforeEach(() => {
    Suggestions.resetTokens();
    server = helpers.createServer();
    input = document.createElement("input");
    document.body.append(input);
  });

  afterEach(() => {
    instance.dispose();
    input.remove();
    server.restore();
  });

  describe("SPACE with `triggerSelectOnSpace`", () => {
    it("Should insert space and search further if nothing matched", async () => {
      const onSelect = vi.fn();
      await showSuggestions({ triggerSelectOnSpace: true, onSelect });

      keydown(32);

      await expect.poll(() => input.value).toEqual("A ");
      expect(suggestRequests().map(queryOf)).toEqual(["A", "A "]);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("Should not intercept space typed in the middle of the value", async () => {
      await showSuggestions({ triggerSelectOnSpace: true });
      keydown(40);
      input.setSelectionRange(0, 0);

      expect(keydown(32).defaultPrevented).toBe(false);
    });
  });
});
