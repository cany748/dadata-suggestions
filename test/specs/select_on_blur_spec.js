import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Select on blur", function () {
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
    });

    helpers.returnGoodStatus(server);
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should trigger on full match", async () => {
    const suggestions = [
      { value: "Afghanistan", data: "Af" },
      { value: "Albania", data: "Al" },
      { value: "Andorra", data: "An" },
    ];
    const options = {
      onSelect() {},
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);
    instance.selectedIndex = -1;

    input.value = "Albania";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);

    helpers.fireBlur(input);

    await expect.poll(() => options.onSelect.calls.count()).toEqual(1);
    expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[1]), false);
  });

  it("Should trigger when suggestion is selected manually", async () => {
    const suggestions = [
      { value: "Afghanistan", data: "Af" },
      { value: "Albania", data: "Al" },
      { value: "Andorra", data: "An" },
    ];
    const options = {
      onSelect() {},
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);

    instance.selectedIndex = 2;
    helpers.fireBlur(input);

    await expect.poll(() => options.onSelect.calls.count()).toEqual(1);
    expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[2]), true);
  });

  it("Should NOT trigger on partial match", async () => {
    const suggestions = [{ value: "Jamaica", data: "J" }];
    const options = {
      onSelect() {},
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);
    instance.selectedIndex = -1;

    input.value = "Jam";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
    input.blur();

    expect(options.onSelect).not.toHaveBeenCalled();
  });

  it("Should NOT trigger when nothing matched", async () => {
    const suggestions = [{ value: "Jamaica", data: "J" }];
    const options = {
      onSelect() {},
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);
    instance.selectedIndex = -1;

    input.value = "Alg";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
    input.blur();

    expect(options.onSelect).not.toHaveBeenCalled();
  });

  it("Should NOT trigger when triggerSelectOnBlur is false", async () => {
    const suggestions = [{ value: "Jamaica", data: "J" }];
    const options = {
      onSelect() {},
      triggerSelectOnBlur: false,
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);
    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);

    instance.selectedIndex = 0;
    helpers.fireBlur(input);

    expect(options.onSelect).not.toHaveBeenCalled();
  });
});

describe("Select on Blur after failed request", () => {
  let input, instance, server, onSearchError;
  const serviceUrl = "/some/url";
  const suggestions = [
    { value: "Afghanistan", data: "Af" },
    { value: "Albania", data: "Al" },
  ];

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

  it("Should not select anything on blur when the last request failed", async () => {
    const onSelect = vi.fn();
    instance.setOptions({ onSelect });
    search("A").respond(...helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
    search("Albania").respond(500, {}, "");
    await expect.poll(() => onSearchError.mock.calls.length).toBe(1);

    helpers.fireBlur(input);

    await expect.poll(() => instance.visible).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
