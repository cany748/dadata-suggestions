import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Nothing selected callback", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const fixtures = [
    { value: "Afghanistan", data: "Af" },
    { value: "Albania", data: "Al" },
    { value: "Andorra", data: "An" },
  ];

  beforeEach(function () {
    Suggestions.resetTokens();

    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      onSelect: () => {},
      geoLocation: false,
    });

    helpers.returnGoodStatus(server);

    server.respond();
    server.requests.length = 0;
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should be triggered on ENTER pressed with no suggestions visible", function () {
    const options = {
      onSelectNothing() {},
    };
    spyOn(options, "onSelectNothing");

    instance.setOptions(options);
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    helpers.hitEnter(input);

    expect(options.onSelectNothing.calls.count()).toEqual(1);
    expect(options.onSelectNothing).toHaveBeenCalledWith("A");
  });

  it("Should be triggered on ENTER pressed with no matching suggestion", function () {
    const options = {
      onSelectNothing() {},
    };
    spyOn(options, "onSelectNothing");

    instance.setOptions(options);
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures));

    helpers.hitEnter(input);

    expect(options.onSelectNothing.calls.count()).toEqual(1);
    expect(options.onSelectNothing).toHaveBeenCalledWith("A");
  });

  it("Should be triggered when focus lost and no matching suggestion", function () {
    const options = {
      onSelectNothing() {},
    };
    spyOn(options, "onSelectNothing");

    instance.setOptions(options);
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(fixtures));

    helpers.fireBlur(input);

    expect(options.onSelectNothing.calls.count()).toEqual(1);
    expect(options.onSelectNothing).toHaveBeenCalledWith("A");
  });
});
