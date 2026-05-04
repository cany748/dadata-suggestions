import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Autoselect", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";

  beforeEach(function () {
    server = fakeServer.create();
    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      geoLocation: false,
    });
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should not autoselect first item by default", function () {
    instance.selectedIndex = -1;

    input.value = "Jam";
    instance.onValueChange();
    server.respond(helpers.responseFor(["Jamaica", "Jamaica", "Jamaica"]));

    expect(instance.selectedIndex).toBe(-1);
  });

  it("Should autoselect first item if autoSelectFirst set to true", function () {
    instance.setOptions({
      autoSelectFirst: true,
    });
    instance.selectedIndex = -1;

    input.value = "Jam";
    instance.onValueChange();
    server.respond(helpers.responseFor(["Jamaica", "Jamaica", "Jamaica"]));

    expect(instance.selectedIndex).toBe(0);
  });
});
