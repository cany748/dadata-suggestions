import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Keyboard navigation", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const suggestions = [
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
      type: "NAME",
    });

    helpers.returnGoodStatus(server);
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should select first suggestion on DOWN key in textbox", function () {
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    helpers.keydown(input, 40);

    expect(instance.selectedIndex).toBe(0);
    expect(input.value).toEqual(suggestions[0].value);
  });

  it("Should select last suggestion on UP key in textbox", function () {
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    helpers.keydown(input, 38);

    expect(instance.selectedIndex).toBe(2);
    expect(input.value).toEqual(suggestions[2].value);
  });

  it("Should select textbox on DOWN key in last suggestion", function () {
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    instance.selectedIndex = 2;
    helpers.keydown(input, 40);

    expect(instance.selectedIndex).toBe(-1);
    expect(input.value).toEqual("A");
  });
});
