import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Element events", function () {
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

  it("`suggestions-select` should be triggered", function () {
    const suggestion = { value: "A", data: "B" };
    let eventArgs;

    input.addEventListener("suggestions-select", function (e) {
      eventArgs = e.detail;
    });

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor([suggestion]));
    instance.select(0);

    expect(eventArgs).toEqual([helpers.appendUnrestrictedValue(suggestion), true]);
  });

  it("`suggestions-selectnothing` should be triggered", function () {
    let eventArgs;

    input.addEventListener("suggestions-selectnothing", function (e) {
      eventArgs = e.detail;
    });

    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    helpers.hitEnter(input);

    expect(eventArgs).toEqual(["A"]);
  });

  it("`suggestions-invalidateselection` should be triggered", function () {
    const suggestion = { value: "A", data: "B" };
    let eventArgs;

    input.addEventListener("suggestions-invalidateselection", function (e) {
      eventArgs = e.detail;
    });

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor([suggestion]));
    instance.select(0);

    input.value = "Aaaa";
    instance.onValueChange();
    helpers.hitEnter(input);

    expect(eventArgs).toEqual([helpers.appendUnrestrictedValue(suggestion)]);
  });

  it("`suggestions-dispose` should be triggered", function () {
    const parentInput = document.createElement("input");
    document.body.append(parentInput);
    const parentInstance = new Suggestions(parentInput, {
      type: "ADDRESS",
      serviceUrl,
      geoLocation: false,
    });

    spyOn(instance, "onParentDispose");

    instance.setOptions({
      constraints: parentInput,
    });

    parentInstance.dispose();
    parentInput.remove();

    expect(instance.onParentDispose).toHaveBeenCalled();
  });

  it("`suggestions-set` should be triggered", function () {
    let triggered = false;
    input.addEventListener("suggestions-set", () => {
      triggered = true;
    });

    instance.setSuggestion({
      value: "somethind",
      data: {},
    });

    expect(triggered).toBe(true);
  });

  it("`suggestions-fixdata` should be triggered", function () {
    let triggered = false;
    input.addEventListener("suggestions-fixdata", () => {
      triggered = true;
    });

    input.value = "г Москва";
    instance.fixData();

    server.respond("GET", /address/, [
      200,
      { "Content-type": "application/json" },
      JSON.stringify([
        {
          value: "г Москва",
          data: {},
        },
      ]),
    ]);

    expect(triggered).toBe(true);
  });
});
