import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Select on Space", function () {
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

  it("Should trigger when suggestion is selected", function () {
    const suggestions = [{ value: "Jamaica", data: "J" }];
    const options = {
      onSelect() {},
    };
    spyOn(options, "onSelect");

    instance.setOptions(options);

    input.value = "Jam";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));

    instance.selectedIndex = 0;

    helpers.keydown(input, 32);

    expect(options.onSelect.calls.count()).toEqual(1);
    expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[0]), true);
  });

  it("Should trigger when nothing is selected but there is exact match", function () {
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

    helpers.keydown(input, 32); // code of space

    expect(options.onSelect.calls.count()).toEqual(1);
    expect(options.onSelect).toHaveBeenCalledWith(helpers.appendUnrestrictedValue(suggestions[0]), true);
  });

  it("Should NOT trigger when triggerSelectOnSpace = false", function () {
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

    instance.selectedIndex = 0;
    helpers.keydown(input, 32); // code of space

    expect(options.onSelect).not.toHaveBeenCalled();
  });

  it("Should keep SPACE if selecting has been caused by space", function () {
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

    instance.selectedIndex = 0;
    helpers.keydown(input, 32);

    expect(options.onSelect.calls.count()).toEqual(1);
    expect(input.value).toEqual("name ");
  });
});
