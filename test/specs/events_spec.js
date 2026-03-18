import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Element events", function () {
  const serviceUrl = "/some/url";

  beforeEach(function () {
    Suggestions.resetTokens();

    this.server = fakeServer.create();

    this.input = document.createElement("input");
    document.body.append(this.input);
    this.instance = new Suggestions(this.input, {
      serviceUrl,
      type: "NAME",
    });

    helpers.returnGoodStatus(this.server);
  });

  afterEach(function () {
    this.instance.dispose();
    this.input.remove();
    this.server.restore();
  });

  it("`suggestions-select` should be triggered", function () {
    const suggestion = { value: "A", data: "B" };
    let eventArgs;

    this.input.addEventListener("suggestions-select", function (e) {
      eventArgs = e.detail;
    });

    this.input.value = "A";
    this.instance.onValueChange();
    this.server.respond(helpers.responseFor([suggestion]));
    this.instance.select(0);

    expect(eventArgs).toEqual([helpers.appendUnrestrictedValue(suggestion), true]);
  });

  it("`suggestions-selectnothing` should be triggered", function () {
    let eventArgs;

    this.input.addEventListener("suggestions-selectnothing", function (e) {
      eventArgs = e.detail;
    });

    this.instance.selectedIndex = -1;

    this.input.value = "A";
    this.instance.onValueChange();
    helpers.hitEnter(this.input);

    expect(eventArgs).toEqual(["A"]);
  });

  it("`suggestions-invalidateselection` should be triggered", function () {
    const suggestion = { value: "A", data: "B" };
    let eventArgs;

    this.input.addEventListener("suggestions-invalidateselection", function (e) {
      eventArgs = e.detail;
    });

    this.input.value = "A";
    this.instance.onValueChange();
    this.server.respond(helpers.responseFor([suggestion]));
    this.instance.select(0);

    this.input.value = "Aaaa";
    this.instance.onValueChange();
    helpers.hitEnter(this.input);

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

    spyOn(this.instance, "onParentDispose");

    this.instance.setOptions({
      constraints: parentInput,
    });

    parentInstance.dispose();
    parentInput.remove();

    expect(this.instance.onParentDispose).toHaveBeenCalled();
  });

  it("`suggestions-set` should be triggered", function () {
    let triggered = false;
    this.input.addEventListener("suggestions-set", () => {
      triggered = true;
    });

    this.instance.setSuggestion({
      value: "somethind",
      data: {},
    });

    expect(triggered).toBe(true);
  });

  it("`suggestions-fixdata` should be triggered", function () {
    let triggered = false;
    this.input.addEventListener("suggestions-fixdata", () => {
      triggered = true;
    });

    this.input.value = "г Москва";
    this.instance.fixData();

    this.server.respond("GET", /address/, [
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
