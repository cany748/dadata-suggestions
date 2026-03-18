import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Email", function () {
  const serviceUrl = "/some/url";

  beforeEach(function () {
    Suggestions.resetTokens();

    this.server = fakeServer.create();

    this.input = document.createElement("input");
    document.body.append(this.input);
    this.instance = new Suggestions(this.input, {
      serviceUrl,
      type: "EMAIL",
      // disable mobile view features
      mobileWidth: Number.NaN,
    });

    helpers.returnGoodStatus(this.server);
    this.server.requests.length = 0;
  });

  afterEach(function () {
    this.instance.dispose();
    this.input.remove();
    this.server.restore();
  });

  it("Should not request until @ typed", function () {
    this.instance.setOptions({
      suggest_local: false,
    });

    this.input.value = "jam";
    this.instance.onValueChange();

    expect(this.server.requests.length).toEqual(0);
  });
});
