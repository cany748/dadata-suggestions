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

  it("Should trigger on full match", function () {
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

    helpers.fireBlur(input);

    expect(options.onSelect.calls.count()).toEqual(1);
    expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[1]), false);
  });

  it("Should trigger when suggestion is selected manually", function () {
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

    instance.selectedIndex = 2;
    helpers.fireBlur(input);

    expect(options.onSelect.calls.count()).toEqual(1);
    expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[2]), true);
  });

  it("Should NOT trigger on partial match", function () {
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
    input.blur();

    expect(options.onSelect).not.toHaveBeenCalled();
  });

  it("Should NOT trigger when nothing matched", function () {
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
    input.blur();

    expect(options.onSelect).not.toHaveBeenCalled();
  });

  it("Should NOT trigger when triggerSelectOnBlur is false", function () {
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

    instance.selectedIndex = 0;
    helpers.fireBlur(input);

    expect(options.onSelect).not.toHaveBeenCalled();
  });
});
