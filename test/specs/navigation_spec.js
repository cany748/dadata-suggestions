import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Keyboard navigation", function () {
  const serviceUrl = "/some/url";
  const suggestions = [
    { value: "Afghanistan", data: "Af" },
    { value: "Albania", data: "Al" },
    { value: "Andorra", data: "An" },
  ];

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

  it("Should select first suggestion on DOWN key in textbox", function () {
    this.instance.selectedIndex = -1;

    this.input.value = "A";
    this.instance.onValueChange();
    this.server.respond(helpers.responseFor(suggestions));
    helpers.keydown(this.input, 40);

    expect(this.instance.selectedIndex).toBe(0);
    expect(this.input.value).toEqual(suggestions[0].value);
  });

  it("Should select last suggestion on UP key in textbox", function () {
    this.instance.selectedIndex = -1;

    this.input.value = "A";
    this.instance.onValueChange();
    this.server.respond(helpers.responseFor(suggestions));
    helpers.keydown(this.input, 38);

    expect(this.instance.selectedIndex).toBe(2);
    expect(this.input.value).toEqual(suggestions[2].value);
  });

  it("Should select textbox on DOWN key in last suggestion", function () {
    this.instance.selectedIndex = -1;

    this.input.value = "A";
    this.instance.onValueChange();
    this.server.respond(helpers.responseFor(suggestions));
    this.instance.selectedIndex = 2;
    helpers.keydown(this.input, 40);

    expect(this.instance.selectedIndex).toBe(-1);
    expect(this.input.value).toEqual("A");
  });
});
