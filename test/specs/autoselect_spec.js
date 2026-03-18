import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Autoselect", function () {
  const serviceUrl = "/some/url";

  beforeEach(function () {
    this.server = fakeServer.create();
    this.input = document.createElement("input");
    document.body.append(this.input);
    this.instance = new Suggestions(this.input, {
      serviceUrl,
      type: "ADDRESS",
      geoLocation: false,
    });
  });

  afterEach(function () {
    this.instance.dispose();
    this.input.remove();
    this.server.restore();
  });

  it("Should not autoselect first item by default", function () {
    this.instance.selectedIndex = -1;

    this.input.value = "Jam";
    this.instance.onValueChange();
    this.server.respond(helpers.responseFor(["Jamaica", "Jamaica", "Jamaica"]));

    expect(this.instance.selectedIndex).toBe(-1);
  });

  it("Should autoselect first item if autoSelectFirst set to true", function () {
    this.instance.setOptions({
      autoSelectFirst: true,
    });
    this.instance.selectedIndex = -1;

    this.input.value = "Jam";
    this.instance.onValueChange();
    this.server.respond(helpers.responseFor(["Jamaica", "Jamaica", "Jamaica"]));

    expect(this.instance.selectedIndex).toBe(0);
  });
});
